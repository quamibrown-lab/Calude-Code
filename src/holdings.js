const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HOLDINGS_FILE = path.join(DATA_DIR, 'holdings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/*
 * 401(k) allocation from the statement dated Jan 1 - Jul 20, 2026 (closing
 * balances, $58,558.27) plus the first payroll deposit posted Wed Jul 22
 * ($1,145.00 = $683.46 deferral + loan repayments + $461.54 employer match),
 * allocated per the 50/10/10/8/17/5 election → total $59,703.27. This portfolio
 * is 100% equity — there is no bond / fixed-income position.
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
    value: 29851.64,
    expectedReturn: 0.075,
  },
  {
    id: 'lc-value',
    name: 'Lrg Cap Value Eq Idx — BlackRock',
    ticker: 'ive.us',
    assetClass: 'US Large Cap',
    value: 5970.33,
    expectedReturn: 0.075,
  },
  {
    id: 'mid-cap',
    name: 'Mid Cap Eq Index — SSgA',
    ticker: 'ijh.us',
    assetClass: 'US Mid Cap',
    value: 5970.33,
    expectedReturn: 0.08,
  },
  {
    id: 'small-cap',
    name: 'Small Cap Eq Index — SSgA',
    ticker: 'ijr.us',
    assetClass: 'US Small Cap',
    value: 4776.26,
    expectedReturn: 0.085,
  },
  {
    id: 'intl',
    name: 'Intl Equity Index — BlackRock',
    ticker: 'efa.us',
    assetClass: 'International',
    value: 10149.55,
    expectedReturn: 0.065,
  },
  {
    id: 'emerging',
    name: 'Emerging Markets Index — SSgA',
    ticker: 'eem.us',
    assetClass: 'Emerging Mkts',
    value: 2985.16,
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
