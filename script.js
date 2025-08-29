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
    // Per provincie data (fictieve schatting). 'province' gebruikt i.p.v. 'name'.
    regions: [
      { province: "Groningen",      lat: 53.2194, lng: 6.5665, value: 850 },
      { province: "Friesland",      lat: 53.1642, lng: 5.7818, value: 620 },
      { province: "Drenthe",        lat: 52.9476, lng: 6.6231, value: 540 },
      { province: "Overijssel",     lat: 52.4380, lng: 6.5016, value: 770 },
      { province: "Flevoland",      lat: 52.5279, lng: 5.5953, value: 460 },
      { province: "Gelderland",     lat: 52.0452, lng: 5.8717, value: 980 },
      { province: "Utrecht",        lat: 52.0907, lng: 5.1214, value: 720 },
      { province: "Noord-Holland",  lat: 52.3874, lng: 4.6462, value: 1280 },
      { province: "Zuid-Holland",   lat: 52.0030, lng: 4.3700, value: 1450 },
      { province: "Zeeland",        lat: 51.4963, lng: 3.8494, value: 350 },
      { province: "Noord-Brabant",  lat: 51.4827, lng: 5.2322, value: 1200 },
      { province: "Limburg",        lat: 51.4427, lng: 6.0609, value: 690 }
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

  // Return the start of today (midnight) as a Date object
  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
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

  /**
   * Start a continuous ticker on an element.
   * The element's text will update smoothly throughout the day.
   * It displays baseToday + (perDay * fraction of day elapsed).
   * Respects reduced motion preferences by updating without animation.
   * @param {Object} param0 - configuration object
   * @param {HTMLElement} param0.el - the element whose text will be updated
   * @param {number} param0.baseToday - base value at start of day
   * @param {number} param0.perDay - total increment per day
   */
  function startContinuousTicker({ el, baseToday, perDay }) {
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastVal = '';
    function update() {
      const now = new Date();
      const frac = Math.max(0, Math.min(1, (now - startOfToday()) / ONE_DAY_MS));
      const value = baseToday + perDay * frac;
      const formatted = fmt.format(Math.floor(value));
      if (formatted !== lastVal) {
        el.textContent = formatted;
        lastVal = formatted;
      }
      if (!reduceMotion) {
        requestAnimationFrame(update);
      }
    }
    update();
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
  // Store the current loaded data to reuse across interactions
  let currentData = null;

  let pie;
  /**
   * Build the pie chart for herkomstlanden. Accepts a list of countries
   * and a scope ('ytd' or 'month'), updates the scope label accordingly.
   * @param {Array} countries - array of {name/share}
   * @param {string} scope - 'ytd' or 'month'
   */
  function buildPie(countries, scope = 'ytd') {
    const ctx = $("#pieChart").getContext("2d");
    if (pie) pie.destroy();
    const labels = countries.map(c => c.name || c.country);
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
          legend: { position: 'bottom', labels: { color: '#111' } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = ctx.parsed;
                // Determine total based on current scope: use base total for YTD
                const totalText = $("#totalCounter").textContent.replace(/\D/g, '');
                const total = Number(totalText) || (currentData?.total ?? FALLBACK.total);
                const abs = Math.round(total * (pct / 100));
                return `${ctx.label}: ${pct}% (${fmt.format(abs)})`;
              }
            }
          }
        }
      }
    });
    // Update scope label
    const labelEl = document.getElementById('scopeLabel');
    if (labelEl) {
      labelEl.textContent = scope === 'ytd' ? '(YTD 2025)' : '(laatste maand)';
    }
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
          x: { ticks: { color: '#111' } },
          y: { beginAtZero: true, ticks: { color: '#111', callback: v => fmt.format(v) } }
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
    // Scale marker size relative to max value for visual variety
    const maxVal = Math.max(...regions.map(r => r.value || 0), 1);
    regions.forEach(r => {
      const radius = 6 + 18 * (r.value || 0) / maxVal; // scale 6–24px
      const marker = L.circleMarker([r.lat, r.lng], {
        radius,
        color: '#334155', weight: 1,
        fillColor: '#4A86FF', fillOpacity: 0.75
      }).bindTooltip(
        `<strong>${r.province || r.name}</strong><br>${fmt.format(r.value || 0)} personen`,
        { direction: 'top' }
      );
      markers.addLayer(marker);
    });
    setTimeout(() => map.invalidateSize(), 200);
  }

  /**
   * Render a sortable table of provinces and their counts into #provTable
   * @param {Array} regions - array of {province, value}
   */
  function renderProvinceTable(regions) {
    const tbody = document.getElementById('provTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    const rows = [...regions].sort((a, b) => (b.value || 0) - (a.value || 0));
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = r.province || r.name;
      const td2 = document.createElement('td');
      td2.className = 'num';
      td2.textContent = fmt.format(r.value || 0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    });
  }

  // Main render function: loads data, simulates growth, updates UI and charts
  async function loadAndRender() {
    let data = loadCached() || FALLBACK;

    // Attempt to fetch JSON data
    const remote = await fetchFirst(DATA_URLS);
    if (remote && typeof remote === 'object') {
      data = { ...data, ...remote };
    }

    // Update global reference to current data
    currentData = data;

    // Use base counts directly; continuous ticker will handle daily growth
    const baseTotal  = Math.max(0, Number(data.total));
    const baseStatus = Math.max(0, Number(data.statusholders));

    // Update UI
    const now = new Date();
    setText("#yearNow", now.getFullYear().toString());
    setText("#lastUpdated", "Laatste update: " + new Date(data.lastUpdated || now).toLocaleString('nl-NL'));
    setText("#todayTicker", `Vandaag: +${SIM_INC_REQUESTS} nieuwe aanvragen (schatting)`);

    // Initialize counters and start continuous ticker. First animate from 0 to base values,
    // then transition into continuous update.
    const totalEl = $("#totalCounter");
    const statusEl = $("#statusCounter");
    // Reset to base values (so we don't display stale values)
    totalEl.textContent  = fmt.format(baseTotal);
    statusEl.textContent = fmt.format(baseStatus);
    // Animate from 0 to base over 1.6s for a smooth entry
    animateNumber(totalEl, baseTotal, 1600);
    animateNumber(statusEl, baseStatus, 1600);
    // After animation completes, start continuous ticker
    setTimeout(() => {
      startContinuousTicker({ el: totalEl, baseToday: baseTotal, perDay: SIM_INC_REQUESTS });
    }, 1600);
    setTimeout(() => {
      startContinuousTicker({ el: statusEl, baseToday: baseStatus, perDay: SIM_INC_STATUS });
    }, 1600);

    // Charts and map
    await monthlyUpdate(data);
    // Pie chart (default to YTD)
    buildPie((data.countries || FALLBACK.countries), 'ytd');
    buildLine(data.monthly || FALLBACK.monthly);
    buildMap(data.regions || FALLBACK.regions);
    renderProvinceTable(data.regions || FALLBACK.regions);

    // Save to cache
    saveCached({ ...data, total: baseTotal, statusholders: baseStatus });
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

    // Scope selector for herkomstlanden chart
    const scopeSel = document.getElementById('scopeSelect');
    if (scopeSel) {
      scopeSel.addEventListener('change', () => {
        const scope = scopeSel.value;
        const countries = (currentData?.countries || FALLBACK.countries);
        buildPie(countries, scope);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setupShare();
    bind();
    await loadAndRender();
  });
})();