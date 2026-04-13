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

export function setLoading() {
  ['m-clicks','m-impr','m-pos','m-ctr','m-sess','m-rev']
    .forEach(id => document.getElementById(id).textContent = '…');
  ['m-clicks-d','m-impr-d','m-pos-d','m-ctr-d','m-sess-d','m-rev-d']
    .forEach(id => document.getElementById(id).innerHTML = '');
  document.getElementById('kw-body').innerHTML =
    '<tr><td colspan="11" style="padding:24px;text-align:center;color:var(--text3);font-size:12px"><span class="dot">Loading</span></td></tr>';
  document.getElementById('winners-body').innerHTML = '<div class="loading"><span class="dot">Loading</span></div>';
  document.getElementById('losers-body').innerHTML  = '<div class="loading"><span class="dot">Loading</span></div>';
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

  // clicks filtered
  const clEl = document.getElementById('m-clicks-f');
  clEl.textContent = fmt(fCl);
  clEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const clDiff = tCl - fCl;
  document.getElementById('m-clicks-diff').innerHTML = hasFilter
    ? `<span class="fdiff saved">−${fmt(clDiff)} from branded (${((clDiff / tCl) * 100).toFixed(1)}%)</span>`
    : '<span class="fdiff">same as total</span>';

  // impressions filtered
  const imEl = document.getElementById('m-impr-f');
  imEl.textContent = fmt(fIm);
  imEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const imDiff = tIm - fIm;
  document.getElementById('m-impr-diff').innerHTML = hasFilter
    ? `<span class="fdiff saved">−${fmt(imDiff)} from branded (${((imDiff / tIm) * 100).toFixed(1)}%)</span>`
    : '<span class="fdiff">same as total</span>';

  // position filtered
  const posEl  = document.getElementById('m-pos-f');
  posEl.textContent = fPos != null ? fPos.toFixed(1) : '—';
  posEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const posDiff = fPos != null && tPos != null ? +(fPos - tPos).toFixed(1) : null;
  document.getElementById('m-pos-diff').innerHTML = hasFilter && posDiff != null
    ? `<span class="fdiff ${posDiff < 0 ? 'saved' : 'added'}">${posDiff > 0 ? '+' : ''}${posDiff} without branded</span>`
    : '<span class="fdiff">same as total</span>';

  // CTR filtered
  const ctrEl  = document.getElementById('m-ctr-f');
  ctrEl.textContent = fCtr != null ? (fCtr * 100).toFixed(2) + '%' : '—';
  ctrEl.className   = 'fval' + (hasFilter ? ' has-filter' : '');
  const ctrDiff = fCtr != null && tCtr != null ? +((fCtr - tCtr) * 100).toFixed(2) : null;
  document.getElementById('m-ctr-diff').innerHTML = hasFilter && ctrDiff != null
    ? `<span class="fdiff ${ctrDiff > 0 ? 'saved' : 'added'}">${ctrDiff > 0 ? '+' : ''}${ctrDiff}% without branded</span>`
    : '<span class="fdiff">same as total</span>';

  // recalc click deltas on filtered set
  const popCl = filt.reduce((a, r) => a + (r.prevClicks || 0), 0);
  const yoyCl = filt.reduce((a, r) => a + (r.yoyClicks  || 0), 0);
  METRICS.clicksPop = fmtD(fCl, popCl);
  METRICS.clicksYoy = fmtD(fCl, yoyCl);
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
  recalcMetricsFromFiltered();
  renderKeywords();
  renderWinners();
  renderLosers();
}

// ── BADGE HELPER ──────────────────────────────

function mkBadge(v, inv) {
  if (v == null) return '—';
  const cls = (inv ? v < 0 : v > 0) ? 'up' : 'dn';
  return `<span class="badge ${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
}

// ── KEYWORD TABLE ─────────────────────────────

export function renderKeywords() {
  const q    = document.getElementById('kw-search').value.toLowerCase();
  let   data = filtBrand(S.kwData).filter(r => r.query.toLowerCase().includes(q));
  if (S.kwTab === 'up') data = data.filter(r => (r.delta != null && r.delta > 5)   || (r.deltaYoy != null && r.deltaYoy > 5));
  if (S.kwTab === 'dn') data = data.filter(r => (r.delta != null && r.delta < -5)  || (r.deltaYoy != null && r.deltaYoy < -5));
  const tb = document.getElementById('kw-body');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="11"><div class="empty">No keywords found.</div></td></tr>'; return; }
  tb.innerHTML = data.slice(0, 200).map((r, i) => {
    const bb = r.branded && !S.hideBranded ? '<span class="bbadge">brand</span>' : '';
    return `<tr>
      <td><span class="rn">${i + 1}</span><span class="kwc" style="display:inline-block" title="${r.query}">${r.query}</span>${bb}</td>
      <td style="color:var(--text);font-weight:500">${fmt(r.clicks)}</td>
      <td>${mkBadge(r.delta,        false)}</td>
      <td>${mkBadge(r.deltaYoy,     false)}</td>
      <td>${fmt(r.impressions)}</td>
      <td>${mkBadge(r.deltaImprPop, false)}</td>
      <td>${mkBadge(r.deltaImprYoy, false)}</td>
      <td>${r.position.toFixed(1)}<span class="pbar"><span class="pbf" style="width:${Math.max(4, Math.min(100, 100 - r.position * 3))}%"></span></span></td>
      <td>${mkBadge(r.deltaPosPop,  true)}</td>
      <td>${mkBadge(r.deltaPosYoy,  true)}</td>
      <td>${(r.ctr * 100).toFixed(2)}%</td>
    </tr>`;
  }).join('');
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

// ── SORT ──────────────────────────────────────

export function sortQ(col) {
  if (S.qSort.col === col) S.qSort.dir *= -1;
  else { S.qSort.col = col; S.qSort.dir = -1; }
  S.qData.sort((a, b) => {
    const av = a[col] ?? -Infinity, bv = b[col] ?? -Infinity;
    return (av > bv ? 1 : -1) * S.qSort.dir;
  });
  renderKeywords();
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
