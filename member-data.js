import { getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, runTransaction, collection, query,
  where, getDocs, addDoc, updateDoc, serverTimestamp, Timestamp, limit
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
  return token.claims.email_verified===true&&token.claims.firebase?.sign_in_provider==="google.com";
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
    meta.textContent="Joined "+safeDate(data.createdAt);
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
  meta.textContent=(adminView?((data.email||data.uid)+" · "+(data.walletAddress||"No address")+" · "):"")+safeDate(data.createdAt);
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
  const requestRef=doc(db,"withdrawalRequests",id);
  const auditRef=doc(collection(db,"adminAuditLogs"));
  try{
    await runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(requestRef);
      if(!snapshot.exists())throw new Error("Request not found.");
      const previous=snapshot.data().status;
      const valid=(previous==="pending"&&["approved","rejected"].includes(nextStatus))||(previous==="approved"&&nextStatus==="paid");
      if(!valid)throw new Error("This request has already been processed or cannot move to that status.");
      const update={status:nextStatus,reviewedAt:serverTimestamp(),reviewedBy:activeUser.uid};
      if(nextStatus==="paid"){update.paymentReference=paymentReference;update.paidAt=serverTimestamp()}
      transaction.update(requestRef,update);
      transaction.set(auditRef,{actorUid:activeUser.uid,action:"withdrawal_"+nextStatus,targetId:id,targetUid:snapshot.data().uid,createdAt:serverTimestamp()});
    });
    await loadWithdrawalRequests(activeUser);
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
    if(message)message.textContent="Check the amount, network and wallet address. The minimum request is 5 USDT.";
    return;
  }
  button.disabled=true;
  if(message)message.textContent="Submitting your request…";
  try{
    const existingRequests=await getDocs(query(collection(db,"withdrawalRequests"),where("uid","==",activeUser.uid),limit(100)));
    if(existingRequests.docs.some(item=>["pending","approved"].includes(item.data().status))){
      if(message)message.textContent="You already have an open withdrawal request. Wait for the owner to review it before submitting another.";
      return;
    }
    await addDoc(collection(db,"withdrawalRequests"),{
      uid:activeUser.uid,email:activeUser.email||"",amount,asset:"USDT",network,walletAddress,
      status:"pending",createdAt:serverTimestamp()
    });
    $("withdrawal-form").reset();
    if(message)message.textContent="Request submitted for manual review. This is not a payment approval or a promise of payout.";
    await loadWithdrawalRequests(activeUser);
  }catch(error){
    if(message)message.textContent="Could not submit. Confirm Firestore rules are published, then retry.";
    console.error(error);
  }finally{button.disabled=false}
}

async function boot(user){
  activeUser=user;
  isOwner=await verifyOwner(user);
  if(!user)return;
  try{
    const profile=await ensureProfile(user);
    await loadReferralData(user,profile);
    await loadMembership(user);
    await loadWithdrawalRequests(user);
    if(isOwner)await loadMembershipRequests();
  }catch(error){
    console.error("Firestore member data unavailable:",error);
    const list=$("referral-list");
    if(list)showMessage(list,"Member data is not ready. Publish firestore.rules in Firebase Console and refresh.");
    const member=$("membership-current");
    if(member)showMessage(member,"Membership data unavailable until Firestore rules are published.");
  }
}
document.querySelectorAll("[data-membership-request]").forEach(button=>button.addEventListener("click",()=>requestMembership(button.dataset.membershipRequest)));
const withdrawalForm=$("withdrawal-form");
if(withdrawalForm)withdrawalForm.addEventListener("submit",submitWithdrawal);
onAuthStateChanged(auth,user=>{boot(user).catch(error=>console.error(error))});

