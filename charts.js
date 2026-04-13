// ─────────────────────────────────────────────
//  charts.js  –  Chart.js configuration
//  To change chart colours, styles, or add a
//  new chart: edit this file only.
// ─────────────────────────────────────────────

import { S } from './state.js';

export function buildCharts(curR, popR, yoyR) {
  const toMap  = rows => { const m = {}; rows.forEach(r => m[r.keys[0]] = r); return m; };
  const dates  = curR.map(r => r.keys[0]).sort();
  const pMap   = toMap(popR), yMap = toMap(yoyR);
  const labels = dates.map(d => d.slice(5));
  const showP  = S.cmpMode === 'pop'  || S.cmpMode === 'both';
  const showY  = S.cmpMode === 'yoy'  || S.cmpMode === 'both';

  destroyCharts();

  // ── Clicks chart ──
  const cDs = [{
    label: 'Current period',
    data: dates.map(d => curR.find(r => r.keys[0] === d)?.clicks || 0),
    borderColor: '#7c6dfa', backgroundColor: 'rgba(124,109,250,0.08)',
    fill: true, borderWidth: 2.5, pointRadius: 0, tension: .4,
  }];
  if (showP) cDs.push({
    label: 'Previous period',
    data: dates.map(d => pMap[shiftDate(d, S.days)]?.clicks || 0),
    borderColor: '#5b9cf6', backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: [5, 3], pointRadius: 0, tension: .4,
  });
  if (showY) cDs.push({
    label: 'Previous year',
    data: dates.map(d => yMap[shiftYear(d, -1)]?.clicks || 0),
    borderColor: '#f06070', backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: [2, 4], pointRadius: 0, tension: .4,
  });
  S.clicksChart = new Chart(document.getElementById('clicks-chart'), {
    type: 'line', data: { labels, datasets: cDs }, options: chartOpts(false),
  });
  renderLegend('cl-legend', cDs);

  // ── Position chart ──
  const pDs = [{
    label: 'Current period',
    data: dates.map(d => curR.find(r => r.keys[0] === d)?.position?.toFixed(1) || null),
    borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.06)',
    fill: true, borderWidth: 2.5, pointRadius: 0, tension: .4,
  }];
  if (showP) pDs.push({
    label: 'Previous period',
    data: dates.map(d => pMap[shiftDate(d, S.days)]?.position?.toFixed(1) || null),
    borderColor: '#5b9cf6', backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: [5, 3], pointRadius: 0, tension: .4,
  });
  if (showY) pDs.push({
    label: 'Previous year',
    data: dates.map(d => yMap[shiftYear(d, -1)]?.position?.toFixed(1) || null),
    borderColor: '#f06070', backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: [2, 4], pointRadius: 0, tension: .4,
  });
  S.posChart = new Chart(document.getElementById('pos-chart'), {
    type: 'line', data: { labels, datasets: pDs }, options: chartOpts(true),
  });
  renderLegend('pos-legend', pDs);
}

export function destroyCharts() {
  if (S.clicksChart) { S.clicksChart.destroy(); S.clicksChart = null; }
  if (S.posChart)    { S.posChart.destroy();    S.posChart    = null; }
}

function chartOpts(invertY) {
  return {
    responsive: true, maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index', intersect: false,
        backgroundColor: 'rgba(26,26,36,.97)',
        borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
        titleColor: '#9090a8', bodyColor: '#e8e8f0',
        titleFont: { family: 'Inter', size: 10 },
        bodyFont: { family: 'Inter', size: 11 }, padding: 10,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,.04)', drawBorder: false }, ticks: { color: '#55556a', font: { family: 'Inter', size: 9 }, maxTicksLimit: 8 } },
      y: { reverse: invertY, grid: { color: 'rgba(255,255,255,.04)', drawBorder: false }, ticks: { color: '#55556a', font: { family: 'Inter', size: 9 }, maxTicksLimit: 5 } },
    },
    interaction: { mode: 'index', intersect: false },
  };
}

function renderLegend(id, datasets) {
  document.getElementById(id).innerHTML = datasets.map(d =>
    `<div class="leg-i"><div class="leg-dot" style="background:${d.borderColor}"></div>${d.label}</div>`
  ).join('');
}

function shiftDate(d, days) { const dt = new Date(d); dt.setDate(dt.getDate() - days); return dt.toISOString().split('T')[0]; }
function shiftYear(d, y)    { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + y); return dt.toISOString().split('T')[0]; }
