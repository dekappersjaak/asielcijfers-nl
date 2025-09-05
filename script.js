/* ---------- kleine helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function animateCount(el, to, dur=1000){
  const from = 0;
  const start = performance.now();
  const fmt = new Intl.NumberFormat('nl-NL');
  function tick(t){
    const p = Math.min(1,(t-start)/dur);
    const val = Math.round(from + (to-from)*easeOutCubic(p));
    el.textContent = fmt.format(val);
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }

/* ---------- data laden ---------- */
async function loadTotals(){
  let data = {
    meta:{ totaal_asielaanvragen:25, week:25, maand:110, jaar:1540, laatst_bijgewerkt:'demo' },
    per_gemeente:{}
  };
  try{
    const res = await fetch(`./data/gemeenten-stats.json?v=${Date.now()}`);
    if (res.ok) data = await res.json();
  } catch(e){
    console.warn('Kon data niet laden, gebruik demo.');
  }
  const total = Number(data.meta?.totaal_asielaanvragen ?? 25);
  animateCount($('#total-count'), total, 1200);
  $('#last-updated').textContent = data.meta?.laatst_bijgewerkt || 'n.v.t.';
  $('#s-week').textContent  = data.meta?.week ?? '—';
  $('#s-month').textContent = data.meta?.maand ?? '—';
  $('#s-year').textContent  = data.meta?.jaar ?? '—';
  return data;
}

/* ---------- kaart ---------- */
let map;
function initMap(){
  map = L.map('map', { zoomControl: true }).setView([52.2, 5.3], 7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> — data © contributors'
  }).addTo(map);
}

/* circle size helper op basis van waarde (log-scale-ish) */
function radiusFor(v){
  const x = Math.max(0, Number(v)||0);
  const r = Math.sqrt(x) * 2.2 + 4; // subtiel schaal
  return Math.min(28, Math.max(4, r));
}

function renderGemeenten(data){
  const items = Object.entries(data.per_gemeente || {});
  const layer = L.layerGroup();
  for(const [naam, g] of items){
    if(!g || !g.lat || !g.lng) continue;
    const val = Number(g.aantal)||0;
    const circle = L.circleMarker([g.lat, g.lng], {
      radius: radiusFor(val),
      color: '#1e88e5',
      weight: 1,
      fillColor: '#ff6f00',
      fillOpacity: .6
    });
    circle.bindPopup(`
      <strong>${naam}</strong><br/>
      Aantal: ${val.toLocaleString('nl-NL')}
    `);
    layer.addLayer(circle);
  }
  layer.addTo(map);
}

/* ---------- boot ---------- */
(async function boot(){
  $('#year').textContent = new Date().getFullYear();
  initMap();
  const data = await loadTotals();
  renderGemeenten(data);
})();
