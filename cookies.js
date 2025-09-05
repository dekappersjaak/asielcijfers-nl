(function(){
  // Key in localStorage om keuze op te slaan
  const KEY = 'consent-v1';
  // Als reeds een keuze bestaat, pas deze direct toe en stop
  const saved = localStorage.getItem(KEY);
  if (saved) {
    applyConsent(JSON.parse(saved));
    return;
  }
  // Genereer banner voor consent
  const bar = document.createElement('div');
  bar.setAttribute('style', `
    position:fixed; inset:auto 0 0 0; background:#0b1020; color:#fff;
    border-top:1px solid rgba(255,255,255,.2); padding:12px; z-index:9999;
    display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;
  `);
  bar.innerHTML = `
    <span>We gebruiken analytics/advertenties voor verbetering en financiering. Kies je voorkeur.</span>
    <span style="display:flex; gap:8px;">
      <button id="c-accept" style="padding:8px 12px; font-weight:700;">Alles accepteren</button>
      <button id="c-essential" style="padding:8px 12px;">Alleen essentieel</button>
    </span>
  `;
  document.body.appendChild(bar);
  // Pas consent toe op gtag en adsense
  function applyConsent(c){
    if (window.gtag) {
      gtag('consent','update',{
        ad_storage:        c.ads      ? 'granted':'denied',
        analytics_storage: c.analytics? 'granted':'denied',
        ad_user_data:      c.ads      ? 'granted':'denied',
        ad_personalization: c.ads     ? 'granted':'denied'
      });
    }
    // Initialiseert advertenties zodra toestemming gegeven is
    if (c.ads && window.adsbygoogle) (adsbygoogle=window.adsbygoogle||[]).push({});
  }
  // Zet de keuze en verwijder banner
  function set(consent){
    localStorage.setItem(KEY, JSON.stringify(consent));
    applyConsent(consent);
    bar.remove();
  }
  document.addEventListener('click', e => {
    if (e.target.id === 'c-accept')   set({ ads:true,  analytics:true });
    if (e.target.id === 'c-essential') set({ ads:false, analytics:false });
  });
})();