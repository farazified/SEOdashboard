// ─────────────────────────────────────────────
//  api.js  –  all data fetching
//  GSC + GA4 API calls live here.
//  To add a new metric: add it inside loadGsc()
//  or loadGa4() and store it in METRICS.
// ─────────────────────────────────────────────

import { GSC_BASE, GA4_BASE, GA4_ADMIN, SCOPES, CLIENT_ID } from './config.js';
import { S, METRICS } from './state.js';
import { renderAll, updateDeltas, setLoading } from './render.js';
import { buildCharts } from './charts.js';

// ── AUTH ──────────────────────────────────────

export function doOAuth() {
  const p = new URLSearchParams({
    client_id:     S.clientId,
    redirect_uri:  location.origin + location.pathname,
    response_type: 'token',
    scope:         SCOPES,
    prompt:        'select_account',
  });
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
}

export function handleOAuthRedirect() {
  const hash = location.hash;
  if (!hash) return false;
  const p = new URLSearchParams(hash.slice(1));
  const t = p.get('access_token');
  if (!t) return false;
  sessionStorage.setItem('seo_tok', t);
  history.replaceState(null, '', location.pathname);
  S.token    = t;
  S.clientId = CLIENT_ID;
  return true;
}

export function signOut() {
  sessionStorage.removeItem('seo_tok');
  S.token = null;
  document.getElementById('setup-overlay').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// ── BASE FETCH ────────────────────────────────

async function api(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' },
  });
  if (r.status === 401) { signOut(); throw new Error('Session expired.'); }
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

// ── DATE HELPERS ──────────────────────────────

function ds(d) { return d.toISOString().split('T')[0]; }

export function getDates() {
  const end = new Date(); end.setDate(end.getDate() - 1);
  const start = new Date(end); start.setDate(start.getDate() - S.days);
  const popEnd = new Date(start); popEnd.setDate(popEnd.getDate() - 1);
  const popStart = new Date(popEnd); popStart.setDate(popStart.getDate() - S.days);
  const yoyEnd = new Date(end); yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
  const yoyStart = new Date(start); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
  return {
    start:    ds(start),    end:    ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(yoyStart), yoyEnd: ds(yoyEnd),
  };
}

// ── PROPERTY LOADERS ─────────────────────────

export async function loadGscProps() {
  try {
    const d = await api(`${GSC_BASE}/sites`);
    S.gscSites = d.siteEntry || [];
    if (S.gscSites.length) {
      S.selGsc = S.gscSites[0].siteUrl;
      document.getElementById('gsc-in').value = S.selGsc.replace(/^sc-domain:/, '').replace(/\/$/, '');
    }
  } catch { document.getElementById('gsc-in').placeholder = 'GSC error'; }
}

export async function loadGa4Props() {
  try {
    const d = await api(`${GA4_ADMIN}/accountSummaries?pageSize=200`);
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

// ── MAIN LOAD ─────────────────────────────────

export async function loadAll() {
  const uf = document.getElementById('url-filter').value.trim();
  document.getElementById('metrics-title').textContent = uf ? `Drill-down — ${uf}` : 'Overview — sitewide';
  document.getElementById('drill-bar').style.display   = uf ? 'flex' : 'none';
  document.getElementById('drill-lbl').textContent     = uf;
  document.getElementById('btn-clr').style.display     = uf ? 'inline-block' : 'none';
  document.getElementById('err-banner').style.display  = 'none';
  setLoading();
  await Promise.all([
    S.selGsc ? loadGsc(S.selGsc) : null,
    S.selGa4 ? loadGa4(S.selGa4) : null,
  ].filter(Boolean));
}

// ── GSC ───────────────────────────────────────

export async function loadGsc(site) {
  const { start, end, popStart, popEnd, yoyStart, yoyEnd } = getDates();
  const uf = document.getElementById('url-filter').value.trim();
  const pf = uf     ? [{ dimension: 'page',    operator: 'contains', expression: uf          }] : null;
  const cf = S.selCountry ? [{ dimension: 'country', operator: 'equals',   expression: S.selCountry }] : null;
  const allF = [...(pf || []), ...(cf || [])];
  const mkB = (s, e, dims, filters) => ({
    startDate: s, endDate: e, dimensions: dims, rowLimit: 500,
    ...(filters && filters.length ? { dimensionFilterGroups: [{ filters }] } : {}),
  });
  const post = b => api(`${GSC_BASE}/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: 'POST', body: JSON.stringify(b),
  });

  try {
    const [cur, pop, yoy, curD, popD, yoyD] = await Promise.all([
      post(mkB(start,    end,    ['query'], allF)),
      post(mkB(popStart, popEnd, ['query'], allF)),
      post(mkB(yoyStart, yoyEnd, ['query'], allF)),
      post(mkB(start,    end,    ['date'],  allF)),
      post(mkB(popStart, popEnd, ['date'],  allF)),
      post(mkB(yoyStart, yoyEnd, ['date'],  allF)),
    ]);

    // aggregate totals
    const rows = cur.rows || [];
    let cl = 0, im = 0, cs = 0, ps = 0;
    rows.forEach(r => { cl += r.clicks; im += r.impressions; cs += r.ctr; ps += r.position; });
    const apos = rows.length ? ps / rows.length : null;
    const actr = rows.length ? cs / rows.length : null;

    const agg = arr => {
      let cl = 0, im = 0, cs = 0, ps = 0, n = 0;
      (arr || []).forEach(r => { cl += r.clicks; im += r.impressions; cs += r.ctr; ps += r.position; n++; });
      return { cl, im, actr: n ? cs / n : null, apos: n ? ps / n : null };
    };
    const p = agg(pop.rows), y = agg(yoy.rows);

    // store in METRICS
    Object.assign(METRICS, {
      clicks: cl,
      clicksPop:  fmtD(cl,    p.cl),   clicksYoy:  fmtD(cl,    y.cl),
      imprPop:    fmtD(im,    p.im),   imprYoy:    fmtD(im,    y.im),
      posPop:     apos && p.apos ? fmtD(apos, p.apos) : null,
      posYoy:     apos && y.apos ? fmtD(apos, y.apos) : null,
      ctrPop:     actr && p.actr ? fmtD(actr, p.actr) : null,
      ctrYoy:     actr && y.actr ? fmtD(actr, y.actr) : null,
    });

    // update top-line display values
    document.getElementById('m-clicks').textContent = fmt(cl);
    document.getElementById('m-impr').textContent   = fmt(im);
    document.getElementById('m-pos').textContent    = apos != null ? apos.toFixed(1) : '—';
    document.getElementById('m-ctr').textContent    = actr != null ? (actr * 100).toFixed(2) + '%' : '—';
    updateDeltas();

    // build keyword rows
    const popMap = {}, yoyMap = {};
    (pop.rows || []).forEach(r => popMap[r.keys[0]] = r);
    (yoy.rows || []).forEach(r => yoyMap[r.keys[0]] = r);
    S.kwData = rows.map(r => {
      const q = r.keys[0], pp = popMap[q], yy = yoyMap[q];
      return {
        query:        q,
        clicks:       r.clicks,
        impressions:  r.impressions,
        position:     r.position,
        ctr:          r.ctr,
        prevClicks:   pp ? pp.clicks     : null,
        yoyClicks:    yy ? yy.clicks     : null,
        delta:        pp ? fmtD(r.clicks,      pp.clicks)      : null,
        deltaYoy:     yy ? fmtD(r.clicks,      yy.clicks)      : null,
        deltaImprPop: pp ? fmtD(r.impressions, pp.impressions)  : null,
        deltaImprYoy: yy ? fmtD(r.impressions, yy.impressions)  : null,
        deltaPosPop:  pp ? fmtD(r.position,    pp.position)     : null,
        deltaPosYoy:  yy ? fmtD(r.position,    yy.position)     : null,
      };
    }).sort((a, b) => b.clicks - a.clicks);
    S.qData = [...S.kwData];

    renderAll();
    buildCharts(curD.rows || [], popD.rows || [], yoyD.rows || []);

  } catch (e) {
    document.getElementById('err-banner').textContent = 'GSC error: ' + (e.message || e);
    document.getElementById('err-banner').style.display = 'block';
  }
}

// ── GA4 (organic only) ───────────────────────

export async function loadGa4(propId) {
  const { start, end, popStart, popEnd, yoyStart, yoyEnd } = getDates();
  const uf = document.getElementById('url-filter').value.trim();

  // filter: organic search + organic shopping only
  const orgF = {
    orGroup: { expressions: [
      { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search'   } } },
      { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Shopping' } } },
    ]},
  };
  const pageF  = uf ? { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: uf } } } : null;
  const dimF   = pageF ? { andGroup: { expressions: [orgF, pageF] } } : orgF;
  const mkB    = (s, e) => ({ dateRanges: [{ startDate: s, endDate: e }], metrics: [{ name: 'sessions' }, { name: 'purchaseRevenue' }], dimensionFilter: dimF });

  try {
    const [c, p, y] = await Promise.all([
      api(`${GA4_BASE}/properties/${propId}:runReport`, { method: 'POST', body: JSON.stringify(mkB(start,    end))    }),
      api(`${GA4_BASE}/properties/${propId}:runReport`, { method: 'POST', body: JSON.stringify(mkB(popStart, popEnd)) }),
      api(`${GA4_BASE}/properties/${propId}:runReport`, { method: 'POST', body: JSON.stringify(mkB(yoyStart, yoyEnd)) }),
    ]);
    const agg = rows => rows.reduce((a, r) => ({
      s: a.s + (+(r.metricValues[0].value || 0)),
      r: a.r + (+(r.metricValues[1].value || 0)),
    }), { s: 0, r: 0 });
    const cv = agg(c.rows || []), pv = agg(p.rows || []), yv = agg(y.rows || []);

    document.getElementById('m-sess').textContent = fmt(cv.s);
    document.getElementById('m-rev').textContent  = fmtRev(cv.r);
    METRICS.sessPop = fmtD(cv.s, pv.s); METRICS.sessYoy = fmtD(cv.s, yv.s);
    METRICS.revPop  = fmtD(cv.r, pv.r); METRICS.revYoy  = fmtD(cv.r, yv.r);
    updateDeltas();
  } catch {
    document.getElementById('m-sess').textContent = 'N/A';
    document.getElementById('m-rev').textContent  = 'N/A';
  }
}

// ── UTILS (shared with render/charts) ─────────

export function fmt(n) {
  if (n == null) return '—';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}
export function fmtRev(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}
export function fmtD(a, b) {
  if (!b) return null;
  return +((a - b) / b * 100).toFixed(1);
}
