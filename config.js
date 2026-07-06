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

// Built-in page segments. Shared by the pill bar (render.js) and the
// Segments breakdown table (api.js) — kept here so both can import without
// a circular dependency. 'All Pages' has an empty pattern (= sitewide).
export const BUILT_IN_SEGS = [
  { id:'all',         name:'All Pages',   pattern:'',             color:'var(--tx2)' },
  { id:'no-home',     name:'Site − Home', exclude:'home',         color:'var(--red)' },
  { id:'collections', name:'Collections', pattern:'/collections', color:'var(--acc)' },
  { id:'products',    name:'Products',    pattern:'/products',    color:'var(--blu)' },
  { id:'blog',        name:'Blog',        pattern:'/blog',        color:'var(--grn)' },
  { id:'pages',       name:'Pages',       pattern:'/pages',       color:'var(--amb)' },
];

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
