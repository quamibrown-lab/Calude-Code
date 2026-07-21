const axios = require('axios');

/*
 * Live market data via Stooq's free CSV quote endpoint (no API key required).
 * We request the day's OHLC for every symbol in a single call and derive the
 * session move as (close - open) / open. If the network call fails (e.g. the
 * outbound proxy blocks it), we fall back to a small synthetic movement so the
 * dashboard always renders — clearly flagged with source: 'mock'.
 */

const STOOQ_URL = 'https://stooq.com/q/l/';

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(s => s.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const row = {};
    header.forEach((key, i) => { row[key] = (cols[i] || '').trim(); });
    return row;
  });
}

async function fetchQuotes(tickers) {
  const symbols = [...new Set(tickers.filter(Boolean))];
  if (!symbols.length) return { quotes: {}, source: 'mock' };

  try {
    const url = `${STOOQ_URL}?s=${symbols.join(',')}&f=sd2t2ohlcv&h&e=csv`;
    const { data } = await axios.get(url, { timeout: 12000, responseType: 'text' });
    const rows = parseCsv(typeof data === 'string' ? data : String(data));

    const quotes = {};
    let liveCount = 0;
    for (const row of rows) {
      const sym = (row.symbol || '').toLowerCase();
      const open = parseFloat(row.open);
      const close = parseFloat(row.close);
      if (!sym) continue;
      if (Number.isFinite(open) && Number.isFinite(close) && open > 0) {
        quotes[sym] = {
          price: close,
          open,
          changePct: (close - open) / open,
          live: true,
        };
        liveCount += 1;
      }
    }

    // Fill any symbols Stooq didn't return with a synthetic move.
    for (const sym of symbols) {
      if (!quotes[sym]) quotes[sym] = mockQuote(sym);
    }

    return { quotes, source: liveCount > 0 ? 'stooq' : 'mock' };
  } catch (err) {
    console.warn('[market] Live quote fetch failed, using mock:', err.message);
    const quotes = {};
    for (const sym of symbols) quotes[sym] = mockQuote(sym);
    return { quotes, source: 'mock' };
  }
}

function mockQuote(sym) {
  // Deterministic-ish small daily move seeded by symbol + date so it is stable
  // within a day but varies day to day.
  const seed = [...`${sym}${new Date().toISOString().slice(0, 10)}`]
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const changePct = ((seed % 400) - 200) / 10000; // -2.00% .. +1.99%
  return { price: 100 * (1 + changePct), open: 100, changePct, live: false };
}

module.exports = { fetchQuotes };
