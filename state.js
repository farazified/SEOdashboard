// ── state.js ── all shared app state ──

import { CLIENT_ID } from './config.js';

export const S = {
  clientId:    CLIENT_ID,
  token:       null,
  days:        30,
  datePreset:  null,   // null = rolling S.days | 'lastMonth' | 'lastQuarter'
  gscSites:    [],
  ga4Props:    [],
  selGsc:      '',
  selGa4:      '',
  selCountry:  '',
  kwData:      [],
  qData:       [],
  kwTab:       'all',
  kwPage:      1,
  qSort:       { col: 'clicks', dir: -1 },
  hideBranded: false,
  cmpMode:     'both',
  clicksChart: null,
  posChart:    null,
  hideCols:    {},           // { 'clicks-pop': true, ... }
  // client profiles
  clients:     [],           // [{id, name, gsc, gscLabel, ga4, ga4Label}]
  selClient:   '',           // active client id
  // segments
  segments:    [],           // custom user-saved segments
  // segments breakdown table (null = not yet fetched)
  segmentsData: null,        // [{id,name,color,clicks,sessions,position,revenue,...deltas}]
  segmentsTab:  'all',       // 'all' | 'growing' | 'decaying'
  // exclusion segments (e.g. whole site minus the homepage). null = off.
  segExclude:  null,   // null | 'home'
  // url filter selections (exact-match mode)
  urlSelections: [],   // full URLs selected for equals+OR filtering
  pageUrls:      [],   // lightweight page list for autocomplete [{url, clicks}]
  // URLs the current contains-filter is aggregating over, when >1 — lets the
  // drill bar offer a picker so you can narrow to exactly one. [{url, clicks}]
  drillMatches:  [],
  // metric explorer (independent section)
  meSource:    'gsc',     // 'gsc' | 'ga4'
  meDays:      500,       // explorer time range (16 months)
  meMetric:    'clicks',
  meType:      'bar',
  meAgg:       'monthly',
  meChart:     null,
  meData:      [],        // rows fetched by loadMetricExplorer
  // multi-page routing
  page:         'overview',
  // pages view (null = not yet fetched)
  pagesData:    null,
  pagesSort:    { col: 'clicks', dir: -1 },
  pagesPage:    1,
  // cannibalization (null = not yet fetched)
  cannibalData: null,
};

export const METRICS = {};
