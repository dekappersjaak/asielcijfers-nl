// scripts/update-data.mjs
//
// A simple Node.js script to update data.json monthly from external sources.
// Replace SOURCE_JSON_URL or SOURCE_CSV_URL with real endpoints from IND or CBS.
// This script will be run via GitHub Actions to fetch and process the latest data,
// write it to /data/data.json, and make a backup in /data/backups.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The current year; override with YEAR env if needed
const YEAR = Number(process.env.YEAR || new Date().getFullYear());

// Optionally specify remote sources via environment
const SOURCE_JSON_URL = process.env.SOURCE_JSON_URL || '';
const SOURCE_CSV_URL  = process.env.SOURCE_CSV_URL  || '';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return res.text();
}

// Basic CSV parser (comma-separated, header-based)
function simpleCSV(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map(h => h.trim());
  return lines.map(line => {
    const parts = line.split(',').map(p => p.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = parts[i]; });
    return obj;
  });
}

function monthKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}`;
}

async function run() {
  // Default dataset (acts as a fallback)
  let data = {
    year: YEAR,
    total: 25000,
    statusholders: 17500,
    lastOfficialMonth: `${YEAR}-07`,
    monthly: [
      { month: `${YEAR}-01`, value: 2000 },
      { month: `${YEAR}-02`, value: 1800 },
      { month: `${YEAR}-03`, value: 1950 },
      { month: `${YEAR}-04`, value: 1980 },
      { month: `${YEAR}-05`, value: 2100 },
      { month: `${YEAR}-06`, value: 2065 },
      { month: `${YEAR}-07`, value: 2065 }
    ],
    countries: [
      { name:"Syrië", share:22 }, { name:"Turkije", share:15 },
      { name:"Afghanistan", share:11 }, { name:"Jemen", share:9 },
      { name:"Somalië", share:8 }, { name:"Irak", share:7 },
      { name:"Eritrea", share:6 }, { name:"Iran", share:5 },
      { name:"Marokko", share:4 }, { name:"Onbekend/overig", share:13 }
    ],
    regions: [
      { name:"Groningen", lat:53.2194, lng:6.5665, value:500 },
      { name:"Utrecht", lat:52.0907, lng:5.1214, value:300 },
      { name:"Zuid-Holland", lat:52.0030, lng:4.3700, value:600 },
      { name:"Noord-Brabant", lat:51.4827, lng:5.2322, value:550 },
      { name:"Gelderland", lat:52.0452, lng:5.8717, value:480 }
    ],
    sources: [
      "https://www.ind.nl/over-ind/cijfers-publicaties",
      "https://opendata.cbs.nl"
    ],
    lastUpdated: new Date().toISOString()
  };

  try {
    if (SOURCE_JSON_URL) {
      const raw = await fetchJSON(SOURCE_JSON_URL);
      // TODO: map raw JSON fields to our data structure
      // Example: data.monthly = raw.monthly; etc.
    } else if (SOURCE_CSV_URL) {
      const text = await fetchText(SOURCE_CSV_URL);
      const rows = simpleCSV(text);
      // TODO: process CSV rows into data.monthly, data.countries, etc.
    }
  } catch (e) {
    console.error('Update failed; using fallback dataset:', e.message);
  }

  // Write data.json and backup
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.join(__dirname, '..', 'data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(data, null, 2));
  // Backup
  const backupDir = path.join(dataDir, 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  await fs.writeFile(path.join(backupDir, `data-${stamp}.json`), JSON.stringify(data, null, 2));
  console.log('data.json updated and backup created');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});