const nav=[...document.querySelectorAll('[data-view]')],views=[...document.querySelectorAll('.view')],side=document.getElementById('side'),title=document.getElementById('title');
function show(id){views.forEach(v=>v.classList.toggle('active',v.id===id));nav.forEach(b=>b.classList.toggle('active',b.dataset.view===id));const b=nav.find(x=>x.dataset.view===id);title.textContent=b?b.textContent.trim():id;side.classList.remove('open');scrollTo({top:0,behavior:'smooth'});if(id==='contract')renderContract()}
nav.forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
document.getElementById('menu').addEventListener('click',()=>side.classList.toggle('open'));
const CONTRACT_KEY='fcm_virtual_contract_demo_v1',Engine=window.FCMContractEngine;
let storageAvailable=true;
function loadContract(){try{return Engine.sanitizeState(JSON.parse(localStorage.getItem(CONTRACT_KEY)))}catch(error){storageAvailable=false;return Engine.freshState()}}
let contract=loadContract();
function saveContract(){try{localStorage.setItem(CONTRACT_KEY,JSON.stringify(contract));storageAvailable=true;return true}catch(error){storageAvailable=false;return false}}
function renderContract(){
const completion=Engine.completeDueSession(contract,Date.now());contract=completion.state;if(completion.completed)saveContract();
const state=Engine.snapshot(contract,Date.now()),active=!!state.session,done=state.cycleCompleted;
document.getElementById('contract-points').textContent=state.points.toLocaleString();
document.getElementById('contract-days').textContent=state.activeDays;
document.getElementById('contract-today').textContent=state.sessionsStartedToday;
document.getElementById('contract-status').textContent=done?'Cycle complete':active?'Session running':state.activeDays?'Paused / ready':'Not started';
document.getElementById('contract-status-note').textContent=done?'Demo cycle completed':active?'Session is in progress':'Missed days preserve progress';
document.getElementById('contract-progress-label').textContent=state.progressPercent+'% complete';
document.getElementById('contract-progress-bar').style.width=state.progressPercent+'%';
document.getElementById('session-state').textContent=active?'SESSION ACTIVE':'READY TO START';
document.getElementById('session-timer').textContent=active?Engine.formatRemaining(state.session.endsAt-Date.now()):'08:00:00';
document.getElementById('session-description').textContent=active?'Your demo session ends at '+new Date(state.session.endsAt).toLocaleString()+' on this device.':'Start a virtual session. Completion awards 10 simulated points.';
document.getElementById('session-start').disabled=active||state.sessionsStartedToday>=state.maxSessionsPerDay||done;
document.getElementById('session-start').textContent=active?'Session running':state.sessionsStartedToday>=state.maxSessionsPerDay?'Daily session limit reached':done?'Cycle completed':'Activate 8-hour session';
document.getElementById('session-message').textContent=active?'Timer continues if you close this page.':state.sessionsStartedToday>=state.maxSessionsPerDay?'You have used all three demo activations for today.':storageAvailable?'No active session.':'Browser storage is unavailable; demo progress may be lost.';
const complete=document.getElementById('contract-complete');complete.classList.toggle('contract-complete',done);complete.replaceChildren();
const completeTitle=document.createElement('b');completeTitle.textContent=done?'Demo cycle completed':'Cycle not yet complete';
const completeText=document.createTextNode(done?'You completed 30 active days and earned '+state.points+' simulated points. These points are not money and cannot be withdrawn.':'Complete sessions across 30 active days to finish this demo cycle. Missing a day pauses progress; it does not reset it.');
complete.append(completeTitle,completeText);
const history=document.getElementById('contract-history');history.replaceChildren();
if(state.history.length){state.history.forEach(entry=>{const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('span');row.className='contract-history-row';label.textContent=entry.type+' · '+entry.day;value.textContent=entry.type==='Session completed'?'+'+entry.points+' pts':'Started';row.append(label,value);history.append(row)})}
else{const empty=document.createElement('div'),bold=document.createElement('b');empty.className='empty';bold.textContent='No demo activity yet';empty.append(bold,document.createTextNode('Completed sessions will appear here.'));history.append(empty)}
}
document.getElementById('session-start').addEventListener('click',()=>{const result=Engine.startSession(contract,Date.now());contract=result.state;saveContract();if(!result.ok){const messages={session_active:'A session is already running.',cycle_complete:'This demo cycle is complete.',daily_limit:'You have used all three demo activations for today.'};document.getElementById('session-message').textContent=messages[result.reason]||'Unable to start a session.'}renderContract()});
document.getElementById('demo-reset').addEventListener('click',()=>{if(!confirm('Reset all virtual contract demo data stored in this browser?'))return;contract=Engine.freshState();saveContract();renderContract()});
renderContract();
setInterval(()=>{if(contract.session&&Date.now()>=contract.session.endsAt){const result=Engine.completeDueSession(contract,Date.now());contract=result.state;if(result.completed)saveContract()}if(document.getElementById('contract').classList.contains('active'))renderContract()},1000);

// Load the Firebase account interface independently from the contract demo.
import('./auth.js').catch((error)=>console.error('Firebase authentication UI failed to load:',error));

const authNotice=document.querySelector('.side-note');
if(authNotice)authNotice.innerHTML='<b>● Prototype mode</b><br>Firebase sign-in is enabled in this preview. Mining, rewards, subscriptions and payouts remain disabled.';
const systemStatus=document.querySelector('.top-right .status');
if(systemStatus)systemStatus.textContent='● Firebase auth · Demo mode';
const dashboardNotice=document.querySelector('#dashboard .notice div');
if(dashboardNotice)dashboardNotice.innerHTML='<strong>Preview only — no real earnings yet.</strong> Firebase sign-in is available. Balances, subscriptions, mining and crypto payouts are not active. No income is promised.';
const settingsIntro=document.querySelector('#settings .intro');
if(settingsIntro)settingsIntro.textContent='Manage your Firebase account using the Account control in the top-right. Your sign-in identity is handled by Firebase Authentication. Contract progress is still stored locally on this device and is not synced to your account.';
const settingsEmail=document.querySelector('#settings input[disabled]');
if(settingsEmail){settingsEmail.placeholder='Use the Account control above';settingsEmail.disabled=true}
const settingsTag=document.querySelector('#settings .tag');
if(settingsTag){settingsTag.textContent='Firebase Authentication enabled';settingsTag.classList.remove('wait')}
const activityEmpty=document.querySelector('#activity .empty');
if(activityEmpty)activityEmpty.innerHTML='<b>No financial ledger entries</b>Firebase accounts are enabled, but no reward credits, conversions, reversals or payouts exist in this prototype.';
