// ── charts.js ── Chart.js config ──

import { S } from './state.js';

export function buildCharts(curR, popR, yoyR) {
  destroyCharts();
  const toMap = rows => { const m={}; rows.forEach(r=>m[r.keys[0]]=r); return m; };
  const dates  = curR.map(r=>r.keys[0]).sort();
  const pMap   = toMap(popR), yMap=toMap(yoyR);
  const labels = dates.map(d => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));

  function shiftD(d,n) { const dt=new Date(d+'T00:00:00'); dt.setDate(dt.getDate()-n); return dt.toISOString().split('T')[0]; }
  function shiftY(d)   { const dt=new Date(d+'T00:00:00'); dt.setFullYear(dt.getFullYear()-1); return dt.toISOString().split('T')[0]; }

  // always show all 3 lines
  const cDs = [
    { label:'Current period',  data:dates.map(d=>curR.find(r=>r.keys[0]===d)?.clicks||0),            borderColor:'#7c6dfa', backgroundColor:'rgba(124,109,250,0.08)', fill:true,  borderWidth:2.5, pointRadius:0, tension:.4 },
    { label:'Previous period', data:dates.map(d=>pMap[shiftD(d,S.days)]?.clicks||0),                  borderColor:'#5b9cf6', backgroundColor:'transparent',             fill:false, borderWidth:1.5, borderDash:[5,3], pointRadius:0, tension:.4 },
    { label:'Previous year',   data:dates.map(d=>yMap[shiftY(d)]?.clicks||0),                         borderColor:'#f06070', backgroundColor:'transparent',             fill:false, borderWidth:1.5, borderDash:[2,4], pointRadius:0, tension:.4 },
  ];
  const pDs = [
    { label:'Current period',  data:dates.map(d=>curR.find(r=>r.keys[0]===d)?.position?.toFixed(1)||null), borderColor:'#f5a623', backgroundColor:'rgba(245,166,35,0.06)', fill:true,  borderWidth:2.5, pointRadius:0, tension:.4 },
    { label:'Previous period', data:dates.map(d=>pMap[shiftD(d,S.days)]?.position?.toFixed(1)||null),       borderColor:'#5b9cf6', backgroundColor:'transparent',            fill:false, borderWidth:1.5, borderDash:[5,3], pointRadius:0, tension:.4 },
    { label:'Previous year',   data:dates.map(d=>yMap[shiftY(d)]?.position?.toFixed(1)||null),              borderColor:'#f06070', backgroundColor:'transparent',            fill:false, borderWidth:1.5, borderDash:[2,4], pointRadius:0, tension:.4 },
  ];

  S.clicksChart = new Chart(document.getElementById('clicks-chart'), { type:'line', data:{labels,datasets:cDs}, options:opts(false) });
  S.posChart    = new Chart(document.getElementById('pos-chart'),    { type:'line', data:{labels,datasets:pDs}, options:opts(true)  });
  legend('cl-legend', cDs);
  legend('pos-legend', pDs);
}

export function destroyCharts() {
  if (S.clicksChart) { S.clicksChart.destroy(); S.clicksChart=null; }
  if (S.posChart)    { S.posChart.destroy();    S.posChart=null; }
}

function opts(inv) {
  return {
    responsive:true, maintainAspectRatio:true,
    plugins:{
      legend:{display:false},
      tooltip:{mode:'index',intersect:false,backgroundColor:'rgba(26,26,36,.97)',borderColor:'rgba(255,255,255,.1)',borderWidth:1,titleColor:'#9090a8',bodyColor:'#e8e8f0',titleFont:{family:'Inter',size:10},bodyFont:{family:'Inter',size:11},padding:10},
    },
    scales:{
      x:{grid:{color:'rgba(255,255,255,.04)',drawBorder:false},ticks:{color:'#55556a',font:{family:'Inter',size:9},maxTicksLimit:8}},
      y:{reverse:inv,grid:{color:'rgba(255,255,255,.04)',drawBorder:false},ticks:{color:'#55556a',font:{family:'Inter',size:9},maxTicksLimit:5}},
    },
    interaction:{mode:'index',intersect:false},
  };
}

function legend(id, datasets) {
  document.getElementById(id).innerHTML = datasets.map(d =>
    `<div class="leg-i"><div class="leg-dot" style="background:${d.borderColor}"></div>${d.label}</div>`
  ).join('');
}
