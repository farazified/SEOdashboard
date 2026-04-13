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
    label: 'Current', borderColor: '#5b4de8', backgroundColor: 'rgba(91,77,232,0.06)',
    data: dates.map(d => curR.find(r => r.keys[0] === d)?.clicks || 0),
    fill: true, borderWidth: 2, pointRadius: 0, tension: .35,
  }];
  if (showP) cDs.push({
    label: 'Prev period', borderColor: '#60a5fa', backgroundColor: 'transparent',
    data: dates.map(d => pMap[shiftDate(d, S.days)]?.clicks || 0),
    borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: .35,
  });
  if (showY) cDs.push({
    label: 'Year ago', borderColor: '#f87171', backgroundColor: 'transparent',
    data: dates.map(d => yMap[shiftYear(d, -1)]?.clicks || 0),
    borderWidth: 1.5, borderDash: [2, 4], pointRadius: 0, tension: .35,
  });
  S.clicksChart = new Chart(document.getElementById('clicks-chart'), {
    type: 'line', data: { labels, datasets: cDs }, options: chartOpts(false),
  });
  renderLegend('cl-legend', cDs);

  // ── Position chart ──
  const pDs = [{
    label: 'Current', borderColor: '#b45309', backgroundColor: 'rgba(180,83,9,0.05)',
    data: dates.map(d => curR.find(r => r.keys[0] === d)?.position?.toFixed(1) || null),
    fill: true, borderWidth: 2, pointRadius: 0, tension: .35,
  }];
  if (showP) pDs.push({
    label: 'Prev period', borderColor: '#60a5fa', backgroundColor: 'transparent',
    data: dates.map(d => pMap[shiftDate(d, S.days)]?.position?.toFixed(1) || null),
    borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: .35,
  });
  if (showY) pDs.push({
    label: 'Year ago', borderColor: '#f87171', backgroundColor: 'transparent',
    data: dates.map(d => yMap[shiftYear(d, -1)]?.position?.toFixed(1) || null),
    borderWidth: 1.5, borderDash: [2, 4], pointRadius: 0, tension: .35,
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
        backgroundColor: 'rgba(255,255,255,.98)', borderColor: 'rgba(0,0,0,.1)', borderWidth: 1,
        titleColor: '#5a5a72', bodyColor: '#1c1c2e',
        titleFont: { family: 'Inter', size: 10 }, bodyFont: { family: 'Inter', size: 11 }, padding: 10,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,.04)', drawBorder: false }, ticks: { color: '#9a9ab0', font: { family: 'Inter', size: 9 }, maxTicksLimit: 8 } },
      y: { reverse: invertY, grid: { color: 'rgba(0,0,0,.05)', drawBorder: false }, ticks: { color: '#9a9ab0', font: { family: 'Inter', size: 9 }, maxTicksLimit: 5 } },
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
