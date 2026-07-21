const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'value_history.json');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

function saveSnapshot(portfolio, source = 'mock') {
  const now = new Date().toISOString();

  const history = readJSON(HISTORY_FILE, []);
  history.push({
    t: now,
    value: portfolio.totals.value,
    dayChange: portfolio.totals.dayChange,
    dayChangePct: portfolio.totals.dayChangePct,
  });
  writeJSON(HISTORY_FILE, history.slice(-2000));

  const scans = readJSON(SCANS_FILE, []);
  scans.push({ scanned_at: now, source, value: portfolio.totals.value });
  writeJSON(SCANS_FILE, scans.slice(-500));
}

function getValueHistory(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return readJSON(HISTORY_FILE, []).filter(r => r.t >= since);
}

function getLastScan() {
  const scans = readJSON(SCANS_FILE, []);
  return scans.length ? scans[scans.length - 1] : null;
}

module.exports = { saveSnapshot, getValueHistory, getLastScan };
