/* Asielcijfers NL – SPA
 * - Data via fetch('data/data.json') of fallback SAMPLE_DATA
 * - Chart.js lijnchart
 * - Leaflet kaart met heatmap en markers
 * - Dark-mode, auto-refresh, herladen-knop
 * - PapaParse voorbeeldfunctie voor CSV -> JSON
 */

(() => {
  "use strict";

  // ======= Config =======
  const DATA_CANDIDATE_URLS = [
    "data/data.json",  // plaats in /data/data.json (aanrader)
    "data.json"        // desnoods in root
  ];

  // Instructieve fallback dataset (werkt direct out-of-the-box)
  const SAMPLE_DATA = {
    year: 2025,
    totalYTD: 38000,
    prevYearYTD: 42850,
    lastUpdated: new Date().toISOString().slice(0,10),
    monthly: [
      {"month":"2024-09","value":3500},
      {"month":"2024-10","value":3700},
      {"month":"2024-11","value":3600},
      {"month":"2024-12","value":3300},
      {"month":"2025-01","value":2800},
      {"month":"2025-02","value":2900},
      {"month":"2025-03","value":3100},
      {"month":"2025-04","value":3200},
      {"month":"2025-05","value":3400},
      {"month":"2025-06","value":3550},
      {"month":"2025-07","value":3650},
      {"month":"2025-08","value":3650}
    ],
    topNationalities: [
      {"country":"Syrië","value":12000},
      {"country":"Afghanistan","value":7800},
      {"country":"Jemen","value":4200},
      {"country":"Turkije","value":3900},
      {"country":"Somalië","value":2400}
    ],
    byRegion: [
      // Benaderde centroiden per provincie (voorbeeld) + fictieve waarden
      {"name":"Groningen","lat":53.2194,"lng":6.5665,"value":650},
      {"name":"Friesland","lat":53.1642,"lng":5.7818,"value":540},
      {"name":"Drenthe","lat":52.9476,"lng":6.6231,"value":480},
      {"name":"Overijssel","lat":52.4380,"lng":6.5016,"value":920},
      {"name":"Flevoland","lat":52.5279,"lng":5.5953,"value":600},
      {"name":"Gelderland","lat":52.0452,"lng":5.8717,"value":1600},
      {"name":"Utrecht","lat":52.0907,"lng":5.1214,"value":1200},
      {"name":"Noord-Holland","lat":52.5200,"lng":4.7885,"value":2200},
      {"name":"Zuid-Holland","lat":52.0030,"lng":4.3700,"value":2600},
      {"name":"Zeeland","lat":51.4940,"lng":3.8497,"value":350},
      {"name":"Noord-Brabant","lat":51.4827,"lng":5.2322,"value":1900},
      {"name":"Limburg","lat":51.4427,"lng":6.0600,"value":880}
    ],
    sourceLinks: [
      "https://www.ind.nl/over-ind/cijfers-publicaties",
      "https://www.cbs.nl"
    ]
  };

  // ======= Elements =======
  const el = {
    ytdYear: document.getElementById("ytdYear"),
    totalCounter: document.getElementById("totalCounter"),
    monthlyValue: document.getElementById("monthlyValue"),
    monthlyLabel: document.getElementById("monthlyLabel"),
    yoyDelta: document.getElementById("yoyDelta"),
    yoyDeltaPct: document.getElementById("yoyDeltaPct"),
    topNationalities: document.getElementById("topNationalities"),
    lastUpdated: document.getElementById("lastUpdated"),
    sourceLinks: document.getElementById("sourceLinks"),
    yearNow: document.getElementById("yearNow"),
    reloadBtn: document.getElementById("reloadBtn"),
    themeToggle: document.getElementById("themeToggle"),
    downloadData: document.getElementById("downloadData"),
    toggleHeat: document.getElementById("toggleHeat"),
    toggleMarkers: document.getElementById("toggleMarkers"),
    chartCanvas: document.getElementById("trendChart"),
    map: document.getElementById("map"),
  };

  // ======= State =======
  let state = {
    data: null,
    chart: null,
    map: null,
    heatLayer: null,
    markerLayer: null,
    theme: null
  };

  // ======= Utils =======
  const fmt = new Intl.NumberFormat('nl-NL');
  const fmtPct = new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 1 });

  function formatNum(n){ return fmt.format(Number(n || 0)); }

  function monthLabel(isoYYYYMM){
    // "2025-08" -> "aug 2025"
    const [y,m] = isoYYYYMM.split("-").map(Number);
    const d = new Date(y, m-1, 1);
    return d.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
  }

  function setLastUpdated(dateStr){
    const d = dateStr ? new Date(dateStr) : new Date();
    el.lastUpdated.textContent = d.toLocaleDateString('nl-NL', { year:'numeric', month:'long', day:'2-digit' });
  }

  function setThemeClass(theme){
    const root = document.documentElement;
    if(theme === 'light'){
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }

  function getPrefTheme(){
    const saved = localStorage.getItem('theme');
    if(saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  // ======= Data Loading =======
  async function fetchFirstAvailable(urls){
    for(const url of urls){
      try{
        const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
        if(res.ok){
          return await res.json();
        }
      }catch(e){ /* try next */ }
    }
    // Fallback
    return JSON.parse(JSON.stringify(SAMPLE_DATA));
  }

  async function loadData(){
    const data = await fetchFirstAvailable(DATA_CANDIDATE_URLS);
    state.data = data;
    localStorage.setItem('lastData', JSON.stringify(data));
    localStorage.setItem('lastUpdatedAt', new Date().toISOString());
    updateUI();
  }

  // Example: CSV -> JSON (not used by default)
  async function loadFromCSV(csvUrl){
    return new Promise((resolve, reject) => {
      Papa.parse(csvUrl, {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: (results) => resolve(results.data),
        error: reject
      });
    });
  }

  // ======= UI Update =======
  function updateUI(){
    const d = state.data;
    if(!d) return;

    // Header totals
    el.ytdYear.textContent = d.year ?? new Date().getFullYear();
    el.totalCounter.textContent = formatNum(d.totalYTD ?? 0);
    setLastUpdated(d.lastUpdated);

    // Monthly (last entry)
    if(Array.isArray(d.monthly) && d.monthly.length){
      const last = d.monthly[d.monthly.length - 1];
      el.monthlyValue.textContent = `${formatNum(last.value)} aanvragen`;
      el.monthlyLabel.textContent = monthLabel(last.month);
    }else{
      el.monthlyValue.textContent = "—";
    }

    // YoY delta
    const total = Number(d.totalYTD || 0);
    const prev = Number(d.prevYearYTD || 0);
    const diff = total - prev;
    const pct = prev ? diff / prev : 0;
    el.yoyDelta.textContent = `${diff >= 0 ? '▲' : '▼'} ${formatNum(Math.abs(diff))}`;
    el.yoyDelta.classList.toggle('trend-up', diff > 0);
    el.yoyDelta.classList.toggle('trend-down', diff < 0);
    el.yoyDeltaPct.textContent = prev ? `${fmtPct.format(pct)} vs ${d.year-1}` : "—";

    // Top 5
    el.topNationalities.innerHTML = "";
    (d.topNationalities || []).slice(0,5).forEach((row, i) => {
      const li = document.createElement('li');
      li.textContent = `${i+1}. ${row.country}: ${formatNum(row.value)}`;
      el.topNationalities.appendChild(li);
    });

    // Sources
    el.sourceLinks.innerHTML = "";
    (d.sourceLinks || []).forEach(url => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = new URL(url).hostname.replace('www.','');
      li.appendChild(a); el.sourceLinks.appendChild(li);
    });

    // Chart & map
    renderChart(d);
    renderMap(d);
  }

  // ======= Chart =======
  function renderChart(d){
    const ctx = el.chartCanvas.getContext('2d');

    // Build labels and data
    const months = (d.monthly || []).map(x => monthLabel(x.month));
    const values = (d.monthly || []).map(x => Number(x.value || 0));

    // Destroy prior chart
    if(state.chart){ state.chart.destroy(); }

    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Asielaanvragen per maand',
          data: values,
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => fmt.format(v) }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${fmt.format(ctx.parsed.y)} aanvragen`
            }
          }
        }
      }
    });

    // Resize container to a sensible height
    el.chartCanvas.parentElement.style.height = "320px";
  }

  // ======= Map =======
  function renderMap(d){
    // Init map once
    if(!state.map){
      state.map = L.map('map', { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap-bijdragers'
      }).addTo(state.map);
      // Center on NL
      state.map.setView([52.2, 5.3], 7);

      // Controls checkboxes
      el.toggleHeat.addEventListener('change', () => {
        updateOverlays();
      });
      el.toggleMarkers.addEventListener('change', updateOverlays);

      // Invalidate after small delay to fix initial size
      setTimeout(() => state.map.invalidateSize(), 300);
    }

    // Remove old layers
    if(state.heatLayer){ state.map.removeLayer(state.heatLayer); state.heatLayer = null; }
    if(state.markerLayer){ state.map.removeLayer(state.markerLayer); state.markerLayer = null; }

    const pts = (d.byRegion || []).map(r => {
      const intensity = Number(r.value || 0);
      return [r.lat, r.lng, Math.max(0.1, intensity / 3000)]; // normalize heat
    });

    // Heat layer
    state.heatLayer = L.heatLayer(pts, { radius: 25, blur: 18, maxZoom: 10, minOpacity: 0.4 });

    // Marker layer
    state.markerLayer = L.layerGroup(
      (d.byRegion || []).map(r => {
        const size = Math.min(30, 8 + (r.value||0)/150); // scale bubble
        const marker = L.circleMarker([r.lat, r.lng], {
          radius: size,
          color: '#fff',
          fillColor: '#3b82f6',
          fillOpacity: 0.7,
          weight: 1
        });
        marker.bindTooltip(`<strong>${r.name}</strong><br>${fmt.format(r.value)} aanvragen`, { sticky: true });
        return marker;
      })
    );

    updateOverlays();

    function updateOverlays(){
      // heat
      if(el.toggleHeat.checked){
        state.map.addLayer(state.heatLayer);
      }else{
        state.map.removeLayer(state.heatLayer);
      }
      // markers
      if(el.toggleMarkers.checked){
        state.map.addLayer(state.markerLayer);
      }else{
        state.map.removeLayer(state.markerLayer);
      }
    }
  }

  // ======= Events / init =======
  function bindEvents(){
    el.reloadBtn.addEventListener('click', loadData);

    el.themeToggle.addEventListener('click', () => {
      state.theme = (state.theme === 'light') ? 'dark' : 'light';
      localStorage.setItem('theme', state.theme);
      setThemeClass(state.theme);
      // Map repaint
      if(state.map){ setTimeout(() => state.map.invalidateSize(), 200); }
    });

    el.downloadData.addEventListener('click', (e) => {
      e.preventDefault();
      const data = state.data || SAMPLE_DATA;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `asielcijfers-${data.year || 'data'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function autoRefreshEvery24h(){
    const oneDay = 24 * 60 * 60 * 1000;
    setInterval(loadData, oneDay);
  }

  function init(){
    // Footer year
    el.yearNow.textContent = new Date().getFullYear();

    // Theme
    state.theme = getPrefTheme();
    setThemeClass(state.theme);

    // Load persisted data if any (instant paint), then refresh
    const cached = localStorage.getItem('lastData');
    if(cached){
      try{
        state.data = JSON.parse(cached);
        updateUI();
      }catch(e){}
    }

    bindEvents();
    autoRefreshEvery24h();
    loadData();
  }

  // Go
  document.addEventListener('DOMContentLoaded', init);

})();
