const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'price_history.json');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

function saveFlights(flights, source = 'mock') {
  const now = new Date().toISOString();

  // Append to history (keep max 2000 records)
  const history = readJSON(HISTORY_FILE, []);
  for (const f of flights) {
    history.push({
      flight_id: f.id,
      airline: f.airline,
      iata_code: f.iataCode,
      origin: f.origin,
      destination: f.destination,
      price: f.price,
      scanned_at: now,
    });
  }
  writeJSON(HISTORY_FILE, history.slice(-2000));

  // Append scan record
  const scans = readJSON(SCANS_FILE, []);
  scans.push({ scanned_at: now, source, flight_count: flights.length });
  writeJSON(SCANS_FILE, scans.slice(-500));
}

function getPriceHistory(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const history = readJSON(HISTORY_FILE, []);
  return history.filter(r => r.scanned_at >= since);
}

function getLastScanTime() {
  const scans = readJSON(SCANS_FILE, []);
  return scans.length ? scans[scans.length - 1] : null;
}

function getRecentScanCount() {
  return readJSON(SCANS_FILE, []).length;
}

module.exports = { saveFlights, getPriceHistory, getLastScanTime, getRecentScanCount };
