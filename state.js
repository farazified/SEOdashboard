// ─────────────────────────────────────────────
//  state.js  –  shared app state
//  All runtime data lives here. Import S and
//  METRICS into any module that needs them.
// ─────────────────────────────────────────────

import { CLIENT_ID } from './config.js';

export const S = {
  clientId:     CLIENT_ID,
  token:        null,
  days:         30,

  // property selections
  gscSites:     [],
  ga4Props:     [],
  selGsc:       '',
  selGa4:       '',
  selCountry:   '',

  // data
  kwData:       [],   // all keyword rows from GSC
  qData:        [],   // sorted copy used by the table

  // UI state
  kwTab:        'all',
  qSort:        { col: 'clicks', dir: -1 },
  hideBranded:  false,
  cmpMode:      'pop',   // 'pop' | 'yoy' | 'both'

  // chart instances (set by charts.js)
  clicksChart:  null,
  posChart:     null,
};

// Aggregated metric values + deltas — populated by api.js, read by render.js
export const METRICS = {};
