const PALETTE = ['#4f8cff', '#26d07c', '#f0b429', '#c77dff', '#ff8fab', '#5bd1d7', '#f0616d'];

const fmtUSD = (n, dp = 0) =>
  n == null || Number.isNaN(n)
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtPct = (n, dp = 2) => (n == null || Number.isNaN(n) ? '—' : `${(n * 100).toFixed(dp)}%`);
const signed = (n, fn) => `${n >= 0 ? '+' : ''}${fn(n)}`;

let holdingsCache = [];

async function loadPortfolio() {
  const res = await fetch('/api/portfolio');
  const data = await res.json();
  if (data.ready === false) {
    setTimeout(loadPortfolio, 1500);
    return;
  }
  render(data);
}

function render(data) {
  const t = data.totals;

  // Source badge + timestamp
  const badge = document.getElementById('source-badge');
  badge.textContent = data.source === 'stooq' ? '● Live' : '● Mock data';
  badge.className = `badge ${data.source === 'stooq' ? 'live' : 'mock'}`;
  document.getElementById('last-scan').textContent =
    data.scannedAt ? `Updated ${new Date(data.scannedAt).toLocaleTimeString()}` : '';

  // KPIs
  document.getElementById('total-value').textContent = fmtUSD(t.value);
  const dc = document.getElementById('day-change');
  dc.textContent = `${signed(t.dayChange, v => fmtUSD(v))}  (${signed(t.dayChangePct, fmtPct)}) today`;
  dc.className = `kpi-delta ${t.dayChange >= 0 ? 'pos' : 'neg'}`;

  document.getElementById('annual-gain').textContent = signed(t.expectedAnnualGain, v => fmtUSD(v));
  document.getElementById('blended-return').textContent =
    `Blended expected return ${fmtPct(t.blendedExpectedReturn)}/yr`;

  const p10 = data.projections.find(p => p.years === 10);
  if (p10) {
    document.getElementById('proj-10').textContent = fmtUSD(p10.projectedValue);
    document.getElementById('proj-10-gain').textContent = `${signed(p10.expectedGain, v => fmtUSD(v))} expected gain`;
  }

  const caption = document.getElementById('proj-caption');
  if (caption) {
    if (data.contributions) {
      const c = data.contributions;
      caption.textContent =
        `Includes ${fmtUSD(c.biweekly, 2)}/paycheck + ${fmtUSD(c.annualMatch)}/yr Goldman match ` +
        `(${fmtUSD(c.annualTotal)}/yr added), compounded biweekly at ${fmtPct(t.blendedExpectedReturn)}`;
    } else {
      caption.textContent = `Compounded at blended ${fmtPct(t.blendedExpectedReturn)} long-run return`;
    }
  }

  renderHoldings(data.positions);
  renderAllocation(data.allocation);
  renderProjection(data.projections);
}

function renderHoldings(positions) {
  const body = document.getElementById('holdings-body');
  body.innerHTML = positions.map(p => `
    <tr>
      <td>
        <div class="holding-name">${escapeHtml(p.name)}</div>
        <div class="holding-meta">${escapeHtml(p.assetClass)} · ${escapeHtml(p.ticker.toUpperCase())}${p.live ? '' : ' · mock'}</div>
      </td>
      <td class="num">${fmtUSD(p.value)}</td>
      <td class="num">${fmtPct(p.value / positions.reduce((s, x) => s + x.value, 0), 1)}</td>
      <td class="num ${p.changePct >= 0 ? 'pos' : 'neg'}">${signed(p.changePct, v => fmtPct(v))}</td>
      <td class="num ${p.dayChange >= 0 ? 'pos' : 'neg'}">${signed(p.dayChange, v => fmtUSD(v, 0))}</td>
      <td class="num muted">${fmtPct(p.expectedReturn, 1)}</td>
    </tr>`).join('');
}

function renderAllocation(allocation) {
  const bar = document.getElementById('allocation-bar');
  const legend = document.getElementById('allocation-legend');
  bar.innerHTML = allocation.map((a, i) =>
    `<div class="alloc-seg" style="width:${(a.pct * 100).toFixed(2)}%;background:${PALETTE[i % PALETTE.length]}"></div>`).join('');
  legend.innerHTML = allocation.map((a, i) => `
    <li>
      <span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
      ${escapeHtml(a.assetClass)}
      <span class="val">${fmtUSD(a.value)} · ${fmtPct(a.pct, 1)}</span>
    </li>`).join('');
}

function renderProjection(projections) {
  document.getElementById('projection').innerHTML = projections.map(p => {
    const added = (p.contributions != null && p.employerMatch != null)
      ? `<div class="proj-added">${fmtUSD(p.contributions + p.employerMatch)} added in</div>`
      : '';
    return `
    <div class="proj-item">
      <div class="proj-years">In ${p.years} year${p.years > 1 ? 's' : ''}</div>
      <div class="proj-value">${fmtUSD(p.projectedValue)}</div>
      <div class="proj-gain">${signed(p.expectedGain, v => fmtUSD(v))} vs today</div>
      ${added}
    </div>`;
  }).join('');
}

/* ---------- Edit holdings ---------- */

async function openEditor() {
  const res = await fetch('/api/holdings');
  holdingsCache = await res.json();
  renderEditRows();
  document.getElementById('edit-modal').classList.remove('hidden');
}

function renderEditRows() {
  const body = document.getElementById('edit-body');
  body.innerHTML = holdingsCache.map((h, i) => `
    <tr data-i="${i}">
      <td><input data-f="name" value="${escapeAttr(h.name)}"></td>
      <td><input data-f="ticker" value="${escapeAttr(h.ticker)}" style="width:90px"></td>
      <td><input data-f="assetClass" value="${escapeAttr(h.assetClass)}" style="width:120px"></td>
      <td><input class="num" data-f="value" type="number" step="1" value="${h.value}"></td>
      <td><input class="num" data-f="expectedReturn" type="number" step="0.005" value="${h.expectedReturn}"></td>
      <td><button class="row-del" title="Remove">✕</button></td>
    </tr>`).join('');
  updateEditTotal();
}

function collectRows() {
  return [...document.querySelectorAll('#edit-body tr')].map(tr => {
    const g = f => tr.querySelector(`[data-f="${f}"]`).value;
    return {
      name: g('name'),
      ticker: g('ticker'),
      assetClass: g('assetClass'),
      value: parseFloat(g('value')) || 0,
      expectedReturn: parseFloat(g('expectedReturn')) || 0,
    };
  });
}

function updateEditTotal() {
  const total = collectRows().reduce((s, r) => s + r.value, 0);
  document.getElementById('edit-total').textContent = `Total: ${fmtUSD(total)}`;
}

async function saveHoldings() {
  const holdings = collectRows().filter(h => h.name.trim());
  if (!holdings.length) return alert('Add at least one holding.');
  const btn = document.getElementById('save-holdings');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await fetch('/api/holdings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdings }),
    });
    const data = await res.json();
    if (data.portfolio) render(data.portfolio);
    document.getElementById('edit-modal').classList.add('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Save & refresh';
  }
}

/* ---------- helpers ---------- */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

/* ---------- events ---------- */

document.getElementById('refresh-btn').addEventListener('click', async () => {
  const res = await fetch('/api/scan', { method: 'POST' });
  render(await res.json());
});
document.getElementById('edit-btn').addEventListener('click', openEditor);
document.getElementById('close-modal').addEventListener('click', () =>
  document.getElementById('edit-modal').classList.add('hidden'));
document.getElementById('add-row').addEventListener('click', () => {
  holdingsCache = collectRows();
  holdingsCache.push({ name: 'New holding', ticker: 'spy.us', assetClass: 'US Equity', value: 0, expectedReturn: 0.07 });
  renderEditRows();
});
document.getElementById('save-holdings').addEventListener('click', saveHoldings);
document.getElementById('edit-body').addEventListener('input', updateEditTotal);
document.getElementById('edit-body').addEventListener('click', e => {
  if (e.target.classList.contains('row-del')) {
    holdingsCache = collectRows();
    holdingsCache.splice(+e.target.closest('tr').dataset.i, 1);
    renderEditRows();
  }
});

// Live updates via Server-Sent Events
const es = new EventSource('/events');
es.addEventListener('scan-complete', e => render(JSON.parse(e.data)));

loadPortfolio();
