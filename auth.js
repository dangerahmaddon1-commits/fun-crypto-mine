import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onIdTokenChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup, signInWithCustomToken, signOut, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig={apiKey:"AIzaSyCVI6SUPyTXusUaZseDu6kwJYwv7E5czMo",authDomain:"fun-crypto.firebaseapp.com",projectId:"fun-crypto",storageBucket:"fun-crypto.firebasestorage.app",messagingSenderId:"650394986630",appId:"1:650394986630:web:f748146bbf8b8795284907",measurementId:"G-9Y5J0F7DEP"};
const auth=getAuth(initializeApp(firebaseConfig));
const provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});

const style=document.createElement("style");
style.textContent=`
.fcm-auth-buttons{display:flex;gap:7px;align-items:center}.fcm-auth-btn{border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:#17263a;color:var(--text);font:inherit;font-size:11px;font-weight:700;cursor:pointer}.fcm-auth-btn.primary{background:var(--lime);color:#142016;border-color:var(--lime)}.fcm-auth-user{display:none;align-items:center;gap:8px}.fcm-auth-user.show{display:flex}.fcm-auth-modal{position:fixed;inset:0;z-index:30;background:#030812df;display:none;place-items:center;padding:16px}.fcm-auth-modal.open{display:grid}.fcm-auth-panel{width:min(100%,420px);background:#111d2d;border:1px solid #3a4d68;border-radius:18px;padding:22px;box-shadow:0 24px 80px #0009}.fcm-auth-panel h2{font-size:21px;margin:8px 0}.fcm-auth-panel p{font-size:11px;color:var(--muted);line-height:1.6}.fcm-auth-panel .field input{width:100%;background:#0c1524;border:1px solid var(--line);border-radius:9px;padding:11px;color:var(--text)}.fcm-auth-panel .field label{display:block;font-size:10px;color:#b9c7d9;margin:10px 0 6px}.fcm-auth-tabs{display:flex;gap:7px;margin:16px 0}.fcm-auth-tabs button{flex:1}.fcm-auth-message{min-height:22px;font-size:11px;color:#ffb4a9;margin-top:8px}.fcm-auth-message.ok{color:var(--lime)}.fcm-auth-close{float:right;border:0;background:none;color:#aab8cc;font-size:22px;cursor:pointer}.fcm-auth-link{border:0;background:none;color:var(--cyan);font-size:11px;padding:9px 0;cursor:pointer}.fcm-auth-profile{font-size:11px;color:#b9c7d9;line-height:1.8}.fcm-auth-profile strong{color:var(--lime)}.fcm-admin-security{margin:14px 0;padding:13px;border:1px solid #66552d;border-radius:11px;background:#272114}.fcm-admin-security p{margin:4px 0 9px}.fcm-admin-security input{display:block;width:100%;margin:8px 0;padding:10px;border:1px solid var(--line);border-radius:8px;background:#0c1524;color:var(--text)}.fcm-admin-security-status{color:#e8d9ad}.fcm-admin-security button{margin-top:5px}@media(max-width:720px){.fcm-auth-buttons{gap:5px}.fcm-auth-btn{padding:8px;font-size:10px}}`;
document.head.append(style);

const top=document.querySelector(".top-right");
if(!top) throw new Error("Authentication UI could not find the header.");
const actions=document.createElement("div");
actions.className="fcm-auth-buttons";
actions.innerHTML='<button class="fcm-auth-btn" id="fcm-signin">Sign in</button><button class="fcm-auth-btn primary" id="fcm-signup">Create account</button><div class="fcm-auth-user" id="fcm-user"><button class="fcm-auth-btn" id="fcm-account">Account</button></div>';
top.append(actions);
const modal=document.createElement("div");
modal.className="fcm-auth-modal";
modal.innerHTML=`<section class="fcm-auth-panel" role="dialog" aria-modal="true" aria-labelledby="fcm-auth-title"><button class="fcm-auth-close" id="fcm-close" aria-label="Close">×</button><div class="eyebrow">FUN CRYPTO MINE</div><h2 id="fcm-auth-title">Welcome back</h2><p id="fcm-auth-subtitle">Sign in to your account.</p><div class="fcm-auth-tabs"><button class="btn primary" id="fcm-tab-in" type="button">Sign in</button><button class="btn" id="fcm-tab-up" type="button">Create account</button></div><form id="fcm-form"><div class="field" id="fcm-name-wrap" hidden><label for="fcm-name">Username</label><input id="fcm-name" autocomplete="nickname" minlength="3" maxlength="30" placeholder="Choose a username"></div><div class="field"><label for="fcm-email">Email</label><input id="fcm-email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></div><div class="field"><label for="fcm-password">Password</label><input id="fcm-password" type="password" autocomplete="current-password" minlength="6" required placeholder="At least 6 characters"></div><button class="btn primary" id="fcm-submit" type="submit" style="width:100%">Sign in</button></form><button class="fcm-auth-link" id="fcm-reset" type="button">Forgot password?</button><div class="auth-divider">OR</div><button class="btn" id="fcm-google" type="button" style="width:100%">Continue with Google</button><div class="fcm-auth-message" id="fcm-message" role="status" aria-live="polite"></div><div class="fcm-auth-profile" id="fcm-profile"></div><p>Contract sessions and simulated points are stored securely with your Firebase account. Points have no cash or crypto value.</p></section>`;
document.body.append(modal);
const $=id=>document.getElementById(id);
let mode="signin";
function say(text,ok=false){$("fcm-message").textContent=text;$("fcm-message").classList.toggle("ok",ok)}
function setMode(next){mode=next;const up=mode==="signup";$("fcm-auth-title").textContent=up?"Create your account":"Welcome back";$("fcm-auth-subtitle").textContent=up?"Register with email and password, or continue with Google.":"Sign in securely using Firebase Authentication.";$("fcm-name-wrap").hidden=!up;$("fcm-name").required=up;$("fcm-password").autocomplete=up?"new-password":"current-password";$("fcm-submit").textContent=up?"Create account":"Sign in";$("fcm-tab-in").classList.toggle("primary",!up);$("fcm-tab-up").classList.toggle("primary",up);$("fcm-reset").hidden=up;say("")}
function open(next="signin"){setMode(next);modal.classList.add("open");$("fcm-email").focus()}
function openAccount(){modal.classList.add("open");renderUser(auth.currentUser)}
function close(){modal.classList.remove("open");say("")}
function errorText(e){const m={"auth/email-already-in-use":"An account already exists for this email. Sign in instead.","auth/invalid-email":"Enter a valid email address.","auth/weak-password":"Use a stronger password with at least 6 characters.","auth/invalid-credential":"Email or password is incorrect.","auth/popup-closed-by-user":"Google sign-in was cancelled.","auth/popup-blocked":"Allow pop-ups for this site and try again.","auth/unauthorized-domain":"Add this website to Firebase Authentication → Settings → Authorized domains.","auth/network-request-failed":"Network error. Check your connection.","auth/too-many-requests":"Too many attempts. Please wait and retry."};return m[e.code]||"Authentication failed. Please try again."}
function renderUser(user){
 const signed=!!user;
 $("fcm-form").hidden=signed;
 modal.querySelector(".fcm-auth-tabs").hidden=signed;
 $("fcm-google").hidden=signed;
 $("fcm-reset").hidden=signed;
 $("fcm-signin").hidden=signed;
 $("fcm-signup").hidden=signed;
 $("fcm-user").classList.toggle("show",signed);
 if(!signed){$("fcm-profile").textContent="";return}
 const name=user.displayName||user.email?.split("@")[0]||"Member";
 $("fcm-account").textContent=name;
 $("fcm-profile").replaceChildren();
 const info=document.createElement("p");
 info.textContent=user.email+" · "+(user.emailVerified?"Email verified":"Email not verified");
 const logout=document.createElement("button");
 logout.className="fcm-auth-btn";
 logout.textContent="Sign out";
 logout.addEventListener("click",async()=>{try{await signOut(auth);close()}catch(e){say(errorText(e))}});
 $("fcm-profile").append(info);
 const isOwnerGoogle=String(user.email||"").toLowerCase()==="dangerahmaddon1@gmail.com"&&user.emailVerified&&user.providerData.some(item=>item.providerId==="google.com");
 if(isOwnerGoogle){
  const security=document.createElement("div");
  security.className="fcm-admin-security";
  const securityLabel=document.createElement("p");
  securityLabel.textContent="Admin security · second verification required";
  const status=document.createElement("p");
  status.className="fcm-admin-security-status";
  status.textContent="Admin access is locked.";
  const password=document.createElement("input");
  password.type="password";password.autocomplete="current-password";password.maxLength=256;
  password.placeholder="Enter admin second-factor password";
  password.setAttribute("aria-label","Admin second-factor password");
  const verify=document.createElement("button");
  verify.type="button";verify.className="fcm-auth-btn primary";verify.textContent="Verify admin access";
  verify.addEventListener("click",async()=>{
   if(!password.value){say("Enter your admin second-factor password.");password.focus();return}
   verify.disabled=true;say("Verifying admin access…",true);
   try{
    const credential=await reauthenticateWithPopup(auth.currentUser,provider);
    const idToken=await credential.user.getIdToken(true);
    const response=await fetch("/api/admin/verify",{method:"POST",headers:{"Authorization":"Bearer "+idToken,"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({password:password.value})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||"Admin verification failed.");
    password.value="";
    await signInWithCustomToken(auth,payload.customToken);
    say("Admin access verified for 15 minutes.",true);
   }catch(error){password.value="";say(error.message||"Admin verification failed.");}
   finally{verify.disabled=false}
  });
  security.append(securityLabel,status,password,verify);
  $("fcm-profile").append(security);
  user.getIdTokenResult().then(token=>{
   const until=Number(token.claims.adminVerifiedUntil||0);
   if(until>Math.floor(Date.now()/1000)){
    status.textContent="Admin access active until "+new Date(until*1000).toLocaleTimeString()+".";
    password.hidden=true;verify.hidden=true;
   }else{
    status.textContent="Admin access is locked. Verify again with Google and your second-factor password.";
    password.hidden=false;verify.hidden=false;
   }
  }).catch(()=>{status.textContent="Admin access is locked."});
 }
 $("fcm-profile").append(logout);
 $("fcm-auth-title").textContent="Your account";
 $("fcm-auth-subtitle").textContent="You are signed in. Your one-hour virtual contract progress is linked to your account.";
}
$("fcm-signin").addEventListener("click",()=>open("signin"));$("fcm-signup").addEventListener("click",()=>open("signup"));$("fcm-account").addEventListener("click",openAccount);$("fcm-close").addEventListener("click",close);$("fcm-tab-in").addEventListener("click",()=>setMode("signin"));$("fcm-tab-up").addEventListener("click",()=>setMode("signup"));modal.addEventListener("click",e=>{if(e.target===modal)close()});document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
$("fcm-form").addEventListener("submit",async e=>{e.preventDefault();const button=$("fcm-submit");button.disabled=true;say(mode==="signup"?"Creating account…":"Signing in…",true);try{if(mode==="signup"){const name=$("fcm-name").value.trim();if(name.length<3)throw new Error("Username must contain at least 3 characters.");const cred=await createUserWithEmailAndPassword(auth,$("fcm-email").value.trim(),$("fcm-password").value);await updateProfile(cred.user,{displayName:name});renderUser(auth.currentUser);say("Account created. You are signed in.",true)}else{await signInWithEmailAndPassword(auth,$("fcm-email").value.trim(),$("fcm-password").value);say("Signed in successfully.",true)}window.setTimeout(close,900)}catch(e){say(e.message.startsWith("Username must")?e.message:errorText(e))}finally{button.disabled=false}});
$("fcm-google").addEventListener("click",async()=>{say("Opening Google sign-in…",true);try{await signInWithPopup(auth,provider);say("Signed in with Google.",true);window.setTimeout(close,900)}catch(e){say(errorText(e))}});
$("fcm-reset").addEventListener("click",async()=>{const email=$("fcm-email").value.trim();if(!email){say("Enter your email address first.");$("fcm-email").focus();return}try{await sendPasswordResetEmail(auth,email);say("If an account exists for this email, a reset message has been sent.",true)}catch(e){say(errorText(e))}});
document.querySelectorAll('[data-auth-open]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.authOpen||'signup')));
window.addEventListener('fcm-open-auth',event=>open(event.detail?.mode||'signup'));
onIdTokenChanged(auth,user=>{
 renderUser(user);
 window.dispatchEvent(new CustomEvent('fcm-auth-state',{detail:{user}}));
});
