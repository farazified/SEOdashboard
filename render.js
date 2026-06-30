// ── render.js ── all DOM rendering ──

import { S, METRICS } from './state.js';
import { fmt, fmtD, fmtMoney, loadAll } from './api.js';
import { COUNTRIES, BUILT_IN_SEGS } from './config.js';

// ── GA4 CARDS ──
// Always renders raw all-organic values on the main cards. When "Hide branded"
// is on AND the non-brand ratio is known, also populates the filtered sub-row
// (Sessions/Revenue) with estimated non-brand values.
export function renderGa4Cards() {
  const sessEl = document.getElementById('m-sess');
  const revEl  = document.getElementById('m-rev');
  const totSEl = document.getElementById('m-tot-sess');
  const totREl = document.getElementById('m-tot-rev');
  if (!sessEl) return;

  // Main cards — always raw values
  sessEl.textContent = METRICS.sess    != null ? fmt(METRICS.sess)        : '—';
  revEl.textContent  = METRICS.rev     != null ? fmtMoney(METRICS.rev)    : '—';
  if (totSEl) totSEl.textContent = METRICS.totSess != null ? fmt(METRICS.totSess) : '—';
  if (totREl) totREl.textContent = METRICS.totRev  != null ? fmtMoney(METRICS.totRev) : '—';

  // Filtered sub-row — only meaningful when brand filter is on & ratio is known
  const ratio  = METRICS.nonBrandRatio;
  const useEst = S.hideBranded && ratio != null && METRICS.sess != null;

  const fvSess  = document.getElementById('fv-sess');
  const fvRev   = document.getElementById('fv-rev');
  const flSess  = document.getElementById('fl-sess');
  const flRev   = document.getElementById('fl-rev');
  const dfSess  = document.getElementById('fv-sess-diff');
  const dfRev   = document.getElementById('fv-rev-diff');

  if (useEst) {
    const estS = METRICS.sess * ratio;
    const estR = (METRICS.rev || 0) * ratio;
    const pct  = (ratio * 100).toFixed(0);

    if (fvSess) fvSess.innerHTML = `<span class="est-val" title="Estimated non-brand: ${fmt(Math.round(estS))} (${pct}% non-brand × ${fmt(METRICS.sess)} all-organic)">~${fmt(Math.round(estS))}</span>`;
    if (fvRev)  fvRev.innerHTML  = `<span class="est-val" title="Estimated non-brand: ${fmtMoney(estR)} (${pct}% non-brand × ${fmtMoney(METRICS.rev||0)} all-organic)">~${fmtMoney(estR)}</span>`;

    if (flSess) flSess.textContent = `~${pct}% non-brand`;
    if (flRev)  flRev.textContent  = `~${pct}% non-brand`;

    // Footnotes: show what proportion of organic this represents
    if (dfSess) dfSess.innerHTML = `<span class="fdiff saved">${pct}% of organic</span>`;
    if (dfRev)  dfRev.innerHTML  = `<span class="fdiff saved">${pct}% of organic</span>`;
  } else {
    if (fvSess) fvSess.textContent = '—';
    if (fvRev)  fvRev.textContent  = '—';
    if (flSess) flSess.textContent = 'no filter';
    if (flRev)  flRev.textContent  = 'no filter';
    if (dfSess) dfSess.innerHTML = '<span class="fdiff">enable brand filter for estimate</span>';
    if (dfRev)  dfRev.innerHTML  = '<span class="fdiff">enable brand filter for estimate</span>';
  }
}

// ── DELTA DISPLAY ──

function dRow(label, val, inv) {
  if (val == null) return '';
  const cls = (inv ? val < 0 : val > 0) ? 'up' : 'dn';
  return `<div class="drow"><span class="dtag">${label}</span><span class="dval ${cls}">${val>0?'+':''}${val}%</span></div>`;
}

export function updateDeltas() {
  const sp = S.cmpMode==='pop'||S.cmpMode==='both';
  const sy = S.cmpMode==='yoy'||S.cmpMode==='both';
  const set = (id, pop, yoy, inv) => {
    document.getElementById(id).innerHTML =
      (sp ? dRow('PoP', pop, inv) : '') +
      (sy ? dRow('YoY', yoy, inv) : '');
  };
  set('m-cd',  METRICS.clicksPop,   METRICS.clicksYoy,   false);
  set('m-id',  METRICS.imprPop,    METRICS.imprYoy,    false);
  set('m-pd',  METRICS.posPop,     METRICS.posYoy,     true);
  set('m-td',  METRICS.ctrPop,     METRICS.ctrYoy,     false);
  set('m-sd',  METRICS.sessPop,    METRICS.sessYoy,    false);
  set('m-rd',  METRICS.revPop,     METRICS.revYoy,     false);
  set('m-tsd', METRICS.totSessPop, METRICS.totSessYoy, false);
  set('m-trd', METRICS.totRevPop,  METRICS.totRevYoy,  false);
}

// ── BRANDED ──

export function getBrandTerms() {
  const v = document.getElementById('brand-terms').value.trim();
  localStorage.setItem('seo_brand', v);
  if (v) return v.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
  if (S.selGsc) {
    const d = S.selGsc.replace(/^sc-domain:/,'').replace(/^https?:\/\//,'').replace(/\/.*/,'').replace(/^www\./,'');
    return [d.split('.')[0], d];
  }
  return [];
}
export function isBrand(q) { return getBrandTerms().some(t => q.toLowerCase().includes(t)); }
export function filtBrand(data) {
  data.forEach(r => r.branded = isBrand(r.query));
  return S.hideBranded ? data.filter(r => !r.branded) : data;
}

// ── FILTERED METRIC CARDS ──

export function recalcFiltered() {
  if (!S.kwData.length) return;
  const all  = S.kwData;
  const filt = filtBrand(S.kwData.map(r=>({...r})));
  const tN=all.length, fN=filt.length;

  // True totals from METRICS (full GSC dataset, byPage aggregation)
  const trueCl  = METRICS.clicks ?? 0;
  const trueIm  = METRICS.impr   ?? 0;
  const truePos = METRICS.pos;
  const trueCtr = METRICS.ctr;

  document.getElementById('m-clicks').textContent = fmt(trueCl);
  document.getElementById('m-impr').textContent   = fmt(trueIm);
  document.getElementById('m-pos').textContent    = truePos!=null?truePos.toFixed(1):'—';
  document.getElementById('m-ctr').textContent    = trueCtr!=null?(trueCtr*100).toFixed(2)+'%':'—';

  // Use server-side non-brand aggregates (full dataset) when available.
  // Falls back to summing top-500 kwData if the non-brand fetch hasn't completed yet.
  const useServer = S.hideBranded && METRICS.nonBrandClicks != null;
  let fCl, fIm, fPos, fCtr, fClPop, fClYoy, fImPop, fImYoy;
  if (useServer) {
    fCl    = METRICS.nonBrandClicks;
    fIm    = METRICS.nonBrandImpr;
    fPos   = METRICS.nonBrandPos;
    fCtr   = METRICS.nonBrandCtr;
    fClPop = METRICS.nonBrandClicksPop;
    fClYoy = METRICS.nonBrandClicksYoy;
    fImPop = METRICS.nonBrandImprPop;
    fImYoy = METRICS.nonBrandImprYoy;
  } else {
    let tCl=0,tIm=0; let cCl=0,cIm=0,cCs=0,cPs=0;
    all.forEach(r=>{tCl+=r.clicks;tIm+=r.impressions;});
    filt.forEach(r=>{cCl+=r.clicks;cIm+=r.impressions;cCs+=r.ctr;cPs+=r.position;});
    fCl=cCl; fIm=cIm;
    fPos = fN ? cPs/fN : null;
    fCtr = fN ? cCs/fN : null;
    fClPop = fmtD(fCl, filt.reduce((a,r)=>a+(r.prevClicks||0),0));
    fClYoy = fmtD(fCl, filt.reduce((a,r)=>a+(r.yoyClicks||0),0));
    fImPop = fmtD(fIm, filt.reduce((a,r)=>a+(r.prevImpr||0),0));
    fImYoy = fmtD(fIm, filt.reduce((a,r)=>a+(r.yoyImpr||0),0));
  }

  const hasF = S.hideBranded && (useServer ? fCl < trueCl : fN < tN);
  document.getElementById('sec-metrics')?.classList.toggle('has-filter', hasF);
  const lbl = hasF
    ? (useServer
        ? `−${fmt(trueCl - fCl)} brand clicks excluded`
        : `−${tN-fN} brand kw excluded`)
    : 'no filter';
  ['cl','im','pos','ctr'].forEach(k => document.getElementById('fl-'+k).textContent = lbl);

  const sp=S.cmpMode==='pop'||S.cmpMode==='both';
  const sy=S.cmpMode==='yoy'||S.cmpMode==='both';

  const fd = (el, fVal, pop, yoy, extraHtml, inv) => {
    document.getElementById(el).textContent = fVal;
    document.getElementById(el).className = 'fval'+(hasF?' has-filter':'');
    let html = extraHtml || '';
    html += (sp && pop!=null ? dRow('PoP',pop,inv) : '') + (sy && yoy!=null ? dRow('YoY',yoy,inv) : '');
    document.getElementById(el+'-diff').innerHTML = html || '<span class="fdiff">same as total</span>';
  };

  // clicks: % bar shows non-brand share of total
  const clPct = trueCl>0 ? (fCl/trueCl*100).toFixed(1) : null;
  const clExtra = (hasF && clPct!=null)
    ? `<div class="filt-pct-row"><div class="filt-bar-wrap"><div class="filt-bar" style="width:${clPct}%"></div></div><span class="fdiff saved">${clPct}% of total</span></div>`
    : '';
  fd('fv-cl', fmt(fCl), fClPop, fClYoy, clExtra, false);

  // impressions: same
  const imPct = trueIm>0 ? (fIm/trueIm*100).toFixed(1) : null;
  const imExtra = (hasF && imPct!=null)
    ? `<div class="filt-pct-row"><div class="filt-bar-wrap"><div class="filt-bar" style="width:${imPct}%"></div></div><span class="fdiff saved">${imPct}% of total</span></div>`
    : '';
  fd('fv-im', fmt(fIm), fImPop, fImYoy, imExtra, false);

  // position — vs all-traffic position
  const posDiff = fPos!=null&&truePos!=null ? +(fPos-truePos).toFixed(1) : null;
  const posExtra = hasF&&posDiff!=null
    ? `<span class="fdiff ${posDiff<0?'saved':'fdiff'}">${posDiff>0?'+':''}${posDiff} vs total (lower = better)</span>` : '';
  const fPosPop = useServer ? METRICS.nonBrandPosPop : null;
  const fPosYoy = useServer ? METRICS.nonBrandPosYoy : null;
  fd('fv-pos', fPos!=null?fPos.toFixed(1):'—', fPosPop, fPosYoy, posExtra, true);

  // CTR
  const ctrDiff = fCtr!=null&&trueCtr!=null ? +((fCtr-trueCtr)*100).toFixed(2) : null;
  const ctrExtra = hasF&&ctrDiff!=null
    ? `<span class="fdiff ${ctrDiff>0?'saved':''}">${ctrDiff>0?'+':''}${ctrDiff}% vs total</span>` : '';
  const fCtrPop = useServer ? METRICS.nonBrandCtrPop : METRICS.ctrPop;
  const fCtrYoy = useServer ? METRICS.nonBrandCtrYoy : METRICS.ctrYoy;
  fd('fv-ctr', fCtr!=null?(fCtr*100).toFixed(2)+'%':'—', fCtrPop, fCtrYoy, ctrExtra, false);
}

// ── RENDER ALL ──

export function renderAll() {
  applySortToQData();
  recalcFiltered();
  renderKeywords();
  renderWinners();
  renderLosers();
  renderSegments();
  requestAnimationFrame(updateSortHeaders);
  if (S.page === 'rank')     renderRankIntelligence();
  if (S.page === 'insights') renderInsights();
}

// ── SEGMENTS ──

export function renderSegments() {
  const container = document.getElementById('seg-pills');
  if (!container) return;
  const curPat = document.getElementById('url-filter')?.value.trim() || '';
  const all = [...BUILT_IN_SEGS, ...(S.segments||[])];
  container.innerHTML = all.map(seg => {
    // URL-list segment: active when urlSelections matches this segment's list
    const isUrlList = !!seg.urlList;
    let active;
    if (isUrlList) {
      active = S.urlSelections.length === seg.urlList.length &&
               seg.urlList.every(u => S.urlSelections.includes(u));
    } else {
      active = curPat === seg.pattern;
    }
    const del = seg.isCustom
      ? `<span class="seg-x" onclick="window._delSeg('${seg.id}',event)" title="Remove">×</span>`
      : '';
    const countChip = isUrlList
      ? `<span class="seg-pill-count">${seg.urlList.length}</span>`
      : '';
    const cls = `seg-pill${active?' seg-active':''}${isUrlList?' seg-urllist':''}`;
    const handler = isUrlList
      ? `window._selSegUrls('${seg.id}')`
      : `window._selSeg('${seg.pattern.replace(/'/g,"\\'")}')`;
    return `<button class="${cls}" style="--sc:${seg.color}"
      onclick="${handler}">
      <span class="seg-dot"></span>${seg.name}${countChip}${del}
    </button>`;
  }).join('');
}

// ── SEGMENTS BREAKDOWN TABLE ──

// Change badges under a metric value, honoring the PoP/YoY/Both comparison toggle.
// inv=true for metrics where down is good (position).
function segDelta(pop, yoy, inv) {
  const sp = S.cmpMode==='pop' || S.cmpMode==='both';
  const sy = S.cmpMode==='yoy' || S.cmpMode==='both';
  const html = (sp ? dRow('PoP', pop, inv) : '') + (sy ? dRow('YoY', yoy, inv) : '');
  return `<div class="seg-deltas">${html || '<span class="fdiff">—</span>'}</div>`;
}

export function renderSegmentsTable() {
  const tb = document.getElementById('seg-table-body');
  if (!tb) return;

  const data = S.segmentsData;
  if (data === null) {
    tb.innerHTML = Array(5).fill(
      '<tr>' + '<td><div class="skel" style="height:12px;border-radius:3px"></div></td>'.repeat(5) + '</tr>'
    ).join('');
    return;
  }

  let rows = data.slice();
  if (S.segmentsTab === 'growing')  rows = rows.filter(s => (s.clicksPop!=null&&s.clicksPop>5)  || (s.clicksYoy!=null&&s.clicksYoy>5));
  if (S.segmentsTab === 'decaying') rows = rows.filter(s => (s.clicksPop!=null&&s.clicksPop<-5) || (s.clicksYoy!=null&&s.clicksYoy<-5));

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon">📁</div>
      <div class="empty-title">No segments ${S.segmentsTab!=='all'?'in this view':'to show'}</div>
      <div class="empty-sub">${S.segmentsTab!=='all'?'Try the All tab.':'Add segments from the pill bar on Overview.'}</div>
    </div></td></tr>`;
    return;
  }

  tb.innerHTML = rows.map(s => {
    const est  = s.estimated ? '~' : '';   // organic sessions/revenue are estimated under brand filter
    const pos  = s.position!=null ? s.position.toFixed(1) : '—';
    return `<tr class="seg-row" onclick="window._segDrill('${s.id}')" title="Drill into ${s.name}">
      <td class="seg-name-cell"><span class="seg-dot" style="background:${s.color}"></span>${s.name}</td>
      <td class="num-cell seg-metric"><span class="seg-val">${fmt(s.clicks)}</span>${segDelta(s.clicksPop, s.clicksYoy, false)}</td>
      <td class="num-cell seg-metric"><span class="seg-val">${pos}</span>${segDelta(s.posPop, s.posYoy, true)}</td>
      <td class="num-cell seg-metric"><span class="seg-val">${est}${fmt(s.sessions)}</span>${segDelta(s.sessPop, s.sessYoy, false)}</td>
      <td class="num-cell seg-metric"><span class="seg-val">${fmt(s.totSessions)}</span>${segDelta(s.totSessPop, s.totSessYoy, false)}</td>
      <td class="num-cell seg-metric"><span class="seg-val">${est}${fmtMoney(s.revenue)}</span>${segDelta(s.revPop, s.revYoy, false)}</td>
      <td class="num-cell seg-metric"><span class="seg-val">${fmtMoney(s.totRevenue)}</span>${segDelta(s.totRevPop, s.totRevYoy, false)}</td>
    </tr>`;
  }).join('');
}

// ── METRIC EXPLORER ──

const ME_CFG = {
  // GSC
  clicks:      { label:'Clicks',       color:'#7c6dfa', inv:false, src:'gsc', fmt: v => Math.round(v).toLocaleString() },
  impressions: { label:'Impressions',  color:'#5b9cf6', inv:false, src:'gsc', fmt: v => Math.round(v).toLocaleString() },
  position:    { label:'Avg Position', color:'#f5a623', inv:true,  src:'gsc', fmt: v => v.toFixed(1) },
  ctr:         { label:'CTR',          color:'#3ecf8e', inv:false, src:'gsc', fmt: v => (v*100).toFixed(2)+'%' },
  // GA4
  sessions:    { label:'Sessions',     color:'#3ecf8e', inv:false, src:'ga4', fmt: v => Math.round(v).toLocaleString() },
  revenue:     { label:'Revenue',      color:'#f5a623', inv:false, src:'ga4', fmt: v => '$'+(v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':v.toFixed(2)) },
};

function _meGetVal(r, met) {
  if (met==='clicks')      return r.clicks      || 0;
  if (met==='impressions') return r.impressions  || 0;
  if (met==='position')    return r.position     || 0;
  if (met==='ctr')         return r.ctr          || 0;
  if (met==='sessions')    return r.sessions     || 0;
  if (met==='revenue')     return r.revenue      || 0;
  return 0;
}
function _meAggRows(rows, met) {
  if (!rows.length) return 0;
  if (met==='position') {
    const wi = rows.reduce((a,r)=>a+(_meGetVal(r,'position')*(_meGetVal(r,'impressions')||1)),0);
    const si = rows.reduce((a,r)=>a+(_meGetVal(r,'impressions')||1),0);
    return si ? wi/si : 0;
  }
  if (met==='ctr') {
    const cl = rows.reduce((a,r)=>a+_meGetVal(r,'clicks'),0);
    const im = rows.reduce((a,r)=>a+_meGetVal(r,'impressions'),0);
    return im ? cl/im : 0;
  }
  return rows.reduce((a,r)=>a+_meGetVal(r,met),0);
}
function _groupBy(arr, fn) {
  return arr.reduce((acc,x) => { const k=fn(x); (acc[k]=acc[k]||[]).push(x); return acc; }, {});
}

const YEAR_COLS = ['#7c6dfa', '#3ecf8e', '#f5a623', '#5b9cf6', '#ef4444'];

export function renderMetricExplorer() {
  const canvas = document.getElementById('me-chart');
  if (!canvas) return;

  const rows = S.meData || [];

  // Update segment badge
  const badge = document.getElementById('me-seg-badge');
  if (badge) {
    const uf = document.getElementById('url-filter')?.value.trim();
    badge.textContent = uf || 'Sitewide';
  }

  if (!rows.length) {
    if (S.meChart) { try { S.meChart.destroy(); } catch{} S.meChart = null; }
    const legendEl = document.getElementById('me-year-legend');
    if (legendEl) { legendEl.innerHTML = ''; legendEl.style.display = 'none'; }
    return;
  }

  // Guard: if current metric belongs to wrong source, switch to source default
  const src = S.meSource || 'gsc';
  const mc0 = ME_CFG[S.meMetric];
  if (!mc0 || mc0.src !== src) {
    S.meMetric = src === 'ga4' ? 'sessions' : 'clicks';
    document.querySelectorAll('.me-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.met === S.meMetric));
  }

  const met = S.meMetric;
  const agg = S.meAgg || 'daily';
  const typ = S.meType || 'line';
  const mc  = ME_CFG[met];

  let labels = [], values = [], labelYears = [];

  if (agg === 'daily') {
    rows.forEach(r => {
      const d = new Date(r.date + 'T00:00:00');
      labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      values.push(_meGetVal(r, met));
      labelYears.push(d.getFullYear());
    });

  } else if (agg === 'weekly') {
    const grp = _groupBy(rows, r => {
      const d = new Date(r.date+'T00:00:00'), dow = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate()-(dow===0?6:dow-1));
      return mon.toISOString().split('T')[0];
    });
    Object.entries(grp).forEach(([k, rs]) => {
      const d = new Date(k + 'T00:00:00');
      labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      values.push(_meAggRows(rs, met));
      labelYears.push(d.getFullYear());
    });

  } else {
    const grp = _groupBy(rows, r => r.date.slice(0,7));
    Object.entries(grp).forEach(([k, rs]) => {
      const d = new Date(k + '-02T00:00:00');
      labels.push(d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
      values.push(_meAggRows(rs, met));
      labelYears.push(d.getFullYear());
    });
  }

  // Build year → color map
  const uniqueYears = [...new Set(labelYears)].sort();
  const multiYear   = uniqueYears.length > 1;
  const yearColorMap = Object.fromEntries(
    uniqueYears.map((y, i) => [y, YEAR_COLS[i % YEAR_COLS.length]])
  );

  // Update year legend chips
  const legendEl = document.getElementById('me-year-legend');
  if (legendEl) {
    if (multiYear) {
      legendEl.innerHTML = uniqueYears.map(y =>
        `<span class="me-year-chip">
          <span class="me-year-dot" style="background:${yearColorMap[y]}"></span>${y}
        </span>`
      ).join('');
      legendEl.style.display = 'flex';
    } else {
      legendEl.innerHTML = '';
      legendEl.style.display = 'none';
    }
  }

  if (S.meChart) { try { S.meChart.destroy(); } catch{} S.meChart = null; }

  const isBar = typ === 'bar';

  // Per-point colors when spanning multiple years
  const bgColors     = multiYear
    ? labelYears.map(y => yearColorMap[y] + 'cc')
    : (isBar ? mc.color + 'bb' : mc.color + '18');
  const borderColors = multiYear
    ? labelYears.map(y => yearColorMap[y])
    : mc.color;

  const dataset = {
    label: mc.label, data: values,
    borderColor: (!isBar && multiYear) ? mc.color : borderColors,
    backgroundColor: bgColors,
    borderWidth: isBar ? 0 : 2.5,
    borderRadius: isBar ? 4 : 0,
    fill: !isBar && !multiYear,
    pointRadius: 0,
    tension: .4,
  };

  // Line chart with multiple years: colour each segment by its start-point year
  if (!isBar && multiYear) {
    dataset.segment = {
      borderColor: ctx => yearColorMap[labelYears[ctx.p0DataIndex]] || mc.color,
    };
    dataset.fill = false;
  }

  // Persistent value labels drawn on each bar / point. Skipped when the chart
  // is too dense (e.g. daily over a long range) — the hover tooltip still works.
  const showLabels = values.length <= 32;
  const meLabels = {
    id: 'meLabels',
    afterDatasetsDraw(chart) {
      if (!showLabels) return;
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || meta.hidden) return;
      ctx.save();
      ctx.font = '600 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      meta.data.forEach((el, i) => {
        const v = values[i];
        if (v == null || (isBar && !v)) return;          // skip empty bars
        const yRaw = el.y - (isBar ? 4 : 6);
        const y = Math.max(yRaw, chartArea.top + 9);      // keep inside the plot
        ctx.fillStyle = multiYear
          ? (yearColorMap[labelYears[i]] || mc.color)
          : (isBar ? '#d2d2e2' : mc.color);
        ctx.fillText(mc.fmt(v), el.x, y);
      });
      ctx.restore();
    },
  };

  S.meChart = new Chart(canvas, {
    type: isBar ? 'bar' : 'line',
    data: { labels, datasets: [dataset] },
    plugins: [meLabels],
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode:'index', intersect:false,
          backgroundColor:'rgba(26,26,36,.97)', borderColor:'rgba(255,255,255,.1)', borderWidth:1,
          titleColor:'#9090a8', bodyColor:'#e8e8f0',
          titleFont:{family:'Inter',size:10}, bodyFont:{family:'Inter',size:11}, padding:10,
          callbacks: {
            label: ctx => {
              const yr = multiYear ? ` (${labelYears[ctx.dataIndex]})` : '';
              return ` ${mc.label}${yr}: ${mc.fmt(ctx.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: { grid:{color:'rgba(255,255,255,.04)',drawBorder:false}, ticks:{color:'#55556a',font:{size:9},maxTicksLimit:14} },
        y: {
          reverse: mc.inv,
          grid:{color:'rgba(255,255,255,.04)',drawBorder:false},
          ticks:{
            color: multiYear ? '#9090a8' : mc.color,
            font:{size:9}, maxTicksLimit:6, callback: v => mc.fmt(v),
          },
        },
      },
      interaction:{ mode:'index', intersect:false },
    },
  });
}

function applySortToQData() {
  const { col, dir } = S.qSort;
  S.qData.sort((a, b) => {
    if (col === 'query') return a.query.localeCompare(b.query) * dir;
    const av=a[col], bv=b[col];
    if (av==null && bv==null) return 0;
    if (av==null) return 1;
    if (bv==null) return -1;
    return (av > bv ? 1 : -1) * dir;
  });
}

// ── BADGE ──

function badge(v, inv) {
  if (v==null) return '<span class="badge fl">—</span>';
  const cls = (inv ? v<0 : v>0) ? 'up' : 'dn';
  return `<span class="badge ${cls}">${v>0?'+':''}${v.toFixed(1)}%</span>`;
}

// ── POSITION COLOR ──

function posClass(p) {
  if (p <= 5)  return 'pos-1';
  if (p <= 10) return 'pos-2';
  if (p <= 15) return 'pos-3';
  if (p <= 20) return 'pos-4';
  return 'pos-5';
}

// ── KEYWORD TABLE ──

const KW_PER_PAGE = 50;

export function renderKeywords(keepPage = false) {
  if (!keepPage) S.kwPage = 1;

  const q    = document.getElementById('kw-search').value.toLowerCase();
  // Brand filter + tab filter applied to the FULL dataset (all fetched rows)
  let   data = filtBrand(S.qData.map(r=>({...r}))).filter(r => r.query.toLowerCase().includes(q));
  if (S.kwTab==='up') data = data.filter(r => (r.delta!=null&&r.delta>5)||(r.deltaYoy!=null&&r.deltaYoy>5));
  if (S.kwTab==='dn') data = data.filter(r => (r.delta!=null&&r.delta<-5)||(r.deltaYoy!=null&&r.deltaYoy<-5));

  const total     = data.length;
  const totalPages = Math.max(1, Math.ceil(total / KW_PER_PAGE));
  // clamp page in case filter reduced total
  if (S.kwPage > totalPages) S.kwPage = totalPages;
  const page = S.kwPage;

  const tb = document.getElementById('kw-body');
  if (!total) {
    tb.innerHTML = `<tr><td colspan="12"><div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">No keywords found</div>
      <div class="empty-sub">${S.kwTab!=='all'?'Try the All tab or adjust filters.':'No data for this period.'}</div>
    </div></td></tr>`;
    _renderPager(0, 0, 0, 1, 1);
    return;
  }

  // top-3 opportunities across FULL filtered set (not just visible page)
  const oppSet = new Set(
    [...data].filter(r=>r.position<=15)
      .sort((a,b)=>b.impressions-a.impressions)
      .slice(0,3).map(r=>r.query)
  );

  const pageData = data.slice((page - 1) * KW_PER_PAGE, page * KW_PER_PAGE);
  const offset   = (page - 1) * KW_PER_PAGE; // global rank offset

  tb.innerHTML = pageData.map((r, i) => {
    const bb     = r.branded&&!S.hideBranded ? '<span class="bbadge">brand</span>' : '';
    const isOpp  = oppSet.has(r.query);
    const oppTag = isOpp ? '<span class="opp-badge">opportunity</span>' : '';
    const q_esc  = r.query.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const q_data = r.query.replace(/"/g,'&quot;');
    return `<tr${isOpp?' class="opp-row"':''}>
      <td class="cb-col"><input type="checkbox" class="kw-cb" data-q="${q_data}" onchange="window._updateCopySel()"></td>
      <td><span class="rn">${offset+i+1}</span><span class="kwc kw-link" onclick="window._kwChart('${q_esc}')" title="Click for 12-month chart">${r.query}</span>${bb}${oppTag}<button class="kw-copy-btn" onclick="window._copyKw(event,'${q_esc}')" title="Copy keyword">⎘</button></td>
      <td class="num-cell hm-click col-clicks">${fmt(r.clicks)}</td>
      <td class="col-clicks-pop">${badge(r.delta,false)}</td>
      <td class="col-clicks-yoy">${badge(r.deltaYoy,false)}</td>
      <td class="num-cell hm-impr col-impr">${fmt(r.impressions)}</td>
      <td class="col-impr-pop">${badge(r.deltaImprPop,false)}</td>
      <td class="col-impr-yoy">${badge(r.deltaImprYoy,false)}</td>
      <td class="num-cell pos-cell ${posClass(r.position)} col-pos">${r.position.toFixed(1)}</td>
      <td class="col-pos-pop">${badge(r.deltaPosPop,true)}</td>
      <td class="col-pos-yoy">${badge(r.deltaPosYoy,true)}</td>
      <td class="num-cell col-ctr">${(r.ctr*100).toFixed(2)}%</td>
    </tr>`;
  }).join('');

  const from = offset + 1;
  const to   = Math.min(page * KW_PER_PAGE, total);
  _renderPager(from, to, total, page, totalPages);

  requestAnimationFrame(() => { applyHeatmap(); applyColVisibility(); });
}

function _renderPager(from, to, total, page, totalPages) {
  const el = document.getElementById('kw-pager');
  if (!el) return;

  if (!total) { el.innerHTML = ''; return; }

  // build page buttons (max 5 visible)
  let pagesHtml = '';
  const maxV = 5;
  let ps = Math.max(1, page - Math.floor(maxV / 2));
  let pe = Math.min(totalPages, ps + maxV - 1);
  if (pe - ps < maxV - 1) ps = Math.max(1, pe - maxV + 1);

  if (ps > 1)           pagesHtml += `<button class="pg-btn" onclick="window._kwGoPage(1)">1</button>`;
  if (ps > 2)           pagesHtml += `<span class="pg-ellipsis">…</span>`;
  for (let i = ps; i <= pe; i++) {
    pagesHtml += `<button class="pg-btn${i===page?' active':''}" onclick="window._kwGoPage(${i})">${i}</button>`;
  }
  if (pe < totalPages - 1) pagesHtml += `<span class="pg-ellipsis">…</span>`;
  if (pe < totalPages)  pagesHtml += `<button class="pg-btn" onclick="window._kwGoPage(${totalPages})">${totalPages}</button>`;

  el.innerHTML = `
    <div class="kw-pager-inner">
      <span class="kw-count">${from}–${to} of ${total} keywords</span>
      <div class="pg-controls">
        <button class="pg-btn pg-arrow" ${page===1?'disabled':''} onclick="window._kwGoPage(${page-1})">←</button>
        ${pagesHtml}
        <button class="pg-btn pg-arrow" ${page===totalPages?'disabled':''} onclick="window._kwGoPage(${page+1})">→</button>
      </div>
    </div>`;
}

// ── COLUMN VISIBILITY ──

const ALL_COLS = ['clicks','clicks-pop','clicks-yoy','impr','impr-pop','impr-yoy','pos','pos-pop','pos-yoy','ctr'];

export function applyColVisibility() {
  const dt = document.querySelector('.dt');
  if (!dt) return;
  ALL_COLS.forEach(k => dt.classList.toggle('hide-' + k, !!S.hideCols[k]));
}

function applyHeatmap() {
  ['.hm-click', '.hm-impr'].forEach(sel => {
    const cells = [...document.querySelectorAll(`#kw-body tr td${sel}`)];
    if (!cells.length) return;
    const vals = cells.map(c => {
      const t = c.textContent.trim();
      if (t==='—') return 0;
      if (t.endsWith('M')) return parseFloat(t)*1e6;
      if (t.endsWith('K')) return parseFloat(t)*1e3;
      return parseFloat(t.replace(/,/g,''))||0;
    });
    const max = Math.max(...vals);
    cells.forEach((c,i) => {
      const pct = max>0 ? vals[i]/max : 0;
      c.dataset.heat = pct>.8?'h5':pct>.6?'h4':pct>.4?'h3':pct>.2?'h2':'h1';
    });
  });
}

// ── SORT ──

export function sortQ(col) {
  if (S.qSort.col===col) S.qSort.dir *= -1;
  else { S.qSort.col=col; S.qSort.dir=-1; }
  applySortToQData();
  renderKeywords();
  requestAnimationFrame(updateSortHeaders);
}

function updateSortHeaders() {
  document.querySelectorAll('.dt th[data-col]').forEach(th => {
    if (!th.dataset.base) th.dataset.base = th.textContent.replace(/[↑↓↕]/g,'').trim();
    const active = th.dataset.col === S.qSort.col;
    th.textContent = th.dataset.base + ' ' + (active ? (S.qSort.dir===-1?'↓':'↑') : '↕');
    th.style.color = active ? 'var(--accent-l)' : '';
  });
}

// ── WINNERS / LOSERS ──

export function renderWinners() {
  const data = filtBrand(S.kwData).filter(r=>r.delta!=null&&r.clicks>=3)
    .sort((a,b)=>b.delta-a.delta).slice(0,5);
  const tb = document.getElementById('winners-body');
  if (!data.length) { tb.innerHTML='<div class="empty">Not enough data.</div>'; return; }
  tb.innerHTML = '<div class="wl-card">' + data.map((r,i) => `
    <div class="wl-row win">
      <span class="wl-rank">${i+1}</span>
      <span class="wl-q">${r.query}</span>
      <span class="wl-stat">${fmt(r.clicks)} clicks</span>
      <span class="wl-badge up">↑ +${r.delta.toFixed(1)}%</span>
    </div>`).join('') + '</div>';
}

export function renderLosers() {
  const data = filtBrand(S.kwData).filter(r=>r.delta!=null&&(r.prevClicks||0)>=3)
    .sort((a,b)=>a.delta-b.delta).slice(0,5);
  const tb = document.getElementById('losers-body');
  if (!data.length) { tb.innerHTML='<div class="empty">Not enough data.</div>'; return; }
  tb.innerHTML = '<div class="wl-card">' + data.map((r,i) => `
    <div class="wl-row lose">
      <span class="wl-rank">${i+1}</span>
      <span class="wl-q">${r.query}</span>
      <span class="wl-stat">${fmt(r.clicks)} clicks</span>
      <span class="wl-badge dn">↓ ${r.delta.toFixed(1)}%</span>
    </div>`).join('') + '</div>';
}

// ── CSV EXPORT ──

export function exportCsv() {
  const data = filtBrand(S.qData);
  if (!data.length) return;
  const hdr = ['Keyword','Clicks','Clicks PoP%','Clicks YoY%','Impressions','Impr PoP%','Impr YoY%','Avg Position','Pos PoP%','Pos YoY%','CTR%'];
  const rows = data.map(r => [
    `"${r.query.replace(/"/g,'""')}"`,
    r.clicks, r.delta??'', r.deltaYoy??'',
    r.impressions, r.deltaImprPop??'', r.deltaImprYoy??'',
    r.position.toFixed(1), r.deltaPosPop??'', r.deltaPosYoy??'',
    (r.ctr*100).toFixed(2),
  ]);
  const csv = [hdr,...rows].map(r=>r.join(',')).join('\n');
  const a   = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
    download: `seo-iq-${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
}

// ── KEYWORD SPARKLINE MODAL ──

// keyword sparkline all-data cache
let _kwAllRows = [];
let _kwActive  = null;
let _kwChart   = null;
let _pendingDays = 365;

export async function showKwChart(keyword) {
  document.getElementById('kw-modal')?.remove();
  _kwAllRows = []; _kwActive = keyword; _pendingDays = 365; _kwVisible = { clicks:true, impr:true, pos:true };

  const modal = document.createElement('div');
  modal.id = 'kw-modal';
  modal.className = 'kw-modal-overlay';
  modal.innerHTML = `
    <div class="kw-modal-card" onclick="event.stopPropagation()">
      <div class="kw-modal-hdr">
        <div>
          <div class="kw-modal-title">${keyword}</div>
          <div class="kw-modal-sub">Clicks, Impressions &amp; Avg. Position</div>
        </div>
        <div class="kw-range-pills">
          <button class="kw-pill" data-days="7">7d</button>
          <button class="kw-pill" data-days="30">30d</button>
          <button class="kw-pill" data-days="90">3m</button>
          <button class="kw-pill active" data-days="365">12m</button>
        </div>
        <button class="kw-modal-close" onclick="document.getElementById('kw-modal').remove()">✕</button>
      </div>
      <div class="kw-modal-body" id="kw-modal-body">
        <div class="skel" style="width:100%;height:260px;border-radius:8px"></div>
      </div>
    </div>`;
  modal.addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);

  // range pill click — uses onclick so it works after fetch too
  modal.querySelectorAll('.kw-pill').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('#kw-modal .kw-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (_kwAllRows.length) {
        _renderKwChart(parseInt(btn.dataset.days));
      } else {
        // data still loading — store selected days and render when ready
        _pendingDays = parseInt(btn.dataset.days);
      }
    });
  });

  // fetch 12 months up front, then slice for range
  try {
    const { GSC_BASE } = await import('./config.js');
    const tok  = sessionStorage.getItem('seo_tok');
    const site = S.selGsc;
    if (!site||!tok) throw new Error('No GSC property selected');

    const end   = new Date(); end.setDate(end.getDate()-3);
    const start = new Date(end); start.setFullYear(start.getFullYear()-1);
    const ds    = d => d.toISOString().split('T')[0];

    const res = await fetch(
      `${GSC_BASE}/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      { method:'POST', headers:{ Authorization:'Bearer '+tok, 'Content-Type':'application/json' },
        body: JSON.stringify({ startDate:ds(start), endDate:ds(end), dimensions:['date'], rowLimit:365,
          dimensionFilterGroups:[{filters:[{dimension:'query',operator:'equals',expression:keyword}]}] }) }
    );
    if (!res.ok) throw new Error('API error '+res.status);
    const data = await res.json();
    _kwAllRows = (data.rows||[]).sort((a,b)=>a.keys[0].localeCompare(b.keys[0]));
    _renderKwChart(_pendingDays);
  } catch(e) {
    const b = document.getElementById('kw-modal-body');
    if (b) b.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Could not load data</div><div class="empty-sub">${e.message}</div></div>`;
  }
}

function rollingAvg(arr, w=7) {
  return arr.map((_,i) => {
    const slice = arr.slice(Math.max(0,i-w+1), i+1);
    return +(slice.reduce((a,b)=>a+b,0)/slice.length).toFixed(2);
  });
}

// which series are visible — persists across range changes
let _kwVisible = { clicks: true, impr: true, pos: true };

function _renderKwChart(days) {
  const modal = document.getElementById('kw-modal');
  if (!modal || _kwActive === null) return;

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days - 3);
  const rows   = _kwAllRows.filter(r => new Date(r.keys[0]+'T00:00:00') >= cutoff);

  const body = document.getElementById('kw-modal-body');
  if (!body) return;

  // build toggle checkboxes + canvas
  body.innerHTML = `
    <div class="kw-toggles">
      <label class="kw-tog-lbl" data-series="clicks">
        <input type="checkbox" ${_kwVisible.clicks?'checked':''} onchange="window._kwToggle('clicks',this.checked)">
        <span class="kw-tog-dot" style="background:#7c6dfa"></span>Clicks
      </label>
      <label class="kw-tog-lbl" data-series="impr">
        <input type="checkbox" ${_kwVisible.impr?'checked':''} onchange="window._kwToggle('impr',this.checked)">
        <span class="kw-tog-dot" style="background:#5b9cf6"></span>Impressions
      </label>
      <label class="kw-tog-lbl" data-series="pos">
        <input type="checkbox" ${_kwVisible.pos?'checked':''} onchange="window._kwToggle('pos',this.checked)">
        <span class="kw-tog-dot" style="background:#f5a623"></span>Avg. Position
      </label>
    </div>
    <canvas id="kw-spark" style="width:100%;height:240px"></canvas>`;

  if (_kwChart) { try { _kwChart.destroy(); } catch{} _kwChart=null; }

  const labels = rows.map(r => new Date(r.keys[0]+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
  const clicks = rows.map(r=>r.clicks);
  const impr   = rows.map(r=>r.impressions);
  const pos    = rows.map(r=>+r.position.toFixed(1));

  _kwChart = new Chart(document.getElementById('kw-spark'), {
    type:'line',
    data:{
      labels,
      datasets:[
        {
          label:'Clicks', data:clicks,
          borderColor:'#7c6dfa', backgroundColor:'rgba(124,109,250,0.08)',
          fill:true, borderWidth:2.5, pointRadius:0, tension:.4,
          yAxisID:'yL', hidden:!_kwVisible.clicks,
        },
        {
          label:'Impressions', data:impr,
          borderColor:'#5b9cf6', backgroundColor:'transparent',
          fill:false, borderWidth:2, borderDash:[5,3], pointRadius:0, tension:.4,
          yAxisID:'yL', hidden:!_kwVisible.impr,
        },
        {
          label:'Avg. Position', data:pos,
          borderColor:'#f5a623', backgroundColor:'transparent',
          fill:false, borderWidth:2.5, borderDash:[3,3], pointRadius:0, tension:.4,
          yAxisID:'yR', hidden:!_kwVisible.pos,
        },
      ],
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:false },
        tooltip:{
          mode:'index', intersect:false,
          backgroundColor:'rgba(26,26,36,.97)', borderColor:'rgba(255,255,255,.1)', borderWidth:1,
          titleColor:'#9090a8', bodyColor:'#e8e8f0',
          titleFont:{family:'Inter',size:10}, bodyFont:{family:'Inter',size:11}, padding:10,
          callbacks:{
            label: ctx => {
              if (ctx.datasetIndex === 2) return ` Position: ${ctx.parsed.y}`;
              if (ctx.datasetIndex === 1) return ` Impressions: ${ctx.parsed.y.toLocaleString()}`;
              return ` Clicks: ${ctx.parsed.y.toLocaleString()}`;
            }
          }
        },
      },
      scales:{
        x: { grid:{color:'rgba(255,255,255,.04)',drawBorder:false}, ticks:{color:'#55556a',font:{family:'Inter',size:9},maxTicksLimit:10} },
        yL:{ position:'left',  grid:{color:'rgba(255,255,255,.04)',drawBorder:false}, ticks:{color:'#7c6dfa',font:{family:'Inter',size:9},maxTicksLimit:6} },
        yR:{ position:'right', reverse:true, grid:{drawOnChartArea:false}, ticks:{color:'#f5a623',font:{family:'Inter',size:9},maxTicksLimit:6},
             title:{display:true, text:'↓ lower = better', color:'#f5a623', font:{size:9}} },
      },
      interaction:{ mode:'index', intersect:false },
    },
  });

  // store active days so toggles can re-use it
  _kwChart._days = days;
}

// toggle a series on/off without re-fetching
window._kwToggle = (series, visible) => {
  _kwVisible[series] = visible;
  if (!_kwChart) return;
  const idx = { clicks:0, impr:1, pos:2 }[series];
  _kwChart.data.datasets[idx].hidden = !visible;
  _kwChart.update('none');
};


// ── KEYWORD COPY ──

window._updateCopySel = () => {
  const n   = document.querySelectorAll('#kw-body .kw-cb:checked').length;
  const btn = document.getElementById('btn-copy-sel');
  if (!btn) return;
  btn.textContent = n > 0 ? `⎘ Copy selected (${n})` : '⎘ Copy selected';
  btn.classList.toggle('has-sel', n > 0);
  const sa = document.getElementById('kw-select-all');
  if (sa) {
    const total = document.querySelectorAll('#kw-body .kw-cb').length;
    sa.indeterminate = n > 0 && n < total;
    sa.checked = total > 0 && n === total;
  }
};

window._kwSelectAll = (checked) => {
  document.querySelectorAll('#kw-body .kw-cb').forEach(cb => cb.checked = checked);
  window._updateCopySel();
};

window._copyKw = (e, q) => {
  e.stopPropagation();
  navigator.clipboard.writeText(q).then(() => {
    const btn = e.currentTarget;
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '⎘'; btn.classList.remove('copied'); }, 1200);
  });
};

window._copySelected = () => {
  const selected = [...document.querySelectorAll('#kw-body .kw-cb:checked')].map(cb => cb.dataset.q);
  if (!selected.length) return;
  navigator.clipboard.writeText(selected.join('\n')).then(() => {
    const btn = document.getElementById('btn-copy-sel');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = `✓ Copied ${selected.length} keyword${selected.length>1?'s':''}`;
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
};

// ── ESCAPE KEY clears keyword filter ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const inp = document.getElementById('kw-search');
    if (inp && inp.value) { inp.value = ''; renderKeywords(); }
  }
});

// ── PICKERS ──

export function renderPropOpts(type) {
  const q     = document.getElementById(type+'-in').value.toLowerCase();
  const items = type==='gsc' ? S.gscSites : S.ga4Props;
  const filt  = items.filter(i => {
    if (type === 'gsc') {
      return i.siteUrl.toLowerCase().includes(q);
    } else {
      return i.name.toLowerCase().includes(q) || (i.accountName && i.accountName.toLowerCase().includes(q));
    }
  });
  document.getElementById(type+'-opts').innerHTML = filt.slice(0,20).map(i=>{
    const val = type==='gsc' ? i.siteUrl : i.id;
    const lbl = type==='gsc' ? i.siteUrl.replace(/^sc-domain:/,'').replace(/\/$/,'') : (i.accountName ? `${i.accountName} > ${i.name}` : i.name);
    return `<div class="popt${(type==='gsc'?S.selGsc:S.selGa4)===val?' sel':''}" onmousedown="window._selProp('${type}','${val}','${(type==='gsc'?lbl:i.name).replace(/'/g,"\\'")}' )">${lbl}</div>`;
  }).join('') || '<div class="popt" style="color:var(--text3)">No results</div>';
}

// ── CLIENT PROFILES ──

export function renderClientOpts(q = '') {
  const opts = document.getElementById('client-opts');
  if (!opts) return;
  const filt = q ? S.clients.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : S.clients;
  if (!filt.length) {
    opts.innerHTML = q
      ? '<div class="copt-empty">No clients match.</div>'
      : '<div class="copt-empty">No clients saved.<br>Click ⚙ Manage to add one.</div>';
    return;
  }
  opts.innerHTML = filt.map(c =>
    `<div class="copt-client${S.selClient===c.id?' sel':''}" onmousedown="window._selClient('${c.id}')">
      <span class="copt-name">${c.name}</span>
      <span class="copt-sub">${c.gscLabel} · ${c.ga4Label}</span>
    </div>`
  ).join('');
}

export function renderClientMgr() {
  const list = document.getElementById('mgr-list');
  if (!list) return;
  if (!S.clients.length) {
    list.innerHTML = '<div class="mgr-empty">No clients yet — add one below.</div>';
    return;
  }
  list.innerHTML = `
    <div class="mgr-list-hdr">Saved clients (${S.clients.length})</div>
    <div class="mgr-rows">
    ${S.clients.map(c => `
      <div class="mgr-row${S.selClient===c.id?' mgr-active':''}">
        <div class="mgr-row-info">
          <div class="mgr-row-name">${c.name}</div>
          <div class="mgr-row-sub">${c.gscLabel} · ${c.ga4Label}${c.countryLabel ? ' · ' + c.countryLabel : ''}</div>
        </div>
        <div class="mgr-row-actions">
          <button class="mgr-row-sel" onclick="window._selClient('${c.id}');window._closeClientMgr()">Load →</button>
          <button class="mgr-row-del" onclick="window._delClient('${c.id}')">✕</button>
        </div>
      </div>`).join('')}
    </div>`;
}

export function renderCountryOpts(q='') {
  document.getElementById('country-opts').innerHTML = COUNTRIES
    .filter(c=>c.label.toLowerCase().includes(q.toLowerCase()))
    .map(c=>`<div class="copt${S.selCountry===c.code?' sel':''}" onmousedown="window._selCountry('${c.code}','${c.label}')">${c.label}</div>`)
    .join('');
}

export function renderMgrCountryOpts(q='', selCode='') {
  const opts = document.getElementById('mgr-country-opts');
  if (!opts) return;
  const filt = COUNTRIES.filter(c => c.label.toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  if (!filt.length) { opts.style.display = 'none'; return; }
  opts.style.display = '';
  opts.innerHTML = filt.map(c =>
    `<div class="mgr-popt${c.code===selCode?' sel':''}" onmousedown="window._selMgrCountry('${c.code}','${c.label.replace(/'/g,"\\'")}')">
      ${c.label}
    </div>`
  ).join('');
}

// ── PAGES VIEW ──

const PAGES_PER_PAGE = 50;

// Pages: GA4 sessions cell — shows estimated non-brand value when brand filter on
function _pgSessCell(r) {
  if (r.sessions == null) return '—';
  if (S.hideBranded && r.estSessions != null) {
    const pct = (r.nonBrandRatio * 100).toFixed(0);
    return `<span class="est-val" title="Estimated non-brand: ${fmt(Math.round(r.estSessions))} (${pct}% non-brand × ${fmt(r.sessions)} all-organic)">~${fmt(Math.round(r.estSessions))}</span>`;
  }
  return fmt(r.sessions);
}
function _pgRevCell(r) {
  if (r.revenue == null) return '—';
  if (S.hideBranded && r.estRevenue != null) {
    const pct = (r.nonBrandRatio * 100).toFixed(0);
    return `<span class="est-val" title="Estimated non-brand: ${fmtMoney(r.estRevenue)} (${pct}% non-brand × ${fmtMoney(r.revenue)} all-organic)">~${fmtMoney(r.estRevenue)}</span>`;
  }
  return fmtMoney(r.revenue);
}

export function renderPages(keepPage = false) {
  if (!keepPage) S.pagesPage = 1;
  const tb = document.getElementById('pages-body');
  if (!tb) return;

  // Show brand-filter note when "Hide branded" is on
  const note = document.getElementById('pages-brand-note');
  if (note) note.style.display = S.hideBranded ? '' : 'none';

  // Update GA4 column headers: "Est. Non-brand …" when brand filter on
  const tbl = document.getElementById('pages-body')?.closest('table');
  const sessTh = tbl?.querySelector('th[data-col="sessions"]');
  const revTh  = tbl?.querySelector('th[data-col="revenue"]');
  if (sessTh) sessTh.textContent = S.hideBranded ? '~ Est. Non-brand Sess.' : 'Org. Sessions';
  if (revTh)  revTh.textContent  = S.hideBranded ? '~ Est. Non-brand Rev.'  : 'Org. Revenue';

  if (S.pagesData === null) {
    tb.innerHTML = `<tr><td colspan="13"><div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">Loading pages…</div><div class="empty-sub">Fetching page-level data from GSC and GA4.</div></div></td></tr>`;
    const pg = document.getElementById('pages-pager'); if (pg) pg.innerHTML = '';
    return;
  }

  let { col, dir } = S.pagesSort;
  // When brand filter is on, sorting by sessions/revenue should use the estimated values
  if (S.hideBranded) {
    if (col === 'sessions') col = 'estSessions';
    if (col === 'revenue')  col = 'estRevenue';
  }
  const sorted = [...S.pagesData].sort((a, b) => {
    const av = a[col], bv = b[col];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; if (bv == null) return -1;
    return (av > bv ? 1 : -1) * dir;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGES_PER_PAGE));
  if (S.pagesPage > totalPages) S.pagesPage = totalPages;
  const pageData = sorted.slice((S.pagesPage - 1) * PAGES_PER_PAGE, S.pagesPage * PAGES_PER_PAGE);

  if (!total) {
    tb.innerHTML = `<tr><td colspan="13"><div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">No page data</div><div class="empty-sub">Load data from the Overview page first.</div></div></td></tr>`;
    const pg = document.getElementById('pages-pager'); if (pg) pg.innerHTML = '';
    return;
  }

  tb.innerHTML = pageData.map(r => {
    const path = r.url.replace(/^https?:\/\/[^/]+/, '') || '/';
    const q_esc = r.url.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `<tr>
      <td class="pages-url-cell" title="${r.url}">
        <span class="pages-path kw-link" onclick="window._drillPage('${q_esc}')">${path}</span>
      </td>
      <td class="num-cell col-clicks">${fmt(r.clicks)}</td>
      <td class="col-clicks-pop">${badge(r.delta, false)}</td>
      <td class="col-clicks-yoy">${badge(r.deltaYoy, false)}</td>
      <td class="num-cell pos-cell ${posClass(r.position)} col-pos">${r.position.toFixed(1)}</td>
      <td class="col-pos-pop">${badge(r.deltaPosPop, true)}</td>
      <td class="col-pos-yoy">${badge(r.deltaPosYoy, true)}</td>
      <td class="num-cell">${_pgSessCell(r)}</td>
      <td>${badge(r.deltaSessPop, false)}</td>
      <td>${badge(r.deltaSessYoy, false)}</td>
      <td class="num-cell">${_pgRevCell(r)}</td>
      <td>${badge(r.deltaRevPop, false)}</td>
      <td>${badge(r.deltaRevYoy, false)}</td>
    </tr>`;
  }).join('');

  const pg = document.getElementById('pages-pager');
  if (!pg) return;
  if (total <= PAGES_PER_PAGE) { pg.innerHTML = `<div class="kw-pager-inner"><span class="kw-count">${total} pages</span></div>`; return; }
  const from = (S.pagesPage - 1) * PAGES_PER_PAGE + 1;
  const to   = Math.min(S.pagesPage * PAGES_PER_PAGE, total);
  let pHtml  = '';
  const maxV = 5;
  let ps = Math.max(1, S.pagesPage - 2), pe = Math.min(totalPages, ps + maxV - 1);
  if (pe - ps < maxV - 1) ps = Math.max(1, pe - maxV + 1);
  if (ps > 1) pHtml += `<button class="pg-btn" onclick="window._pagesGoPage(1)">1</button>`;
  if (ps > 2) pHtml += `<span class="pg-ellipsis">…</span>`;
  for (let i = ps; i <= pe; i++) pHtml += `<button class="pg-btn${i===S.pagesPage?' active':''}" onclick="window._pagesGoPage(${i})">${i}</button>`;
  if (pe < totalPages - 1) pHtml += `<span class="pg-ellipsis">…</span>`;
  if (pe < totalPages) pHtml += `<button class="pg-btn" onclick="window._pagesGoPage(${totalPages})">${totalPages}</button>`;
  pg.innerHTML = `<div class="kw-pager-inner"><span class="kw-count">${from}–${to} of ${total} pages</span><div class="pg-controls"><button class="pg-btn pg-arrow" ${S.pagesPage===1?'disabled':''} onclick="window._pagesGoPage(${S.pagesPage-1})">←</button>${pHtml}<button class="pg-btn pg-arrow" ${S.pagesPage===totalPages?'disabled':''} onclick="window._pagesGoPage(${S.pagesPage+1})">→</button></div></div>`;
}

// ── RANK INTELLIGENCE ──

const CTR_BENCH = [28,15,11,8,7,6,5,4,3.5,3,2.5,2,1.8,1.6,1.4,1.2,1.1,1,0.9,0.8]; // pos 1-20
function _expectedCTR(pos) {
  const i = Math.max(0, Math.min(19, Math.round(pos) - 1));
  return CTR_BENCH[i] / 100;
}

export function renderRankIntelligence() {
  const container = document.getElementById('rank-content');
  if (!container) return;
  const data = S.kwData;
  if (!data.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">No data yet</div><div class="empty-sub">Load data from Overview first, then come back here.</div></div>`;
    return;
  }

  const buckets = [
    { label:'1–3',  min:1,  max:3,  cls:'b1' },
    { label:'4–10', min:4,  max:10, cls:'b2' },
    { label:'11–20',min:11, max:20, cls:'b3' },
    { label:'21–50',min:21, max:50, cls:'b4' },
    { label:'51+',  min:51, max:Infinity, cls:'b5' },
  ];
  const bClicks = buckets.map(b => data.filter(r=>r.position>=b.min&&r.position<=b.max).reduce((s,r)=>s+r.clicks,0));
  const bCount  = buckets.map(b => data.filter(r=>r.position>=b.min&&r.position<=b.max).length);
  const maxCl   = Math.max(...bClicks, 1);

  const distHtml = `<div class="ri-card">
    <div class="ri-card-ttl">Rank Distribution</div>
    <div class="rank-buckets">
      ${buckets.map((b,i)=>`<div class="rank-bucket">
        <div class="rb-label">${b.label}</div>
        <div class="rb-bar-wrap"><div class="rb-bar ${b.cls}" style="width:${(bClicks[i]/maxCl*100).toFixed(1)}%"></div></div>
        <div class="rb-stats">${fmt(bClicks[i])} clicks · ${bCount[i]} kw</div>
      </div>`).join('')}
    </div>
  </div>`;

  const ctrRows = data.slice(0,20).map(r=>{
    const exp=((_expectedCTR(r.position))*100).toFixed(1), act=(r.ctr*100).toFixed(2), gap=+(act-exp).toFixed(1);
    return `<tr>
      <td class="ctr-kw">${r.query}</td>
      <td class="num-cell pos-cell ${posClass(r.position)}">${r.position.toFixed(1)}</td>
      <td class="num-cell">${exp}%</td>
      <td class="num-cell">${act}%</td>
      <td class="num-cell"><span class="badge ${gap>=0?'up':'dn'}">${gap>0?'+':''}${gap}%</span></td>
    </tr>`;
  }).join('');

  const ctrHtml = `<div class="ri-card ri-card-wide">
    <div class="ri-card-ttl">CTR vs Benchmark <span class="ri-sub">(top 20 keywords by clicks)</span></div>
    <div class="ctr-table-wrap"><table class="ctr-table">
      <thead><tr><th>Keyword</th><th>Pos</th><th>Expected CTR</th><th>Actual CTR</th><th>Gap</th></tr></thead>
      <tbody>${ctrRows}</tbody>
    </table></div>
  </div>`;

  const opps = data.map(r=>{
    const exp=_expectedCTR(r.position), gain=Math.round(Math.max(0,r.impressions*(exp-r.ctr)));
    return {...r, expCtr:(exp*100).toFixed(1), gain};
  }).filter(r=>r.gain>0&&r.position>1).sort((a,b)=>b.gain-a.gain).slice(0,25);

  const oppHtml = `<div class="ri-card ri-card-wide">
    <div class="ri-card-ttl">Click Opportunities <span class="ri-sub">(if CTR matched benchmark)</span></div>
    <div class="ctr-table-wrap"><table class="ctr-table">
      <thead><tr><th>Keyword</th><th>Pos</th><th>Impressions</th><th>Current CTR</th><th>Expected CTR</th><th>Est. Gain</th></tr></thead>
      <tbody>${opps.map(r=>`<tr>
        <td class="ctr-kw">${r.query}</td>
        <td class="num-cell pos-cell ${posClass(r.position)}">${r.position.toFixed(1)}</td>
        <td class="num-cell">${fmt(r.impressions)}</td>
        <td class="num-cell">${(r.ctr*100).toFixed(2)}%</td>
        <td class="num-cell">${r.expCtr}%</td>
        <td class="num-cell opp-gain">+${fmt(r.gain)} clicks</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;

  container.innerHTML = `<div class="ri-grid">${distHtml}${ctrHtml}${oppHtml}</div>`;
}

// ── CANNIBALIZATION ──

export function renderCannibalization() {
  const container = document.getElementById('cannibal-content');
  if (!container) return;
  const data = S.cannibalData;

  if (data === null) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">Loading…</div><div class="empty-sub">Fetching query+page data from GSC.</div></div>`;
    return;
  }
  if (!data.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">No cannibalization detected</div><div class="empty-sub">No keywords found competing across multiple URLs in this period.</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="cannibal-summary">
      <span class="cannibal-count">${data.length} keyword${data.length!==1?'s':''}</span> competing across multiple URLs
    </div>
    <div class="cannibal-list">
      ${data.map(g=>`<div class="cannibal-group">
        <div class="cannibal-qhdr">
          <span class="cannibal-q">${g.query}</span>
          <span class="cannibal-q-stat">${fmt(g.totalClicks)} total clicks · ${g.urls.length} URLs</span>
        </div>
        <div class="cannibal-urls">
          ${g.urls.map((u,i)=>{
            const path=u.url.replace(/^https?:\/\/[^/]+/,'')||'/';
            return `<div class="cannibal-url-row${i===0?' cannibal-winner':''}">
              <span class="cannibal-rank-dot">${i===0?'★':(i+1)}</span>
              <span class="cannibal-path" title="${u.url}">${path}</span>
              <span class="cannibal-stat">${fmt(u.clicks)} clicks</span>
              <span class="cannibal-stat">${fmt(u.impressions)} impr.</span>
              <span class="cannibal-stat pos-cell ${posClass(u.position)}">${u.position.toFixed(1)}</span>
              <span class="cannibal-stat">${(u.ctr*100).toFixed(2)}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>`;
}

// ── INSIGHTS ──

export function renderInsights() {
  const container = document.getElementById('insights-content');
  if (!container) return;
  const data = S.kwData;
  if (!data.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💡</div><div class="empty-title">No data yet</div><div class="empty-sub">Load data from Overview first, then come back here.</div></div>`;
    return;
  }

  const bullets = [];
  const totalClicks = data.reduce((s,r)=>s+r.clicks,0);
  const totalImpr   = data.reduce((s,r)=>s+r.impressions,0);
  bullets.push({ icon:'📊', text:`Dataset covers <strong>${data.length}</strong> keywords totalling <strong>${fmt(totalClicks)}</strong> clicks and <strong>${fmt(totalImpr)}</strong> impressions.` });

  const avgPos = data.reduce((s,r)=>s+r.position,0)/data.length;
  bullets.push({ icon:'📍', text:`Average position across all keywords is <strong>${avgPos.toFixed(1)}</strong>.` });

  const top3 = data.filter(r=>r.position<=3);
  const top3Clicks = top3.reduce((s,r)=>s+r.clicks,0);
  const top3Pct = totalClicks>0?(top3Clicks/totalClicks*100).toFixed(1):0;
  bullets.push({ icon:'🥇', text:`<strong>${top3.length}</strong> keywords rank in positions 1–3, driving <strong>${top3Pct}%</strong> of all clicks.` });

  const rising  = data.filter(r=>r.delta!=null&&r.delta>10);
  const falling = data.filter(r=>r.delta!=null&&r.delta<-10);
  if (rising.length)  bullets.push({ icon:'↑', text:`<strong>${rising.length}</strong> keyword${rising.length>1?'s':''} grew clicks by more than 10% PoP.` });
  if (falling.length) bullets.push({ icon:'↓', text:`<strong>${falling.length}</strong> keyword${falling.length>1?'s':''} lost more than 10% of clicks PoP — review content freshness.` });

  const p1120 = data.filter(r=>r.position>10&&r.position<=20);
  if (p1120.length) {
    const impr = p1120.reduce((s,r)=>s+r.impressions,0);
    bullets.push({ icon:'🎯', text:`<strong>${p1120.length}</strong> keywords sit in positions 11–20 with <strong>${fmt(impr)}</strong> combined impressions — prime candidates for page-1 pushes.` });
  }

  const lowCtr = data.filter(r=>r.position<=5&&r.ctr<0.03);
  if (lowCtr.length) bullets.push({ icon:'⚠️', text:`<strong>${lowCtr.length}</strong> keyword${lowCtr.length>1?'s':''} rank in top-5 but have CTR below 3% — title/meta optimisation opportunity.` });

  // N-gram analysis
  const stop = new Set(['with','from','that','this','have','your','for','the','and','are','was','not','you','can','how','what']);
  const ngrams = {};
  data.forEach(r=>{
    const words = r.query.toLowerCase().split(/\s+/);
    words.forEach(w=>{ if(w.length>=4&&!stop.has(w)) ngrams[w]=(ngrams[w]||0)+r.clicks; });
    for(let i=0;i<words.length-1;i++){
      const bg=words[i]+' '+words[i+1];
      if(bg.length>=6) ngrams[bg]=(ngrams[bg]||0)+r.clicks;
    }
  });
  const topNgrams = Object.entries(ngrams).sort((a,b)=>b[1]-a[1]).slice(0,10);

  const ngramHtml = topNgrams.length ? `<div class="ins-card ins-ngram-card">
    <div class="ins-card-ttl">🔤 Top N-Grams by Clicks</div>
    <div class="ngram-list">
      ${topNgrams.map(([w,cl],i)=>`<div class="ngram-row">
        <span class="ngram-rank">${i+1}</span>
        <span class="ngram-word">${w}</span>
        <div class="ngram-bar-wrap"><div class="ngram-bar" style="width:${(cl/topNgrams[0][1]*100).toFixed(1)}%"></div></div>
        <span class="ngram-clicks">${fmt(cl)}</span>
      </div>`).join('')}
    </div>
  </div>` : '';

  const quickWins = data.filter(r=>r.position>3&&r.position<=20).sort((a,b)=>b.impressions-a.impressions).slice(0,10);
  const qwHtml = quickWins.length ? `<div class="ins-card ins-qw-card">
    <div class="ins-card-ttl">⚡ Quick Wins <span class="ri-sub">(pos 4–20, high impressions)</span></div>
    <div class="qw-list">
      ${quickWins.map(r=>`<div class="qw-row">
        <span class="qw-q">${r.query}</span>
        <span class="qw-pos pos-cell ${posClass(r.position)}">${r.position.toFixed(1)}</span>
        <span class="qw-impr">${fmt(r.impressions)} impr</span>
      </div>`).join('')}
    </div>
  </div>` : '';

  container.innerHTML = `<div class="insights-grid">
    <div class="ins-card ins-bullets-card">
      <div class="ins-card-ttl">📋 Summary</div>
      <div class="ins-bullets">
        ${bullets.map(b=>`<div class="ins-bullet"><span class="ins-icon">${b.icon}</span><span>${b.text}</span></div>`).join('')}
      </div>
    </div>
    ${ngramHtml}${qwHtml}
  </div>`;
}

