// ── app.js ── entry point ──

import { CLIENT_ID, COUNTRIES } from './config.js';
import { S } from './state.js';
import { doOAuth, handleOAuthRedirect, signOut, loadGscProps, loadGa4Props, loadAll } from './api.js';
import { renderAll, renderKeywords, renderPropOpts, renderCountryOpts,
         sortQ, exportCsv, showKwChart, startDrag, startResize,
         restoreWidgetPos, recalcFiltered, updateDeltas } from './render.js';

// ── EXPOSED TO HTML onclick attributes ──
// Must be on window because ES modules are scoped

window._signIn = () => {
  S.clientId = CLIENT_ID;
  doOAuth();
};

window._signOut = () => signOut();

window._loadAll = () => loadAll();

window._clearDrill = () => {
  document.getElementById('url-filter').value = '';
  loadAll();
};

window._setCmp = m => {
  S.cmpMode = m;
  document.querySelectorAll('.cmp-btn').forEach(b => b.classList.toggle('active', b.dataset.cmp===m));
  updateDeltas();
  recalcFiltered();
};

window._setDays = d => {
  S.days = d;
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', +p.dataset.d===d));
  loadAll();
};

window._setKwTab = t => {
  S.kwTab = t;
  document.querySelectorAll('.kwtab').forEach(b => b.classList.toggle('active', b.dataset.kw===t));
  renderKeywords();
};

window._toggleBranded = () => {
  S.hideBranded = !S.hideBranded;
  document.getElementById('brand-tog').classList.toggle('on', S.hideBranded);
  recalcFiltered();
  renderAll();
};

window._filterProp = t => { document.getElementById(t+'-drop').classList.add('open'); renderPropOpts(t); };
window._openDrop   = t => { document.getElementById(t+'-drop').classList.add('open'); renderPropOpts(t); };
window._closeDrop  = (t,d) => setTimeout(() => document.getElementById(t+'-drop').classList.remove('open'), d);

window._selProp = (type, val, lbl) => {
  if (type==='gsc') { S.selGsc=val; document.getElementById('gsc-in').value=lbl; }
  else              { S.selGa4=val; document.getElementById('ga4-in').value=lbl; }
  document.getElementById(type+'-drop').classList.remove('open');
  loadAll();
};

window._filterCountry = () => {
  renderCountryOpts(document.getElementById('country-in').value);
  document.getElementById('country-drop').classList.add('open');
};
window._openCountry  = () => { document.getElementById('country-drop').classList.add('open'); renderCountryOpts(document.getElementById('country-in').value); };
window._closeCountry = d  => setTimeout(() => document.getElementById('country-drop').classList.remove('open'), d);
window._selCountry   = (code, lbl) => {
  S.selCountry = code;
  document.getElementById('country-in').value = code ? lbl : '';
  document.getElementById('country-drop').classList.remove('open');
  loadAll();
};

window._sortQ       = col => sortQ(col);
window._exportCsv   = ()  => exportCsv();
window._kwChart     = kw  => showKwChart(kw);
window._startDrag   = (e,id) => startDrag(e,id);
window._startResize = (e,id) => startResize(e,id);
window._renderKws   = ()  => renderKeywords();
window._recalc      = ()  => { recalcFiltered(); renderAll(); };

// ── BOOT ──

async function boot() {
  S.clientId = CLIENT_ID;

  // restore brand terms
  const bt = localStorage.getItem('seo_brand');
  if (bt) document.getElementById('brand-terms').value = bt;

  // handle Google OAuth redirect (token in URL hash)
  if (handleOAuthRedirect()) {
    await showApp();
    return;
  }

  // already have a session token
  const tok = sessionStorage.getItem('seo_tok');
  if (tok) {
    S.token = tok;
    await showApp();
    return;
  }

  // no token — setup screen is visible, user clicks Sign in button
}

async function showApp() {
  document.getElementById('setup-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  renderCountryOpts('');
  restoreWidgetPos();
  // sync comparison toggle to match state default ('both')
  document.querySelectorAll('.cmp-btn').forEach(b => b.classList.toggle('active', b.dataset.cmp === S.cmpMode));
  await Promise.all([loadGscProps(), loadGa4Props()]);
  loadAll();
}

// boot immediately
boot();
