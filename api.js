// ── api.js ── all data fetching ──

import { CLIENT_ID, GSC_BASE, GA4_BASE, GA4_ADMIN, SCOPES } from './config.js';
import { S, METRICS } from './state.js';

// ── AUTH ──

export function doOAuth() {
  const cid = CLIENT_ID;
  const params = new URLSearchParams({
    client_id:     cid,
    redirect_uri:  location.origin + location.pathname,
    response_type: 'token',
    scope:         SCOPES,
    prompt:        'select_account',
  });
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}

export function handleOAuthRedirect() {
  if (!location.hash) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const t = p.get('access_token');
  if (!t) return false;
  sessionStorage.setItem('seo_tok', t);
  history.replaceState(null, '', location.pathname);
  S.token = t;
  return true;
}

export function signOut() {
  sessionStorage.removeItem('seo_tok');
  S.token = null;
  // show reconnect banner instead of hard reload
  const banner = document.getElementById('session-banner');
  if (banner) { banner.style.display = 'flex'; return; }
  location.reload();
}

// ── BASE REQUEST ──

async function req(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' },
  });
  if (r.status === 401) { signOut(); throw new Error('Session expired — please reconnect'); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── DATE HELPERS ──

function ds(d) { return d.toISOString().split('T')[0]; }

export function getDates() {
  // GSC lags ~3 days
  const end      = new Date(); end.setDate(end.getDate() - 3);
  const start    = new Date(end); start.setDate(start.getDate() - S.days);
  const popEnd   = new Date(start); popEnd.setDate(popEnd.getDate() - 1);
  const popStart = new Date(popEnd); popStart.setDate(popStart.getDate() - S.days);
  const yoyEnd   = new Date(end);   yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
  const yoyStart = new Date(start); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
  const fmt      = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return {
    start: ds(start), end: ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(yoyStart), yoyEnd: ds(yoyEnd),
    label: fmt(start) + ' – ' + fmt(end),
  };
}

// ── PROPERTY LOADERS ──

export async function loadGscProps() {
  try {
    const d = await req(`${GSC_BASE}/sites`);
    S.gscSites = d.siteEntry || [];
    if (S.gscSites.length) {
      S.selGsc = S.gscSites[0].siteUrl;
      document.getElementById('gsc-in').value =
        S.selGsc.replace(/^sc-domain:/, '').replace(/\/$/, '');
    }
  } catch { document.getElementById('gsc-in').placeholder = 'GSC error'; }
}

export async function loadGa4Props() {
  try {
    const d = await req(`${GA4_ADMIN}/accountSummaries?pageSize=200`);
    S.ga4Props = [];
    (d.accountSummaries || []).forEach(a =>
      (a.propertySummaries || []).forEach(p =>
        S.ga4Props.push({ id: p.property.replace('properties/', ''), name: p.displayName })
      )
    );
    if (S.ga4Props.length) {
      S.selGa4 = S.ga4Props[0].id;
      document.getElementById('ga4-in').value = S.ga4Props[0].name;
    }
  } catch { document.getElementById('ga4-in').placeholder = 'GA4 error'; }
}

// ── MAIN LOAD ──

// shared URL normalizer — call this everywhere we read url-filter
export function getCleanUrl() {
  const raw = document.getElementById('url-filter').value.trim();
  const clean = raw
    .replace(/^https?:\/\/[^/]+/, '')  // strip https://us.koala.com
    .replace(/\/+$/, '');               // strip trailing slashes
  if (clean !== raw) document.getElementById('url-filter').value = clean;
  return clean;
}

export async function loadAll() {
  const uf    = getCleanUrl();
  const dates = getDates();

  document.getElementById('section-title').textContent =
    uf ? 'Drill-down — ' + uf : 'Overview — sitewide';
  document.getElementById('date-lbl').textContent = dates.label;
  document.getElementById('drill-bar').style.display = uf ? 'flex' : 'none';
  document.getElementById('drill-lbl').textContent   = uf;
  document.getElementById('btn-clr').style.display   = uf ? 'inline-block' : 'none';
  document.getElementById('err-banner').style.display = 'none';

  // show skeletons
  setLoadingSkeletons();

  await Promise.all([
    S.selGsc ? loadGsc(S.selGsc) : Promise.resolve(),
    S.selGa4 ? loadGa4(S.selGa4) : Promise.resolve(),
  ]);
}

function setLoadingSkeletons() {
  ['m-clicks','m-impr','m-pos','m-ctr','m-sess','m-rev']
    .forEach(id => document.getElementById(id).innerHTML = '<div class="skel" style="width:60%;height:24px;border-radius:6px"></div>');
  ['m-cd','m-id','m-pd','m-td','m-sd','m-rd']
    .forEach(id => document.getElementById(id).innerHTML = '<div class="skel" style="width:50%;height:9px;border-radius:3px;margin-top:4px"></div>');
  document.getElementById('kw-body').innerHTML =
    Array(6).fill('<tr>' + '<td><div class="skel" style="height:10px;border-radius:3px"></div></td>'.repeat(11) + '</tr>').join('');
  document.getElementById('winners-body').innerHTML =
  document.getElementById('losers-body').innerHTML =
    Array(4).fill('<div style="padding:10px 14px;border-bottom:1px solid var(--border)"><div class="skel" style="height:10px;width:80%;border-radius:3px"></div></div>').join('');
}

// ── GSC ──

export async function loadGsc(site) {
  const { start, end, popStart, popEnd, yoyStart, yoyEnd } = getDates();
  const uf = getCleanUrl();
  const pf = uf ? [{ dimension: 'page', operator: 'contains', expression: uf }] : null;
  const cf = S.selCountry ? [{ dimension: 'country', operator: 'equals', expression: S.selCountry }] : null;
  const af = [...(pf||[]), ...(cf||[])];

  const post = (s, e, dims, filters) => req(
    `${GSC_BASE}/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    { method: 'POST', body: JSON.stringify({
      startDate: s, endDate: e, dimensions: dims, rowLimit: 100,
      ...(filters && filters.length ? { dimensionFilterGroups: [{ filters }] } : {}),
    })}
  );

  try {
    const [cur, pop, yoy, curD, popD, yoyD] = await Promise.all([
      post(start,    end,    ['query'], af),
      post(popStart, popEnd, ['query'], af),
      post(yoyStart, yoyEnd, ['query'], af),
      post(start,    end,    ['date'],  af),
      post(popStart, popEnd, ['date'],  af),
      post(yoyStart, yoyEnd, ['date'],  af),
    ]);

    const rows = cur.rows || [];
    let cl=0, im=0, cs=0, ps=0;
    rows.forEach(r => { cl+=r.clicks; im+=r.impressions; cs+=r.ctr; ps+=r.position; });
    const n    = rows.length;
    const apos = n ? ps/n : null;
    const actr = n ? cs/n : null;

    const agg = arr => { let cl=0,im=0,cs=0,ps=0,n=0; (arr||[]).forEach(r=>{cl+=r.clicks;im+=r.impressions;cs+=r.ctr;ps+=r.position;n++;}); return {cl,im,actr:n?cs/n:null,apos:n?ps/n:null}; };
    const p = agg(pop.rows), y = agg(yoy.rows);

    Object.assign(METRICS, {
      clicks: cl,
      clicksPop: fmtD(cl,p.cl),     clicksYoy: fmtD(cl,y.cl),
      imprPop:   fmtD(im,p.im),     imprYoy:   fmtD(im,y.im),
      posPop:    apos&&p.apos ? fmtD(apos,p.apos) : null,
      posYoy:    apos&&y.apos ? fmtD(apos,y.apos) : null,
      ctrPop:    actr&&p.actr ? fmtD(actr,p.actr) : null,
      ctrYoy:    actr&&y.actr ? fmtD(actr,y.actr) : null,
    });

    document.getElementById('m-clicks').textContent = fmt(cl);
    document.getElementById('m-impr').textContent   = fmt(im);
    document.getElementById('m-pos').textContent    = apos!=null ? apos.toFixed(1) : '—';
    document.getElementById('m-ctr').textContent    = actr!=null ? (actr*100).toFixed(2)+'%' : '—';

    // build keyword rows
    const pm={}, ym={};
    (pop.rows||[]).forEach(r => pm[r.keys[0]]=r);
    (yoy.rows||[]).forEach(r => ym[r.keys[0]]=r);

    S.kwData = rows.map(r => {
      const q=r.keys[0], pp=pm[q], yy=ym[q];
      return {
        query: q, clicks: r.clicks, impressions: r.impressions,
        position: r.position, ctr: r.ctr,
        prevClicks: pp?.clicks ?? null,    yoyClicks: yy?.clicks ?? null,
        prevImpr:   pp?.impressions ?? null, yoyImpr: yy?.impressions ?? null,
        prevPos:    pp?.position ?? null,  yoyPos:  yy?.position ?? null,
        delta:        pp ? fmtD(r.clicks,      pp.clicks)      : null,
        deltaYoy:     yy ? fmtD(r.clicks,      yy.clicks)      : null,
        deltaImprPop: pp ? fmtD(r.impressions, pp.impressions) : null,
        deltaImprYoy: yy ? fmtD(r.impressions, yy.impressions) : null,
        deltaPosPop:  pp ? fmtD(r.position,    pp.position)    : null,
        deltaPosYoy:  yy ? fmtD(r.position,    yy.position)    : null,
      };
    }).sort((a,b) => b.clicks - a.clicks);

    S.qData = S.kwData.map(r => ({...r}));

    // import render lazily to avoid circular deps
    const { renderAll, updateDeltas } = await import('./render.js');
    updateDeltas();
    renderAll();

    const { buildCharts } = await import('./charts.js');
    buildCharts(curD.rows||[], popD.rows||[], yoyD.rows||[]);

  } catch(e) {
    document.getElementById('err-banner').textContent = 'GSC error: ' + e.message;
    document.getElementById('err-banner').style.display = 'block';
  }
}

// ── GA4 (organic only) ──

export async function loadGa4(propId) {
  const { start, end, popStart, popEnd, yoyStart, yoyEnd } = getDates();
  const uf = getCleanUrl();

  const orgF = { orGroup: { expressions: [
    { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' }}},
    { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Shopping' }}},
  ]}};
  const pageF = uf ? { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: uf }}} : null;
  const dimF  = pageF ? { andGroup: { expressions: [orgF, pageF] }} : orgF;
  const mkB   = (s, e) => ({ dateRanges: [{startDate:s,endDate:e}], metrics: [{name:'sessions'},{name:'purchaseRevenue'}], dimensionFilter: dimF });

  try {
    const [c, p, y] = await Promise.all([
      req(`${GA4_BASE}/properties/${propId}:runReport`, { method:'POST', body: JSON.stringify(mkB(start,end)) }),
      req(`${GA4_BASE}/properties/${propId}:runReport`, { method:'POST', body: JSON.stringify(mkB(popStart,popEnd)) }),
      req(`${GA4_BASE}/properties/${propId}:runReport`, { method:'POST', body: JSON.stringify(mkB(yoyStart,yoyEnd)) }),
    ]);
    const agg = rows => rows.reduce((a,r) => ({s: a.s+(+r.metricValues[0].value||0), r: a.r+(+r.metricValues[1].value||0)}), {s:0,r:0});
    const cv=agg(c.rows||[]), pv=agg(p.rows||[]), yv=agg(y.rows||[]);

    document.getElementById('m-sess').textContent = fmt(cv.s);
    document.getElementById('m-rev').textContent  = fmtMoney(cv.r);
    METRICS.sessPop=fmtD(cv.s,pv.s); METRICS.sessYoy=fmtD(cv.s,yv.s);
    METRICS.revPop=fmtD(cv.r,pv.r);  METRICS.revYoy=fmtD(cv.r,yv.r);

    const { updateDeltas } = await import('./render.js');
    updateDeltas();
  } catch {
    document.getElementById('m-sess').textContent = 'N/A';
    document.getElementById('m-rev').textContent  = 'N/A';
  }
}

// ── UTILS ──

export function fmt(n) {
  if (n==null) return '—';
  if (n>=1e6) return (n/1e6).toFixed(1)+'M';
  if (n>=1e3) return (n/1e3).toFixed(1)+'K';
  return Math.round(n).toLocaleString();
}
export function fmtMoney(n) {
  if (!n&&n!==0) return '—';
  if (n>=1e6) return '$'+(n/1e6).toFixed(2)+'M';
  if (n>=1e3) return '$'+(n/1e3).toFixed(1)+'K';
  return '$'+n.toFixed(2);
}
export function fmtD(a,b) {
  if (!b) return null;
  return +((a-b)/b*100).toFixed(1);
}
