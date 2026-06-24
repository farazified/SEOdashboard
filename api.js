// ── api.js ── all data fetching ──

import { CLIENT_ID, GSC_BASE, GA4_BASE, GA4_ADMIN, SCOPES, BUILT_IN_SEGS } from './config.js';
import { S, METRICS } from './state.js';

// Map GSC 3-letter country codes → GA4 country dimension values
const GA4_COUNTRY_MAP = {
  usa:'United States', gbr:'United Kingdom', aus:'Australia', can:'Canada',
  deu:'Germany',       fra:'France',         esp:'Spain',     ita:'Italy',
  nld:'Netherlands',   bel:'Belgium',        che:'Switzerland', swe:'Sweden',
  nor:'Norway',        dnk:'Denmark',        pol:'Poland',    mex:'Mexico',
  bra:'Brazil',        ind:'India',          jpn:'Japan',     sgp:'Singapore',
  are:'United Arab Emirates', hkg:'Hong Kong',
};

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
  // preserve query-string state params through the OAuth redirect
  history.replaceState(null, '', location.pathname + location.search);
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

// Format as a LOCAL calendar date (YYYY-MM-DD). Using toISOString() here would
// convert local midnight to UTC and shift the date back a day for users ahead of
// UTC (e.g. Australia), throwing month/quarter/year boundaries off by one.
function ds(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtD_ = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function getDates() {
  switch (S.datePreset) {
    case 'thisWeek':    return _thisWeekDates();
    case 'lastWeek':    return _lastWeekDates();
    case 'thisMonth':   return _thisMonthDates();
    case 'lastMonth':   return _lastMonthDates();
    case 'thisQuarter': return _thisQuarterDates();
    case 'lastQuarter': return _lastQuarterDates();
    case 'ytd':         return _yearToDateDates();
    case 'lastYear':    return _lastYearDates();
  }
  return _rollingDates();
}

// Monday-based start of the week containing d.
function _weekStart(d) {
  const x = new Date(d); const dow = x.getDay();
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
  x.setHours(0, 0, 0, 0); return x;
}
// Partial ("this …") period: today is the end; PoP/YoY use the same elapsed
// duration measured from the previous unit / same unit last year.
function _partialDates(start, prevStart, prevYearStart, label) {
  const end = new Date();
  const elapsed = end.getTime() - start.getTime();
  return {
    start: ds(start), end: ds(end),
    popStart: ds(prevStart),     popEnd: ds(new Date(prevStart.getTime() + elapsed)),
    yoyStart: ds(prevYearStart), yoyEnd: ds(new Date(prevYearStart.getTime() + elapsed)),
    label,
  };
}

function _rollingDates() {
  // GSC lags ~3 days
  const end      = new Date(); end.setDate(end.getDate() - 3);
  const start    = new Date(end); start.setDate(start.getDate() - S.days);
  const popEnd   = new Date(start); popEnd.setDate(popEnd.getDate() - 1);
  const popStart = new Date(popEnd); popStart.setDate(popStart.getDate() - S.days);
  const yoyEnd   = new Date(end);   yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
  const yoyStart = new Date(start); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
  return {
    start: ds(start), end: ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(yoyStart), yoyEnd: ds(yoyEnd),
    label: fmtD_(start) + ' – ' + fmtD_(end),
  };
}

function _lastMonthDates() {
  const t = new Date();
  // Last month: e.g. if today is Apr 27 → Mar 1 – Mar 31
  const start    = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const end      = new Date(t.getFullYear(), t.getMonth(),     0);
  // PoP: month before last month
  const popStart = new Date(t.getFullYear(), t.getMonth() - 2, 1);
  const popEnd   = new Date(t.getFullYear(), t.getMonth() - 1, 0);
  // YoY: same month last year
  const yoyStart = new Date(t.getFullYear() - 1, t.getMonth() - 1, 1);
  const yoyEnd   = new Date(t.getFullYear() - 1, t.getMonth(),     0);
  const label    = start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return {
    start: ds(start), end: ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(yoyStart), yoyEnd: ds(yoyEnd),
    label,
  };
}

function _lastQuarterDates() {
  const t   = new Date();
  const yr  = t.getFullYear();
  const cq  = Math.floor(t.getMonth() / 3); // 0=Q1…3=Q4 (current)
  const lq  = cq === 0 ? 3 : cq - 1;        // last complete quarter
  const lqYr = cq === 0 ? yr - 1 : yr;
  const pq  = lq === 0 ? 3 : lq - 1;        // quarter before last
  const pqYr = lq === 0 ? lqYr - 1 : lqYr;

  const start    = new Date(lqYr,   lq * 3,     1);
  const end      = new Date(lqYr,   lq * 3 + 3, 0);
  const popStart = new Date(pqYr,   pq * 3,     1);
  const popEnd   = new Date(pqYr,   pq * 3 + 3, 0);
  const yoyStart = new Date(lqYr - 1, lq * 3,     1);
  const yoyEnd   = new Date(lqYr - 1, lq * 3 + 3, 0);
  const label    = `Q${lq + 1} ${lqYr} · ${fmtD_(start)} – ${fmtD_(end)}`;
  return {
    start: ds(start), end: ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(yoyStart), yoyEnd: ds(yoyEnd),
    label,
  };
}

function _yearToDateDates() {
  const t   = new Date();
  const yr  = t.getFullYear();
  // YTD: Jan 1 – today
  const start    = new Date(yr, 0, 1);
  const end      = new Date(t);
  // PoP: same period last year
  const popStart = new Date(yr - 1, 0, 1);
  const popEnd   = new Date(yr - 1, t.getMonth(), t.getDate());
  // YoY: same period two years ago
  const yoyStart = new Date(yr - 2, 0, 1);
  const yoyEnd   = new Date(yr - 2, t.getMonth(), t.getDate());
  const label    = `Year to date · ${fmtD_(start)} – ${fmtD_(end)}`;
  return {
    start: ds(start), end: ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(yoyStart), yoyEnd: ds(yoyEnd),
    label,
  };
}

function _thisWeekDates() {
  const start = _weekStart(new Date());
  const prev  = new Date(start); prev.setDate(prev.getDate() - 7);
  const prevY = new Date(start); prevY.setDate(prevY.getDate() - 364); // keep weekday alignment
  return _partialDates(start, prev, prevY, `This week · ${fmtD_(start)} – ${fmtD_(new Date())}`);
}

function _lastWeekDates() {
  const thisMon  = _weekStart(new Date());
  const start    = new Date(thisMon); start.setDate(start.getDate() - 7);
  const end      = new Date(thisMon); end.setDate(end.getDate() - 1);     // last Sunday
  const popStart = new Date(start);   popStart.setDate(popStart.getDate() - 7);
  const popEnd   = new Date(end);     popEnd.setDate(popEnd.getDate() - 7);
  const yoyStart = new Date(start);   yoyStart.setDate(yoyStart.getDate() - 364);
  const yoyEnd   = new Date(end);     yoyEnd.setDate(yoyEnd.getDate() - 364);
  return {
    start: ds(start), end: ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(yoyStart), yoyEnd: ds(yoyEnd),
    label: `Last week · ${fmtD_(start)} – ${fmtD_(end)}`,
  };
}

function _thisMonthDates() {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth();
  const start  = new Date(y, m, 1);
  const prev   = new Date(y, m - 1, 1);
  const prevY  = new Date(y - 1, m, 1);
  return _partialDates(start, prev, prevY, `This month · ${start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`);
}

function _thisQuarterDates() {
  const t = new Date(), y = t.getFullYear(), q = Math.floor(t.getMonth() / 3);
  const start = new Date(y, q * 3, 1);
  const prev  = new Date(q === 0 ? y - 1 : y, (q === 0 ? 3 : q - 1) * 3, 1);
  const prevY = new Date(y - 1, q * 3, 1);
  return _partialDates(start, prev, prevY, `This quarter · Q${q + 1} ${y}`);
}

function _lastYearDates() {
  const y = new Date().getFullYear();
  // Full previous calendar year; PoP and YoY both = the year before it.
  const start    = new Date(y - 1, 0, 1);
  const end      = new Date(y - 1, 11, 31);
  const popStart = new Date(y - 2, 0, 1), popEnd = new Date(y - 2, 11, 31);
  return {
    start: ds(start), end: ds(end),
    popStart: ds(popStart), popEnd: ds(popEnd),
    yoyStart: ds(popStart), yoyEnd: ds(popEnd),
    label: `Last year · ${y - 1}`,
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
    S.ga4Props = [];
    let pageToken = '';
    do {
      const url = `${GA4_ADMIN}/accountSummaries?pageSize=200` + (pageToken ? `&pageToken=${pageToken}` : '');
      const d = await req(url);
      (d.accountSummaries || []).forEach(a =>
        (a.propertySummaries || []).forEach(p =>
          S.ga4Props.push({ id: p.property.replace('properties/', ''), name: p.displayName, accountName: a.displayName })
        )
      );
      pageToken = d.nextPageToken || '';
    } while (pageToken);

    if (S.ga4Props.length) {
      S.selGa4 = S.ga4Props[0].id;
      document.getElementById('ga4-in').value = S.ga4Props[0].name;
    }
  } catch (e) {
    console.error('GA4 props load error:', e);
    document.getElementById('ga4-in').placeholder = 'GA4 error';
  }
}

// ── PROGRESS BAR ──

function _pbStart() {
  const b = document.getElementById('progress-bar');
  if (!b) return;
  b.className = 'progress-bar';     // reset
  void b.offsetWidth;               // force reflow
  b.className = 'progress-bar loading';
}

function _pbDone() {
  const b = document.getElementById('progress-bar');
  if (!b) return;
  b.className = 'progress-bar done';
  setTimeout(() => { if (b.classList.contains('done')) b.className = 'progress-bar'; }, 500);
}

// ── FILTER HELPERS ──

// GSC: returns dimensionFilterGroups array.
// When S.urlSelections has items:
//   - Single URL → one group with `equals`
//   - Multiple URLs → one group with `includingRegex` (OR all URLs in one regex,
//     with optional trailing slash to handle GSC's canonical-URL variations).
//     This avoids both the per-request filter-group count limit AND mismatch
//     issues where GSC stores URLs with trailing slashes that the user's list
//     does not include.
// extraFilters is an array of additional filter objects added to every group (e.g. brand notContains).
// Core builder — takes an explicit pattern + urlList so it can be reused for the
// global filter (S.urlSelections / url-filter) AND per-segment in loadSegments().
function _gscGroupsFor(pattern, urlList, cty, extraFilters = []) {
  const cf = cty ? { dimension: 'country', operator: 'equals', expression: cty } : null;
  if (urlList && urlList.length > 0) {
    if (urlList.length === 1) {
      // Single URL — try both with-and-without trailing slash via regex
      const u = urlList[0].replace(/\/$/, '');
      const escaped = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return [{
        filters: [
          ...(cf ? [cf] : []),
          { dimension: 'page', operator: 'includingRegex', expression: '^' + escaped + '/?$' },
          ...extraFilters,
        ],
      }];
    }
    // Multiple URLs — combine into one regex (avoids GSC group-count limit)
    const escaped = urlList.map(u =>
      u.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = '^(?:' + escaped.join('|') + ')/?$';
    return [{
      filters: [
        ...(cf ? [cf] : []),
        { dimension: 'page', operator: 'includingRegex', expression: regex },
        ...extraFilters,
      ],
    }];
  }
  const pf = pattern ? { dimension: 'page', operator: 'contains', expression: pattern } : null;
  const f = [...(pf ? [pf] : []), ...(cf ? [cf] : []), ...extraFilters];
  return f.length ? [{ filters: f }] : [];
}
function _buildGscGroups(uf, cty, extraFilters = []) {
  return _gscGroupsFor(uf, S.urlSelections, cty, extraFilters);
}

// GA4: returns a pageFilter expression (CONTAINS, EXACT, or FULL_REGEXP).
// For multiple URLs we use FULL_REGEXP with optional trailing slash — same
// trailing-slash variation problem as GSC, plus it sidesteps any limits on
// the size of an orGroup expression list.
function _ga4PageFilterFor(pattern, urlList) {
  if (urlList && urlList.length > 0) {
    const paths = urlList.map(u =>
      (u.replace(/^https?:\/\/[^/]+/, '') || '/').replace(/\/$/, '') || '/'
    );
    if (paths.length === 1) {
      const escaped = paths[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'FULL_REGEXP', value: '^' + escaped + '/?$' }}};
    }
    const escaped = paths.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex   = '^(?:' + escaped.join('|') + ')/?$';
    return { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'FULL_REGEXP', value: regex }}};
  }
  return pattern ? { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'CONTAINS', value: pattern }}} : null;
}
function _buildGa4PageFilter(uf) {
  return _ga4PageFilterFor(uf, S.urlSelections);
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

  const selCount = S.urlSelections.length;
  const displayUrl = selCount === 1
    ? S.urlSelections[0].replace(/^https?:\/\/[^/]+/, '')
    : selCount > 1 ? `${selCount} URLs` : uf;
  const hasFilter = !!(selCount || uf);
  document.getElementById('section-title').textContent =
    hasFilter ? 'Drill-down — ' + displayUrl : 'Overview — sitewide';
  document.getElementById('date-lbl').textContent = dates.label;
  document.getElementById('drill-bar').style.display = hasFilter ? 'flex' : 'none';
  document.getElementById('drill-lbl').textContent   = displayUrl;
  document.getElementById('btn-clr').style.display   = hasFilter ? 'inline-block' : 'none';
  document.getElementById('err-banner').style.display = 'none';

  // show skeletons + start progress bar
  setLoadingSkeletons();
  _pbStart();
  // invalidate page-specific caches so they re-fetch on next navigation
  S.pagesData    = null;
  S.cannibalData = null;
  S.segmentsData = null;

  await Promise.all([
    S.selGsc ? loadGsc(S.selGsc) : Promise.resolve(),
    S.selGa4 ? loadGa4(S.selGa4) : Promise.resolve(),
  ]);

  _pbDone();
  // if user is on a lazy page, reload it now data is fresh
  if (S.page === 'pages'   ) loadPages();
  if (S.page === 'cannibal') loadCannibalization();
  if (S.page === 'segments') loadSegments();
  // reload Explorer if open or already has data (keeps filter in sync)
  const _exPanel = document.getElementById('sec-explorer');
  const _exOpen  = _exPanel && !_exPanel.classList.contains('me-collapsed');
  if (_exOpen || S.meData.length) loadMetricExplorer();
}

function setLoadingSkeletons() {
  ['m-clicks','m-impr','m-pos','m-ctr','m-sess','m-rev','m-tot-sess','m-tot-rev']
    .forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML='<div class="skel" style="width:60%;height:24px;border-radius:6px"></div>'; });
  ['m-cd','m-id','m-pd','m-td','m-sd','m-rd','m-tsd','m-trd']
    .forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML='<div class="skel" style="width:50%;height:9px;border-radius:3px;margin-top:4px"></div>'; });
  document.getElementById('kw-body').innerHTML =
    Array(6).fill('<tr>' + '<td><div class="skel" style="height:10px;border-radius:3px"></div></td>'.repeat(12) + '</tr>').join('');
  const pg = document.getElementById('kw-pager'); if (pg) pg.innerHTML = '';
  document.getElementById('winners-body').innerHTML =
  document.getElementById('losers-body').innerHTML =
    Array(4).fill('<div style="padding:10px 14px;border-bottom:1px solid var(--border)"><div class="skel" style="height:10px;width:80%;border-radius:3px"></div></div>').join('');
}

// ── GSC ──

export async function loadGsc(site) {
  const { start, end, popStart, popEnd, yoyStart, yoyEnd } = getDates();
  const uf = getCleanUrl();
  const groups = _buildGscGroups(uf, S.selCountry);

  // CRITICAL: when filtering by `page` but `page` is NOT in dimensions, GSC
  // defaults to byProperty aggregation — which only counts impressions where
  // the CANONICAL URL matches the filter, dropping huge chunks of real data.
  // Forcing byPage matches SEOGets and gives accurate per-page totals.
  const hasPageFilter = !!(uf || S.urlSelections.length);
  const aggT = hasPageFilter ? { aggregationType: 'byPage' } : {};

  const gscUrl = `${GSC_BASE}/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const postKw = (s, e) => req(gscUrl, { method:'POST', body: JSON.stringify({
    startDate:s, endDate:e, dimensions:['query'], rowLimit:500,
    ...(groups.length ? {dimensionFilterGroups: groups} : {}),
    ...aggT,
  })});
  const postD = (s, e) => req(gscUrl, { method:'POST', body: JSON.stringify({
    startDate:s, endDate:e, dimensions:['date'], rowLimit:1000,
    ...(groups.length ? {dimensionFilterGroups: groups} : {}),
    ...aggT,
  })});
  const postA = (s, e) => req(gscUrl, { method:'POST', body: JSON.stringify({
    startDate:s, endDate:e,
    ...(groups.length ? {dimensionFilterGroups: groups} : {}),
    ...aggT,
  })});

  try {
    const [cur, pop, yoy, curD, popD, yoyD, curA, popA, yoyA] = await Promise.all([
      postKw(start, end),    postKw(popStart, popEnd),    postKw(yoyStart, yoyEnd),
      postD(start, end),     postD(popStart, popEnd),     postD(yoyStart, yoyEnd),
      postA(start, end),     postA(popStart, popEnd),     postA(yoyStart, yoyEnd),
    ]);

    // Direct aggregate row — no counting, no summing, straight from GSC
    const agg0 = rows => { const r=(rows||[])[0]||{}; return {cl:r.clicks||0,im:r.impressions||0,apos:r.position||null,actr:r.ctr||null}; };
    const cv = agg0(curA.rows);
    const pv = agg0(popA.rows);
    const yv = agg0(yoyA.rows);
    const { cl, im, apos, actr } = cv;

    Object.assign(METRICS, {
      clicks:    cl,  impr: im,  pos: apos,  ctr: actr,
      clicksPop: fmtD(cl,   pv.cl),                          clicksYoy: fmtD(cl,   yv.cl),
      imprPop:   fmtD(im,   pv.im),                          imprYoy:   fmtD(im,   yv.im),
      posPop:    apos&&pv.apos ? fmtD(apos, pv.apos) : null, posYoy:    apos&&yv.apos ? fmtD(apos, yv.apos) : null,
      ctrPop:    actr&&pv.actr ? fmtD(actr, pv.actr) : null, ctrYoy:    actr&&yv.actr ? fmtD(actr, yv.actr) : null,
      nonBrandRatio: null,  // populated below if brand filter on
    });

    // Non-brand aggregates (full-dataset, server-side brand exclusion).
    // Powers both the GSC "Filtered" sub-row AND the GA4 estimated non-brand cards.
    // 3 parallel calls (cur/pop/yoy) so the sub-row can show real PoP/YoY deltas.
    if (S.hideBranded) {
      try {
        const nbGroups = _buildGscGroups(uf, S.selCountry, _meBrandFilters());
        const postNbA  = (s, e) => req(gscUrl, { method:'POST', body: JSON.stringify({
          startDate:s, endDate:e,
          ...(nbGroups.length ? {dimensionFilterGroups: nbGroups} : {}),
          ...aggT,
        })});
        const [nbA, nbPopA, nbYoyA] = await Promise.all([
          postNbA(start,    end),
          postNbA(popStart, popEnd),
          postNbA(yoyStart, yoyEnd),
        ]);
        const nbCv = agg0(nbA.rows);
        const nbPv = agg0(nbPopA.rows);
        const nbYv = agg0(nbYoyA.rows);
        Object.assign(METRICS, {
          nonBrandClicks: nbCv.cl, nonBrandImpr: nbCv.im,
          nonBrandPos:    nbCv.apos, nonBrandCtr: nbCv.actr,
          nonBrandClicksPop: fmtD(nbCv.cl, nbPv.cl),
          nonBrandClicksYoy: fmtD(nbCv.cl, nbYv.cl),
          nonBrandImprPop:   fmtD(nbCv.im, nbPv.im),
          nonBrandImprYoy:   fmtD(nbCv.im, nbYv.im),
          nonBrandPosPop:    nbCv.apos && nbPv.apos ? fmtD(nbCv.apos, nbPv.apos) : null,
          nonBrandPosYoy:    nbCv.apos && nbYv.apos ? fmtD(nbCv.apos, nbYv.apos) : null,
          nonBrandCtrPop:    nbCv.actr && nbPv.actr ? fmtD(nbCv.actr, nbPv.actr) : null,
          nonBrandCtrYoy:    nbCv.actr && nbYv.actr ? fmtD(nbCv.actr, nbYv.actr) : null,
          nonBrandRatio:     cl > 0 ? (nbCv.cl / cl) : null,
        });
      } catch(e) { console.error('non-brand aggregate fetch failed:', e); }
    } else {
      // Brand filter off — clear stale non-brand metrics
      Object.assign(METRICS, {
        nonBrandClicks: null, nonBrandImpr: null, nonBrandPos: null, nonBrandCtr: null,
        nonBrandClicksPop: null, nonBrandClicksYoy: null,
        nonBrandImprPop:   null, nonBrandImprYoy:   null,
        nonBrandPosPop:    null, nonBrandPosYoy:    null,
        nonBrandCtrPop:    null, nonBrandCtrYoy:    null,
        nonBrandRatio:     null,
      });
    }

    document.getElementById('m-clicks').textContent = fmt(cl);
    document.getElementById('m-impr').textContent   = fmt(im);
    document.getElementById('m-pos').textContent    = apos!=null ? apos.toFixed(1) : '—';
    document.getElementById('m-ctr').textContent    = actr!=null ? (actr*100).toFixed(2)+'%' : '—';

    // keyword rows still used for the table (top 100 by clicks)
    const rows = cur.rows || [];

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
    const { renderAll, updateDeltas, renderGa4Cards } = await import('./render.js');
    updateDeltas();
    renderAll();
    // Re-render GA4 cards in case loadGa4 finished first (ratio now available)
    renderGa4Cards();

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

  // Organic = Organic Search only (excludes Organic Shopping) to match GA4's
  // "Organic Search" channel row.
  const orgF  = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' }}};
  const pageF  = _buildGa4PageFilter(uf);
  const ga4Cty = S.selCountry ? GA4_COUNTRY_MAP[S.selCountry] : null;
  const ctyF   = ga4Cty ? { filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: ga4Cty }}} : null;
  const exprs  = [orgF, ...(pageF ? [pageF] : []), ...(ctyF ? [ctyF] : [])];
  const dimF   = exprs.length === 1 ? exprs[0] : { andGroup: { expressions: exprs } };

  // Organic totals. NO dimension → GA4 returns a single exact-total row. (Using a
  // landingPage dimension with limit:250 truncated big sites to the top 250 pages,
  // undercounting sessions & revenue vs GA4's true total.) The dimensionFilter
  // (organic channel + URL + country) still applies without the dimension.
  const mkB = (s, e) => ({
    dateRanges: [{ startDate: s, endDate: e }],
    metrics: [{ name: 'sessions' }, { name: 'purchaseRevenue' }],
    dimensionFilter: dimF,
  });

  // All-channel body — keep URL/country filter but drop organic restriction
  const totExprs = [...(pageF ? [pageF] : []), ...(ctyF ? [ctyF] : [])];
  const totDimF  = totExprs.length === 0 ? null : totExprs.length === 1 ? totExprs[0] : { andGroup: { expressions: totExprs } };
  const mkBTot = (s, e) => ({
    dateRanges: [{ startDate: s, endDate: e }],
    metrics: [{ name: 'sessions' }, { name: 'purchaseRevenue' }],
    ...(totDimF ? { dimensionFilter: totDimF } : {}),
  });

  const run = body => req(`${GA4_BASE}/properties/${propId}:runReport`, { method:'POST', body: JSON.stringify(body) });

  try {
    const [c, p, y, ct, pt, yt] = await Promise.all([
      run(mkB(start,end)),    run(mkB(popStart,popEnd)),    run(mkB(yoyStart,yoyEnd)),    // organic
      run(mkBTot(start,end)), run(mkBTot(popStart,popEnd)), run(mkBTot(yoyStart,yoyEnd)), // all-channel
    ]);

    // Sum across all returned landing-page rows
    const agg = rows => (rows||[]).reduce((a,r) => ({
      s: a.s + (+(r.metricValues[0].value)||0),
      r: a.r + (+(r.metricValues[1].value)||0),
    }), {s:0, r:0});

    const cv=agg(c.rows), pv=agg(p.rows), yv=agg(y.rows);
    const tv=agg(ct.rows), tpv=agg(pt.rows), tyv=agg(yt.rows);

    // Store raw GA4 values in METRICS so render can re-apply the non-brand ratio
    METRICS.sess    = cv.s;  METRICS.rev    = cv.r;
    METRICS.totSess = tv.s;  METRICS.totRev = tv.r;
    METRICS.sessPop = fmtD(cv.s, pv.s);  METRICS.sessYoy = fmtD(cv.s, yv.s);
    METRICS.revPop  = fmtD(cv.r, pv.r);  METRICS.revYoy  = fmtD(cv.r, yv.r);
    METRICS.totSessPop = fmtD(tv.s, tpv.s); METRICS.totSessYoy = fmtD(tv.s, tyv.s);
    METRICS.totRevPop  = fmtD(tv.r, tpv.r); METRICS.totRevYoy  = fmtD(tv.r, tyv.r);

    const { renderGa4Cards, updateDeltas } = await import('./render.js');
    renderGa4Cards();
    updateDeltas();
  } catch(e) {
    console.error('GA4 error:', e);
    ['m-sess','m-rev','m-tot-sess','m-tot-rev'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = 'N/A';
    });
  }
}

// ── METRIC EXPLORER ──

// Token prevents a slow/stale fetch from overwriting a newer one
let _meToken = 0;

// Build brand exclusion filters for the GSC query dimension
// ── SEGMENTS BREAKDOWN ──
// Per-segment exact totals: Clicks/Impr/Position from a dimensionless GSC
// aggregate (same trick as loadGsc's postA), Sessions/Revenue from summed GA4
// organic (same as loadGa4). Looped over every segment and fired in parallel.
// Honors date range, country, and the Hide-branded toggle (exact non-brand GSC
// totals; GA4 estimated via the segment's non-brand click ratio, like the cards).
//
// NOTE: with brand filter on, each segment ≈ 6 GSC + 3 GA4 calls. For a handful
// of segments that's ~50 parallel requests — fine here, but if GSC starts
// returning 429s, batch the `segs.map` loop instead of one big Promise.all.
export async function loadSegments() {
  const finish = async () => { const { renderSegmentsTable } = await import('./render.js'); renderSegmentsTable(); };
  if (!S.selGsc) { S.segmentsData = []; return finish(); }

  const { start, end, popStart, popEnd, yoyStart, yoyEnd } = getDates();
  const cty    = S.selCountry;
  const brand  = _meBrandFilters();                 // [] when brand filter off
  const ga4Cty = cty ? GA4_COUNTRY_MAP[cty] : null;
  const segs   = [...BUILT_IN_SEGS, ...(S.segments || [])];

  const gscUrl = `${GSC_BASE}/sites/${encodeURIComponent(S.selGsc)}/searchAnalytics/query`;
  const agg0   = rows => { const r=(rows||[])[0]||{}; return { cl:r.clicks||0, im:r.impressions||0, apos:r.position||null }; };

  // GSC dimensionless aggregate for one segment+period (+ optional extra filters)
  const gscAgg = (seg, s, e, extra=[]) => {
    const groups = _gscGroupsFor(seg.pattern || '', seg.urlList, cty, extra);
    const hasPageFilter = !!(seg.pattern || (seg.urlList && seg.urlList.length));
    return req(gscUrl, { method:'POST', body: JSON.stringify({
      startDate:s, endDate:e,
      ...(groups.length ? { dimensionFilterGroups: groups } : {}),
      ...(hasPageFilter ? { aggregationType: 'byPage' } : {}),
    })});
  };

  // GA4 sessions+revenue for one segment+period, summed across pages.
  // organic=true restricts to Organic Search (same as the cards);
  // organic=false drops that restriction → all-traffic totals (matches totSess/totRev).
  const ga4Sum = async (seg, s, e, organic=true) => {
    if (!S.selGa4) return { s:0, r:0 };
    const orgF = { filter: { fieldName:'sessionDefaultChannelGroup', stringFilter:{ matchType:'EXACT', value:'Organic Search' }}};
    const pageF = _ga4PageFilterFor(seg.pattern || '', seg.urlList);
    const ctyF  = ga4Cty ? { filter:{ fieldName:'country', stringFilter:{ matchType:'EXACT', value:ga4Cty }}} : null;
    const exprs = [...(organic?[orgF]:[]), ...(pageF?[pageF]:[]), ...(ctyF?[ctyF]:[])];
    const dimF  = exprs.length === 0 ? null : exprs.length === 1 ? exprs[0] : { andGroup:{ expressions: exprs } };
    // No dimension → exact total row (avoids the 250-landing-page truncation).
    const res   = await req(`${GA4_BASE}/properties/${S.selGa4}:runReport`, { method:'POST', body: JSON.stringify({
      dateRanges:[{ startDate:s, endDate:e }],
      metrics:[{ name:'sessions' }, { name:'purchaseRevenue' }],
      ...(dimF ? { dimensionFilter: dimF } : {}),
    })});
    return (res.rows||[]).reduce((a,r)=>({ s:a.s+(+(r.metricValues[0].value)||0), r:a.r+(+(r.metricValues[1].value)||0) }), { s:0, r:0 });
  };

  try {
    S.segmentsData = await Promise.all(segs.map(async seg => {
      const tasks = [
        gscAgg(seg, start, end), gscAgg(seg, popStart, popEnd), gscAgg(seg, yoyStart, yoyEnd),                 // 0-2 GSC
        ga4Sum(seg, start, end, true),  ga4Sum(seg, popStart, popEnd, true),  ga4Sum(seg, yoyStart, yoyEnd, true),  // 3-5 GA4 organic
        ga4Sum(seg, start, end, false), ga4Sum(seg, popStart, popEnd, false), ga4Sum(seg, yoyStart, yoyEnd, false), // 6-8 GA4 all-traffic
      ];
      if (brand.length) tasks.push(
        gscAgg(seg, start, end, brand), gscAgg(seg, popStart, popEnd, brand), gscAgg(seg, yoyStart, yoyEnd, brand), // 9-11 GSC non-brand
      );
      const r = await Promise.all(tasks);
      const cur=agg0(r[0].rows), pop=agg0(r[1].rows), yoy=agg0(r[2].rows);
      const gc=r[3], gp=r[4], gy=r[5];   // GA4 organic
      const ac=r[6], ap=r[7], ay=r[8];   // GA4 all-traffic

      // Default = all-organic GSC figures
      let cl=cur.cl, im=cur.im, pos=cur.apos, clPrev=pop.cl, clYoyV=yoy.cl, posPrev=pop.apos, posYoyV=yoy.apos;
      let estimated=false, ratio=null;

      // Brand filter on → swap to exact non-brand GSC figures, derive ratio for GA4
      if (brand.length) {
        const nbCur=agg0(r[9].rows), nbPop=agg0(r[10].rows), nbYoy=agg0(r[11].rows);
        ratio = cur.cl > 0 ? nbCur.cl/cur.cl : null;
        cl=nbCur.cl; im=nbCur.im; pos=nbCur.apos;
        clPrev=nbPop.cl; clYoyV=nbYoy.cl; posPrev=nbPop.apos; posYoyV=nbYoy.apos;
        estimated = ratio != null;
      }

      // Organic GA4 — estimate non-brand via the click ratio when known.
      // All-traffic GA4 is shown raw (brand filter only concerns organic search).
      const mul = (estimated && ratio != null) ? ratio : 1;
      const sess=gc.s*mul, rev=gc.r*mul, sessP=gp.s*mul, sessY=gy.s*mul, revP=gp.r*mul, revY=gy.r*mul;

      return {
        id: seg.id, name: seg.name, color: seg.color,
        pattern: seg.pattern, urlList: seg.urlList || null,
        clicks: cl,    clicksPop: fmtD(cl, clPrev),   clicksYoy: fmtD(cl, clYoyV),
        position: pos, posPop: pos&&posPrev ? fmtD(pos, posPrev) : null, posYoy: pos&&posYoyV ? fmtD(pos, posYoyV) : null,
        sessions: sess, sessPop: fmtD(sess, sessP),   sessYoy: fmtD(sess, sessY),
        revenue: rev,   revPop: fmtD(rev, revP),      revYoy: fmtD(rev, revY),
        totSessions: ac.s, totSessPop: fmtD(ac.s, ap.s), totSessYoy: fmtD(ac.s, ay.s),
        totRevenue:  ac.r, totRevPop:  fmtD(ac.r, ap.r), totRevYoy:  fmtD(ac.r, ay.r),
        estimated,
      };
    }));
  } catch(e) {
    console.error('segments load failed:', e);
    S.segmentsData = [];
    document.getElementById('err-banner').textContent = 'Segments error: ' + e.message;
    document.getElementById('err-banner').style.display = 'block';
  }
  return finish();
}

function _meBrandFilters() {
  if (!S.hideBranded) return [];
  const v = document.getElementById('brand-terms')?.value.trim();
  let terms = v ? v.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
  if (!terms.length && S.selGsc) {
    const d = S.selGsc.replace(/^sc-domain:/,'').replace(/^https?:\/\//,'').replace(/\/.*/,'').replace(/^www\./,'');
    terms = [d.split('.')[0], d];
  }
  return terms.map(t => ({ dimension: 'query', operator: 'notContains', expression: t }));
}

export async function loadMetricExplorer() {
  const token = ++_meToken;  // capture this call's token before any await
  const src  = S.meSource || 'gsc';
  const days = S.meDays   || 90;
  const uf   = getCleanUrl();
  const cty  = S.selCountry;  // snapshot at call time

  if (src === 'gsc') {
    if (!S.selGsc) { S.meData = []; return; }
    const end   = new Date(); end.setDate(end.getDate() - 3);
    const start = new Date(end); start.setDate(start.getDate() - days);
    const gscUrl = `${GSC_BASE}/sites/${encodeURIComponent(S.selGsc)}/searchAnalytics/query`;
    const meGroups = _buildGscGroups(uf, cty, _meBrandFilters());
    const meHasPageFilter = !!(uf || S.urlSelections.length);
    try {
      const res = await req(gscUrl, { method: 'POST', body: JSON.stringify({
        startDate: ds(start), endDate: ds(end),
        dimensions: ['date'], rowLimit: days + 10,
        ...(meGroups.length ? { dimensionFilterGroups: meGroups } : {}),
        ...(meHasPageFilter ? { aggregationType: 'byPage' } : {}),
      })});
      if (token !== _meToken) return;  // a newer call is in flight — discard
      S.meData = (res.rows || []).map(r => ({
        date: r.keys[0],
        clicks: r.clicks, impressions: r.impressions,
        position: r.position, ctr: r.ctr,
      }));
    } catch(e) {
      if (token !== _meToken) return;
      console.error('ME GSC error:', e); S.meData = [];
    }

  } else { // ga4
    if (!S.selGa4) { S.meData = []; return; }
    const end   = new Date();
    const start = new Date(end); start.setDate(start.getDate() - days);

    const orgF = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' }}};
    const pageF  = _buildGa4PageFilter(uf);
    const ga4Cty = cty ? GA4_COUNTRY_MAP[cty] : null;
    const ctyF   = ga4Cty ? { filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: ga4Cty }}} : null;
    const meExprs = [orgF, ...(pageF ? [pageF] : []), ...(ctyF ? [ctyF] : [])];
    const meDimF  = meExprs.length === 1 ? meExprs[0] : { andGroup: { expressions: meExprs } };

    try {
      const res = await req(`${GA4_BASE}/properties/${S.selGa4}:runReport`, {
        method: 'POST',
        body: JSON.stringify({
          dateRanges: [{ startDate: ds(start), endDate: ds(end) }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }, { name: 'purchaseRevenue' }],
          dimensionFilter: meDimF,
          limit: days + 10,
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        })
      });
      if (token !== _meToken) return;  // discard stale response
      S.meData = (res.rows || []).map(r => {
        const d = r.dimensionValues[0].value; // YYYYMMDD
        return {
          date: `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,
          sessions: +(r.metricValues[0].value) || 0,
          revenue:  +(r.metricValues[1].value) || 0,
        };
      });
    } catch(e) {
      if (token !== _meToken) return;
      console.error('ME GA4 error:', e); S.meData = [];
    }
  }

  const { renderMetricExplorer } = await import('./render.js');
  renderMetricExplorer();
}

// ── PAGES (page-level GSC + GA4) ──

export async function loadPages() {
  if (!S.selGsc) return;
  const { start, end, popStart, popEnd, yoyStart, yoyEnd } = getDates();
  const uf = getCleanUrl();
  // Apply brand filter (notContains query) at GSC API level when "Hide branded" is on
  const pgGroups    = _buildGscGroups(uf, S.selCountry, _meBrandFilters());
  // For non-brand ratio we also need ALL-CLICKS per page (no brand exclusion)
  const allGroups   = _buildGscGroups(uf, S.selCountry); // no brand filter
  const needsAllRef = S.hideBranded;

  const gscUrl = `${GSC_BASE}/sites/${encodeURIComponent(S.selGsc)}/searchAnalytics/query`;
  const post = (s, e, groups) => req(gscUrl, { method: 'POST', body: JSON.stringify({
    startDate: s, endDate: e, dimensions: ['page'], rowLimit: 500,
    ...(groups.length ? { dimensionFilterGroups: groups } : {}),
  })});

  _pbStart();
  try {
    const requests = [
      post(start,    end,    pgGroups),
      post(popStart, popEnd, pgGroups),
      post(yoyStart, yoyEnd, pgGroups),
    ];
    // Extra request: all-clicks per page in current period (for non-brand ratio)
    if (needsAllRef) requests.push(post(start, end, allGroups));
    const [cur, pop, yoy, allRef] = await Promise.all(requests);

    // Build all-clicks lookup per page (only when brand filter is on)
    const allClicksMap = {};
    if (needsAllRef && allRef) {
      (allRef.rows || []).forEach(r => allClicksMap[r.keys[0]] = r.clicks);
    }
    const pm = {}, ym = {};
    (pop.rows || []).forEach(r => pm[r.keys[0]] = r);
    (yoy.rows || []).forEach(r => ym[r.keys[0]] = r);

    let rows = (cur.rows || []).map(r => {
      const url = r.keys[0], pp = pm[url], yy = ym[url];
      const allCl = allClicksMap[url];
      // Non-brand ratio: how much of this page's organic clicks are non-brand?
      // null when ratio not applicable (brand filter off OR no all-clicks data).
      const nonBrandRatio = (needsAllRef && allCl > 0) ? (r.clicks / allCl) : null;
      return {
        url, clicks: r.clicks, impressions: r.impressions,
        position: r.position, ctr: r.ctr,
        prevClicks: pp?.clicks ?? null,    yoyClicks: yy?.clicks ?? null,
        prevImpr:   pp?.impressions ?? null, yoyImpr: yy?.impressions ?? null,
        prevPos:    pp?.position ?? null,    yoyPos:  yy?.position ?? null,
        delta:        pp ? fmtD(r.clicks,      pp.clicks)      : null,
        deltaYoy:     yy ? fmtD(r.clicks,      yy.clicks)      : null,
        deltaImprPop: pp ? fmtD(r.impressions, pp.impressions) : null,
        deltaImprYoy: yy ? fmtD(r.impressions, yy.impressions) : null,
        deltaPosPop:  pp ? fmtD(r.position,    pp.position)    : null,
        deltaPosYoy:  yy ? fmtD(r.position,    yy.position)    : null,
        sessions: null, revenue: null,
        prevSessions: null, yoySessions: null,
        prevRevenue:  null, yoyRevenue:  null,
        deltaSessPop: null, deltaSessYoy: null,
        deltaRevPop:  null, deltaRevYoy:  null,
        allClicks: allCl ?? null,
        nonBrandRatio,
        estSessions: null, estRevenue: null,
      };
    }).sort((a, b) => b.clicks - a.clicks);

    // Merge GA4 per-page organic data — three parallel fetches for cur/pop/yoy
    if (S.selGa4) {
      try {
        const orgF = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' }}};
        const pageF  = _buildGa4PageFilter(uf);
        const ga4Cty = S.selCountry ? GA4_COUNTRY_MAP[S.selCountry] : null;
        const ctyF   = ga4Cty ? { filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: ga4Cty }}} : null;
        const exprs  = [orgF, ...(pageF ? [pageF] : []), ...(ctyF ? [ctyF] : [])];
        const dimF   = exprs.length === 1 ? exprs[0] : { andGroup: { expressions: exprs } };

        const ga4Post = (s, e) => req(`${GA4_BASE}/properties/${S.selGa4}:runReport`, {
          method: 'POST',
          body: JSON.stringify({
            dateRanges: [{ startDate: s, endDate: e }],
            dimensions: [{ name: 'landingPage' }],
            metrics: [{ name: 'sessions' }, { name: 'purchaseRevenue' }],
            dimensionFilter: dimF, limit: 500,
          }),
        });
        const [ga4Cur, ga4Pop, ga4Yoy] = await Promise.all([
          ga4Post(start,    end),
          ga4Post(popStart, popEnd),
          ga4Post(yoyStart, yoyEnd),
        ]);
        const buildMap = res => {
          const m = {};
          (res.rows || []).forEach(r => {
            m[r.dimensionValues[0].value] = {
              sessions: +(r.metricValues[0].value) || 0,
              revenue:  +(r.metricValues[1].value) || 0,
            };
          });
          return m;
        };
        const curMap = buildMap(ga4Cur);
        const popMap = buildMap(ga4Pop);
        const yoyMap = buildMap(ga4Yoy);

        rows = rows.map(r => {
          const path = r.url.replace(/^https?:\/\/[^/]+/, '');
          const g  = curMap[path] || curMap[r.url] || {};
          const gp = popMap[path] || popMap[r.url] || {};
          const gy = yoyMap[path] || yoyMap[r.url] || {};
          const sessions = g.sessions ?? null;
          const revenue  = g.revenue  ?? null;
          const prevSessions = gp.sessions ?? null;
          const yoySessions  = gy.sessions ?? null;
          const prevRevenue  = gp.revenue  ?? null;
          const yoyRevenue   = gy.revenue  ?? null;
          // Estimated non-brand GA4: apply GSC non-brand-clicks ratio to GA4 organic
          const estSessions = (r.nonBrandRatio != null && sessions != null)
            ? sessions * r.nonBrandRatio : null;
          const estRevenue  = (r.nonBrandRatio != null && revenue  != null)
            ? revenue  * r.nonBrandRatio : null;
          return {
            ...r, sessions, revenue,
            prevSessions, yoySessions, prevRevenue, yoyRevenue,
            deltaSessPop: (sessions != null && prevSessions != null) ? fmtD(sessions, prevSessions) : null,
            deltaSessYoy: (sessions != null && yoySessions  != null) ? fmtD(sessions, yoySessions)  : null,
            deltaRevPop:  (revenue  != null && prevRevenue  != null) ? fmtD(revenue,  prevRevenue)  : null,
            deltaRevYoy:  (revenue  != null && yoyRevenue   != null) ? fmtD(revenue,  yoyRevenue)   : null,
            estSessions, estRevenue,
          };
        });
      } catch(e) { console.error('Pages GA4 error:', e); }
    }

    S.pagesData = rows;
    S.pagesPage = 1;
    const { renderPages } = await import('./render.js');
    renderPages();
  } catch(e) {
    console.error('loadPages error:', e);
    S.pagesData = [];
    const { renderPages } = await import('./render.js');
    renderPages();
  } finally { _pbDone(); }
}

// ── CANNIBALIZATION ──

export async function loadCannibalization() {
  if (!S.selGsc) return;
  const { start, end } = getDates();
  const uf = getCleanUrl();
  // Apply brand filter so cannibalization signals are non-brand only
  const canGroups = _buildGscGroups(uf, S.selCountry, _meBrandFilters());

  const gscUrl = `${GSC_BASE}/sites/${encodeURIComponent(S.selGsc)}/searchAnalytics/query`;
  _pbStart();
  try {
    const res = await req(gscUrl, { method: 'POST', body: JSON.stringify({
      startDate: start, endDate: end, dimensions: ['query', 'page'], rowLimit: 1000,
      ...(canGroups.length ? { dimensionFilterGroups: canGroups } : {}),
    })});

    const map = {};
    (res.rows || []).forEach(r => {
      const q = r.keys[0], url = r.keys[1];
      if (!map[q]) map[q] = [];
      map[q].push({ url, clicks: r.clicks, impressions: r.impressions, position: r.position, ctr: r.ctr });
    });

    S.cannibalData = Object.entries(map)
      .filter(([, urls]) => urls.length >= 2)
      .map(([query, urls]) => ({
        query, totalClicks: urls.reduce((s, u) => s + u.clicks, 0),
        urls: urls.sort((a, b) => b.clicks - a.clicks),
      }))
      .sort((a, b) => b.totalClicks - a.totalClicks);

    const { renderCannibalization } = await import('./render.js');
    renderCannibalization();
  } catch(e) {
    console.error('loadCannibalization error:', e);
    S.cannibalData = [];
    const { renderCannibalization } = await import('./render.js');
    renderCannibalization();
  } finally { _pbDone(); }
}

// ── PAGE URL LIST (for autocomplete) ──

export async function loadPageUrls() {
  if (!S.selGsc) return;
  const { start, end } = getDates();
  const gscUrl = `${GSC_BASE}/sites/${encodeURIComponent(S.selGsc)}/searchAnalytics/query`;
  try {
    const res = await req(gscUrl, { method: 'POST', body: JSON.stringify({
      startDate: start, endDate: end, dimensions: ['page'], rowLimit: 500,
    })});
    S.pageUrls = (res.rows || [])
      .map(r => ({ url: r.keys[0], clicks: r.clicks }))
      .sort((a, b) => b.clicks - a.clicks);
  } catch(e) { console.error('pageUrls error:', e); }
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
