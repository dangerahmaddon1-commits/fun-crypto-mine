import { getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onIdTokenChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, runTransaction, collection, query,
  where, getDocs, getCountFromServer, addDoc, updateDoc, serverTimestamp, Timestamp, limit
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const auth=getAuth(getApp());
const db=getFirestore(getApp());
const $=id=>document.getElementById(id);
const OWNER_EMAIL="dangerahmaddon1@gmail.com";
let activeUser=null;
let isOwner=false;

function setText(id,value){const node=$(id);if(node)node.textContent=value}
function safeDate(value){
  if(!value)return "Date pending";
  const date=value.toDate?value.toDate():new Date(value);
  return Number.isNaN(date.getTime())?"Date pending":date.toLocaleDateString();
}
async function walletApi(user,payload){
  const token=await user.getIdToken();
  const response=await fetch("/api/wallet",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
    body:JSON.stringify(payload)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||"Wallet request failed.");
  return result;
}
async function loadActivityLedger(user){
  const container=$("activity-ledger");
  if(!container)return;
  try{
    const snapshot=await getDocs(query(collection(db,"contractLedger"),where("uid","==",user.uid),limit(100)));
    container.replaceChildren();
    if(snapshot.empty){showMessage(container,"No reward activity yet");return}
    const entries=snapshot.docs.map(item=>({id:item.id,...item.data()}));
    entries.sort((a,b)=>{
      const at=a.createdAt?.toMillis?a.createdAt.toMillis():0;
      const bt=b.createdAt?.toMillis?b.createdAt.toMillis():0;
      return bt-at;
    });
    entries.forEach(data=>{
      const row=document.createElement("div");row.className="fcm-request-row";
      const details=document.createElement("div");
      const heading=document.createElement("strong");
      heading.textContent=data.type==="usdt_withdrawal"?"USDT withdrawal":data.type==="contract_session_reward"?"Completed reward session":"Account adjustment";
      const meta=document.createElement("div");meta.className="fcm-request-meta";
      meta.textContent=safeDate(data.createdAt)+(data.amountUsdt?(" · "+Number(data.amountUsdt).toFixed(2)+" USDT"):"");
      const points=document.createElement("span");points.className="fcm-request-status";
      const amount=Number(data.points||0);
      points.textContent=(amount>0?"+":"")+(amount.toLocaleString())+" pts";
      details.append(heading,meta);row.append(details,points);container.append(row);
    });
  }catch(error){showMessage(container,"Could not load account activity.");console.error("Activity ledger unavailable:",error)}
}
async function loadWalletBalance(user){
  try{
    const result=await walletApi(user,{action:"balance"});
    const balance=result.balance||{};
    setText("wallet-balance-points",Number(balance.availablePoints||0).toLocaleString()+" pts");
    setText("wallet-balance-usdt",Number(balance.availableUsdt||0).toFixed(2)+" USDT");
    setText("wallet-reserved-points",Number(balance.reservedPoints||0).toLocaleString()+" pts reserved");
    const amount=$("withdrawal-amount");
    if(amount)amount.max=String(Math.min(100000,Number(balance.availableUsdt||0)));
  }catch(error){
    setText("wallet-balance-points","Unavailable");
    setText("wallet-balance-usdt","Unavailable");
    console.error("Wallet balance unavailable:",error);
  }
}
function makeCode(){
  const bytes=new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[value%32]).join("");
}
function showMessage(container,message){
  if(!container)return;
  container.replaceChildren();
  const box=document.createElement("div");
  box.className="empty";
  const strong=document.createElement("b");
  strong.textContent=message;
  box.append(strong);
  container.append(box);
}
async function verifyOwner(user){
  if(!user||String(user.email||"").toLowerCase()!==OWNER_EMAIL)return false;
  const token=await user.getIdTokenResult();
  return token.claims.email_verified===true&&token.claims.firebase?.sign_in_provider==="custom"&&Number(token.claims.adminVerifiedUntil||0)>Math.floor(Date.now()/1000);
}
async function ensureProfile(user){
  const userRef=doc(db,"users",user.uid);
  const existing=await getDoc(userRef);
  if(existing.exists()){
    const profile=existing.data();
    if(!profile.referralCode){
      throw new Error("Your profile is missing an invite code. Contact support before continuing.");
    }
    return profile;
  }
  const referralInput=(new URLSearchParams(location.search).get("ref")||"").trim().toUpperCase();
  for(let attempt=0;attempt<5;attempt++){
    const code=makeCode();
    const codeRef=doc(db,"referralCodes",code);
    const referrerRef=referralInput?doc(db,"referralCodes",referralInput):null;
    try{
      return await runTransaction(db,async transaction=>{
        const userSnap=await transaction.get(userRef);
        if(userSnap.exists())return userSnap.data();
        const codeSnap=await transaction.get(codeRef);
        if(codeSnap.exists())throw new Error("Invite code collision. Retry.");
        let referrerUid=null;
        if(referrerRef){
          const referrerSnap=await transaction.get(referrerRef);
          if(referrerSnap.exists()&&referrerSnap.data().uid!==user.uid)referrerUid=referrerSnap.data().uid;
        }
        const profile={
          uid:user.uid,email:user.email||"",displayName:user.displayName||"",
          referralCode:code,referredBy:referrerUid,
          createdAt:serverTimestamp(),updatedAt:serverTimestamp()
        };
        transaction.set(userRef,profile);
        transaction.set(codeRef,{uid:user.uid,createdAt:serverTimestamp()});
        if(referrerUid){
          transaction.set(doc(db,"referralEvents",user.uid),{
            referrerUid,referredUid:user.uid,referralCode:referralInput,createdAt:serverTimestamp()
          });
        }
        return profile;
      });
    }catch(error){
      if(!String(error.message||"").includes("collision"))throw error;
    }
  }
  throw new Error("Could not create a unique invite code. Please retry.");
}
async function loadReferralData(user,profile){
  const code=profile.referralCode;
  const link=new URL(location.origin+location.pathname);
  link.searchParams.set("ref",code);
  setText("referral-code",code);
  setText("referral-link",link.toString());
  const copyCode=$("referral-copy-code"),copyLink=$("referral-copy-link");
  if(copyCode)copyCode.onclick=()=>navigator.clipboard.writeText(code).then(()=>copyCode.textContent="Copied").catch(()=>copyCode.textContent="Copy unavailable");
  if(copyLink)copyLink.onclick=()=>navigator.clipboard.writeText(link.toString()).then(()=>copyLink.textContent="Copied").catch(()=>copyLink.textContent="Copy unavailable");
  const q=query(collection(db,"referralEvents"),where("referrerUid","==",user.uid),limit(100));
  const snapshot=await getDocs(q);
  setText("referral-count",String(snapshot.size));
  const list=$("referral-list");
  if(!list)return;
  list.replaceChildren();
  if(snapshot.empty){showMessage(list,"No referrals yet");return}
  snapshot.forEach(item=>{
    const data=item.data(),row=document.createElement("div");
    row.className="fcm-request-row";
    const details=document.createElement("div");
    const heading=document.createElement("strong");
    heading.textContent="New referred account";
    const meta=document.createElement("div");
    meta.className="fcm-request-meta";
    meta.textContent="Joined "+safeDate(data.createdAt)+" · "+(data.rewardStatus==="credited"?"20-point reward credited":"Reward review pending");
    details.append(heading,meta);row.append(details);list.append(row);
  });
}
async function loadMembership(user){
  const box=$("membership-current");
  if(!box)return;
  try{
    const snap=await getDoc(doc(db,"memberships",user.uid));
    box.replaceChildren();
    if(!snap.exists()){showMessage(box,"Free membership");return}
    const data=snap.data();
    const expired=data.expiresAt?.toDate&&data.expiresAt.toDate().getTime()<=Date.now();
    const title=document.createElement("strong");
    title.textContent=(data.planId||"Member").toUpperCase()+" · "+(expired?"expired":(data.status||"unknown"));
    const detail=document.createElement("p");
    detail.className="fcm-request-meta";
    detail.textContent="Valid until "+safeDate(data.expiresAt)+". Membership provides software features only; no earnings or returns are promised.";
    box.append(title,detail);
  }catch(error){showMessage(box,"Membership status unavailable");console.error(error)}
}
async function loadMembershipRequestStatus(user){
  const status=$("membership-request-status");
  if(!status)return;
  try{
    const snap=await getDoc(doc(db,"membershipRequests",user.uid));
    if(!snap.exists()){status.textContent="No membership review request submitted.";return}
    const data=snap.data();
    status.textContent="Latest request: "+String(data.planId||"").toUpperCase()+" · "+(data.status||"pending")+".";
  }catch(error){status.textContent="Membership request status unavailable.";console.error(error)}
}

async function loadAccountSettings(user){
  const nameField=$("profile-display-name"),emailField=$("profile-email");
  if(nameField)nameField.value=user.displayName||"";
  if(emailField)emailField.value=user.email||"";
  const hasPasswordProvider=(user.providerData||[]).some(item=>item.providerId==="password");
  const resetButton=$("profile-password-reset"),note=$("profile-password-note");
  if(resetButton)resetButton.hidden=!hasPasswordProvider;
  if(note)note.textContent=hasPasswordProvider
    ?"Send a password-reset link to your sign-in email."
    :"This account uses Google sign-in. Manage its password through your Google account.";
}
async function saveAccountProfile(event){
  event.preventDefault();
  if(!activeUser)return;
  const field=$("profile-display-name"),button=$("profile-save"),message=$("profile-message");
  const displayName=(field?.value||"").trim();
  if(displayName.length<3||displayName.length>30){
    if(message)message.textContent="Display name must be between 3 and 30 characters.";
    return;
  }
  if(button)button.disabled=true;
  if(message)message.textContent="Saving profile…";
  try{
    await updateProfile(activeUser,{displayName});
    await updateDoc(doc(db,"users",activeUser.uid),{displayName,updatedAt:serverTimestamp()});
    if(message)message.textContent="Profile updated successfully.";
    await loadAccountSettings(activeUser);
  }catch(error){
    if(message)message.textContent=error.code==="auth/requires-recent-login"
      ?"For security, sign out and sign in again before changing your profile."
      :"Could not save your profile. Please retry.";
    console.error("Profile update failed:",error);
  }finally{if(button)button.disabled=false}
}
async function sendAccountPasswordReset(){
  if(!activeUser?.email)return;
  const button=$("profile-password-reset"),message=$("profile-password-message");
  if(button)button.disabled=true;
  if(message)message.textContent="Sending password-reset email…";
  try{
    await sendPasswordResetEmail(auth,activeUser.email);
    if(message)message.textContent="If the account supports email/password sign-in, a reset link has been sent.";
  }catch(error){
    if(message)message.textContent="Could not send the reset email. Please try again later.";
    console.error("Password reset request failed:",error);
  }finally{if(button)button.disabled=false}
}

async function requestMembership(planId){
  if(!activeUser){window.dispatchEvent(new CustomEvent("fcm-open-auth",{detail:{mode:"signup"}}));return}
  if(!["starter","pro"].includes(planId))return;
  const button=document.querySelector('[data-membership-request="'+planId+'"]');
  if(button)button.disabled=true;
  try{
    const requestRef=doc(db,"membershipRequests",activeUser.uid);
    await runTransaction(db,async transaction=>{
      const existing=await transaction.get(requestRef);
      if(existing.exists()&&existing.data().status==="pending")throw new Error("You already have a pending membership request.");
      const requestData={
        uid:activeUser.uid,planId,status:"pending",
        displayName:activeUser.displayName||"",email:activeUser.email||"",
        createdAt:serverTimestamp()
      };
      if(existing.exists())transaction.update(requestRef,requestData);
      else transaction.set(requestRef,requestData);
    });
    if(button)button.textContent="Request submitted";
    await loadMembershipRequestStatus(activeUser);
    await loadMembershipRequests();
  }catch(error){
    if(button){button.disabled=false;button.textContent="Request manual review"}
    alert(error.message||"Could not submit your request. Check that Firestore rules have been published.");
  }
}
function renderRequestRow(container,requestId,data){
  const row=document.createElement("div");row.className="fcm-request-row";
  const details=document.createElement("div");
  const heading=document.createElement("strong");
  heading.textContent=(data.planId||"Plan").toUpperCase()+" membership request";
  const meta=document.createElement("div");meta.className="fcm-request-meta";
  meta.textContent=(data.displayName||"Member")+" · "+(data.email||"No email")+" · "+safeDate(data.createdAt);
  const status=document.createElement("span");status.className="fcm-request-status";status.textContent=data.status||"pending";
  details.append(heading,meta,status);row.append(details);
  if(isOwner&&data.status==="pending"){
    const actions=document.createElement("div");actions.className="fcm-request-actions";
    const activate=document.createElement("button");activate.className="btn primary";activate.textContent="Activate 30 days";
    activate.onclick=()=>resolveMembershipRequest(requestId,data,true);
    const reject=document.createElement("button");reject.className="btn";reject.textContent="Reject";
    reject.onclick=()=>resolveMembershipRequest(requestId,data,false);
    actions.append(activate,reject);row.append(actions);
  }
  container.append(row);
}
async function loadAdminOverview(){
  if(!isOwner)return;
  const status=$("admin-stats-status");
  const button=$("admin-stats-refresh");
  if(button)button.disabled=true;
  if(status)status.textContent="Refreshing live Firestore counts…";
  try{
    const since=Timestamp.fromDate(new Date(Date.now()-30*24*60*60*1000));
    const counts=await Promise.all([
      getCountFromServer(collection(db,"users")),
      getCountFromServer(query(collection(db,"users"),where("createdAt",">=",since))),
      getCountFromServer(query(collection(db,"memberships"),where("expiresAt",">",Timestamp.now()))),
      getCountFromServer(query(collection(db,"membershipRequests"),where("status","==","pending"))),
      getCountFromServer(query(collection(db,"withdrawalRequests"),where("status","in",["pending","approved"]))),
      getCountFromServer(collection(db,"referralEvents"))
    ]);
    const ids=["admin-stat-users","admin-stat-new-users","admin-stat-memberships","admin-stat-membership-pending","admin-stat-withdrawals","admin-stat-referrals"];
    counts.forEach((item,index)=>setText(ids[index],item.data().count.toLocaleString()));
    if(status)status.textContent="Updated "+new Date().toLocaleString()+". Counts reflect Firestore records, not website visits.";
  }catch(error){
    if(status)status.textContent="Could not load live counts. Confirm Firestore rules are published and admin access is active.";
    console.error("Admin overview unavailable:",error);
  }finally{if(button)button.disabled=false}
}

async function loadMembershipRequests(){
  const container=$("admin-membership-queue");
  if(!container||!isOwner)return;
  try{
    const q=query(collection(db,"membershipRequests"),limit(100));
    const snapshot=await getDocs(q);
    container.replaceChildren();
    if(snapshot.empty){showMessage(container,"No membership requests");return}
    snapshot.forEach(item=>renderRequestRow(container,item.id,item.data()));
  }catch(error){showMessage(container,"Could not load requests. Check Firestore rules.");console.error(error)}
}
async function resolveMembershipRequest(requestId,data,approve){
  if(!isOwner||!activeUser)return;
  const days=30;
  const requestRef=doc(db,"membershipRequests",requestId);
  const memberRef=doc(db,"memberships",data.uid);
  const auditRef=doc(collection(db,"adminAuditLogs"));
  try{
    await runTransaction(db,async transaction=>{
      const requestSnap=await transaction.get(requestRef);
      if(!requestSnap.exists()||requestSnap.data().status!=="pending")throw new Error("This request has already been processed.");
      const now=Timestamp.now();
      if(approve){
        transaction.set(memberRef,{
          uid:data.uid,planId:data.planId,status:"active",
          startedAt:now,expiresAt:Timestamp.fromMillis(now.toMillis()+days*24*60*60*1000),
          updatedAt:serverTimestamp(),updatedBy:activeUser.uid
        });
      }
      transaction.update(requestRef,{status:approve?"approved":"rejected",reviewedAt:serverTimestamp(),reviewedBy:activeUser.uid});
      transaction.set(auditRef,{
        actorUid:activeUser.uid,action:approve?"membership_activated":"membership_request_rejected",
        targetUid:data.uid,targetId:requestId,createdAt:serverTimestamp()
      });
    });
    await loadMembershipRequests();
  }catch(error){alert(error.message||"Could not update this request.");console.error(error)}
}

async function loadWithdrawalRequests(user){
  const history=$("withdrawal-history");
  if(history){
    try{
      const ownQuery=query(collection(db,"withdrawalRequests"),where("uid","==",user.uid),limit(50));
      const own=await getDocs(ownQuery);
      history.replaceChildren();
      if(own.empty)showMessage(history,"No withdrawal requests yet");
      else own.forEach(item=>renderWithdrawalRow(history,item.id,item.data(),false));
    }catch(error){showMessage(history,"Could not load your requests. Check Firestore rules.");console.error(error)}
  }
  if(isOwner)await loadAdminWithdrawalRequests();
}
function renderWithdrawalRow(container,id,data,adminView){
  const row=document.createElement("div");row.className="fcm-request-row";
  const details=document.createElement("div");
  const heading=document.createElement("strong");
  heading.textContent=Number(data.amount).toFixed(2)+" USDT · "+(data.network||"Network not specified");
  const meta=document.createElement("div");meta.className="fcm-request-meta";
  meta.textContent=(adminView?((data.email||data.uid)+" · "+(data.walletAddress||"No address")+" · "):"")+(data.status==="paid"&&data.paymentReference?("Paid · Tx ref: "+data.paymentReference+" · "):"")+safeDate(data.createdAt);
  const status=document.createElement("span");status.className="fcm-request-status";status.textContent=data.status||"pending";
  details.append(heading,meta,status);row.append(details);
  if(adminView&&isOwner){
    const actions=document.createElement("div");actions.className="fcm-request-actions";
    if(data.status==="pending"){
      const approve=document.createElement("button");approve.className="btn primary";approve.textContent="Approve";
      approve.onclick=()=>resolveWithdrawalRequest(id,"approved");
      const reject=document.createElement("button");reject.className="btn";reject.textContent="Reject";
      reject.onclick=()=>resolveWithdrawalRequest(id,"rejected");
      actions.append(approve,reject);
    }else if(data.status==="approved"){
      const paid=document.createElement("button");paid.className="btn primary";paid.textContent="Mark paid";
      paid.onclick=()=>{const reference=prompt("Enter the external transaction reference after you have sent the USDT:");if(reference)resolveWithdrawalRequest(id,"paid",reference.trim())};
      actions.append(paid);
    }
    if(actions.childElementCount)row.append(actions);
  }
  container.append(row);
}
async function loadAdminWithdrawalRequests(){
  const container=$("admin-withdrawal-queue");
  if(!container||!isOwner)return;
  try{
    const snapshot=await getDocs(query(collection(db,"withdrawalRequests"),limit(100)));
    container.replaceChildren();
    if(snapshot.empty){showMessage(container,"No withdrawal requests");return}
    snapshot.forEach(item=>renderWithdrawalRow(container,item.id,item.data(),true));
  }catch(error){showMessage(container,"Could not load requests. Check Firestore rules.");console.error(error)}
}
async function resolveWithdrawalRequest(id,nextStatus,paymentReference=""){
  if(!isOwner||!activeUser)return;
  if(nextStatus==="paid"&&paymentReference.length<6){alert("Enter a valid transaction reference.");return}
  try{
    await walletApi(activeUser,{action:"resolve",requestId:id,status:nextStatus,paymentReference});
    await loadWithdrawalRequests(activeUser);
    await loadWalletBalance(activeUser);
    await loadActivityLedger(activeUser);
    if(typeof window.syncContract==="function")window.syncContract("snapshot");
  }catch(error){alert(error.message||"Could not update withdrawal request.");console.error(error)}
}
async function submitWithdrawal(event){
  event.preventDefault();
  if(!activeUser){window.dispatchEvent(new CustomEvent("fcm-open-auth",{detail:{mode:"signin"}}));return}
  const amount=Number($("withdrawal-amount")?.value);
  const network=$("withdrawal-network")?.value;
  const walletAddress=$("withdrawal-address")?.value.trim();
  const message=$("withdrawal-message");
  const button=$("withdrawal-submit");
  if(!Number.isFinite(amount)||amount<5||amount>100000||!network||walletAddress.length<12||walletAddress.length>180){
    if(message)message.textContent="Check the amount, network and receiving address. Minimum withdrawal is 5 USDT.";
    return;
  }
  button.disabled=true;
  if(message)message.textContent="Submitting your request…";
  try{
    await walletApi(activeUser,{action:"request",amount,network,walletAddress});
    $("withdrawal-form").reset();
    if(message)message.textContent="Your request has been added to the owner review queue.";
    await loadWithdrawalRequests(activeUser);
    await loadWalletBalance(activeUser);
    await loadActivityLedger(activeUser);
  }catch(error){
    if(message)message.textContent=error.message||"Could not submit your withdrawal request.";
    console.error(error);
  }finally{button.disabled=false}
}

async function boot(user){
  activeUser=user;
  isOwner=await verifyOwner(user);
  if(!user)return;
  try{
    const profile=await ensureProfile(user);
    try{
      await walletApi(user,{action:"claimReferral"});
    }catch(referralError){
      console.warn("Referral reward check is temporarily unavailable:",referralError);
    }
    await loadAccountSettings(user);
    await loadReferralData(user,profile);
    await loadMembership(user);
    await loadMembershipRequestStatus(user);
    await loadWithdrawalRequests(user);
    await loadWalletBalance(user);
    await loadActivityLedger(user);
    if(isOwner){await loadMembershipRequests();await loadAdminOverview()}
  }catch(error){
    console.error("Firestore member data unavailable:",error);
    const list=$("referral-list");
    if(list)showMessage(list,"Member data is not ready. Publish firestore.rules in Firebase Console and refresh.");
    const member=$("membership-current");
    if(member)showMessage(member,"Membership data unavailable until Firestore rules are published.");
  }
}
document.querySelectorAll("[data-membership-request]").forEach(button=>button.addEventListener("click",()=>requestMembership(button.dataset.membershipRequest)));
const profileForm=$("profile-form");
if(profileForm)profileForm.addEventListener("submit",saveAccountProfile);
const passwordReset=$("profile-password-reset");
if(passwordReset)passwordReset.addEventListener("click",sendAccountPasswordReset);
const adminRefresh=$("admin-stats-refresh");
if(adminRefresh)adminRefresh.addEventListener("click",async()=>{
  await loadAdminOverview();
  await loadMembershipRequests();
  if(activeUser)await loadWithdrawalRequests(activeUser);
});
document.querySelectorAll('[data-view="wallet"]').forEach(button=>button.addEventListener("click",()=>{if(activeUser)loadWalletBalance(activeUser)}));
const withdrawalForm=$("withdrawal-form");
if(withdrawalForm)withdrawalForm.addEventListener("submit",submitWithdrawal);
onIdTokenChanged(auth,user=>{boot(user).catch(error=>console.error(error))});

