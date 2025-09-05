(function(){
  const KEY = 'consent-v1';
  const saved = localStorage.getItem(KEY);
  if (saved) { applyConsent(JSON.parse(saved)); return; }

  const bar = document.createElement('div');
  bar.setAttribute('style', 'position:fixed; inset:auto 0 0 0; background:#0b1020; color:#fff; border-top:1px solid rgba(255,255,255,.2); padding:12px; z-index:9999; display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;');
  bar.innerHTML = '<span>We gebruiken analytics/advertenties om de site te verbeteren en te financieren. Kies je voorkeur.</span><span style="display:flex; gap:8px;"><button id="c-accept" style="padding:8px 12px; font-weight:700;">Alles accepteren</button><button id="c-essential" style="padding:8px 12px;">Alleen essentieel</button></span>';
  document.body.appendChild(bar);

  function setConsent(consent){
    localStorage.setItem(KEY, JSON.stringify(consent));
    applyConsent(consent);
    bar.remove();
  }
  function applyConsent(c){
    if (window.gtag){
      gtag('consent', 'update', {
        ad_storage: c.ads ? 'granted':'denied',
        analytics_storage: c.analytics ? 'granted':'denied',
        ad_user_data: c.ads ? 'granted':'denied',
        ad_personalization: c.ads ? 'granted':'denied'
      });
    }
    if (c.ads && window.adsbygoogle) (adsbygoogle = window.adsbygoogle || []).push({});
  }
  document.addEventListener('click', e=>{
    if (e.target.id === 'c-accept') setConsent({ads:true, analytics:true});
    if (e.target.id === 'c-essential') setConsent({ads:false, analytics:false});
  });
})();
