/**
 * Chart.js helpers for Hermes Code Helper report page.
 * Requires Chart.js loaded globally.
 */
(function (global) {
  'use strict';

  function destroy(id) {
    const existing = global.Chart && global.Chart.getChart(id);
    if (existing) existing.destroy();
  }

  function renderGauge(canvasId, score) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const cx = 110, cy = 100, r = 72;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = '#1e2330';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();
    const col = score >= 60 ? '#ef4444' : score >= 30 ? '#f97316' : '#22c55e';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + (score / 100) * Math.PI);
    ctx.strokeStyle = col;
    ctx.lineWidth = 12;
    ctx.stroke();
  }

  function renderSeverity(canvasId, summary) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || !global.Chart) return;
    const keys = ['critical', 'high', 'medium', 'low', 'info'];
    new global.Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
        datasets: [{
          data: keys.map((k) => summary[k] || 0),
          backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#60a5fa', '#9ca3b0'],
          borderRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, color: '#5d6478' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { ticks: { color: '#5d6478' }, grid: { display: false } },
        },
      },
    });
  }

  function renderLanguages(canvasId, langs) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || !global.Chart) return;
    const keys = Object.keys(langs).slice(0, 7);
    new global.Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: keys,
        datasets: [{
          data: keys.map((k) => langs[k]),
          backgroundColor: ['#7c6bea', '#2dd4aa', '#f97316', '#60a5fa', '#ef4444', '#f59e0b', '#22c55e'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#9ca3b0', font: { size: 10 }, boxWidth: 9 } } },
      },
    });
  }

  function renderHotspots(canvasId, hotspots) {
    destroy(canvasId);
    const el = document.getElementById(canvasId);
    if (!el || !global.Chart) return;
    const cols = (hotspots || []).map((h) =>
      h.complexity >= 8 ? '#ef4444' : h.complexity >= 6 ? '#f97316' : '#f59e0b'
    );
    new global.Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: (hotspots || []).map((h) => (h.path || '').split('/').pop()),
        datasets: [{ data: (hotspots || []).map((h) => h.complexity), backgroundColor: cols, borderRadius: 4 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 10, ticks: { color: '#5d6478', stepSize: 2 }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#5d6478', font: { size: 10 } }, grid: { display: false } },
        },
      },
    });
  }

  global.HermesCharts = { renderGauge, renderSeverity, renderLanguages, renderHotspots, destroy };
})(typeof window !== 'undefined' ? window : globalThis);
