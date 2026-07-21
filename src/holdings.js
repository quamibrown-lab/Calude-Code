const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HOLDINGS_FILE = path.join(DATA_DIR, 'holdings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/*
 * Seed 401(k) allocation totalling $58,000.
 *
 * NOTE: These rows are a realistic PLACEHOLDER mix, not the exact funds from the
 * "401K Mix" screenshot (the Gmail connector in this environment cannot download
 * attachment images, so the exact holdings could not be read). Replace the rows
 * below — via the dashboard's "Edit holdings" panel or by editing
 * data/holdings.json — with the actual funds and dollar amounts. Everything else
 * (live movement, day P/L, expected gains) recomputes automatically.
 *
 * Each holding stores the dollar value invested plus a liquid `ticker` used only
 * as a live-price proxy for that asset class, and a long-run expected annual
 * return assumption used for the projection math.
 */
const SEED_HOLDINGS = [
  {
    id: 'us-total',
    name: 'US Total Market Index',
    ticker: 'vti.us',
    assetClass: 'US Equity',
    value: 26100,
    expectedReturn: 0.075,
  },
  {
    id: 'us-growth',
    name: 'US Large-Cap Growth Index',
    ticker: 'vug.us',
    assetClass: 'US Equity',
    value: 8700,
    expectedReturn: 0.08,
  },
  {
    id: 'intl-dev',
    name: 'International Developed Markets',
    ticker: 'vea.us',
    assetClass: 'Intl Equity',
    value: 8700,
    expectedReturn: 0.065,
  },
  {
    id: 'emerging',
    name: 'Emerging Markets',
    ticker: 'vwo.us',
    assetClass: 'Intl Equity',
    value: 4640,
    expectedReturn: 0.085,
  },
  {
    id: 'bonds',
    name: 'US Total Bond Market',
    ticker: 'bnd.us',
    assetClass: 'Fixed Income',
    value: 6960,
    expectedReturn: 0.04,
  },
  {
    id: 'financials',
    name: 'Financials Sector (company stock)',
    ticker: 'xlf.us',
    assetClass: 'US Equity',
    value: 2900,
    expectedReturn: 0.08,
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
