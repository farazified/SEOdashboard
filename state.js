// ── state.js ── all shared app state ──

import { CLIENT_ID } from './config.js';

export const S = {
  clientId:    CLIENT_ID,
  token:       null,
  days:        30,
  gscSites:    [],
  ga4Props:    [],
  selGsc:      '',
  selGa4:      '',
  selCountry:  '',
  kwData:      [],
  qData:       [],
  kwTab:       'all',
  qSort:       { col: 'clicks', dir: -1 },
  hideBranded: false,
  cmpMode:     'pop',
  clicksChart: null,
  posChart:    null,
};

export const METRICS = {};
