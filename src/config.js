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
    rate: 0.06,           // GS: 100% up to 6% of eligible compensation
    floor: 6000,          // $6,000/yr minimum (non-binding at this comp level)
    eligibleComp: 200000, // TOTAL comp (base + bonus); drives the match
  },
  // Two independent growth rates:
  //  - contribAutoIncreasePct: the plan's auto-escalation of the elective
  //    contribution dollar amount (1%/yr here).
  //  - annualRaisePct: pay raise that grows total comp each year, which lifts
  //    the 6%-of-comp match ceiling.
  // Loan repayments are fixed and do NOT grow.
  contribAutoIncreasePct: 0.01,
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
// Match is 100% of the deferral up to `rate` of eligible (total) comp, with the
// supplemental floor as a minimum. Capped by what the employee actually defers.
function matchAnnual(cfg, deferralAnnual) {
  const raw = Math.min(cfg.match.rate * cfg.match.eligibleComp, deferralAnnual);
  return Math.max(raw, cfg.match.floor);
}

module.exports = { readConfig, writeConfig, matchAnnual, DEFAULT_CONFIG };
