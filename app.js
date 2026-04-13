// ─────────────────────────────────────────────
//  app.js  –  entry point & wiring
//  This file imports all modules and connects
//  them. It also exposes functions to the HTML
//  via window.__ so inline onclick handlers work
//  with ES Modules (which are scoped by default).
// ─────────────────────────────────────────────

import { CLIENT_ID }                           from './config.js';
import { openKeywordChart, closeKeywordChart }  from './keyword-chart.js';
import { S }                                   from './state.js';
import { doOAuth, handleOAuthRedirect, signOut, loadGscProps, loadGa4Props, loadAll } from './api.js';
import {
  renderAll, renderKeywords, renderWinners, renderLosers,
  renderPropOpts, renderCountryOpts,
  recalcMetricsFromFiltered, updateDeltas, setCmp,
  getBrandTerms, filtBrand, isBrand,
  startDrag, startResize, restoreWidgetPositions,
  setLoading, sortQ, exportCsv, showKeywordChart,
} from './render.js';

// ── BOOT ──────────────────────────────────────

// ES Modules execute as soon as they're parsed — use top-level init
// instead of window.onload which can race with module evaluation
async function init() {
  S.clientId = CLIENT_ID;

  const bt = localStorage.getItem('seo_brand');
  if (bt) document.getElementById('brand-terms').value = bt;
  renderCountryOpts('');
  restoreWidgetPositions();

  // 1. Handle OAuth redirect (token in URL hash)
  if (handleOAuthRedirect()) {
    await showApp();
    return;
  }

  // 2. Existing session token
  const tok = sessionStorage.getItem('seo_tok');
  if (tok) {
    S.token = tok;
    await showApp();
    return;
  }

  // 3. No token — show a clean sign-in screen with a button
  //    (auto-redirect is unreliable on some browsers/CSPs)
  const card = document.querySelector('.setup-card');
  card.innerHTML = `
    <div class="setup-logo">SEO·IQ</div>
    <p class="setup-sub">GSC + GA4 in one place. Runs entirely in your browser — free forever.</p>
    <button class="btn-connect" id="btn-signin" style="margin-top:8px">
      <svg width="18" height="18" viewBox="0 0 18 18" style="vertical-align:middle;margin-right:8px"><path fill="#fff" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"/><path fill="#fff" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#fff" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"/><path fill="#fff" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"/></svg>
      Sign in with Google
    </button>
    <p style="font-size:11px;color:var(--text3);text-align:center;margin-top:20px;line-height:1.7">
      You only need to sign in once per session.<br>
      Your data never leaves your browser.
    </p>`;

  document.getElementById('btn-signin').addEventListener('click', () => {
    S.clientId = CLIENT_ID;
    doOAuth();
  });
}

// Run immediately when module loads — no waiting for window.onload
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function showApp() {
  document.getElementById('setup-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  renderCountryOpts('');
  restoreWidgetPositions();
  await Promise.all([loadGscProps(), loadGa4Props()]);
  loadAll();
}

// ── EXPOSE TO HTML (inline onclick handlers) ──
// ES Modules are scoped — functions must be on window to be callable from HTML attributes.

// __connect removed — Client ID is hardcoded in config.js

window.__signOut        = signOut;
window.__loadAll        = loadAll;
window.__renderAll      = renderAll;
window.__renderKeywords = renderKeywords;
window.__recalcMetrics  = recalcMetricsFromFiltered;
window.__setCmp         = setCmp;
window.__sortQ          = sortQ;
window.__exportCsv      = exportCsv;
window.__showKwChart    = showKeywordChart;
window.__startDrag      = startDrag;
window.__startResize    = startResize;

window.__drillKeyword = (kw) => {
  openKeywordChart(kw);
};
window.__closeKwChart = closeKeywordChart;

window.__clearDrill = () => {
  document.getElementById('url-filter').value = '';
  loadAll();
};

window.__toggleBranded = () => {
  S.hideBranded = !S.hideBranded;
  document.getElementById('brand-tog').classList.toggle('on', S.hideBranded);
  recalcMetricsFromFiltered();
  renderAll();
};

window.__setDays = d => {
  S.days = d;
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', +p.dataset.d === d));
  loadAll();
};

window.__setKwTab = t => {
  S.kwTab = t;
  document.querySelectorAll('.kwtab').forEach(b => b.classList.toggle('active', b.dataset.kw === t));
  renderKeywords();
};

window.__filterProp  = t => { openDrop(t); renderPropOpts(t); };
window.__openDrop    = t => { document.getElementById(t + '-drop').classList.add('open'); renderPropOpts(t); };
window.__closeDrop   = (t, d) => setTimeout(() => document.getElementById(t + '-drop').classList.remove('open'), d);

window.__selProp = (type, val, lbl) => {
  if (type === 'gsc') { S.selGsc = val; document.getElementById('gsc-in').value = lbl; }
  else                { S.selGa4 = val; document.getElementById('ga4-in').value = lbl; }
  document.getElementById(type + '-drop').classList.remove('open');
  loadAll();
};

window.__filterCountry  = () => { renderCountryOpts(document.getElementById('country-in').value); document.getElementById('country-drop').classList.add('open'); };
window.__openCountry    = () => { document.getElementById('country-drop').classList.add('open'); renderCountryOpts(document.getElementById('country-in').value); };
window.__closeCountry   = d  => setTimeout(() => document.getElementById('country-drop').classList.remove('open'), d);

window.__selCountry = (code, lbl) => {
  S.selCountry = code;
  document.getElementById('country-in').value = code ? lbl : '';
  document.getElementById('country-drop').classList.remove('open');
  loadAll();
};

function openDrop(t) { document.getElementById(t + '-drop').classList.add('open'); renderPropOpts(t); }
