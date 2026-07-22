/*
 * Combines the user's holdings with live quotes to produce:
 *  - each holding's live day movement and resulting $ P/L
 *  - portfolio totals (value, day change, blended expected return)
 *  - a contribution-aware growth projection (1, 5, 10, 20 years) that compounds
 *    the current balance plus ongoing biweekly contributions, reinvested loan
 *    repayments, and the Goldman Sachs employer match.
 */

const { matchAnnual } = require('./config');

const PROJECTION_YEARS = [1, 5, 10, 20];
const HORIZON = 20;

// Simulate biweekly compounding of balance + contributions + match out to
// `years`, returning cumulative contribution/match and ending balance per year.
function projectSeries(startValue, blended, cfg) {
  const periods = cfg.payPeriodsPerYear || 26;
  const r = Math.pow(1 + blended, 1 / periods) - 1;
  const biweekly = cfg.biweekly.contribution + cfg.biweekly.loan1 + cfg.biweekly.loan2;
  const deferralAnnual = cfg.biweekly.contribution * periods;
  const annualMatch = matchAnnual(cfg, deferralAnnual);

  let bal = startValue, contribTot = 0, matchTot = 0;
  let biEmp = biweekly, biMatch = annualMatch / periods;
  const byYear = { 0: { value: startValue, contrib: 0, match: 0 } };

  for (let y = 1; y <= HORIZON; y++) {
    if (y > 1 && cfg.annualRaisePct) {
      const g = 1 + cfg.annualRaisePct;
      biEmp *= g; biMatch *= g;
    }
    for (let p = 0; p < periods; p++) {
      bal = bal * (1 + r) + biEmp + biMatch;
      contribTot += biEmp; matchTot += biMatch;
    }
    byYear[y] = { value: bal, contrib: contribTot, match: matchTot };
  }
  return { byYear, biweekly, annualMatch, deferralAnnual };
}

function buildPortfolio(holdings, quotes, cfg = null) {
  const positions = holdings.map(h => {
    const q = quotes[h.ticker] || { changePct: 0, price: null, live: false };
    const changePct = q.changePct || 0;
    const value = h.value;
    const priorValue = value / (1 + changePct);
    const dayChange = value - priorValue;

    return {
      id: h.id,
      name: h.name,
      ticker: h.ticker,
      assetClass: h.assetClass,
      value,
      expectedReturn: h.expectedReturn,
      price: q.price,
      live: !!q.live,
      changePct,
      dayChange,
      expectedAnnualGain: value * h.expectedReturn,
    };
  });

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalDayChange = positions.reduce((s, p) => s + p.dayChange, 0);
  const priorTotal = totalValue - totalDayChange;
  const totalDayChangePct = priorTotal > 0 ? totalDayChange / priorTotal : 0;

  const blendedExpectedReturn = totalValue > 0
    ? positions.reduce((s, p) => s + p.value * p.expectedReturn, 0) / totalValue
    : 0;

  const expectedAnnualGain = totalValue * blendedExpectedReturn;

  const series = cfg ? projectSeries(totalValue, blendedExpectedReturn, cfg) : null;

  const projections = PROJECTION_YEARS.map(years => {
    if (series) {
      const p = series.byYear[years];
      const growth = p.value - totalValue - p.contrib - p.match;
      return {
        years,
        projectedValue: p.value,
        contributions: p.contrib,
        employerMatch: p.match,
        investmentGrowth: growth,
        expectedGain: p.value - totalValue,
      };
    }
    const future = totalValue * Math.pow(1 + blendedExpectedReturn, years);
    return { years, projectedValue: future, expectedGain: future - totalValue };
  });

  const byClass = {};
  for (const p of positions) byClass[p.assetClass] = (byClass[p.assetClass] || 0) + p.value;
  const allocation = Object.entries(byClass)
    .map(([assetClass, value]) => ({ assetClass, value, pct: totalValue > 0 ? value / totalValue : 0 }))
    .sort((a, b) => b.value - a.value);

  const contributions = series ? {
    biweekly: series.biweekly,
    annual: series.biweekly * (cfg.payPeriodsPerYear || 26),
    annualMatch: series.annualMatch,
    annualTotal: series.biweekly * (cfg.payPeriodsPerYear || 26) + series.annualMatch,
  } : null;

  return {
    positions: positions.sort((a, b) => b.value - a.value),
    totals: {
      value: totalValue,
      dayChange: totalDayChange,
      dayChangePct: totalDayChangePct,
      blendedExpectedReturn,
      expectedAnnualGain,
    },
    contributions,
    allocation,
    projections,
  };
}

module.exports = { buildPortfolio, projectSeries, PROJECTION_YEARS };
