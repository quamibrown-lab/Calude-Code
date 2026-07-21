# Market Movements Tracker

A live dashboard for watching your 401(k) / portfolio movements and seeing what your
**expected gains** should be.

## What it does

- **Live market movements** — pulls quotes for every holding (free Stooq CSV feed, no API
  key) and shows each fund's move today plus the day's dollar P/L on your position.
- **Portfolio totals** — total value, today's gain/loss, and a blended long-run expected
  return derived from your allocation.
- **Expected gains** — projects your expected annual gain and compounded portfolio value at
  1, 5, 10, and 20 years.
- **Allocation breakdown** — weight by asset class.
- **Editable holdings** — replace the seeded rows with your actual funds and amounts right in
  the UI (persisted to `data/holdings.json`); every metric recomputes instantly.
- **Auto-refresh** — re-scans on an interval and pushes updates to the browser over SSE.

## Your holdings

The app is seeded with the real 401(k) allocation from the statement dated Jan 1 – Jul 20,
2026 (closing balances, **$58,558.27**, 100% equity — no bonds). Because the underlying
BlackRock/SSgA collective trusts have no public ticker, each fund uses a comparable ETF as a
live-price proxy. Adjust anything via the **"Edit holdings"** button (or `data/holdings.json`).

Each holding has:
- `value` — dollars invested in that fund
- `ticker` — any liquid symbol used as a live-price proxy (Stooq format, e.g. `vti.us`)
- `expectedReturn` — your long-run annual return assumption (`0.07` = 7%)

## Run

```bash
npm install
npm start          # http://localhost:3000
```

Set `SCAN_INTERVAL_MINUTES` in `.env` to change the refresh cadence.

## Note on expected gains

Projections compound your allocation's **blended expected return** — an assumption, not a
guarantee. Real markets fluctuate and actual results will differ. This tool is for tracking
and planning, not financial advice.
