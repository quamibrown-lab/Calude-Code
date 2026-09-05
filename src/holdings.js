const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HOLDINGS_FILE = path.join(DATA_DIR, 'holdings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/*
 * Actual current 401(k) balance $63,000.00 (as of Jul 28, 2026), split across
 * the six funds per the 50/10/10/8/17/5 election. Anchored to the real account
 * total rather than the stale Jul 20 statement closing balances ($58,558.27),
 * which did not include market appreciation since the statement date. This
 * portfolio is 100% equity — there is no bond / fixed-income position.
 *
 * Each holding stores the dollar value invested plus a liquid `ticker` used as a
 * live-price proxy for that fund's asset class (the underlying BlackRock/SSgA
 * collective trusts have no public ticker, so a comparable ETF stands in for
 * live movement tracking), and a long-run expected annual return assumption used
 * for the projection math. Edit these via the dashboard or data/holdings.json.
 */
const SEED_HOLDINGS = [
  {
    id: 'sp500',
    name: 'S&P 500 Index — SSgA',
    ticker: 'spy.us',
    assetClass: 'US Large Cap',
    value: 31500.00,
    expectedReturn: 0.075,
  },
  {
    id: 'lc-value',
    name: 'Lrg Cap Value Eq Idx — BlackRock',
    ticker: 'ive.us',
    assetClass: 'US Large Cap',
    value: 6300.00,
    expectedReturn: 0.075,
  },
  {
    id: 'mid-cap',
    name: 'Mid Cap Eq Index — SSgA',
    ticker: 'ijh.us',
    assetClass: 'US Mid Cap',
    value: 6300.00,
    expectedReturn: 0.08,
  },
  {
    id: 'small-cap',
    name: 'Small Cap Eq Index — SSgA',
    ticker: 'ijr.us',
    assetClass: 'US Small Cap',
    value: 5040.00,
    expectedReturn: 0.085,
  },
  {
    id: 'intl',
    name: 'Intl Equity Index — BlackRock',
    ticker: 'efa.us',
    assetClass: 'International',
    value: 10710.00,
    expectedReturn: 0.065,
  },
  {
    id: 'emerging',
    name: 'Emerging Markets Index — SSgA',
    ticker: 'eem.us',
    assetClass: 'Emerging Mkts',
    value: 3150.00,
    expectedReturn: 0.085,
  },
];

function readHoldings() {
  try {
    const raw = fs.readFileSync(HOLDINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* fall through to seed */
  }
  writeHoldings(SEED_HOLDINGS);
  return SEED_HOLDINGS;
}

function writeHoldings(holdings) {
  const clean = holdings.map((h, i) => ({
    id: h.id || `holding-${i}`,
    name: String(h.name || 'Untitled holding'),
    ticker: String(h.ticker || '').toLowerCase(),
    assetClass: h.assetClass || 'Other',
    value: Number(h.value) || 0,
    expectedReturn: Number(h.expectedReturn) || 0,
  }));
  fs.writeFileSync(HOLDINGS_FILE, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

module.exports = { readHoldings, writeHoldings, SEED_HOLDINGS };
