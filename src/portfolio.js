/*
 * Combines the user's holdings with live quotes to produce:
 *  - each holding's live day movement and resulting $ P/L
 *  - portfolio totals (value, day change, blended expected return)
 *  - forward expected-gain projections (1, 5, 10, 20 years, compounded)
 */

const PROJECTION_YEARS = [1, 5, 10, 20];

function buildPortfolio(holdings, quotes) {
  const positions = holdings.map(h => {
    const q = quotes[h.ticker] || { changePct: 0, price: null, live: false };
    const changePct = q.changePct || 0;
    // Today's value already reflects the day's move; the pre-market ("prior")
    // value is backed out so we can show today's $ gain/loss.
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

  const projections = PROJECTION_YEARS.map(years => {
    const future = totalValue * Math.pow(1 + blendedExpectedReturn, years);
    return {
      years,
      projectedValue: future,
      expectedGain: future - totalValue,
    };
  });

  // Allocation breakdown by asset class.
  const byClass = {};
  for (const p of positions) {
    byClass[p.assetClass] = (byClass[p.assetClass] || 0) + p.value;
  }
  const allocation = Object.entries(byClass)
    .map(([assetClass, value]) => ({
      assetClass,
      value,
      pct: totalValue > 0 ? value / totalValue : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    positions: positions.sort((a, b) => b.value - a.value),
    totals: {
      value: totalValue,
      dayChange: totalDayChange,
      dayChangePct: totalDayChangePct,
      blendedExpectedReturn,
      expectedAnnualGain,
    },
    allocation,
    projections,
  };
}

module.exports = { buildPortfolio, PROJECTION_YEARS };
