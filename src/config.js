const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/*
 * Contribution + employer-match settings that drive the growth projection.
 *
 * Biweekly cash into the market (26 paychecks/yr), starting from the next
 * paycheck. Both 401(k) loan repayments are reinvested, so all three streams
 * add to the invested balance.
 *
 * Goldman Sachs match: 100% of contributions up to 4% of base pay, with a
 * $6,000/yr supplemental floor, vested immediately. The match applies only to
 * the elective deferral (contribution) — loan repayments are not new deferrals
 * and are not matched.
 */
const DEFAULT_CONFIG = {
  biweekly: {
    contribution: 467.30, // elective 401(k) deferral (matchable)
    loan1: 141.83,        // 401(k) loan 1 repayment, reinvested
    loan2: 74.33,         // 401(k) loan 2 repayment, reinvested
  },
  match: {
    rate: 0.04,           // GS: 100% up to 4% of base pay
    floor: 6000,          // GS: $6,000/yr supplemental floor
    baseSalary: 135000,   // eligible base pay (4% = $5,400 → $6k floor applies)
  },
  // Annual raise grows the elective contribution and base pay (and thus the
  // match) each year. Loan repayments are fixed and do NOT grow.
  annualRaisePct: 0.03,
  payPeriodsPerYear: 26,
};

function readConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    writeConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

function writeConfig(cfg) {
  const merged = { ...DEFAULT_CONFIG, ...cfg };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

// Derived annual figures given the config and the annual elective deferral.
function matchAnnual(cfg, deferralAnnual) {
  const raw = Math.min(cfg.match.rate * cfg.match.baseSalary, deferralAnnual);
  return Math.max(raw, cfg.match.floor);
}

module.exports = { readConfig, writeConfig, matchAnnual, DEFAULT_CONFIG };
