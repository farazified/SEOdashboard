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

window.onload = async () => {
  // restore saved brand terms
  const bt = localStorage.getItem('seo_brand');
  if (bt) document.getElementById('brand-terms').value = bt;

  renderCountryOpts('');
  restoreWidgetPositions();

  // handle OAuth token coming back in the URL hash
  if (handleOAuthRedirect()) {
    await showApp();
    return;
  }

  // already have a valid session token
  const tok = sessionStorage.getItem('seo_tok');
  if (tok) {
    S.token = tok;
    S.clientId = CLIENT_ID;
    await showApp();
    return;
  }

  // no token — go straight to Google sign-in (Client ID is hardcoded)
  doOAuth();
};

async function showApp() {
  document.getElementById('setup-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  await Promise.all([loadGscProps(), loadGa4Props()]);
  loadAll();
}

// ── EXPOSE TO HTML (inline onclick handlers) ──
// ES Modules are scoped — functions must be on window to be callable from HTML attributes.

window.__connect = () => {
  const v = document.getElementById('cid-input').value.trim();
  if (!v || !v.includes('.apps.googleusercontent.com')) {
    const e = document.getElementById('setup-err');
    e.textContent = 'Please enter a valid OAuth Client ID.';
    e.style.display = 'block';
    return;
  }
  S.clientId = v;
  doOAuth();
};

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
