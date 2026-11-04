(function(){
  const gate=document.getElementById('adblock-gate');
  const checkButton=document.getElementById('adblock-check');
  const status=document.getElementById('adblock-status');
  if(!gate||!checkButton)return;
  const bait=document.createElement('div');
  bait.className='adsbox ad-placement ad-unit ad-banner';
  bait.setAttribute('aria-hidden','true');
  bait.style.cssText='position:absolute;left:-10000px;top:-10000px;width:12px;height:12px;overflow:hidden;pointer-events:none;';
  bait.innerHTML='<div class="ad-placeholder">Advertisement</div>';
  document.body.append(bait);
  let checkCount=0;
  function blocked(){
    const style=window.getComputedStyle(bait);
    return bait.offsetHeight===0||bait.offsetWidth===0||style.display==='none'||style.visibility==='hidden';
  }
  function runCheck(){
    checkCount++;
    const isBlocked=blocked();
    gate.hidden=!isBlocked;
    if(status)status.textContent=isBlocked?'An ad blocker or content filter is still active. Disable it for this site, then check again.':'';
    document.documentElement.classList.toggle('fcm-adblock-detected',isBlocked);
    return !isBlocked;
  }
  checkButton.addEventListener('click',()=>{
    if(status)status.textContent='Checking this browser…';
    bait.remove();
    const replacement=bait.cloneNode(true);
    document.body.append(replacement);
    // Rebind the active bait reference through a fresh detector node.
    activeBait=replacement;
    window.setTimeout(runCheck,250);
  });
  let activeBait=bait;
  function blockedActive(){
    const style=window.getComputedStyle(activeBait);
    return activeBait.offsetHeight===0||activeBait.offsetWidth===0||style.display==='none'||style.visibility==='hidden';
  }
  // Use the current bait node after each manual retry.
  blocked=blockedActive;
  window.setTimeout(runCheck,250);
  [900,2200,4500,8000].forEach(ms=>window.setTimeout(runCheck,ms));
  window.addEventListener('focus',runCheck);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)runCheck()});
  window.setInterval(runCheck,20000);
})();