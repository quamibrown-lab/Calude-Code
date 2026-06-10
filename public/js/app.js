let allFlights = [];
let filteredFlights = [];
let activeAlliance = 'all';
let sortKey = 'price';
let sortAsc = true;
let priceChart = null;
let countdownVal = 1800;
let countdownTimer = null;
let previousPrices = {};
let alertLog = [];

const ALLIANCE_CLASS = {
  'Oneworld': 'oneworld',
  'SkyTeam': 'skyteam',
  'Star Alliance': 'star',
  'None': 'none',
};

const MILES_DATA = {
  AA106: { milesRT: 35000, flightId: 'AA106' },
  BA178: { milesRT: 30000, flightId: 'BA178' },
  BA175: { milesRT: 30000, flightId: 'BA175' },
};

// ── Initialise ──────────────────────────────────────────────────────────────

async function init() {
  await fetchFlights();
  connectSSE();
  fetchHistory();
  calcMiles();
  startCountdown(1800);
}

// ── Data fetch ──────────────────────────────────────────────────────────────

async function fetchFlights() {
  try {
    const res = await fetch('/api/flights');
    const data = await res.json();
    applyData(data);
  } catch (e) {
    console.error('fetchFlights error', e);
  }
}

function applyData(data) {
  allFlights = data.flights || [];
  const newAlerts = data.alerts || [];
  const source = data.source || 'mock';

  updateSourceBanner(source);
  updateLastScanTime(data.scannedAt);
  renderTopPicks();
  applyFilter();
  renderAlerts(newAlerts);
  resetCountdown(data.nextScanIn || 1800);

  // Track price changes for visual indicators
  const newPrices = {};
  allFlights.forEach(f => { newPrices[f.id] = f.price; });
  previousPrices = newPrices;
}

// ── SSE ──────────────────────────────────────────────────────────────────────

function connectSSE() {
  const es = new EventSource('/events');
  es.addEventListener('scan-complete', e => {
    const data = JSON.parse(e.data);
    showToast(`✈ Scan complete — ${data.flights.length} flights updated`);
    document.title = '(NEW SCAN) ✈ NYC → London Flight Scanner';
    setTimeout(() => { document.title = '✈ NYC → London Flight Scanner'; }, 3000);
    applyData(data);
    fetchHistory();
  });
  es.onerror = () => setTimeout(connectSSE, 5000);
}

// ── Manual scan ──────────────────────────────────────────────────────────────

async function triggerScan() {
  const btn = document.getElementById('scan-now-btn');
  btn.textContent = '⟳ Scanning…';
  btn.classList.add('scanning');
  try {
    const res = await fetch('/api/scan', { method: 'POST' });
    const data = await res.json();
    if (data.ok) await fetchFlights();
  } catch (e) {
    console.error(e);
  }
  btn.textContent = '⟳ Scan Now';
  btn.classList.remove('scanning');
}

// ── Countdown ────────────────────────────────────────────────────────────────

function startCountdown(seconds) {
  countdownVal = seconds;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdownVal--;
    if (countdownVal <= 0) countdownVal = 1800;
    document.getElementById('countdown').textContent = fmtCountdown(countdownVal);
  }, 1000);
  document.getElementById('countdown').textContent = fmtCountdown(countdownVal);
}

function resetCountdown(seconds) { startCountdown(seconds); }

function fmtCountdown(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function updateSourceBanner(source) {
  const el = document.getElementById('source-banner');
  if (source === 'amadeus') {
    el.className = 'source-banner live';
    el.textContent = '✅ Live data from Amadeus Flight Offers API';
  } else {
    el.className = 'source-banner';
    el.textContent = '⚠ Using realistic mock data. Add AMADEUS_CLIENT_ID to .env for live prices.';
  }
  el.style.display = 'flex';
}

function updateLastScanTime(iso) {
  if (!iso) return;
  const d = new Date(iso);
  document.getElementById('last-scan-time').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderTopPicks() {
  if (!allFlights.length) return;

  const sorted = [...allFlights].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  document.getElementById('pick-cheap-airline').textContent = cheapest.airline;
  document.getElementById('pick-cheap-price').textContent = `$${cheapest.price.toLocaleString()} RT`;
  document.getElementById('pick-cheap-detail').textContent = `${cheapest.origin}→${cheapest.destination} · ${cheapest.stops === 0 ? 'Nonstop' : `Via ${cheapest.stopAirport}`}`;

  const ewrNonstop = allFlights.filter(f => f.origin === 'EWR' && f.stops === 0).sort((a, b) => a.price - b.price);
  if (ewrNonstop.length) {
    const best = ewrNonstop[0];
    document.getElementById('pick-value-airline').textContent = best.airline;
    document.getElementById('pick-value-price').textContent = `$${best.price.toLocaleString()} RT`;
    document.getElementById('pick-value-detail').textContent = `${best.aircraft} · ${fmtTime(best.outboundDeparture)} depart`;
  }
}

function filterByAlliance(alliance, tabEl) {
  activeAlliance = alliance;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  applyFilter();
}

function applyFilter() {
  filteredFlights = activeAlliance === 'all'
    ? [...allFlights]
    : allFlights.filter(f => f.alliance === activeAlliance);

  updateTabCounts();
  sortAndRender();
}

function updateTabCounts() {
  const counts = { all: allFlights.length, Oneworld: 0, SkyTeam: 0, 'Star Alliance': 0, None: 0 };
  allFlights.forEach(f => { if (counts[f.alliance] !== undefined) counts[f.alliance]++; });
  document.getElementById('count-all').textContent = counts.all;
  document.getElementById('count-oneworld').textContent = counts.Oneworld;
  document.getElementById('count-skyteam').textContent = counts.SkyTeam;
  document.getElementById('count-star').textContent = counts['Star Alliance'];
  document.getElementById('count-none').textContent = counts.None;
}

function sortTable(key) {
  if (sortKey === key) { sortAsc = !sortAsc; } else { sortKey = key; sortAsc = true; }
  // Update sort icons
  document.querySelectorAll('thead th').forEach(th => th.classList.remove('sorted'));
  event.currentTarget.classList.add('sorted');
  sortAndRender();
}

function sortAndRender() {
  const sorted = [...filteredFlights].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const cheapestId = allFlights.length ? [...allFlights].sort((a, b) => a.price - b.price)[0].id : null;
  renderTable(sorted, cheapestId);
}

function renderTable(flights, cheapestId) {
  const tbody = document.getElementById('flight-tbody');
  if (!flights.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted)">No flights match this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = flights.map(f => {
    const allianceClass = ALLIANCE_CLASS[f.alliance] || 'none';
    const isCheapest = f.id === cheapestId;
    const changeHtml = f._change ? `<span class="price-change ${f._change > 0 ? 'up' : 'down'}">${f._change > 0 ? '▲' : '▼'}$${Math.abs(f._change)}</span>` : '';
    const warnHtml = f.warning ? `<span class="warn-badge" title="Financial uncertainty — purchase travel insurance">⚠ Risk</span>` : '';

    return `<tr class="${isCheapest ? 'cheapest-row' : ''}">
      <td>
        <div class="airline-cell">
          <div class="airline-logo ${allianceClass}">${f.iataCode}</div>
          <div>
            <div class="airline-name">${f.airline} ${warnHtml}</div>
            <div class="flight-id">${f.id}</div>
          </div>
        </div>
      </td>
      <td><span class="alliance-badge badge-${allianceClass}">${f.alliance}</span></td>
      <td>
        <div class="route-cell">${f.origin} → ${f.destination}</div>
        <div class="route-sub">${f.stops === 0 ? 'Nonstop' : `1 stop ${f.stopAirport}`}</div>
      </td>
      <td>
        <div class="time-cell">${fmtTime(f.outboundDeparture)}</div>
        <div class="time-sub">→ ${fmtTime(f.outboundArrival)} ${f.stops === 0 ? '+1' : '+1'}</div>
      </td>
      <td>
        ${f.stops === 0
          ? '<span class="nonstop">✦ Nonstop</span>'
          : `<span class="connecting">1 stop · ${f.stopAirport}</span>`}
      </td>
      <td class="aircraft-cell">${f.aircraft}</td>
      <td class="price-cell">
        <span class="price-value">$${f.price.toLocaleString()}</span>${changeHtml}
        <div style="font-size:11px;color:var(--text-dim)">round trip</div>
        ${f.awardsAvailable ? `<div style="font-size:11px;color:#c0392b;margin-top:2px">🎫 ~${(f.estimatedMiles||30000).toLocaleString()} mi</div>` : ''}
      </td>
      <td><a class="book-btn" href="${f.bookingUrl}" target="_blank" rel="noopener">Book →</a></td>
    </tr>`;
  }).join('');
}

// ── Price History Chart ───────────────────────────────────────────────────────

async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    const series = await res.json();
    renderChart(series);
  } catch (e) {
    console.error('history fetch error', e);
  }
}

const PALETTE = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e','#e91e63','#00bcd4'];

function renderChart(series) {
  const ctx = document.getElementById('price-chart').getContext('2d');
  if (priceChart) priceChart.destroy();

  const datasets = series.slice(0, 8).map((s, i) => ({
    label: `${s.iataCode} ${s.route}`,
    data: s.points.map(p => ({ x: p.t, y: p.price })),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: 'transparent',
    tension: 0.3,
    borderWidth: 2,
    pointRadius: 3,
  }));

  if (!datasets.length) return;

  priceChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#7b8fb5', font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          backgroundColor: '#151d35',
          borderColor: '#1e2d4e',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#7b8fb5',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'hour', displayFormats: { hour: 'MMM d, HH:mm' } },
          ticks: { color: '#4a5d80', maxTicksLimit: 8 },
          grid: { color: 'rgba(30,45,78,0.6)' },
        },
        y: {
          ticks: {
            color: '#4a5d80',
            callback: v => `$${v.toLocaleString()}`,
          },
          grid: { color: 'rgba(30,45,78,0.6)' },
        },
      },
    },
  });
}

// ── Miles Calculator ─────────────────────────────────────────────────────────

function calcMiles() {
  const balance = parseInt(document.getElementById('miles-input').value || '0', 10);
  const routeKey = document.getElementById('miles-route').value;
  const milesData = MILES_DATA[routeKey];
  if (!milesData) return;

  const needed = milesData.milesRT;
  const flight = allFlights.find(f => f.id === milesData.flightId);
  const cashPrice = flight ? flight.price : null;

  document.getElementById('calc-miles-needed').textContent = `~${needed.toLocaleString()}`;
  document.getElementById('calc-balance').textContent = balance.toLocaleString();

  if (cashPrice) {
    document.getElementById('calc-cash').textContent = `$${cashPrice.toLocaleString()}`;
    const cpp = (cashPrice / needed * 100).toFixed(2);
    const cppEl = document.getElementById('calc-cpp');
    cppEl.textContent = `${cpp}¢ / mile`;
    cppEl.className = 'val ' + (parseFloat(cpp) >= 1.5 ? 'green' : parseFloat(cpp) >= 1.0 ? 'amber' : '');
  } else {
    document.getElementById('calc-cash').textContent = '—';
    document.getElementById('calc-cpp').textContent = '—';
  }

  const verdict = document.getElementById('miles-verdict');
  const diff = balance - needed;
  if (diff >= 5000) {
    verdict.className = 'miles-verdict yes';
    verdict.textContent = `✅ You have enough! ${diff.toLocaleString()} miles to spare.`;
  } else if (diff >= -5000) {
    verdict.className = 'miles-verdict close';
    verdict.textContent = `⚠ Close — you're ${Math.abs(diff).toLocaleString()} miles ${diff >= 0 ? 'over' : 'short'}. Check live availability.`;
  } else {
    verdict.className = 'miles-verdict no';
    verdict.textContent = `❌ Short by ${Math.abs(diff).toLocaleString()} miles for peak season.`;
  }
}

// ── Alerts ────────────────────────────────────────────────────────────────────

function renderAlerts(newAlerts) {
  if (newAlerts.length) alertLog = [...newAlerts, ...alertLog].slice(0, 50);
  const container = document.getElementById('alerts-log');
  if (!alertLog.length) {
    container.innerHTML = '<div class="alerts-empty">No price changes detected yet — alerts appear after the second scan.</div>';
    return;
  }
  container.innerHTML = alertLog.map(a => {
    const dir = a.direction === 'down';
    const timeStr = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="alert-item">
      <span class="alert-icon">${dir ? '📉' : '📈'}</span>
      <span class="alert-text">
        <strong>${a.airline}</strong> <span class="muted">${a.route}</span>
        &nbsp;$${a.oldPrice.toLocaleString()} → <span class="${dir ? 'alert-price-down' : 'alert-price-up'}">$${a.newPrice.toLocaleString()}</span>
        &nbsp;<span class="muted">(${dir ? '' : '+'}${a.change} · ${dir ? '' : '+'}${a.percentChange}%)</span>
      </span>
      <span class="alert-time">${timeStr}</span>
    </div>`;
  }).join('');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
