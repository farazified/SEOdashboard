// ─────────────────────────────────────────────
//  render.js  –  all DOM updates & rendering
//  Tables, cards, badges, metric displays.
//  To change what a column shows or add a new
//  table column: edit this file only.
// ─────────────────────────────────────────────

import { S, METRICS } from './state.js';
import { fmt, fmtD } from './api.js';
import { COUNTRIES } from './config.js';

// ── LOADING STATE ─────────────────────────────

const SKEL_ROW = `<tr class="skel-row">${'<td><div class="skel"></div></td>'.repeat(11)}</tr>`;
const SKEL_CARD = `<div class="skel-card"><div class="skel" style="width:60%;height:10px;margin-bottom:8px"></div><div class="skel" style="width:80%;height:8px"></div></div>`;

export function setLoading() {
  ['m-clicks','m-impr','m-pos','m-ctr','m-sess','m-rev']
    .forEach(id => { const el = document.getElementById(id); el.innerHTML = '<div class="skel mval-skel"></div>'; });
  ['m-clicks-d','m-impr-d','m-pos-d','m-ctr-d','m-sess-d','m-rev-d']
    .forEach(id => document.getElementById(id).innerHTML = '<div class="skel delta-skel"></div><div class="skel delta-skel" style="margin-top:4px"></div>');
  document.getElementById('kw-body').innerHTML = SKEL_ROW.repeat(8);
  document.getElementById('winners-body').innerHTML = SKEL_CARD.repeat(4);
  document.getElementById('losers-body').innerHTML  = SKEL_CARD.repeat(4);
}

// ── DELTA DISPLAY ─────────────────────────────

function deltaRows(pop, yoy, inv) {
  const rows = [];
  const showPop = S.cmpMode === 'pop' || S.cmpMode === 'both';
  const showYoy = S.cmpMode === 'yoy' || S.cmpMode === 'both';
  if (showPop && pop != null) {
    const cls = (inv ? pop < 0 : pop > 0) ? 'up' : 'dn';
    rows.push(`<div class="drow"><span class="dtag">PoP</span><span class="dval ${cls}">${pop > 0 ? '+' : ''}${pop}%</span></div>`);
  }
  if (showYoy && yoy != null) {
    const cls = (inv ? yoy < 0 : yoy > 0) ? 'up' : 'dn';
    rows.push(`<div class="drow"><span class="dtag">YoY</span><span class="dval ${cls}">${yoy > 0 ? '+' : ''}${yoy}%</span></div>`);
  }
  return rows.join('');
}

export function updateDeltas() {
  if (!METRICS.clicks) return;
  document.getElementById('m-clicks-d').innerHTML = deltaRows(METRICS.clicksPop, METRICS.clicksYoy, false);
  document.getElementById('m-impr-d').innerHTML   = deltaRows(METRICS.imprPop,   METRICS.imprYoy,   false);
  document.getElementById('m-pos-d').innerHTML    = deltaRows(METRICS.posPop,    METRICS.posYoy,    true);
  document.getElementById('m-ctr-d').innerHTML    = deltaRows(METRICS.ctrPop,    METRICS.ctrYoy,    false);
  document.getElementById('m-sess-d').innerHTML   = deltaRows(METRICS.sessPop,   METRICS.sessYoy,   false);
  document.getElementById('m-rev-d').innerHTML    = deltaRows(METRICS.revPop,    METRICS.revYoy,    false);
}

// ── BRANDED FILTER ────────────────────────────

export function getBrandTerms() {
  const v = document.getElementById('brand-terms').value.trim();
  localStorage.setItem('seo_brand', v);
  if (v) return v.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  if (S.selGsc) {
    const d = S.selGsc.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '');
    return [d.split('.')[0], d];
  }
  return [];
}
export function isBrand(q)      { return getBrandTerms().some(t => q.toLowerCase().includes(t)); }
export function filtBrand(data) {
  data.forEach(r => r.branded = isBrand(r.query));
  return S.hideBranded ? data.filter(r => !r.branded) : data;
}

// ── FILTERED METRICS (paired cards) ──────────

export function recalcMetricsFromFiltered() {
  if (!S.kwData.length) return;

  const all  = S.kwData;
  let tCl = 0, tIm = 0, tCs = 0, tPs = 0;
  all.forEach(r => { tCl += r.clicks; tIm += r.impressions; tCs += r.ctr; tPs += r.position; });
  const tN   = all.length;
  const tPos = tN ? tPs / tN : null;
  const tCtr = tN ? tCs / tN : null;

  const filt = filtBrand(S.kwData);
  let fCl = 0, fIm = 0, fCs = 0, fPs = 0;
  filt.forEach(r => { fCl += r.clicks; fIm += r.impressions; fCs += r.ctr; fPs += r.position; });
  const fN   = filt.length;
  const fPos = fN ? fPs / fN : null;
  const fCtr = fN ? fCs / fN : null;

  const hasFilter = S.hideBranded && fN < tN;
  const lbl       = hasFilter ? `−${tN - fN} kw` : 'no filter';

  // top-line values (always total)
  document.getElementById('m-clicks').textContent = fmt(tCl);
  document.getElementById('m-impr').textContent   = fmt(tIm);
  document.getElementById('m-pos').textContent    = tPos != null ? tPos.toFixed(1) : '—';
  document.getElementById('m-ctr').textContent    = tCtr != null ? (tCtr * 100).toFixed(2) + '%' : '—';

  ['cl','im','pos','ctr'].forEach(k => document.getElementById(`filter-label-${k}`).textContent = lbl);

  // helper: build PoP + YoY delta rows for filtered sub-cards
  function fDeltaRows(pop, yoy, inv) {
    const rows = [];
    const sp = S.cmpMode === 'pop'  || S.cmpMode === 'both';
    const sy = S.cmpMode === 'yoy'  || S.cmpMode === 'both';
    if (sp && pop != null) {
      const cls = (inv ? pop < 0 : pop > 0) ? 'up' : 'dn';
      rows.push(`<div class="drow"><span class="dtag">PoP</span><span class="dval ${cls}">${pop > 0 ? '+' : ''}${pop}%</span></div>`);
    }
    if (sy && yoy != null) {
      const cls = (inv ? yoy < 0 : yoy > 0) ? 'up' : 'dn';
      rows.push(`<div class="drow"><span class="dtag">YoY</span><span class="dval ${cls}">${yoy > 0 ? '+' : ''}${yoy}%</span></div>`);
    }
    return rows.join('');
  }

  // recalc filtered deltas from keyword-level prev/yoy data
  const popCl  = filt.reduce((a, r) => a + (r.prevClicks  || 0), 0);
  const yoyCl  = filt.reduce((a, r) => a + (r.yoyClicks   || 0), 0);
  const popIm  = filt.reduce((a, r) => a + (r.prevImpr    || 0), 0);
  const yoyIm  = filt.reduce((a, r) => a + (r.yoyImpr     || 0), 0);
  const fClPop = fmtD(fCl,  popCl);
  const fClYoy = fmtD(fCl,  yoyCl);
  const fImPop = fmtD(fIm,  popIm);
  const fImYoy = fmtD(fIm,  yoyIm);

  // clicks filtered
  const clEl = document.getElementById('m-clicks-f');
  clEl.textContent = fmt(fCl);
  clEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const clDiff = tCl - fCl;
  document.getElementById('m-clicks-diff').innerHTML =
    (hasFilter ? `<span class="fdiff saved">−${fmt(clDiff)} branded (${((clDiff / tCl) * 100).toFixed(1)}%)</span>` : '') +
    fDeltaRows(fClPop, fClYoy, false) ||
    '<span class="fdiff">same as total</span>';

  // impressions filtered
  const imEl = document.getElementById('m-impr-f');
  imEl.textContent = fmt(fIm);
  imEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const imDiff = tIm - fIm;
  document.getElementById('m-impr-diff').innerHTML =
    (hasFilter ? `<span class="fdiff saved">−${fmt(imDiff)} branded (${((imDiff / tIm) * 100).toFixed(1)}%)</span>` : '') +
    fDeltaRows(fImPop, fImYoy, false) ||
    '<span class="fdiff">same as total</span>';

  // position filtered
  const fPosPop = filt.length && fPos != null ? fmtD(fPos, filt.reduce((a, r) => a + (r.prevPos || r.position), 0) / filt.length) : null;
  const fPosYoy = filt.length && fPos != null ? fmtD(fPos, filt.reduce((a, r) => a + (r.yoyPos  || r.position), 0) / filt.length) : null;
  const posEl   = document.getElementById('m-pos-f');
  posEl.textContent = fPos != null ? fPos.toFixed(1) : '—';
  posEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const posDiff = fPos != null && tPos != null ? +(fPos - tPos).toFixed(1) : null;
  document.getElementById('m-pos-diff').innerHTML =
    (hasFilter && posDiff != null ? `<span class="fdiff ${posDiff < 0 ? 'saved' : 'added'}">${posDiff > 0 ? '+' : ''}${posDiff} vs total</span>` : '') +
    fDeltaRows(fPosPop, fPosYoy, true) ||
    '<span class="fdiff">same as total</span>';

  // CTR filtered
  const ctrEl = document.getElementById('m-ctr-f');
  ctrEl.textContent = fCtr != null ? (fCtr * 100).toFixed(2) + '%' : '—';
  ctrEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const ctrDiff = fCtr != null && tCtr != null ? +((fCtr - tCtr) * 100).toFixed(2) : null;
  // use total period deltas for CTR since we can't sum CTR per keyword
  document.getElementById('m-ctr-diff').innerHTML =
    (hasFilter && ctrDiff != null ? `<span class="fdiff ${ctrDiff > 0 ? 'saved' : 'added'}">${ctrDiff > 0 ? '+' : ''}${ctrDiff}% vs total</span>` : '') +
    fDeltaRows(METRICS.ctrPop, METRICS.ctrYoy, false) ||
    '<span class="fdiff">same as total</span>';

  METRICS.clicksPop = fClPop;
  METRICS.clicksYoy = fClYoy;
  document.getElementById('m-clicks-d').innerHTML = deltaRows(METRICS.clicksPop, METRICS.clicksYoy, false);
}

// ── COMPARISON TOGGLE ─────────────────────────

export function setCmp(m) {
  S.cmpMode = m;
  document.querySelectorAll('.cmp-btn').forEach(b => b.classList.toggle('active', b.dataset.cmp === m));
  updateDeltas();
  renderAll();
}

// ── RENDER ALL ────────────────────────────────

export function renderAll() {
  // seed qData from kwData only if empty (api.js populates it on load)
  if (!S.qData.length) S.qData = S.kwData.map(r => ({...r}));
  applySortToQData();
  recalcMetricsFromFiltered();
  renderKeywords();
  renderWinners();
  renderLosers();
  requestAnimationFrame(updateSortHeaders);
}

function applySortToQData() {
  const col = S.qSort.col;
  const dir = S.qSort.dir;
  S.qData.sort((a, b) => {
    const av = a[col], bv = b[col];
    // string sort for query column
    if (col === 'query') return av.localeCompare(bv) * dir;
    // nulls always go to bottom regardless of direction
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av > bv ? 1 : -1) * dir;
  });
}


// ── POSITION COLOR ────────────────────────────
function posColor(pos) {
  if (pos <= 5)  return 'pos-top';
  if (pos <= 10) return 'pos-good';
  if (pos <= 15) return 'pos-mid';
  if (pos <= 20) return 'pos-low';
  return 'pos-out';
}

// ── BADGE HELPER ──────────────────────────────

function mkBadge(v, inv) {
  if (v == null) return '<span class="badge fl">—</span>';
  const cls = (inv ? v < 0 : v > 0) ? 'up' : 'dn';
  return `<span class="badge ${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
}

// ── HEATMAP HELPER ────────────────────────────
// assigns data-heat attribute based on rank within column

function applyHeatmap() {
  // clicks column (index 1) and impressions (index 4)
  [1, 4].forEach(colIdx => {
    const cells = [...document.querySelectorAll(`#kw-body tr td:nth-child(${colIdx + 1}).num-cell`)];
    if (!cells.length) return;
    const vals = cells.map(c => parseFloat(c.textContent.replace(/[K M,]/g, v => v==='K'?'e3':v==='M'?'e6':'')) || 0);
    const max = Math.max(...vals);
    cells.forEach((c, i) => {
      const pct = max > 0 ? vals[i] / max : 0;
      c.dataset.heat = pct > .8 ? 'h5' : pct > .6 ? 'h4' : pct > .4 ? 'h3' : pct > .2 ? 'h2' : 'h1';
    });
  });
}

// ── KEYWORD TABLE ─────────────────────────────

export function renderKeywords() {
  const q    = document.getElementById('kw-search').value.toLowerCase();
  // filtBrand on qData preserves sort order (qData is already sorted)
  let   data = filtBrand(S.qData.map(r => ({...r}))).filter(r => r.query.toLowerCase().includes(q));
  if (S.kwTab === 'up') data = data.filter(r => (r.delta != null && r.delta > 5)   || (r.deltaYoy != null && r.deltaYoy > 5));
  if (S.kwTab === 'dn') data = data.filter(r => (r.delta != null && r.delta < -5)  || (r.deltaYoy != null && r.deltaYoy < -5));
  const tb = document.getElementById('kw-body');
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No keywords found</div><div class="empty-sub">${S.kwTab !== 'all' ? 'Try switching to "All" tab or adjusting your filters.' : 'No data returned for this period or URL.'}</div></div></td></tr>`;
    return;
  }

  // find top-3 by impressions with position <= 15 (opportunity highlights)
  const oppIds = new Set(
    [...data]
      .filter(r => r.position <= 15)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
      .map(r => r.query)
  );

  tb.innerHTML = data.slice(0, 200).map((r, i) => {
    const bb      = r.branded && !S.hideBranded ? '<span class="bbadge">brand</span>' : '';
    const isOpp   = oppIds.has(r.query);
    const rowCls  = isOpp ? ' class="opp-row"' : '';
    const oppTag  = isOpp ? '<span class="opp-badge">opportunity</span>' : '';
    return `<tr${rowCls}>
      <td><span class="rn">${i + 1}</span><span class="kwc kw-drill" title="Click to filter" onclick="window.__showKwChart('${r.query.replace(/'/g,"\'")}') )">${r.query}</span>${bb}${oppTag}</td>
      <td class="num-cell">${fmt(r.clicks)}</td>
      <td>${mkBadge(r.delta,        false)}</td>
      <td>${mkBadge(r.deltaYoy,     false)}</td>
      <td class="num-cell">${fmt(r.impressions)}</td>
      <td>${mkBadge(r.deltaImprPop, false)}</td>
      <td>${mkBadge(r.deltaImprYoy, false)}</td>
      <td class="num-cell pos-cell ${posColor(r.position)}">${r.position.toFixed(1)}</td>
      <td>${mkBadge(r.deltaPosPop,  true)}</td>
      <td>${mkBadge(r.deltaPosYoy,  true)}</td>
      <td class="num-cell">${(r.ctr * 100).toFixed(2)}%</td>
    </tr>`;
  }).join('');
  requestAnimationFrame(applyHeatmap);
}

// ── WINNERS / LOSERS ──────────────────────────

export function renderWinners() {
  const data = filtBrand(S.kwData).filter(r => r.delta != null && r.clicks >= 3).sort((a, b) => b.delta - a.delta).slice(0, 5);
  const tb   = document.getElementById('winners-body');
  if (!data.length) { tb.innerHTML = '<div class="empty">Not enough data.</div>'; return; }
  tb.innerHTML = '<div class="wl-card">' + data.map((r, i) => `
    <div class="wl-row win">
      <span class="wl-rank">${i + 1}</span>
      <span class="wl-query" title="${r.query}">${r.query}</span>
      <span class="wl-stat">${fmt(r.clicks)} clicks</span>
      <span class="wl-badge up">↑ +${r.delta.toFixed(1)}%</span>
    </div>`).join('') + '</div>';
}

export function renderLosers() {
  const data = filtBrand(S.kwData).filter(r => r.delta != null && r.prevClicks >= 3).sort((a, b) => a.delta - b.delta).slice(0, 5);
  const tb   = document.getElementById('losers-body');
  if (!data.length) { tb.innerHTML = '<div class="empty">Not enough data.</div>'; return; }
  tb.innerHTML = '<div class="wl-card">' + data.map((r, i) => `
    <div class="wl-row lose">
      <span class="wl-rank">${i + 1}</span>
      <span class="wl-query" title="${r.query}">${r.query}</span>
      <span class="wl-stat">${fmt(r.clicks)} clicks</span>
      <span class="wl-badge dn">↓ ${r.delta.toFixed(1)}%</span>
    </div>`).join('') + '</div>';
}


// ── CSV EXPORT ────────────────────────────────

export function exportCsv() {
  const data = filtBrand(S.qData);
  if (!data.length) return;
  const headers = ['Keyword','Clicks','Clicks PoP %','Clicks YoY %','Impressions','Impr PoP %','Impr YoY %','Avg Position','Pos PoP %','Pos YoY %','CTR %'];
  const rows = data.map(r => [
    `"${r.query.replace(/"/g,'""')}"`,
    r.clicks, r.delta ?? '', r.deltaYoy ?? '',
    r.impressions, r.deltaImprPop ?? '', r.deltaImprYoy ?? '',
    r.position.toFixed(1), r.deltaPosPop ?? '', r.deltaPosYoy ?? '',
    (r.ctr * 100).toFixed(2),
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `seo-iq-keywords-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}


// ── KEYWORD SPARKLINE MODAL ───────────────────

export function showKwModal(query) {
  const kw = S.kwData.find(r => r.query === query);
  if (!kw) return;
  // create or reuse modal
  let modal = document.getElementById('kw-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'kw-modal';
    modal.className = 'kw-modal';
    modal.innerHTML = `
      <div class="kw-modal-overlay" onclick="window.__closeKwModal()"></div>
      <div class="kw-modal-box">
        <div class="kw-modal-hdr">
          <span class="kw-modal-title" id="kw-modal-title"></span>
          <button class="kw-modal-cls" onclick="window.__closeKwModal()">✕</button>
        </div>
        <div class="kw-modal-stats" id="kw-modal-stats"></div>
        <div class="kw-modal-note">12-month trend from GSC daily data — click, impressions &amp; position</div>
        <div class="kw-modal-chart-wrap">
          <canvas id="kw-modal-canvas" height="160"></canvas>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('kw-modal-title').textContent = query;
  document.getElementById('kw-modal-stats').innerHTML = `
    <div class="kw-stat"><span class="kw-stat-lbl">Clicks</span><span class="kw-stat-val">${fmt(kw.clicks)}</span></div>
    <div class="kw-stat"><span class="kw-stat-lbl">Impressions</span><span class="kw-stat-val">${fmt(kw.impressions)}</span></div>
    <div class="kw-stat"><span class="kw-stat-lbl">Position</span><span class="kw-stat-val">${kw.position.toFixed(1)}</span></div>
    <div class="kw-stat"><span class="kw-stat-lbl">CTR</span><span class="kw-stat-val">${(kw.ctr*100).toFixed(2)}%</span></div>`;
  modal.style.display = 'flex';
  // load 12-month chart data for this keyword
  loadKwHistory(query);
}

export function closeKwModal() {
  const m = document.getElementById('kw-modal');
  if (m) m.style.display = 'none';
}

async function loadKwHistory(query) {
  // 12-month daily data for this specific keyword
  const end   = new Date(); end.setDate(end.getDate() - 3);
  const start = new Date(end); start.setFullYear(start.getFullYear() - 1);
  const ds    = d => d.toISOString().split('T')[0];
  const site  = S.selGsc;
  if (!site) return;
  const body = {
    startDate: ds(start), endDate: ds(end),
    dimensions: ['date'],
    rowLimit: 365,
    dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: query }] }],
  };
  try {
    const res = await fetch(
      \`https://www.googleapis.com/webmasters/v3/sites/\${encodeURIComponent(site)}/searchAnalytics/query\`,
      { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' } }
    );
    const data = await res.json();
    const rows = (data.rows || []).sort((a,b) => a.keys[0].localeCompare(b.keys[0]));
    const labels = rows.map(r => {
      const dt = new Date(r.keys[0] + 'T00:00:00');
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });
    const clicks = rows.map(r => r.clicks);
    const impr   = rows.map(r => r.impressions);
    const pos    = rows.map(r => +r.position.toFixed(1));
    const canvas = document.getElementById('kw-modal-canvas');
    if (!canvas) return;
    if (window.__kwChart) { window.__kwChart.destroy(); window.__kwChart = null; }
    window.__kwChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Clicks',       data: clicks, borderColor: '#7c6dfa', backgroundColor: 'rgba(124,109,250,.07)', fill: true, borderWidth: 2, pointRadius: 0, tension: .4, yAxisID: 'y' },
          { label: 'Impressions',  data: impr,   borderColor: '#5b9cf6', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4,3], pointRadius: 0, tension: .4, yAxisID: 'y' },
          { label: 'Position',     data: pos,    borderColor: '#f5a623', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [2,4], pointRadius: 0, tension: .4, yAxisID: 'y2' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { color: '#9090a8', font: { family: 'Inter', size: 10 }, boxWidth: 12, padding: 16 } }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(26,26,36,.97)', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, titleColor: '#9090a8', bodyColor: '#e8e8f0', titleFont: { family: 'Inter', size: 10 }, bodyFont: { family: 'Inter', size: 11 } } },
        scales: {
          x:  { grid: { color: 'rgba(255,255,255,.04)', drawBorder: false }, ticks: { color: '#55556a', font: { family: 'Inter', size: 9 }, maxTicksLimit: 12 } },
          y:  { position: 'left',  grid: { color: 'rgba(255,255,255,.04)', drawBorder: false }, ticks: { color: '#55556a', font: { family: 'Inter', size: 9 }, maxTicksLimit: 5 } },
          y2: { position: 'right', reverse: true, grid: { display: false }, ticks: { color: '#f5a623', font: { family: 'Inter', size: 9 }, maxTicksLimit: 4 } },
        },
        interaction: { mode: 'index', intersect: false },
      },
    });
  } catch(e) { console.error('KW history error', e); }
}



// ── KEYWORD SPARKLINE MODAL ───────────────────

export async function showKeywordChart(keyword) {
  // remove existing modal if any
  const old = document.getElementById('kw-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'kw-modal';
  modal.className = 'kw-modal-overlay';
  modal.innerHTML = `
    <div class="kw-modal-card" onclick="event.stopPropagation()">
      <div class="kw-modal-header">
        <div class="kw-modal-title">${keyword}</div>
        <div class="kw-modal-sub">Last 12 months — Clicks, Impressions &amp; Position</div>
        <button class="kw-modal-close" onclick="document.getElementById('kw-modal').remove()">✕</button>
      </div>
      <div class="kw-modal-body">
        <div class="kw-modal-loading"><div class="skel" style="width:100%;height:200px;border-radius:8px"></div></div>
        <canvas id="kw-sparkline" height="200" style="display:none"></canvas>
      </div>
    </div>`;
  modal.addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);

  // fetch 12 months of data for this keyword
  try {
    const { S: st, METRICS: _m } = await import('./state.js');
    const { GSC_BASE } = await import('./config.js');
    const end = new Date(); end.setDate(end.getDate() - 3);
    const start = new Date(end); start.setFullYear(start.getFullYear() - 1);
    const ds = d => d.toISOString().split('T')[0];
    const token = sessionStorage.getItem('seo_tok');
    const site = st.selGsc;
    if (!site || !token) { modal.querySelector('.kw-modal-loading').innerHTML = '<div class="empty-sub">No GSC property selected.</div>'; return; }

    const body = {
      startDate: ds(start), endDate: ds(end),
      dimensions: ['date'],
      rowLimit: 365,
      dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: keyword }] }]
    };
    const res = await fetch(`${GSC_BASE}/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const rows = (data.rows || []).sort((a, b) => a.keys[0].localeCompare(b.keys[0]));

    const labels = rows.map(r => {
      const dt = new Date(r.keys[0] + 'T00:00:00');
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });
    const clicks      = rows.map(r => r.clicks);
    const impressions = rows.map(r => r.impressions);
    const positions   = rows.map(r => +r.position.toFixed(1));

    modal.querySelector('.kw-modal-loading').style.display = 'none';
    const canvas = modal.querySelector('#kw-sparkline');
    canvas.style.display = 'block';

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Clicks', data: clicks, borderColor: '#7c6dfa', backgroundColor: 'rgba(124,109,250,0.07)', fill: true, borderWidth: 2, pointRadius: 0, tension: .4, yAxisID: 'yClicks' },
          { label: 'Impressions', data: impressions, borderColor: '#5b9cf6', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: .4, yAxisID: 'yImpr' },
          { label: 'Avg. Position', data: positions, borderColor: '#f5a623', backgroundColor: 'transparent', borderWidth: 2, borderDash: [2, 4], pointRadius: 0, tension: .4, yAxisID: 'yPos' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: '#9090a8', font: { family: 'Inter', size: 10 }, boxWidth: 8, padding: 16 } },
          tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(26,26,36,.97)', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, titleColor: '#9090a8', bodyColor: '#e8e8f0', titleFont: { family: 'Inter', size: 10 }, bodyFont: { family: 'Inter', size: 11 }, padding: 10 }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,.04)', drawBorder: false }, ticks: { color: '#55556a', font: { family: 'Inter', size: 9 }, maxTicksLimit: 10 } },
          yClicks: { position: 'left',  grid: { color: 'rgba(255,255,255,.04)', drawBorder: false }, ticks: { color: '#7c6dfa', font: { family: 'Inter', size: 9 }, maxTicksLimit: 5 } },
          yImpr:   { position: 'left',  display: false },
          yPos:    { position: 'right', reverse: true, grid: { drawOnChartArea: false }, ticks: { color: '#f5a623', font: { family: 'Inter', size: 9 }, maxTicksLimit: 5 } },
        },
        interaction: { mode: 'index', intersect: false }
      }
    });
  } catch (e) {
    modal.querySelector('.kw-modal-loading').innerHTML = `<div class="empty-sub">Could not load data: ${e.message}</div>`;
  }
}

// ── SORT ──────────────────────────────────────

export function sortQ(col) {
  if (S.qSort.col === col) S.qSort.dir *= -1;
  else { S.qSort.col = col; S.qSort.dir = -1; }
  applySortToQData();
  updateSortHeaders();
  renderKeywords();
}

function updateSortHeaders() {
  document.querySelectorAll('.dt th[data-col]').forEach(th => {
    // store original label once
    if (!th.dataset.label) th.dataset.label = th.textContent.replace(/[↑↓↕\s]+$/,'').trim();
    const base = th.dataset.label;
    if (th.dataset.col === S.qSort.col) {
      th.textContent = base + (S.qSort.dir === -1 ? ' ↓' : ' ↑');
      th.style.color = 'var(--accent-l)';
    } else {
      th.textContent = base + ' ↕';
      th.style.color = '';
    }
  });
}

// ── PICKERS ───────────────────────────────────

export function renderPropOpts(type) {
  const q     = document.getElementById(type + '-in').value.toLowerCase();
  const items = type === 'gsc' ? S.gscSites : S.ga4Props;
  const filt  = items.filter(i => (type === 'gsc' ? i.siteUrl : i.name).toLowerCase().includes(q));
  document.getElementById(type + '-opts').innerHTML = filt.slice(0, 20).map(i => {
    const val = type === 'gsc' ? i.siteUrl : i.id;
    const lbl = type === 'gsc' ? i.siteUrl.replace(/^sc-domain:/, '').replace(/\/$/, '') : i.name;
    return `<div class="popt${(type === 'gsc' ? S.selGsc : S.selGa4) === val ? ' sel' : ''}" onmousedown="window.__selProp('${type}','${val}','${lbl.replace(/'/g, "\\'")}')">${lbl}</div>`;
  }).join('') || '<div class="popt" style="color:var(--text3)">No results</div>';
}

export function renderCountryOpts(q) {
  document.getElementById('country-opts').innerHTML = COUNTRIES
    .filter(c => c.label.toLowerCase().includes(q.toLowerCase()))
    .map(c => `<div class="copt${S.selCountry === c.code ? ' sel' : ''}" onmousedown="window.__selCountry('${c.code}','${c.label}')">${c.label}</div>`)
    .join('');
}

// ── DRAG & RESIZE ─────────────────────────────

let drag   = { active: false };
let resize = { active: false };

export function startDrag(e, id) {
  e.preventDefault();
  const el = document.getElementById(id);
  drag = { active: true, id, ox: e.clientX - el.offsetLeft, oy: e.clientY - el.offsetTop };
  el.classList.add('dragging');
  el.style.zIndex = 99;
}
export function startResize(e, id) {
  e.preventDefault(); e.stopPropagation();
  const el = document.getElementById(id);
  resize = { active: true, id, ox: e.clientX, oy: e.clientY, sw: el.offsetWidth, sh: el.offsetHeight };
  el.classList.add('resizing');
  el.style.zIndex = 99;
}

document.addEventListener('mousemove', e => {
  if (drag.active) {
    const el   = document.getElementById(drag.id);
    const area = document.getElementById('canvas-area');
    el.style.left = Math.max(0, Math.min(area.offsetWidth - el.offsetWidth, e.clientX - drag.ox)) + 'px';
    el.style.top  = Math.max(0, e.clientY - drag.oy) + 'px';
    updateCanvasHeight();
  }
  if (resize.active) {
    const el = document.getElementById(resize.id);
    el.style.width  = Math.max(260, resize.sw + (e.clientX - resize.ox)) + 'px';
    el.style.height = Math.max(180, resize.sh + (e.clientY - resize.oy)) + 'px';
    updateCanvasHeight();
  }
});
document.addEventListener('mouseup', () => {
  if (drag.active)   { document.getElementById(drag.id).classList.remove('dragging');   saveWidgetPositions(); drag.active   = false; }
  if (resize.active) { document.getElementById(resize.id).classList.remove('resizing'); saveWidgetPositions(); resize.active = false; }
});

function updateCanvasHeight() {
  const area = document.getElementById('canvas-area');
  let max = 400;
  area.querySelectorAll('.widget').forEach(w => { max = Math.max(max, w.offsetTop + w.offsetHeight + 20); });
  area.style.minHeight = max + 'px';
}
function saveWidgetPositions() {
  const pos = {};
  ['w-winners', 'w-losers'].forEach(id => {
    const el = document.getElementById(id);
    pos[id] = { l: el.style.left, t: el.style.top, w: el.style.width, h: el.style.height };
  });
  localStorage.setItem('seo_wpos', JSON.stringify(pos));
}
export function restoreWidgetPositions() {
  try {
    const pos = JSON.parse(localStorage.getItem('seo_wpos') || '{}');
    Object.keys(pos).forEach(id => {
      const el = document.getElementById(id);
      if (el && pos[id]) { el.style.left = pos[id].l; el.style.top = pos[id].t; el.style.width = pos[id].w; el.style.height = pos[id].h; }
    });
  } catch {}
  updateCanvasHeight();
}
