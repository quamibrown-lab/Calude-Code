require('dotenv').config();
const express = require('express');
const path = require('path');
const { EventEmitter } = require('events');

const { readHoldings, writeHoldings } = require('./src/holdings');
const { fetchQuotes } = require('./src/marketData');
const { buildPortfolio } = require('./src/portfolio');
const { saveSnapshot, getValueHistory, getLastScan } = require('./src/database');
const scheduler = require('./src/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL_MINUTES || '15', 10);

const scanEmitter = new EventEmitter();
const clients = new Set();

let latestPortfolio = null;
let lastScanTime = null;
let scanSource = 'mock';

async function runScan() {
  console.log('[scan] Refreshing market movements...');
  const holdings = readHoldings();
  const { quotes, source } = await fetchQuotes(holdings.map(h => h.ticker));

  latestPortfolio = buildPortfolio(holdings, quotes);
  scanSource = source;
  lastScanTime = new Date().toISOString();

  saveSnapshot(latestPortfolio, source);

  const payload = JSON.stringify(buildResponse());
  for (const res of clients) {
    try { res.write(`event: scan-complete\ndata: ${payload}\n\n`); } catch (_) {}
  }

  console.log(`[scan] Done. Total $${latestPortfolio.totals.value.toFixed(0)}, ` +
    `day ${(latestPortfolio.totals.dayChangePct * 100).toFixed(2)}%. Source: ${source}`);
}

function buildResponse() {
  return {
    ...latestPortfolio,
    scannedAt: lastScanTime,
    source: scanSource,
    nextScanIn: SCAN_INTERVAL * 60,
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/portfolio', (_req, res) => {
  if (!latestPortfolio) return res.json({ ready: false });
  res.json(buildResponse());
});

app.get('/api/holdings', (_req, res) => {
  res.json(readHoldings());
});

app.put('/api/holdings', async (req, res) => {
  const incoming = req.body && req.body.holdings;
  if (!Array.isArray(incoming) || !incoming.length) {
    return res.status(400).json({ error: 'Body must be { holdings: [...] } with at least one holding.' });
  }
  const saved = writeHoldings(incoming);
  await runScan();
  res.json({ ok: true, holdings: saved, portfolio: buildResponse() });
});

app.get('/api/history', (_req, res) => {
  res.json(getValueHistory(30));
});

app.post('/api/scan', async (_req, res) => {
  await runScan();
  res.json({ ok: true, scannedAt: lastScanTime, ...buildResponse() });
});

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
    source: scanSource,
    totalValue: latestPortfolio ? latestPortfolio.totals.value : null,
    clientCount: clients.size,
    lastPersisted: getLastScan(),
  });
});

app.listen(PORT, async () => {
  console.log(`\n📈  Market Movements Tracker running at http://localhost:${PORT}`);
  console.log(`   Live prices: Stooq (free, no key). Falls back to mock if network blocked.`);
  console.log(`   Refresh interval: every ${SCAN_INTERVAL} minutes\n`);
  await runScan();
  scheduler.start(runScan, SCAN_INTERVAL);
});
