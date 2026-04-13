// ─────────────────────────────────────────────
//  config.js  –  constants & settings
//  Edit this file to change API keys, add
//  countries, or update API endpoint versions.
// ─────────────────────────────────────────────

export const CLIENT_ID = '890208838259-0ns3e1isj4u53uj080c3drl2lsqmjk9o.apps.googleusercontent.com';

export const GSC_BASE  = 'https://www.googleapis.com/webmasters/v3';
export const GA4_BASE  = 'https://analyticsdata.googleapis.com/v1beta';
export const GA4_ADMIN = 'https://analyticsadmin.googleapis.com/v1alpha';

export const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'openid email profile'
].join(' ');

export const COUNTRIES = [
  { code: '',    label: 'All countries' },
  { code: 'usa', label: 'United States' },
  { code: 'gbr', label: 'United Kingdom' },
  { code: 'aus', label: 'Australia' },
  { code: 'can', label: 'Canada' },
  { code: 'deu', label: 'Germany' },
  { code: 'fra', label: 'France' },
  { code: 'esp', label: 'Spain' },
  { code: 'ita', label: 'Italy' },
  { code: 'nld', label: 'Netherlands' },
  { code: 'bel', label: 'Belgium' },
  { code: 'che', label: 'Switzerland' },
  { code: 'aut', label: 'Austria' },
  { code: 'swe', label: 'Sweden' },
  { code: 'nor', label: 'Norway' },
  { code: 'dnk', label: 'Denmark' },
  { code: 'fin', label: 'Finland' },
  { code: 'pol', label: 'Poland' },
  { code: 'prt', label: 'Portugal' },
  { code: 'mex', label: 'Mexico' },
  { code: 'bra', label: 'Brazil' },
  { code: 'arg', label: 'Argentina' },
  { code: 'ind', label: 'India' },
  { code: 'jpn', label: 'Japan' },
  { code: 'kor', label: 'South Korea' },
  { code: 'sgp', label: 'Singapore' },
  { code: 'nzl', label: 'New Zealand' },
  { code: 'zaf', label: 'South Africa' },
  { code: 'are', label: 'UAE' },
  { code: 'sau', label: 'Saudi Arabia' },
  { code: 'tur', label: 'Turkey' },
  { code: 'phl', label: 'Philippines' },
  { code: 'idn', label: 'Indonesia' },
  { code: 'mys', label: 'Malaysia' },
  { code: 'tha', label: 'Thailand' },
  { code: 'hkg', label: 'Hong Kong' },
];
