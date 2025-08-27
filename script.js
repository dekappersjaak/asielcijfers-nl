/*
 * Asielcijfers NL (data-only version)
 * This script powers the SPA: animated counters, simulated growth, charts, map,
 * and data loading with fallback. It includes auto-refresh and share links.
 */

(() => {
  "use strict";

  // ======= Configuration =======
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SIM_INC_REQUESTS = 68;   // daily growth (asielaanvragen)
  const SIM_INC_STATUS   = 48;   // daily growth (statushouders)
  const START_YEAR = 2025;
  // Candidate endpoints for JSON data
  const DATA_URLS = ["data/data.json", "data.json"];

  // Fallback dataset used when remote JSON isn't available
  const FALLBACK = {
    year: START_YEAR,
    total: 25000,
    statusholders: 17500,
    todayEstimate: SIM_INC_REQUESTS,
    lastOfficialMonth: "2025-07",
    monthly: [
      { month: "2025-01", value: 2000 },
      { month: "2025-02", value: 1800 },
      { month: "2025-03", value: 1950 },
      { month: "2025-04", value: 1980 },
      { month: "2025-05", value: 2100 },
      { month: "2025-06", value: 2065 },
      { month: "2025-07", value: 2065 }
    ],
    countries: [
      { name: "Syrië", share: 22 },
      { name: "Turkije", share: 15 },
      { name: "Afghanistan", share: 11 },
      { name: "Jemen", share: 9 },
      { name: "Somalië", share: 8 },
      { name: "Irak", share: 7 },
      { name: "Eritrea", share: 6 },
      { name: "Iran", share: 5 },
      { name: "Marokko", share: 4 },
      { name: "Onbekend/overig", share: 13 }
    ],
    regions: [
      { name: "Groningen", lat: 53.2194, lng: 6.5665, value: 500 },
      { name: "Utrecht", lat: 52.0907, lng: 5.1214, value: 300 },
      { name: "Zuid-Holland", lat: 52.0030, lng: 4.3700, value: 600 },
      { name: "Noord-Brabant", lat: 51.4827, lng: 5.2322, value: 550 },
      { name: "Gelderland", lat: 52.0452, lng: 5.8717, value: 480 }
    ],
    sources: [
      "https://www.ind.nl/over-ind/cijfers-publicaties",
      "https://opendata.cbs.nl"
    ],
    lastUpdated: new Date().toISOString()
  };

  // ======= Utility functions =======
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const fmt = new Intl.NumberFormat('nl-NL');
  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function loadCached() {
    try { return JSON.parse(localStorage.getItem("acnl_data") || "null"); } catch { return null; }
  }
  function saveCached(d) {
    try { localStorage.setItem("acnl_data", JSON.stringify(d)); } catch {}
  }

  function dayDiff(fromISO) {
    // number of days between given date and today (rounded down)
    const d0 = new Date(fromISO).setHours(0, 0, 0, 0);
    const d1 = new Date().setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((d1 - d0) / ONE_DAY_MS));
  }

  // Ease out cubic for smooth animations
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Animate a number using requestAnimationFrame from 0 to target
  function animateNumber(el, target, duration = 2000) {
    if (!el) return;
    const start = performance.now();
    const from = 0;
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const val = Math.round(from + (target - from) * easeOutCubic(p));
      el.textContent = fmt.format(val);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Pulsing effect for statushouders counter every 10s
  function pulseStatus() {
    const el = $("#statusCounter");
    if (!el) return;
    el.classList.add("pulse");
    setTimeout(() => el.classList.remove("pulse"), 1200);
  }

  // Fetch data from first available endpoint
  async function fetchFirst(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          return json;
        }
      } catch (e) {
        // try next
      }
    }
    return null;
  }

  // Example of reading CSV using PapaParse; adjust for real sources
  async function fetchCSV(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: r => resolve(r.data),
        error: reject
      });
    });
  }

  // Process monthly update (placeholder: can be extended to update from CSV/JSON)
  async function monthlyUpdate(data) {
    // Example: Use PapaParse to load a CSV and update data.monthly/countries
    // const rows = await fetchCSV('path/to/ind.csv');
    // ... process rows ...
    return data;
  }

  // Build Pie Chart with Chart.js
  let pie;
  function buildPie(countries) {
    const ctx = $("#pieChart").getContext("2d");
    if (pie) pie.destroy();
    const labels = countries.map(c => c.name);
    const values = countries.map(c => c.share);
    pie = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [ { data: values, borderWidth: 1 } ]
      },
      options: {
        animation: { duration: 600 },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#fff' } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = ctx.parsed;
                const total = Number($("#totalCounter").textContent.replace(/\D/g, '')) || FALLBACK.total;
                const abs = Math.round(total * (pct / 100));
                return `${ctx.label}: ${pct}% (${fmt.format(abs)})`;
              }
            }
          }
        }
      }
    });
  }

  // Build Line Chart
  let line;
  function buildLine(monthly) {
    const ctx = $("#lineChart").getContext("2d");
    if (line) line.destroy();
    const labels = monthly.map(m => m.month.slice(5,7) + '-' + m.month.slice(2,4));
    const values = monthly.map(m => m.value);
    line = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [ { label: 'Aanvragen per maand', data: values, tension: 0.25, borderWidth: 2, pointRadius: 3 } ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#fff' } },
          y: { beginAtZero: true, ticks: { color: '#fff', callback: v => fmt.format(v) } }
        }
      }
    });
  }

  // Build Leaflet map and markers
  let map;
  let markers;
  function buildMap(regions) {
    if (!map) {
      map = L.map('map');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap-bijdragers'
      }).addTo(map);
      map.setView([52.2, 5.3], 7);
    }
    if (markers) markers.clearLayers();
    markers = L.layerGroup().addTo(map);
    regions.forEach(r => {
      const circle = L.circleMarker([r.lat, r.lng], {
        radius: Math.min(24, 6 + (r.value || 0) / 80),
        color: '#fff', weight: 1,
        fillColor: '#2E9AFF', fillOpacity: 0.8
      }).bindTooltip(`<strong>${r.name}</strong><br>${fmt.format(r.value)} aanvragen`);
      markers.addLayer(circle);
    });
    setTimeout(() => map.invalidateSize(), 200);
  }

  // Main render function: loads data, simulates growth, updates UI and charts
  async function loadAndRender() {
    let data = loadCached() || FALLBACK;

    // Attempt to fetch JSON data
    const remote = await fetchFirst(DATA_URLS);
    if (remote && typeof remote === 'object') {
      data = { ...data, ...remote };
    }

    // Simulate growth since last update
    const daysSince = dayDiff(new Date().toISOString());
    const simulatedTotal  = Math.max(0, Number(data.total)) + daysSince * SIM_INC_REQUESTS;
    const simulatedStatus = Math.max(0, Number(data.statusholders || data.statusholders || data.statusholders)) + daysSince * SIM_INC_STATUS;

    // Update UI
    const now = new Date();
    setText("#yearNow", now.getFullYear().toString());
    setText("#lastUpdated", "Laatste update: " + new Date(data.lastUpdated || now).toLocaleString('nl-NL'));
    setText("#todayTicker", `Vandaag: +${SIM_INC_REQUESTS} nieuwe aanvragen (schatting)`);

    // Animate counters
    animateNumber($("#totalCounter"), simulatedTotal, 2000);
    animateNumber($("#statusCounter"), simulatedStatus, 2000);

    // Charts and map
    await monthlyUpdate(data);
    buildPie(data.countries || FALLBACK.countries);
    buildLine(data.monthly || FALLBACK.monthly);
    buildMap(data.regions || FALLBACK.regions);

    // Save to cache
    saveCached({ ...data, total: simulatedTotal, statusholders: simulatedStatus });
  }

  // Setup share links for X and Reddit
  function setupShare() {
    const url  = encodeURIComponent(location.href);
    const text = encodeURIComponent("Bekijk de live asielzoekers teller voor Nederland! #asielcijfers");
    $("#shareX").href     = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    $("#shareReddit").href = `https://www.reddit.com/submit?url=${url}&title=${text}`;
  }

  // Bind events
  function bind() {
    $("#reloadBtn")?.addEventListener("click", () => loadAndRender());
    $("#downloadData")?.addEventListener("click", (e) => {
      e.preventDefault();
      const cache = loadCached() || FALLBACK;
      const blob = new Blob([JSON.stringify(cache, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    // Pulse statushouders counter every 10 seconds
    setInterval(pulseStatus, 10000);
    // Auto refresh daily (simulate)
    setInterval(loadAndRender, ONE_DAY_MS);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setupShare();
    bind();
    await loadAndRender();
  });
})();