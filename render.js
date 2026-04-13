// ── render.js ── all DOM rendering ──

import { S, METRICS } from './state.js';
import { fmt, fmtD, loadAll } from './api.js';
import { COUNTRIES } from './config.js';

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
  set('m-cd', METRICS.clicksPop, METRICS.clicksYoy, false);
  set('m-id', METRICS.imprPop,   METRICS.imprYoy,   false);
  set('m-pd', METRICS.posPop,    METRICS.posYoy,    true);
  set('m-td', METRICS.ctrPop,    METRICS.ctrYoy,    false);
  set('m-sd', METRICS.sessPop,   METRICS.sessYoy,   false);
  set('m-rd', METRICS.revPop,    METRICS.revYoy,    false);
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
  let tCl=0,tIm=0,tCs=0,tPs=0; all.forEach(r=>{tCl+=r.clicks;tIm+=r.impressions;tCs+=r.ctr;tPs+=r.position;});
  let fCl=0,fIm=0,fCs=0,fPs=0; filt.forEach(r=>{fCl+=r.clicks;fIm+=r.impressions;fCs+=r.ctr;fPs+=r.position;});
  const tN=all.length, fN=filt.length;
  const tPos=tN?tPs/tN:null, fPos=fN?fPs/fN:null;
  const tCtr=tN?tCs/tN:null, fCtr=fN?fCs/fN:null;
  const urlF = !!document.getElementById('url-filter')?.value.trim();
  const hasF = (S.hideBranded && fN<tN) || urlF;
  const lbl  = hasF ? (S.hideBranded && fN<tN ? `−${tN-fN} kw` : 'filtered') : 'no filter';

  document.getElementById('m-clicks').textContent = fmt(tCl);
  document.getElementById('m-impr').textContent   = fmt(tIm);
  document.getElementById('m-pos').textContent    = tPos!=null?tPos.toFixed(1):'—';
  document.getElementById('m-ctr').textContent    = tCtr!=null?(tCtr*100).toFixed(2)+'%':'—';

  ['cl','im','pos','ctr'].forEach(k => document.getElementById('fl-'+k).textContent = lbl);

  const sp=S.cmpMode==='pop'||S.cmpMode==='both';
  const sy=S.cmpMode==='yoy'||S.cmpMode==='both';

  const fClPop=fmtD(fCl, filt.reduce((a,r)=>a+(r.prevClicks||0),0));
  const fClYoy=fmtD(fCl, filt.reduce((a,r)=>a+(r.yoyClicks||0),0));
  const fImPop=fmtD(fIm, filt.reduce((a,r)=>a+(r.prevImpr||0),0));
  const fImYoy=fmtD(fIm, filt.reduce((a,r)=>a+(r.yoyImpr||0),0));

  const fd = (el, fVal, pop, yoy, extraHtml, inv) => {
    document.getElementById(el).textContent = fVal;
    document.getElementById(el).className = 'fval'+(hasF?' has-filter':'');
    let html = extraHtml || '';
    html += (sp && pop!=null ? dRow('PoP',pop,inv) : '') + (sy && yoy!=null ? dRow('YoY',yoy,inv) : '');
    document.getElementById(el+'-diff').innerHTML = html || '<span class="fdiff">same as total</span>';
  };

  // clicks: always show % of total + mini bar when filter active
  const clPct = tCl>0 ? (fCl/tCl*100).toFixed(1) : null;
  const clExtra = (hasF && clPct!=null)
    ? `<div class="filt-pct-row"><div class="filt-bar-wrap"><div class="filt-bar" style="width:${clPct}%"></div></div><span class="fdiff saved">${clPct}% of total</span></div>`
    : '';
  fd('fv-cl', fmt(fCl), fClPop, fClYoy, clExtra, false);

  // impressions: same
  const imPct = tIm>0 ? (fIm/tIm*100).toFixed(1) : null;
  const imExtra = (hasF && imPct!=null)
    ? `<div class="filt-pct-row"><div class="filt-bar-wrap"><div class="filt-bar" style="width:${imPct}%"></div></div><span class="fdiff saved">${imPct}% of total</span></div>`
    : '';
  fd('fv-im', fmt(fIm), fImPop, fImYoy, imExtra, false);

  // position
  const posDiff = fPos!=null&&tPos!=null ? +(fPos-tPos).toFixed(1) : null;
  const posExtra = hasF&&posDiff!=null
    ? `<span class="fdiff ${posDiff<0?'saved':'fdiff'}">${posDiff>0?'+':''}${posDiff} vs total (lower = better)</span>` : '';
  fd('fv-pos', fPos!=null?fPos.toFixed(1):'—', null, null, posExtra, true);

  // CTR
  const ctrDiff = fCtr!=null&&tCtr!=null ? +((fCtr-tCtr)*100).toFixed(2) : null;
  const ctrExtra = hasF&&ctrDiff!=null
    ? `<span class="fdiff ${ctrDiff>0?'saved':''}">${ctrDiff>0?'+':''}${ctrDiff}% vs total</span>` : '';
  fd('fv-ctr', fCtr!=null?(fCtr*100).toFixed(2)+'%':'—', METRICS.ctrPop, METRICS.ctrYoy, ctrExtra, false);

  // recalc clicks deltas with filtered set
  METRICS.clicksPop = fClPop; METRICS.clicksYoy = fClYoy;
  document.getElementById('m-cd').innerHTML =
    (sp?dRow('PoP',fClPop,false):'')+(sy?dRow('YoY',fClYoy,false):'');
}

// ── RENDER ALL ──

export function renderAll() {
  applySortToQData();
  recalcFiltered();
  renderKeywords();
  renderWinners();
  renderLosers();
  requestAnimationFrame(updateSortHeaders);
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

export function renderKeywords() {
  const q    = document.getElementById('kw-search').value.toLowerCase();
  let   data = filtBrand(S.qData.map(r=>({...r}))).filter(r => r.query.toLowerCase().includes(q));
  if (S.kwTab==='up') data = data.filter(r => (r.delta!=null&&r.delta>5)||(r.deltaYoy!=null&&r.deltaYoy>5));
  if (S.kwTab==='dn') data = data.filter(r => (r.delta!=null&&r.delta<-5)||(r.deltaYoy!=null&&r.deltaYoy<-5));

  const tb = document.getElementById('kw-body');
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="11"><div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">No keywords found</div>
      <div class="empty-sub">${S.kwTab!=='all'?'Try the All tab or adjust filters.':'No data for this period.'}</div>
    </div></td></tr>`;
    return;
  }

  // top-3 opportunities: high impressions, position ≤ 15
  const oppSet = new Set(
    [...data].filter(r=>r.position<=15)
      .sort((a,b)=>b.impressions-a.impressions)
      .slice(0,3).map(r=>r.query)
  );

  tb.innerHTML = data.slice(0,200).map((r,i) => {
    const bb     = r.branded&&!S.hideBranded ? '<span class="bbadge">brand</span>' : '';
    const isOpp  = oppSet.has(r.query);
    const oppTag = isOpp ? '<span class="opp-badge">opportunity</span>' : '';
    const q_esc  = r.query.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `<tr${isOpp?' class="opp-row"':''}>
      <td><span class="rn">${i+1}</span><span class="kwc kw-link" onclick="window._kwChart('${q_esc}')" title="Click for 12-month chart">${r.query}</span>${bb}${oppTag}</td>
      <td class="num-cell hm-click">${fmt(r.clicks)}</td>
      <td>${badge(r.delta,false)}</td>
      <td>${badge(r.deltaYoy,false)}</td>
      <td class="num-cell hm-impr">${fmt(r.impressions)}</td>
      <td>${badge(r.deltaImprPop,false)}</td>
      <td>${badge(r.deltaImprYoy,false)}</td>
      <td class="num-cell pos-cell ${posClass(r.position)}">${r.position.toFixed(1)}</td>
      <td>${badge(r.deltaPosPop,true)}</td>
      <td>${badge(r.deltaPosYoy,true)}</td>
      <td class="num-cell">${(r.ctr*100).toFixed(2)}%</td>
    </tr>`;
  }).join('');

  requestAnimationFrame(applyHeatmap);
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
  _kwAllRows = []; _kwActive = keyword; _pendingDays = 365;

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

function _renderKwChart(days) {
  const modal = document.getElementById('kw-modal');
  if (!modal || _kwActive === null) return;

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days - 3);
  const rows   = _kwAllRows.filter(r => new Date(r.keys[0]+'T00:00:00') >= cutoff);

  const body = document.getElementById('kw-modal-body');
  if (!body) return;
  body.innerHTML = '<canvas id="kw-spark" style="width:100%;height:260px"></canvas>';
  if (_kwChart) { try { _kwChart.destroy(); } catch{} _kwChart=null; }

  const labels   = rows.map(r => new Date(r.keys[0]+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
  const clicks   = rows.map(r=>r.clicks);
  const impr     = rows.map(r=>r.impressions);
  const pos      = rows.map(r=>+r.position.toFixed(1));
  const clicksMA = rollingAvg(clicks, 7);

  _kwChart = new Chart(document.getElementById('kw-spark'), {
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Clicks',          data:clicks,   borderColor:'rgba(124,109,250,.35)', backgroundColor:'transparent', fill:false, borderWidth:1, pointRadius:0, tension:.3, yAxisID:'yL' },
        { label:'Clicks (7d avg)', data:clicksMA, borderColor:'#7c6dfa',              backgroundColor:'rgba(124,109,250,0.08)', fill:true, borderWidth:2.5, pointRadius:0, tension:.4, yAxisID:'yL' },
        { label:'Impressions',     data:impr,     borderColor:'#5b9cf6',              backgroundColor:'transparent', fill:false, borderWidth:1.5, borderDash:[4,3], pointRadius:0, tension:.4, yAxisID:'yL' },
        { label:'Avg. Position',   data:pos,      borderColor:'#f5a623',              backgroundColor:'transparent', fill:false, borderWidth:2, borderDash:[2,4], pointRadius:0, tension:.4, yAxisID:'yR' },
      ],
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:true, position:'top', labels:{ color:'#9090a8', font:{family:'Inter',size:10}, boxWidth:8, padding:12 }},
        tooltip:{ mode:'index', intersect:false, backgroundColor:'rgba(26,26,36,.97)', borderColor:'rgba(255,255,255,.1)', borderWidth:1, titleColor:'#9090a8', bodyColor:'#e8e8f0', titleFont:{family:'Inter',size:10}, bodyFont:{family:'Inter',size:11}, padding:10 },
      },
      scales:{
        x:  { grid:{color:'rgba(255,255,255,.04)',drawBorder:false}, ticks:{color:'#55556a',font:{family:'Inter',size:9},maxTicksLimit:10} },
        yL: { position:'left',  grid:{color:'rgba(255,255,255,.04)',drawBorder:false}, ticks:{color:'#7c6dfa',font:{family:'Inter',size:9},maxTicksLimit:5}, title:{display:true,text:'Clicks / Impr.',color:'#55556a',font:{size:9}} },
        yR: { position:'right', reverse:true, grid:{drawOnChartArea:false}, ticks:{color:'#f5a623',font:{family:'Inter',size:9},maxTicksLimit:5}, title:{display:true,text:'Position (lower = better)',color:'#f5a623',font:{size:9}} },
      },
      interaction:{ mode:'index', intersect:false },
    },
  });
}


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
  const filt  = items.filter(i=>(type==='gsc'?i.siteUrl:i.name).toLowerCase().includes(q));
  document.getElementById(type+'-opts').innerHTML = filt.slice(0,20).map(i=>{
    const val = type==='gsc' ? i.siteUrl : i.id;
    const lbl = type==='gsc' ? i.siteUrl.replace(/^sc-domain:/,'').replace(/\/$/,'') : i.name;
    return `<div class="popt${(type==='gsc'?S.selGsc:S.selGa4)===val?' sel':''}" onmousedown="window._selProp('${type}','${val}','${lbl.replace(/'/g,"\\'")}' )">${lbl}</div>`;
  }).join('') || '<div class="popt" style="color:var(--text3)">No results</div>';
}

export function renderCountryOpts(q='') {
  document.getElementById('country-opts').innerHTML = COUNTRIES
    .filter(c=>c.label.toLowerCase().includes(q.toLowerCase()))
    .map(c=>`<div class="copt${S.selCountry===c.code?' sel':''}" onmousedown="window._selCountry('${c.code}','${c.label}')">${c.label}</div>`)
    .join('');
}

// ── DRAG / RESIZE ──

let drag={active:false}, resize={active:false};

export function startDrag(e,id) {
  e.preventDefault();
  const el=document.getElementById(id);
  drag={active:true,id,ox:e.clientX-el.offsetLeft,oy:e.clientY-el.offsetTop};
  el.classList.add('dragging'); el.style.zIndex=99;
}
export function startResize(e,id) {
  e.preventDefault(); e.stopPropagation();
  const el=document.getElementById(id);
  resize={active:true,id,ox:e.clientX,oy:e.clientY,sw:el.offsetWidth,sh:el.offsetHeight};
  el.classList.add('resizing'); el.style.zIndex=99;
}
document.addEventListener('mousemove', e => {
  if (drag.active) {
    const el=document.getElementById(drag.id), area=document.getElementById('canvas-area');
    el.style.left=Math.max(0,Math.min(area.offsetWidth-el.offsetWidth, e.clientX-drag.ox))+'px';
    el.style.top =Math.max(0, e.clientY-drag.oy)+'px';
    _updateCanvasH();
  }
  if (resize.active) {
    const el=document.getElementById(resize.id);
    el.style.width =Math.max(260,resize.sw+(e.clientX-resize.ox))+'px';
    el.style.height=Math.max(160,resize.sh+(e.clientY-resize.oy))+'px';
    _updateCanvasH();
  }
});
document.addEventListener('mouseup', () => {
  if (drag.active)   { document.getElementById(drag.id).classList.remove('dragging');   _saveWPos(); drag.active=false; }
  if (resize.active) { document.getElementById(resize.id).classList.remove('resizing'); _saveWPos(); resize.active=false; }
});
function _updateCanvasH() {
  const a=document.getElementById('canvas-area');
  let m=300; a.querySelectorAll('.widget').forEach(w=>{ m=Math.max(m,w.offsetTop+w.offsetHeight+20); });
  a.style.minHeight=m+'px';
}
function _saveWPos() {
  const p={}; ['w-win','w-lose'].forEach(id=>{ const el=document.getElementById(id); p[id]={l:el.style.left,t:el.style.top,w:el.style.width,h:el.style.height}; });
  localStorage.setItem('seo_wpos',JSON.stringify(p));
}
export function restoreWidgetPos() {
  try { const p=JSON.parse(localStorage.getItem('seo_wpos')||'{}'); Object.keys(p).forEach(id=>{ const el=document.getElementById(id); if(el&&p[id]){el.style.left=p[id].l;el.style.top=p[id].t;el.style.width=p[id].w;el.style.height=p[id].h;} }); } catch{}
  _updateCanvasH();
}
