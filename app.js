const nav=[...document.querySelectorAll('[data-view]')],views=[...document.querySelectorAll('.view')],side=document.getElementById('side'),title=document.getElementById('title'),eyebrow=document.querySelector('.top .eyebrow');
let currentUser=null,isOwnerAdmin=false;
const ownerEmail='dangerahmaddon1@gmail.com';
const publicViews=new Set(['public','plans','help']);
function openSignup(){window.dispatchEvent(new CustomEvent('fcm-open-auth',{detail:{mode:'signup'}}))}
function show(id){
 const target=document.getElementById(id);
 const memberView=target?.classList.contains('member-view');
 const adminView=target?.classList.contains('admin-only');
 if(memberView&&!currentUser){openSignup();return}
 if(adminView&&!isOwnerAdmin){show(currentUser?'dashboard':'public');return}
 if(!target||target.hidden)return;
 views.forEach(v=>v.classList.toggle('active',v.id===id));
 nav.forEach(b=>b.classList.toggle('active',b.dataset.view===id));
 const b=nav.find(x=>x.dataset.view===id);title.textContent=b?b.textContent.trim():id;
 if(eyebrow)eyebrow.textContent=currentUser?'Member workspace':'Public information';
 if(typeof window.va==='function')window.va('pageview',{route:'/'+id,path:'/'+id});
 side.classList.remove('open');scrollTo({top:0,behavior:'smooth'});
 if(id==='mining')renderContract()
}
async function applyAccess(user){
 currentUser=user||null;
 contractUser=user||null;
 contractState=null;
 isOwnerAdmin=false;
 if(user){
  try{
   const token=await user.getIdTokenResult();
   isOwnerAdmin=String(user.email||'').toLowerCase()===ownerEmail&&token.claims.email_verified===true&&token.claims.firebase?.sign_in_provider==='custom'&&Number(token.claims.adminVerifiedUntil||0)>Math.floor(Date.now()/1000);
  }catch(error){console.warn('Could not verify owner sign-in provider:',error)}
 }
 document.body.classList.toggle('fcm-signed-in',!!currentUser);
 document.querySelectorAll('[data-auth-cta]').forEach(el=>el.hidden=!!currentUser);
 document.querySelectorAll('.member-only').forEach(el=>el.hidden=!currentUser);
 document.querySelectorAll('.member-view').forEach(el=>el.hidden=!currentUser);
 document.querySelectorAll('.admin-only').forEach(el=>el.hidden=!isOwnerAdmin);
 const note=document.getElementById('side-note');
 if(note)note.innerHTML=currentUser?'<b>● Member preview</b><br>Account access enabled. No real earnings or payouts are enabled.':'<b>● Public preview</b><br>Read the project information and rules. Create an account to enter the member workspace.';
 show(currentUser?'dashboard':'public');
 if(currentUser)syncContract('snapshot');else renderContract();
}
window.addEventListener('fcm-auth-state',event=>applyAccess(event.detail?.user||null));
setInterval(async()=>{if(!currentUser)return;try{const token=await currentUser.getIdTokenResult();const allowed=String(currentUser.email||'').toLowerCase()===ownerEmail&&token.claims.email_verified===true&&token.claims.firebase?.sign_in_provider==='custom'&&Number(token.claims.adminVerifiedUntil||0)>Math.floor(Date.now()/1000);if(allowed!==isOwnerAdmin){isOwnerAdmin=allowed;document.querySelectorAll('.admin-only').forEach(el=>el.hidden=!allowed);if(!allowed&&document.getElementById('admin')?.classList.contains('active'))show('dashboard')}}catch(error){console.warn('Could not refresh admin access state:',error)}},15000);

nav.forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
document.getElementById('menu').addEventListener('click',()=>side.classList.toggle('open'));
const Engine=window.FCMContractEngine;
let contractState=null,contractBusy=false,contractUser=null,lastSyncError="";
const resetDemoButton=document.getElementById('demo-reset');
if(resetDemoButton){resetDemoButton.hidden=true;resetDemoButton.disabled=true}
async function syncContract(action='snapshot'){
 if(!contractUser)return;
 if(contractBusy)return;
 contractBusy=true;
 const requestUser=contractUser;
 const message=document.getElementById('session-message');
 try{
  const token=await requestUser.getIdToken();
  const response=await fetch('/api/contracts/session',{
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
   body:JSON.stringify({action})
  });
  const payload=await response.json().catch(()=>({}));
  if(contractUser?.uid!==requestUser.uid)return;
  if(!response.ok)throw new Error(payload.error||'Contract service unavailable.');
  contractState=payload.state;
  lastSyncError='';
  if(message){
   if(action==='start'&&payload.started)message.textContent='Your one-hour server-timed session is active.';
   else if(action==='start'&&payload.reason==='session_active')message.textContent='A session is already running.';
   else if(payload.completed)message.textContent='Session completed. 10 simulated points were added to your account.';
   else message.textContent=contractState.session?'Your session is active. The server checks its completion time.':'No active session.';
  }
 }catch(error){
  if(contractUser?.uid===requestUser.uid){
   lastSyncError=error.message||'Could not sync contract progress.';
   if(message)message.textContent=lastSyncError;
  }
 }finally{
  contractBusy=false;
  renderContract();
  if(contractUser&&contractUser.uid!==requestUser.uid)syncContract('snapshot');
 }
}
function renderContract(){
 const state=contractState;
 const empty=!state;
 const active=!!state?.session;
 const pointsText=empty?'—':Number(state.points||0).toLocaleString()+' pts';
 const available=document.getElementById('dashboard-available');
 const lifetime=document.getElementById('dashboard-lifetime');
 if(available)available.textContent=pointsText;
 if(lifetime)lifetime.textContent=pointsText;
 document.getElementById('contract-points').textContent=empty?'—':Number(state.points||0).toLocaleString();
 document.getElementById('contract-status').textContent=empty?'Connecting…':active?'Session running':(state?.points?'Ready for next session':'Not started');
 document.getElementById('contract-status-note').textContent=empty?'Loading account-backed progress':active?'Server-timed session is in progress':'Activate another session whenever the previous one completes';
 document.getElementById('session-state').textContent=active?'SESSION ACTIVE':'READY TO START';
 const remaining=active?Math.max(0,Number(state.session.endsAt)-Date.now()):3600000;
 document.getElementById('session-timer').textContent=Engine.formatRemaining(remaining);
 document.getElementById('session-description').textContent=active?'Your session is stored on the server and completes after one hour.':'Start a server-timed virtual session. Completion awards 10 simulated points.';
 const startButton=document.getElementById('session-start');
 startButton.disabled=empty||contractBusy||active;
 startButton.textContent=active?'Session running':'Activate 1-hour session';
 if(empty&&!lastSyncError)document.getElementById('session-message').textContent='Connecting to your secure contract account…';
 const history=document.getElementById('contract-history');history.replaceChildren();
 if(state?.history?.length){
  state.history.forEach(entry=>{
   const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('span');
   row.className='contract-history-row';label.textContent=entry.type+' · '+entry.day;
   value.textContent=entry.type==='Session completed'?'+'+entry.points+' pts':'Started';
   row.append(label,value);history.append(row);
  });
 }else{
  const emptyNode=document.createElement('div'),bold=document.createElement('b');
  emptyNode.className='empty';bold.textContent=empty?'Loading account activity…':'No contract activity yet';
  emptyNode.append(bold,document.createTextNode(empty?'Your server-backed contract activity will appear here.':'Completed sessions will appear here.'));
  history.append(emptyNode);
 }
}
document.getElementById('session-start').addEventListener('click',()=>syncContract('start'));
function updateContractClock(){
 if(!contractState?.session)return;
 const remaining=Number(contractState.session.endsAt)-Date.now();
 document.getElementById('session-timer').textContent=Engine.formatRemaining(remaining);
 if(remaining<=0)syncContract('snapshot');
}
setInterval(updateContractClock,1000);
applyAccess(null);
// Firebase authentication and Firestore-backed member features.
import('./auth.js').then(()=>import('./member-data.js')).catch((error)=>console.error('Firebase modules failed to load:',error));

const authNotice=document.querySelector('.side-note');
if(authNotice)authNotice.innerHTML='<b>● Account secured</b><br>Firebase sign-in is enabled. Reward and payout integrations remain under development.';
const systemStatus=document.querySelector('.top-right .status');
if(systemStatus)systemStatus.textContent='● Firebase account access';
const dashboardNotice=document.querySelector('#dashboard .notice div');
if(dashboardNotice)dashboardNotice.innerHTML='<strong>Preview only — no real earnings yet.</strong> Firebase sign-in is available. Balances, subscriptions, mining and crypto payouts are not active. No income is promised.';
const settingsIntro=document.querySelector('#settings .intro');
if(settingsIntro)settingsIntro.textContent='Update your display name below. Your sign-in email and password recovery are handled by Firebase Authentication. Contract sessions and simulated points are synced securely to your Firebase account.';
const settingsEmail=document.querySelector('#settings input[disabled]');
if(settingsEmail){settingsEmail.placeholder='Use the Account control above';settingsEmail.disabled=true}
const settingsTag=document.querySelector('#settings .tag');
if(settingsTag){settingsTag.textContent='Firebase Authentication enabled';settingsTag.classList.remove('wait')}
const activityEmpty=document.querySelector('#activity .empty');
if(activityEmpty)activityEmpty.innerHTML='<b>No financial ledger entries</b>Firebase accounts are enabled, but no reward credits, conversions, reversals or payouts exist in this prototype.';
