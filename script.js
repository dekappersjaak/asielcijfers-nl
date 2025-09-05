// Kleine helperfuncties voor DOM-selectie
const $  = (q, s=document) => s.querySelector(q);
const $$ = (q, s=document) => [...s.querySelectorAll(q)];

// Jaar in footer instellen
$('#year').textContent = new Date().getFullYear();

// Begrippen met titels en toelichtingen
const DEFINITIES = {
  asielaanvraag: { titel:'Asielaanvraag', tekst:'Een verzoek om bescherming in Nederland. Wordt beoordeeld door de IND.' },
  statushouder: { titel:'Statushouder',  tekst:'Iemand die een verblijfsvergunning asiel heeft gekregen.' },
  opname:       { titel:'Opname',        tekst:'De huisvesting/plaatsing van statushouders in gemeenten.' }
};

// Open een modal met definities. Indien een key is meegegeven, toon deze als eerste.
function openDefs(key){
  const wrap = $('#defs-content');
  wrap.innerHTML = `
    <article>
      <h4>${key ? DEFINITIES[key].titel : 'Uitleg'}</h4>
      <p>${key ? DEFINITIES[key].tekst : 'Klik op een begrip voor de definitie.'}</p>
      <hr />
      ${Object.entries(DEFINITIES).map(([k,v])=>
        `<details ${k===key?'open':''}><summary><strong>${v.titel}</strong></summary><p>${v.tekst}</p></details>`
      ).join('')}
    </article>
  `;
  $('#defs').showModal();
}
// Koppel openers aan chips en knoppen
$$('[data-open="defs"]').forEach(btn=>{
  btn.addEventListener('click', ()=> openDefs(btn.dataset.key || null));
});

// Easing-functie voor telleranimatie
function easeOutCubic(p){ return 1 - Math.pow(1 - p, 3); }
// Animeer getallen van 0 naar een doel in een opgegeven tijd (ms)
function animateCount(el, to, dur=1000){
  const start = performance.now();
  const from  = 0;
  function step(t){
    const p   = Math.min(1, (t - start)/dur);
    const val = Math.round(from + (to - from) * easeOutCubic(p));
    el.textContent = val.toLocaleString('nl-NL');
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Laad totalen en kleine tiles uit JSON. Fallback op demo-waarden bij fouten.
async function loadTotals(){
  // Voor demo: standaardwaarden
  let data = {
    meta: {
      totaal_asielaanvragen: 25,
      week: 25,
      maand: 110,
      jaar: 1540,
      laatst_bijgewerkt: 'demo'
    },
    per_gemeente: {}
  };
  try{
    const res = await fetch(`/data/gemeenten-stats.json?v=${Date.now()}`);
    if(res.ok) data = await res.json();
  }catch(e){
    console.warn('Kon data niet laden, gebruik demo.');
  }
  const total = data.meta?.totaal_asielaanvragen ?? 25;
  animateCount($('#total-count'), total, 1200);
  $('#last-updated').textContent = data.meta?.laatst_bijgewerkt || 'n.v.t.';
  $('#s-week').textContent  = data.meta?.week  ?? '—';
  $('#s-month').textContent = data.meta?.maand ?? '—';
  $('#s-year').textContent  = data.meta?.jaar  ?? '—';
  return data;
}

// Functie voor kleurenschaal (choropleth)
function colorScale(value, max){
  const steps = ['#e3f2fd','#b3e5fc','#4fc3f7','#29b6f6','#039be5','#0277bd'];
  // Voorkom deling door 0; bepaal index op basis van fractie van max
  const idx = Math.min(steps.length - 1, Math.floor((value / Math.max(1, max)) * steps.length));
  return steps[idx];
}

// Voeg legenda toe onder de kaart
function renderLegend(){
  $('#legend').innerHTML = `
    <span class="sw" style="background:#e3f2fd"></span> Laag
    <span class="sw" style="background:#0277bd"></span> Hoog
  `;
}

// Initialiseert de Leaflet-kaart met geojson en dataset
async function initMap(dataset){
  // Start een kaart gericht op Nederland (coördinaat midden/zoom). Schakel zoomcontrols in.
  const map = L.map('map', { zoomControl:true }).setView([52.2, 5.3], 7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }).addTo(map);
  let geo;
  try{
    geo = await fetch('/assets/nl_gemeenten.geojson').then(r=>r.json());
  }catch(e){
    console.error('GeoJSON ontbreekt of kon niet geladen worden');
    return;
  }
  const byCode = dataset?.per_gemeente ?? {};
  const values  = Object.values(byCode);
  const max     = values.length ? Math.max(...values) : 1;
  L.geoJSON(geo, {
    style: f => {
      const gm = f.properties?.statcode || f.properties?.GM_CODE || f.properties?.code || '';
      const val= byCode[gm] ?? 0;
      return {
        color:'rgba(255,255,255,.15)',
        weight:1,
        fillColor: colorScale(val, max),
        fillOpacity:.85
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.statnaam || feature.properties?.GM_NAAM || 'Gemeente';
      const gm   = feature.properties?.statcode || feature.properties?.GM_CODE || '';
      const val  = byCode[gm] ?? 0;
      layer.bindPopup(`<strong>${name}</strong><br/>Opname statushouders: ${val}`);
      layer.on('mouseover', ()=> layer.setStyle({weight:2}));
      layer.on('mouseout',  ()=> layer.setStyle({weight:1}));
    }
  }).addTo(map);
  renderLegend();
}

// Start de applicatie: laad totalen en initialiseer de kaart
(async function(){
  try{
    const data = await loadTotals();
    await initMap(data);
  }catch(e){
    console.error(e);
    $('#total-count').textContent = '25';
    $('#last-updated').textContent = 'demo';
  }
})();