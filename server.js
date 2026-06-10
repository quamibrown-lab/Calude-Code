require('dotenv').config();
const express = require('express');
const path = require('path');
const { EventEmitter } = require('events');

const { getMockFlights } = require('./src/mockData');
const { saveFlights, getPriceHistory, getLastScanTime } = require('./src/database');
const { checkAlerts } = require('./src/alertManager');
const scheduler = require('./src/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL_MINUTES || '30', 10);

const scanEmitter = new EventEmitter();
const clients = new Set();

let latestFlights = [];
let previousFlights = [];
let lastAlerts = [];
let lastScanTime = null;
let scanSource = 'mock';

async function runScan() {
  console.log('[scan] Starting flight scan...');
  let flights;

  if (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) {
    try {
      const { fetchAllFlights } = require('./src/amadeusClient');
      flights = await fetchAllFlights();
      scanSource = 'amadeus';
      console.log(`[scan] Amadeus returned ${flights.length} flights`);
    } catch (err) {
      console.warn('[scan] Amadeus API failed, falling back to mock:', err.message);
      flights = getMockFlights();
      scanSource = 'mock';
    }
  } else {
    flights = getMockFlights();
    scanSource = 'mock';
  }

  lastAlerts = checkAlerts(previousFlights, flights);
  previousFlights = latestFlights;
  latestFlights = flights;
  lastScanTime = new Date().toISOString();

  saveFlights(flights, scanSource);

  const payload = JSON.stringify({
    flights,
    alerts: lastAlerts,
    scannedAt: lastScanTime,
    source: scanSource,
    nextScanIn: SCAN_INTERVAL * 60,
  });

  for (const res of clients) {
    try { res.write(`event: scan-complete\ndata: ${payload}\n\n`); } catch (_) {}
  }

  console.log(`[scan] Done. ${flights.length} flights, ${lastAlerts.length} alerts. Source: ${scanSource}`);
}

// REST API
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/flights', (_req, res) => {
  res.json({
    flights: latestFlights,
    alerts: lastAlerts,
    scannedAt: lastScanTime,
    source: scanSource,
    nextScanIn: SCAN_INTERVAL * 60,
  });
});

app.get('/api/history', (_req, res) => {
  const rows = getPriceHistory(7);
  // Group by flight_id for charting
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.flight_id]) {
      grouped[row.flight_id] = {
        flightId: row.flight_id,
        airline: row.airline,
        iataCode: row.iata_code,
        route: `${row.origin}→${row.destination}`,
        points: [],
      };
    }
    grouped[row.flight_id].points.push({ t: row.scanned_at, price: row.price });
  }
  res.json(Object.values(grouped));
});

app.post('/api/scan', async (_req, res) => {
  await runScan();
  res.json({ ok: true, scannedAt: lastScanTime, count: latestFlights.length });
});

// Server-Sent Events
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(':ok\n\n');
  clients.add(res);
  console.log(`[sse] Client connected (${clients.size} total)`);

  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    console.log(`[sse] Client disconnected (${clients.size} remaining)`);
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    uptime: process.uptime(),
    lastScan: lastScanTime,
    flightCount: latestFlights.length,
    source: scanSource,
    clientCount: clients.size,
  });
});

// Boot
app.listen(PORT, async () => {
  console.log(`\n✈  Flight Scanner running at http://localhost:${PORT}`);
  console.log(`   Data source: ${process.env.AMADEUS_CLIENT_ID ? 'Amadeus API' : 'Mock data (set AMADEUS_CLIENT_ID to use live API)'}`);
  console.log(`   Scan interval: every ${SCAN_INTERVAL} minutes\n`);
  await runScan();
  scheduler.start(runScan, SCAN_INTERVAL);
});
