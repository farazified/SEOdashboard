// ── config.js ── edit this file to change settings ──

export const CLIENT_ID = '890208838259-0ns3e1isj4u53uj080c3drl2lsqmjk9o.apps.googleusercontent.com';

export const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'openid email profile'
].join(' ');

export const GSC_BASE  = 'https://www.googleapis.com/webmasters/v3';
export const GA4_BASE  = 'https://analyticsdata.googleapis.com/v1beta';
export const GA4_ADMIN = 'https://analyticsadmin.googleapis.com/v1alpha';

export const COUNTRIES = [
  {code:'',    label:'All countries'},
  {code:'usa', label:'United States'},
  {code:'gbr', label:'United Kingdom'},
  {code:'aus', label:'Australia'},
  {code:'can', label:'Canada'},
  {code:'deu', label:'Germany'},
  {code:'fra', label:'France'},
  {code:'esp', label:'Spain'},
  {code:'ita', label:'Italy'},
  {code:'nld', label:'Netherlands'},
  {code:'bel', label:'Belgium'},
  {code:'che', label:'Switzerland'},
  {code:'swe', label:'Sweden'},
  {code:'nor', label:'Norway'},
  {code:'dnk', label:'Denmark'},
  {code:'pol', label:'Poland'},
  {code:'mex', label:'Mexico'},
  {code:'bra', label:'Brazil'},
  {code:'ind', label:'India'},
  {code:'jpn', label:'Japan'},
  {code:'sgp', label:'Singapore'},
  {code:'are', label:'UAE'},
  {code:'hkg', label:'Hong Kong'},
];
