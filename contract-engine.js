(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FCMContractEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SESSION_MS=8*60*60*1000;
  const POINTS_PER_SESSION=10;
  const MAX_SESSIONS_PER_DAY=3;
  const REQUIRED_ACTIVE_DAYS=30;
  const validDay=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;};
  function localDay(timestamp){
    const date=new Date(timestamp);
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }
  function freshState(){return {points:0,activeDays:[],sessionsByDay:{},session:null,history:[]};}
  function sanitizeState(input){
    if(!input||!Array.isArray(input.activeDays)||!input.sessionsByDay||typeof input.sessionsByDay!=='object'||!Array.isArray(input.history))return freshState();
    const activeDays=[...new Set(input.activeDays.filter(validDay))].slice(0,REQUIRED_ACTIVE_DAYS);
    const sessionsByDay={};
    Object.entries(input.sessionsByDay).forEach(([day,count])=>{if(validDay(day)&&Number.isInteger(count)&&count>=0&&count<=MAX_SESSIONS_PER_DAY)sessionsByDay[day]=count;});
    let session=null;
    if(input.session&&validDay(input.session.day)&&Number.isFinite(input.session.startedAt)&&Number.isFinite(input.session.endsAt)&&input.session.endsAt-input.session.startedAt===SESSION_MS){
      session={day:input.session.day,startedAt:input.session.startedAt,endsAt:input.session.endsAt};
    }
    const history=input.history.filter(entry=>entry&&validDay(entry.day)&&typeof entry.type==='string').slice(0,12).map(entry=>({
      type:entry.type==='Session completed'?'Session completed':'Session activated',
      day:entry.day,
      at:Number.isFinite(entry.at)?entry.at:0,
      points:Number.isSafeInteger(entry.points)&&entry.points>=0?entry.points:0
    }));
    return {points:Number.isSafeInteger(input.points)&&input.points>=0?input.points:0,activeDays,sessionsByDay,session,history};
  }
  function completeDueSession(input,now){
    const state=sanitizeState(input);
    if(!state.session||now<state.session.endsAt)return {state,completed:false};
    const session=state.session;
    state.points+=POINTS_PER_SESSION;
    if(!state.activeDays.includes(session.day))state.activeDays.push(session.day);
    state.history.unshift({type:'Session completed',day:session.day,at:session.endsAt,points:POINTS_PER_SESSION});
    state.history=state.history.slice(0,12);
    state.session=null;
    return {state,completed:true};
  }
  function startSession(input,now){
    let {state}=completeDueSession(input,now);
    if(state.session)return {state,ok:false,reason:'session_active'};
    if(state.activeDays.length>=REQUIRED_ACTIVE_DAYS)return {state,ok:false,reason:'cycle_complete'};
    const day=localDay(now);
    const started=state.sessionsByDay[day]||0;
    if(started>=MAX_SESSIONS_PER_DAY)return {state,ok:false,reason:'daily_limit'};
    state.sessionsByDay[day]=started+1;
    state.session={day,startedAt:now,endsAt:now+SESSION_MS};
    state.history.unshift({type:'Session activated',day,at:now,points:0});
    state.history=state.history.slice(0,12);
    return {state,ok:true,reason:null};
  }
  function snapshot(input,now){
    const state=sanitizeState(input);
    const days=Math.min(REQUIRED_ACTIVE_DAYS,state.activeDays.length);
    const today=localDay(now);
    return {
      points:state.points,
      activeDays:days,
      requiredActiveDays:REQUIRED_ACTIVE_DAYS,
      progressPercent:Math.round(days/REQUIRED_ACTIVE_DAYS*100),
      sessionsStartedToday:state.sessionsByDay[today]||0,
      maxSessionsPerDay:MAX_SESSIONS_PER_DAY,
      pointsPerSession:POINTS_PER_SESSION,
      sessionDurationMs:SESSION_MS,
      session:state.session,
      cycleCompleted:days>=REQUIRED_ACTIVE_DAYS,
      history:state.history
    };
  }
  function formatRemaining(milliseconds){
    const seconds=Math.max(0,Math.floor(milliseconds/1000));
    return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(value=>String(value).padStart(2,'0')).join(':');
  }
  return {SESSION_MS,POINTS_PER_SESSION,MAX_SESSIONS_PER_DAY,REQUIRED_ACTIVE_DAYS,localDay,freshState,sanitizeState,completeDueSession,startSession,snapshot,formatRemaining};
});
