(function(){
  const gate=document.getElementById('adblock-gate');
  const checkButton=document.getElementById('adblock-check');
  const status=document.getElementById('adblock-status');
  if(!gate||!checkButton)return;

  function createBait(){
    const node=document.createElement('div');
    node.className='adsbox ad-placement ad-unit ad-banner';
    node.setAttribute('aria-hidden','true');
    node.style.cssText='position:absolute;left:-10000px;top:-10000px;width:12px;height:12px;overflow:hidden;pointer-events:none;';
    node.innerHTML='<div class="ad-placeholder">Advertisement</div>';
    document.body.append(node);
    return node;
  }

  let bait=createBait();
  function isBlocked(){
    const style=window.getComputedStyle(bait);
    return bait.offsetHeight===0||bait.offsetWidth===0||style.display==='none'||style.visibility==='hidden';
  }
  function runCheck(){
    const detected=isBlocked();
    gate.hidden=!detected;
    if(status)status.textContent=detected?'An ad blocker or content filter is still active. Disable it for this site, then check again.':'';
    document.documentElement.classList.toggle('fcm-adblock-detected',detected);
    return !detected;
  }

  checkButton.addEventListener('click',()=>{
    if(status)status.textContent='Checking this browser…';
    bait.remove();
    bait=createBait();
    window.setTimeout(runCheck,250);
  });

  window.setTimeout(runCheck,250);
  [900,2200,4500,8000].forEach(ms=>window.setTimeout(runCheck,ms));
  window.addEventListener('focus',runCheck);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)runCheck()});
  window.setInterval(runCheck,20000);
})();