// ── app.js ── entry point ──

import { CLIENT_ID, COUNTRIES } from './config.js';
import { S } from './state.js';
import { doOAuth, handleOAuthRedirect, signOut, loadGscProps, loadGa4Props, loadAll, loadMetricExplorer, loadPages, loadCannibalization, loadPageUrls, fmt } from './api.js';
import { renderAll, renderKeywords, renderCountryOpts,
         sortQ, exportCsv, showKwChart,
         recalcFiltered, updateDeltas,
         renderSegments, renderMetricExplorer, renderGa4Cards,
         applyColVisibility,
         renderClientOpts, renderClientMgr, renderMgrCountryOpts,
         renderPages, renderRankIntelligence, renderCannibalization, renderInsights } from './render.js';

// ── EXPOSED TO HTML onclick attributes ──
// Must be on window because ES modules are scoped
window.S = S;

// ── PAGE NAVIGATION ──

window._navTo = (page, skipLoad = false) => {
  // 'explorer' and 'keywords' are embedded in overview — scroll to them
  if (page === 'explorer') { window._openExplorer(); return; }
  if (page === 'keywords') { window._navToKeywords(); return; }
  S.page = page;
  document.querySelectorAll('.page-view').forEach(el => el.style.display = 'none');
  const pEl = document.getElementById('page-' + page);
  if (pEl) pEl.style.display = '';
  document.querySelectorAll('.snav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const p = new URLSearchParams(location.search);
  if (page !== 'overview') p.set('page', page); else p.delete('page');
  const qs = p.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  if (!skipLoad) {
    if (page === 'pages')    { if (S.pagesData === null) loadPages(); else renderPages(); }
    if (page === 'cannibal') { if (S.cannibalData === null) loadCannibalization(); else renderCannibalization(); }
    if (page === 'rank')     renderRankIntelligence();
    if (page === 'insights') renderInsights();
  }
};

window._navToKeywords = () => {
  // Keywords table lives on Overview — navigate there then scroll to it
  if (S.page !== 'overview') window._navTo('overview', true);
  document.querySelectorAll('.snav-item').forEach(b => b.classList.toggle('active', b.dataset.page === 'keywords'));
  setTimeout(() => {
    document.getElementById('sec-keywords')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
};

window._openExplorer = () => {
  // navigate to overview if needed
  if (S.page !== 'overview') window._navTo('overview', true);
  const panel = document.getElementById('sec-explorer');
  if (!panel) return;
  const wasCollapsed = panel.classList.contains('me-collapsed');
  panel.classList.remove('me-collapsed');
  const btn = document.getElementById('me-toggle');
  if (btn) btn.textContent = '▼ Hide';
  if (wasCollapsed && !S.meData.length) loadMetricExplorer();
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
};

window._toggleExplorer = () => {
  const panel = document.getElementById('sec-explorer');
  if (!panel) return;
  const nowCollapsed = panel.classList.toggle('me-collapsed');
  const btn = document.getElementById('me-toggle');
  if (btn) btn.textContent = nowCollapsed ? '▶ Load' : '▼ Hide';
  if (!nowCollapsed && !S.meData.length) loadMetricExplorer();
};

window._signIn = () => {
  S.clientId = CLIENT_ID;
  doOAuth();
};

window._signOut = () => signOut();

window._loadAll = () => {
  document.getElementById('url-drop').style.display = 'none';
  syncUrlState(); updateCtxBadge(); loadAll();
};

window._clearDrill = () => {
  document.getElementById('url-filter').value = '';
  S.urlSelections = [];
  document.getElementById('url-drop').style.display = 'none';
  syncUrlState(); updateCtxBadge(); loadAll();
};

// ── URL AUTOCOMPLETE DROPDOWN ──

window._urlFocus = () => {
  // Lazy-load page URL list on first focus
  if (!S.pageUrls.length && S.selGsc) loadPageUrls().then(() => _renderUrlDrop());
  _renderUrlDrop();
};

window._urlInput = () => _renderUrlDrop();

window._urlBlur = () => {
  // Delay so clicks inside the dropdown fire before hiding
  setTimeout(() => { document.getElementById('url-drop').style.display = 'none'; }, 200);
};

function _renderUrlDrop() {
  const q    = document.getElementById('url-filter').value.trim().toLowerCase();
  const drop = document.getElementById('url-drop');
  const opts = document.getElementById('url-drop-opts');

  if (!q || !S.pageUrls.length) { drop.style.display = 'none'; return; }

  const matches = S.pageUrls
    .filter(p => p.url.toLowerCase().includes(q))
    .slice(0, 30);

  if (!matches.length) { drop.style.display = 'none'; return; }

  opts.innerHTML = matches.map(p => {
    const path = p.url.replace(/^https?:\/\/[^/]+/, '') || '/';
    const sel  = S.urlSelections.includes(p.url);
    return `<div class="url-opt${sel ? ' selected' : ''}" onmousedown="event.preventDefault()" onclick="window._selUrlOpt('${p.url.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
      <span class="url-opt-chk">${sel ? '✓' : ''}</span>
      <span class="url-opt-path">${path}</span>
      <span class="url-opt-clicks">${fmt(p.clicks)}</span>
    </div>`;
  }).join('');

  // Footer: show how many are selected
  const footer   = document.getElementById('url-drop-footer');
  const selCount = document.getElementById('url-drop-sel-count');
  if (S.urlSelections.length > 0) {
    selCount.textContent = `${S.urlSelections.length} URL${S.urlSelections.length > 1 ? 's' : ''} selected — exact match`;
    footer.style.display = 'flex';
  } else {
    footer.style.display = 'none';
  }

  drop.style.display = '';
}

window._selUrlOpt = url => {
  if (S.urlSelections.includes(url)) {
    S.urlSelections = S.urlSelections.filter(u => u !== url);
  } else {
    S.urlSelections.push(url);
  }
  _renderUrlDrop();
};

window._clearUrlSel = () => {
  S.urlSelections = [];
  _renderUrlDrop();
};

window._setCmp = m => {
  S.cmpMode = m;
  document.querySelectorAll('.cmp-btn').forEach(b => b.classList.toggle('active', b.dataset.cmp===m));
  syncUrlState();
  updateDeltas();
  recalcFiltered();
};

window._setDays = d => {
  S.days = d;
  S.datePreset = null;
  document.querySelectorAll('.pill').forEach(p =>
    p.classList.toggle('active', !p.dataset.preset && +p.dataset.d === d));
  document.getElementById('custom-days').value = '';
  syncUrlState(); updateCtxBadge();
  loadAll();
};

window._setCustomDays = v => {
  const n = parseInt(v);
  if (!n || n < 1) return;
  S.days = n;
  S.datePreset = null;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  syncUrlState(); updateCtxBadge(); loadAll();
};

window._setPreset = preset => {
  S.datePreset = preset;
  document.querySelectorAll('.pill').forEach(p =>
    p.classList.toggle('active', p.dataset.preset === preset));
  document.getElementById('custom-days').value = '';
  syncUrlState(); updateCtxBadge(); loadAll();
};

window._setKwTab = t => {
  S.kwTab = t;
  S.kwPage = 1;
  document.querySelectorAll('.kwtab').forEach(b => b.classList.toggle('active', b.dataset.kw===t));
  renderKeywords();
};

window._kwGoPage = n => {
  S.kwPage = n;
  renderKeywords(true);
};

// ── PAGES HANDLERS ──

window._sortPages = col => {
  if (S.pagesSort.col === col) S.pagesSort.dir *= -1;
  else { S.pagesSort.col = col; S.pagesSort.dir = -1; }
  renderPages(true);
};

window._pagesGoPage = n => {
  S.pagesPage = n;
  renderPages(true);
};

window._drillPage = url => {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  document.getElementById('url-filter').value = path;
  window._navTo('overview');
  syncUrlState(); updateCtxBadge(); loadAll();
};

window._exportPagesCsv = () => {
  if (!S.pagesData?.length) return;
  const brand = S.hideBranded;
  const hdr = [
    'URL',
    'Clicks','Clicks PoP%','Clicks YoY%',
    'Avg Position','Pos PoP%','Pos YoY%',
    'Org. Sessions','Sess. PoP%','Sess. YoY%',
    'Org. Revenue','Rev. PoP%','Rev. YoY%',
    ...(brand ? ['Est. Non-brand Sessions','Est. Non-brand Revenue','Non-brand %'] : []),
  ];
  const rows = S.pagesData.map(r => {
    const base = [
      `"${r.url.replace(/"/g,'""')}"`,
      r.clicks, r.delta ?? '', r.deltaYoy ?? '',
      r.position.toFixed(1), r.deltaPosPop ?? '', r.deltaPosYoy ?? '',
      r.sessions ?? '', r.deltaSessPop ?? '', r.deltaSessYoy ?? '',
      r.revenue?.toFixed(2) ?? '', r.deltaRevPop ?? '', r.deltaRevYoy ?? '',
    ];
    if (brand) {
      base.push(
        r.estSessions != null ? Math.round(r.estSessions) : '',
        r.estRevenue  != null ? r.estRevenue.toFixed(2)   : '',
        r.nonBrandRatio != null ? (r.nonBrandRatio*100).toFixed(1) : '',
      );
    }
    return base;
  });
  const csv = [hdr,...rows].map(r=>r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
    download: `seo-iq-pages-${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
};

window._toggleSettings = () => {
  const bar = document.getElementById('settings-bar');
  const btn = document.getElementById('btn-settings');
  const open = bar.classList.toggle('open');
  btn.classList.toggle('active', open);
  localStorage.setItem('seo_settings_open', open ? '1' : '');
};

window._toggleBranded = () => {
  S.hideBranded = !S.hideBranded;
  document.getElementById('brand-tog').classList.toggle('on', S.hideBranded);
  document.getElementById('brand-active-tag')?.classList.toggle('visible', S.hideBranded);
  recalcFiltered();
  renderAll();
  // Re-render the overview GA4 cards (estimated non-brand values use the ratio)
  renderGa4Cards();
  // If brand turned ON, the non-brand ratio isn't computed yet — refetch GSC
  // overview metrics to get it. (Toggling OFF doesn't need a refetch.)
  if (S.hideBranded) {
    import('./api.js').then(m => m.loadGsc(S.selGsc).then(renderGa4Cards));
  }
  // Reload everything that filters branded queries server-side
  const exPanel = document.getElementById('sec-explorer');
  const exOpen  = exPanel && !exPanel.classList.contains('me-collapsed');
  if (exOpen || S.meData.length) loadMetricExplorer();
  // Pages: re-fetch if data exists (mark as loading so user sees state change)
  if (S.pagesData !== null) {
    S.pagesData = null;
    if (S.page === 'pages') renderPages();
    loadPages();
  }
  // Cannibalization: re-fetch if data exists
  if (S.cannibalData !== null) {
    S.cannibalData = null;
    if (S.page === 'cannibal') renderCannibalization();
    loadCannibalization();
  }
};

// ── CLIENT PROFILES ──

function _applyClient(client) {
  S.selClient = client.id;
  S.selGsc    = client.gsc;
  S.selGa4    = client.ga4;
  const gi = document.getElementById('gsc-in'); if (gi) gi.value = client.gscLabel;
  const ai = document.getElementById('ga4-in'); if (ai) ai.value = client.ga4Label;
  const lbl = document.getElementById('client-lbl');
  if (lbl) lbl.textContent = client.name;
  document.getElementById('client-btn')?.classList.add('has-client');
  // Apply saved country if present
  if (client.country) {
    S.selCountry = client.country;
    const ci = document.getElementById('country-in');
    if (ci) ci.value = client.countryLabel || client.country;
  }
  localStorage.setItem('seo_last_client', client.id);
}

window._toggleClientDrop = () => {
  const drop = document.getElementById('client-drop');
  const btn  = document.getElementById('client-btn');
  const opening = !drop.classList.contains('open');
  drop.classList.toggle('open', opening);
  btn?.classList.toggle('active', opening);
  if (opening) {
    const inp = document.getElementById('client-search');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 60); }
    renderClientOpts('');
  }
};

window._searchClients = q => renderClientOpts(q);

window._selClient = id => {
  const client = S.clients.find(c => c.id === id);
  if (!client) return;
  _applyClient(client);
  // reset URL state for new client
  S.urlSelections = [];
  S.pageUrls = [];
  document.getElementById('url-drop').style.display = 'none';
  document.getElementById('client-drop')?.classList.remove('open');
  document.getElementById('client-btn')?.classList.remove('active');
  syncUrlState(); updateCtxBadge(); loadAll();
};

window._openClientMgr = () => {
  document.getElementById('client-drop')?.classList.remove('open');
  document.getElementById('client-btn')?.classList.remove('active');
  const modal = document.getElementById('client-mgr');
  if (!modal) return;
  modal.style.display = 'flex';
  // clear the searchable property pickers
  ['mgr-gsc-in','mgr-gsc-val','mgr-ga4-in','mgr-ga4-val','mgr-country-in','mgr-country-val'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['mgr-gsc-opts','mgr-ga4-opts','mgr-country-opts'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  renderClientMgr();
};

// ── MANAGER PROPERTY SEARCH PICKERS ──

window._filterMgrGsc = q => {
  const opts = document.getElementById('mgr-gsc-opts');
  if (!opts) return;
  const filt = S.gscSites.filter(s => s.siteUrl.toLowerCase().includes(q.toLowerCase()));
  if (!filt.length) { opts.style.display = 'none'; return; }
  opts.style.display = '';
  opts.innerHTML = filt.slice(0, 20).map(s => {
    const lbl = s.siteUrl.replace(/^sc-domain:/,'').replace(/\/$/,'');
    return `<div class="mgr-popt" onmousedown="window._selMgrGsc('${s.siteUrl.replace(/'/g,"\\'")}','${lbl.replace(/'/g,"\\'")}')"><strong>GSC:</strong> ${lbl}</div>`;
  }).join('');
};
window._openMgrGsc  = () => window._filterMgrGsc(document.getElementById('mgr-gsc-in')?.value || '');
window._closeMgrGsc = d  => setTimeout(() => { const el = document.getElementById('mgr-gsc-opts'); if (el) el.style.display = 'none'; }, d);
window._selMgrGsc   = (val, lbl) => {
  const i = document.getElementById('mgr-gsc-in');  if (i) { i.value = lbl; i.classList.remove('inp-err'); }
  const v = document.getElementById('mgr-gsc-val'); if (v) v.value = val;
  const o = document.getElementById('mgr-gsc-opts'); if (o) o.style.display = 'none';
  // auto-detect country from TLD if country not already set
  const cVal = document.getElementById('mgr-country-val');
  if (cVal && !cVal.value) {
    const detected = detectCountryFromGsc(val);
    if (detected) {
      const match = COUNTRIES.find(c => c.code === detected);
      if (match) {
        cVal.value = match.code;
        const ci = document.getElementById('mgr-country-in'); if (ci) ci.value = match.label;
      }
    }
  }
};

window._filterMgrGa4 = q => {
  const opts = document.getElementById('mgr-ga4-opts');
  if (!opts) return;
  const filt = S.ga4Props.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.accountName && p.accountName.toLowerCase().includes(q.toLowerCase()))
  );
  if (!filt.length) { opts.style.display = 'none'; return; }
  opts.style.display = '';
  opts.innerHTML = filt.slice(0, 20).map(p => {
    const displayLabel = p.accountName ? `${p.accountName} > ${p.name}` : p.name;
    return `<div class="mgr-popt" onmousedown="window._selMgrGa4('${p.id}','${p.name.replace(/'/g,"\\'")}')"><strong>GA4:</strong> ${displayLabel}</div>`;
  }).join('');
};
window._openMgrGa4  = () => window._filterMgrGa4(document.getElementById('mgr-ga4-in')?.value || '');
window._closeMgrGa4 = d  => setTimeout(() => { const el = document.getElementById('mgr-ga4-opts'); if (el) el.style.display = 'none'; }, d);
window._selMgrGa4   = (val, lbl) => {
  const i = document.getElementById('mgr-ga4-in');  if (i) { i.value = lbl; i.classList.remove('inp-err'); }
  const v = document.getElementById('mgr-ga4-val'); if (v) v.value = val;
  const o = document.getElementById('mgr-ga4-opts'); if (o) o.style.display = 'none';
};

// ── TLD → country code auto-detection ──
const TLD_COUNTRY = {
  'au':'aus','com.au':'aus','net.au':'aus',
  'co.uk':'gbr','uk':'gbr','me.uk':'gbr',
  'ca':'can',
  'nz':'nzl','co.nz':'nzl',
  'de':'deu','fr':'fra','it':'ita','es':'esp','nl':'nld',
  'ie':'irl','pt':'prt','be':'bel','ch':'che','at':'aut',
  'in':'ind','com.sg':'sgp','sg':'sgp',
  'co.za':'zaf','com.br':'bra','mx':'mex',
  'co.jp':'jpn','jp':'jpn','kr':'kor','hk':'hkg',
  'se':'swe','no':'nor','dk':'dnk','fi':'fin',
  'pl':'pol','cz':'cze','hu':'hun','ro':'rou',
};

function detectCountryFromGsc(siteUrl) {
  const domain = siteUrl
    .replace(/^sc-domain:/,'')
    .replace(/^https?:\/\//,'')
    .replace(/\/.*/,'')
    .replace(/^www\./,'');
  const parts = domain.split('.');
  if (parts.length >= 3) {
    const tld2 = parts.slice(-2).join('.');
    if (TLD_COUNTRY[tld2]) return TLD_COUNTRY[tld2];
  }
  const tld1 = parts[parts.length - 1];
  return TLD_COUNTRY[tld1] || null;
}

// ── MANAGER COUNTRY PICKER ──

window._filterMgrCountry = q => {
  const selCode = document.getElementById('mgr-country-val')?.value || '';
  renderMgrCountryOpts(q, selCode);
  document.getElementById('mgr-country-opts').style.display = '';
};
window._openMgrCountry  = () => {
  const selCode = document.getElementById('mgr-country-val')?.value || '';
  renderMgrCountryOpts(document.getElementById('mgr-country-in')?.value || '', selCode);
};
window._closeMgrCountry = d => setTimeout(() => {
  const el = document.getElementById('mgr-country-opts'); if (el) el.style.display = 'none';
}, d);
window._selMgrCountry   = (code, lbl) => {
  const i = document.getElementById('mgr-country-in');  if (i) i.value = lbl;
  const v = document.getElementById('mgr-country-val'); if (v) v.value = code;
  const o = document.getElementById('mgr-country-opts'); if (o) o.style.display = 'none';
};

window._closeClientMgr = () => {
  const modal = document.getElementById('client-mgr');
  if (modal) modal.style.display = 'none';
};

window._saveClient = () => {
  const nameInp       = document.getElementById('mgr-name');
  const gscInp        = document.getElementById('mgr-gsc-in');
  const ga4Inp        = document.getElementById('mgr-ga4-in');
  const countryInp    = document.getElementById('mgr-country-in');
  const gscValEl      = document.getElementById('mgr-gsc-val');
  const ga4ValEl      = document.getElementById('mgr-ga4-val');
  const countryValEl  = document.getElementById('mgr-country-val');
  const name         = nameInp.value.trim();
  const gscVal       = gscValEl?.value.trim();
  const ga4Val       = ga4ValEl?.value.trim();
  const gscLabel     = gscInp?.value.trim();
  const ga4Label     = ga4Inp?.value.trim();
  const countryCode  = countryValEl?.value.trim() || '';
  const countryLabel = countryInp?.value.trim() || '';
  nameInp.classList.toggle('inp-err', !name);
  gscInp?.classList.toggle('inp-err', !gscVal);
  ga4Inp?.classList.toggle('inp-err', !ga4Val);
  if (!name || !gscVal || !ga4Val) return;
  S.clients.push({ id: 'cl_' + Date.now(), name, gsc: gscVal, gscLabel, ga4: ga4Val, ga4Label, country: countryCode, countryLabel });
  localStorage.setItem('seo_clients', JSON.stringify(S.clients));
  nameInp.value = ''; nameInp.classList.remove('inp-err');
  [gscInp, ga4Inp, countryInp].forEach(el => { if (el) { el.value = ''; el.classList.remove('inp-err'); }});
  [gscValEl, ga4ValEl, countryValEl].forEach(el => { if (el) el.value = ''; });
  renderClientMgr();
  renderClientOpts('');
};

window._delClient = id => {
  S.clients = S.clients.filter(c => c.id !== id);
  if (S.selClient === id) {
    S.selClient = '';
    const lbl = document.getElementById('client-lbl');
    if (lbl) lbl.textContent = 'Select client…';
    document.getElementById('client-btn')?.classList.remove('has-client');
  }
  localStorage.setItem('seo_clients', JSON.stringify(S.clients));
  renderClientMgr();
  renderClientOpts('');
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
  syncUrlState(); updateCtxBadge(); loadAll();
};

window._sortQ       = col => sortQ(col);
window._exportCsv   = ()  => exportCsv();
window._kwChart     = kw  => showKwChart(kw);
window._renderKws   = ()  => renderKeywords();
window._recalc      = ()  => { recalcFiltered(); renderAll(); };

// ── SEGMENTS ──

window._selSeg = pat => {
  document.getElementById('url-filter').value = pat;
  S.urlSelections = [];
  document.getElementById('url-drop').style.display = 'none';
  window._closeSegForm();
  loadAll();
};

window._openSegForm = () => {
  document.getElementById('seg-form').style.display = 'flex';
  document.getElementById('seg-add-btn').style.display = 'none';
  document.getElementById('seg-name-inp').focus();
};

window._closeSegForm = () => {
  document.getElementById('seg-form').style.display = 'none';
  document.getElementById('seg-add-btn').style.display = '';
  document.getElementById('seg-name-inp').value = '';
  document.getElementById('seg-pat-inp').value  = '';
};

window._saveSeg = () => {
  const name = document.getElementById('seg-name-inp').value.trim();
  const pat  = document.getElementById('seg-pat-inp').value.trim();
  if (!name || !pat) return;
  const seg = { id: 'c_' + Date.now(), name, pattern: pat, color:'var(--acc-l)', isCustom: true };
  S.segments.push(seg);
  localStorage.setItem('seo_segments', JSON.stringify(S.segments));
  window._closeSegForm();
  renderSegments();
};

window._delSeg = (id, e) => {
  e.stopPropagation();
  S.segments = S.segments.filter(s => s.id !== id);
  localStorage.setItem('seo_segments', JSON.stringify(S.segments));
  renderSegments();
};

// ── URL LIST SEGMENTS ──

window._openUrlListModal = () => {
  const modal = document.getElementById('url-list-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('ul-name-inp').value = '';
  document.getElementById('ul-urls-inp').value = '';
  document.getElementById('ul-count').textContent = '0 URLs';
  window._closeSegForm();
  _renderUlSavedList();
  setTimeout(() => document.getElementById('ul-name-inp').focus(), 60);
};

window._closeUrlListModal = () => {
  const modal = document.getElementById('url-list-modal');
  if (modal) modal.style.display = 'none';
};

window._ulCountUrls = () => {
  const lines = _parseUlUrls();
  const el = document.getElementById('ul-count');
  if (el) el.textContent = lines.length ? `${lines.length} URL${lines.length>1?'s':''}` : '0 URLs';
};

function _parseUlUrls() {
  const raw = document.getElementById('ul-urls-inp')?.value || '';
  return raw.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && (l.startsWith('http://') || l.startsWith('https://') || l.startsWith('/')));
}

function _renderUlSavedList() {
  const container = document.getElementById('ul-saved-list');
  if (!container) return;
  const urlSegs = (S.segments || []).filter(s => s.urlList);
  if (!urlSegs.length) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <div class="ul-saved-hdr">Saved URL lists (${urlSegs.length})</div>
    <div class="ul-saved-rows">
      ${urlSegs.map(s => `
        <div class="ul-saved-row">
          <div>
            <div class="ul-saved-name">${s.name}</div>
            <div class="ul-saved-sub">${s.urlList.length} URLs</div>
          </div>
          <button class="ul-saved-del" onclick="window._delUrlListSeg('${s.id}')">✕ Remove</button>
        </div>`).join('')}
    </div>`;
}

window._saveUrlListSeg = () => {
  const nameInp = document.getElementById('ul-name-inp');
  const name    = nameInp?.value.trim();
  const urls    = _parseUlUrls();
  if (!name) { nameInp?.classList.add('inp-err'); setTimeout(()=>nameInp?.classList.remove('inp-err'),1500); return; }
  if (!urls.length) {
    document.getElementById('ul-urls-inp')?.classList.add('inp-err');
    setTimeout(() => document.getElementById('ul-urls-inp')?.classList.remove('inp-err'), 1500);
    return;
  }
  const seg = { id: 'ul_' + Date.now(), name, urlList: urls, color: '#3ecf8e', isCustom: true };
  S.segments.push(seg);
  localStorage.setItem('seo_segments', JSON.stringify(S.segments));
  nameInp.value = '';
  document.getElementById('ul-urls-inp').value = '';
  document.getElementById('ul-count').textContent = '0 URLs';
  renderSegments();
  _renderUlSavedList();
  // auto-apply the new segment
  window._selSegUrls(seg.id);
  window._closeUrlListModal();
};

window._delUrlListSeg = id => {
  S.segments = S.segments.filter(s => s.id !== id);
  localStorage.setItem('seo_segments', JSON.stringify(S.segments));
  // if this was the active segment, reset to sitewide
  if (S.urlSelections.length) {
    S.urlSelections = [];
    document.getElementById('url-filter').value = '';
    document.getElementById('url-drop').style.display = 'none';
  }
  renderSegments();
  _renderUlSavedList();
};

window._selSegUrls = id => {
  const seg = S.segments.find(s => s.id === id);
  if (!seg || !seg.urlList) return;
  S.urlSelections = [...seg.urlList];
  // clear the text filter — exact URL list takes over
  document.getElementById('url-filter').value = '';
  document.getElementById('url-drop').style.display = 'none';
  S.pageUrls = [];
  window._closeSegForm();
  window._closeUrlListModal();
  syncUrlState(); updateCtxBadge(); loadAll();
};

// ── COLUMN VISIBILITY ──

window._toggleColDrop = e => {
  e.stopPropagation();
  const menu = document.getElementById('col-menu');
  if (!menu) return;
  const opening = !menu.classList.contains('open');
  menu.classList.toggle('open', opening);
  document.getElementById('btn-cols')?.classList.toggle('active', opening);
  if (opening) {
    // sync checkboxes to current state
    menu.querySelectorAll('input[data-col]').forEach(inp => {
      inp.checked = !S.hideCols[inp.dataset.col];
    });
  }
};

window._toggleCol = (key, checked) => {
  if (checked) delete S.hideCols[key];
  else S.hideCols[key] = true;
  localStorage.setItem('seo_hidecols', JSON.stringify(S.hideCols));
  applyColVisibility();
};

// ── METRIC EXPLORER ──

// Re-fetch + re-render (called on source/range/URL changes)
window._meRender = () => loadMetricExplorer();

// Switch data source — updates tabs and re-fetches
window._meSrc = src => {
  S.meSource = src;
  document.querySelectorAll('.me-src').forEach(b => b.classList.toggle('active', b.dataset.src === src));
  // Swap metric tabs to match source
  const tabs = document.getElementById('me-metric-tabs');
  if (tabs) {
    if (src === 'ga4') {
      tabs.innerHTML = `
        <button class="me-tab active" data-met="sessions" onclick="window._mePick('sessions')">Sessions</button>
        <button class="me-tab"        data-met="revenue"  onclick="window._mePick('revenue')">Revenue</button>`;
      S.meMetric = 'sessions';
    } else {
      tabs.innerHTML = `
        <button class="me-tab active" data-met="clicks"      onclick="window._mePick('clicks')">Clicks</button>
        <button class="me-tab"        data-met="impressions" onclick="window._mePick('impressions')">Impressions</button>
        <button class="me-tab"        data-met="position"    onclick="window._mePick('position')">Avg. Position</button>
        <button class="me-tab"        data-met="ctr"         onclick="window._mePick('ctr')">CTR</button>`;
      S.meMetric = 'clicks';
    }
  }
  loadMetricExplorer();
};

// Change time range — re-fetches data
window._meRange = days => {
  S.meDays = days;
  document.querySelectorAll('.me-range').forEach(b => b.classList.toggle('active', +b.dataset.days === days));
  // auto-switch aggregation to keep chart readable
  if (days >= 180 && S.meAgg === 'daily') {
    S.meAgg = 'monthly';
    document.querySelectorAll('.me-agg').forEach(b => b.classList.toggle('active', b.dataset.agg === 'monthly'));
  } else if (days <= 30 && S.meAgg === 'monthly') {
    S.meAgg = 'daily';
    document.querySelectorAll('.me-agg').forEach(b => b.classList.toggle('active', b.dataset.agg === 'daily'));
  }
  loadMetricExplorer();
};

// Toggle metric — re-renders from cached S.meData (no re-fetch)
window._mePick = met => {
  S.meMetric = met;
  document.querySelectorAll('.me-tab').forEach(b => b.classList.toggle('active', b.dataset.met === met));
  renderMetricExplorer();
};

// Toggle chart type — re-renders from cached S.meData
window._meType = typ => {
  S.meType = typ;
  document.querySelectorAll('.me-type').forEach(b => b.classList.toggle('active', b.dataset.type === typ));
  renderMetricExplorer();
};

// Toggle aggregation — re-renders from cached S.meData
window._meAgg = agg => {
  S.meAgg = agg;
  document.querySelectorAll('.me-agg').forEach(b => b.classList.toggle('active', b.dataset.agg === agg));
  renderMetricExplorer();
};

// ── URL STATE ──

export function syncUrlState() {
  const p = new URLSearchParams();
  if (S.selClient)  p.set('client',  S.selClient);
  if (S.selGsc)     p.set('gsc',     S.selGsc);
  if (S.selGa4)     p.set('ga4',     S.selGa4);
  const uf = document.getElementById('url-filter')?.value.trim();
  if (uf)           p.set('url',     uf);
  if (S.selCountry) p.set('country', S.selCountry);
  if (S.datePreset) p.set('preset',  S.datePreset);
  else if (S.days !== 30) p.set('days', S.days);
  if (S.cmpMode !== 'both') p.set('cmp', S.cmpMode);
  if (S.page && S.page !== 'overview') p.set('page', S.page);
  const qs = p.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

function restoreUrlState() {
  const p = new URLSearchParams(location.search);
  const uf = p.get('url');       if (uf) { const el = document.getElementById('url-filter'); if (el) el.value = uf; }
  const days = p.get('days');    if (days && !p.get('preset')) { S.days = +days; document.querySelectorAll('.pill').forEach(pl => pl.classList.toggle('active', !pl.dataset.preset && +pl.dataset.d === S.days)); }
  const preset = p.get('preset'); if (preset) { S.datePreset = preset; document.querySelectorAll('.pill').forEach(pl => pl.classList.toggle('active', pl.dataset.preset === preset)); }
  const cmp = p.get('cmp');      if (cmp) { S.cmpMode = cmp; document.querySelectorAll('.cmp-btn').forEach(b => b.classList.toggle('active', b.dataset.cmp === cmp)); }
  const country = p.get('country'); if (country) S.selCountry = country;
  return p; // caller reads gsc / ga4 after properties load
}

// ── CONTEXT BADGE ──

export function updateCtxBadge() {
  const seg  = document.getElementById('url-filter')?.value.trim();
  const cty  = S.selCountry ? document.getElementById('country-in')?.value : '';
  const segEl = document.getElementById('ctx-seg');
  const dateEl = document.getElementById('ctx-date');
  if (!segEl || !dateEl) return;

  segEl.textContent = seg || 'Sitewide';

  if (S.datePreset === 'lastMonth')        dateEl.textContent = 'Last mo';
  else if (S.datePreset === 'lastQuarter') dateEl.textContent = 'Last qtr';
  else if (S.days === 7)                   dateEl.textContent = '7d';
  else if (S.days === 28)                  dateEl.textContent = '28d';
  else if (S.days === 90)                  dateEl.textContent = '3m';
  else if (S.days === 180)                 dateEl.textContent = '6m';
  else if (S.days === 365)                 dateEl.textContent = '12m';
  else                                     dateEl.textContent = S.days + 'd';

  const ctySpan = document.getElementById('ctx-country');
  if (ctySpan) ctySpan.textContent = cty ? ' · ' + cty : '';
}

// ── BOOT ──

async function boot() {
  S.clientId = CLIENT_ID;

  // restore brand terms
  const bt = localStorage.getItem('seo_brand');
  if (bt) document.getElementById('brand-terms').value = bt;

  // restore settings bar open state
  if (localStorage.getItem('seo_settings_open')) {
    document.getElementById('settings-bar')?.classList.add('open');
    document.getElementById('btn-settings')?.classList.add('active');
  }

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
  // restore URL state first (before loading props so filters are ready)
  const urlParams = restoreUrlState();
  // load saved custom segments
  try { S.segments = JSON.parse(localStorage.getItem('seo_segments')||'[]'); } catch{}
  renderSegments();
  renderCountryOpts('');
  // sync comparison toggle to match restored state
  document.querySelectorAll('.cmp-btn').forEach(b => b.classList.toggle('active', b.dataset.cmp === S.cmpMode));
  await Promise.all([loadGscProps(), loadGa4Props()]);
  // restore clients from localStorage
  try { S.clients = JSON.parse(localStorage.getItem('seo_clients') || '[]'); } catch{}
  renderClientOpts('');
  // apply client: URL param → last-used → auto if only one
  const clientParam = urlParams.get('client');
  let clientToApply = S.clients.find(c => c.id === clientParam)
    || S.clients.find(c => c.id === localStorage.getItem('seo_last_client'))
    || (S.clients.length === 1 ? S.clients[0] : null);
  if (clientToApply) {
    _applyClient(clientToApply);
  } else {
    // fallback: restore individual gsc/ga4 from URL params
    const gscParam = urlParams.get('gsc');
    const ga4Param = urlParams.get('ga4');
    if (gscParam && S.gscSites.some(s => s.siteUrl === gscParam)) {
      S.selGsc = gscParam;
      const gi = document.getElementById('gsc-in'); if (gi) gi.value = gscParam.replace(/^sc-domain:/,'').replace(/\/$/,'');
    }
    if (ga4Param && S.ga4Props.some(p => p.id === ga4Param)) {
      S.selGa4 = ga4Param;
      const prop = S.ga4Props.find(p => p.id === ga4Param);
      const ai = document.getElementById('ga4-in'); if (ai) ai.value = prop?.name || ga4Param;
    }
  }
  // restore country label
  const ctyParam = urlParams.get('country');
  if (ctyParam) {
    const { COUNTRIES } = await import('./config.js');
    const c = COUNTRIES.find(c => c.code === ctyParam);
    if (c) document.getElementById('country-in').value = c.label;
  }
  updateCtxBadge();
  // restore column visibility
  try { S.hideCols = JSON.parse(localStorage.getItem('seo_hidecols') || '{}'); } catch{}
  applyColVisibility();
  // restore page navigation
  const pageParam = urlParams.get('page');
  const validPages = ['overview','keywords','rank','pages','cannibal','insights','explorer'];
  const startPage  = validPages.includes(pageParam) ? pageParam : 'overview';
  // keywords & explorer live on overview — boot on overview, then scroll after load
  if (startPage === 'keywords' || startPage === 'explorer') {
    window._navTo('overview', true);
  } else {
    window._navTo(startPage, true);
  }
  loadAll();
}

// close floating dropdowns when clicking outside
document.addEventListener('click', e => {
  // col-menu
  const menu = document.getElementById('col-menu');
  const btn  = document.getElementById('btn-cols');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== btn) {
    menu.classList.remove('open');
    btn?.classList.remove('active');
  }
  // client dropdown
  const cdrop = document.getElementById('client-drop');
  const cbtn  = document.getElementById('client-btn');
  if (cdrop && cdrop.classList.contains('open') && !cdrop.contains(e.target) && e.target !== cbtn) {
    cdrop.classList.remove('open');
    cbtn?.classList.remove('active');
  }
});

// boot immediately
boot();
