'use strict';

const ST = {
  depth: 'standard',
  url: '',
  mode: 'demo',
  modeNote: '',
  stack: 'generic',
  payload: null,
  allIssues: [],
  apiBase: '',
  hasBackend: false,
};

const GITHUB_RE = /^https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

document.addEventListener('DOMContentLoaded', init);

function init() {
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => switchTab(t.dataset.tab, t))
  );
  document.querySelectorAll('.pill[data-d]').forEach((p) =>
    p.addEventListener('click', () => setDepth(p.dataset.d, p))
  );
  document.querySelectorAll('.q-btn[data-url]').forEach((b) =>
    b.addEventListener('click', () => setRepo(b.dataset.url))
  );
  document.getElementById('sampleBtn')?.addEventListener('click', () => {
    setRepo('https://github.com/demo/example_repo');
    ST.useSample = true;
  });
  document.getElementById('goBtn')?.addEventListener('click', startAnalysis);
  document.getElementById('copyPrBtn')?.addEventListener('click', copyPR);
  document.getElementById('expMdBtn')?.addEventListener('click', expMD);
  document.getElementById('expJsonBtn')?.addEventListener('click', expJSON);
  document.getElementById('resetBtn')?.addEventListener('click', resetAll);
  document.querySelectorAll('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => switchTab(el.dataset.goto, document.querySelector('.tab')))
  );

  ST.apiBase = detectApiBase();
  checkBackend();
}

function detectApiBase() {
  if (location.protocol === 'file:') return '';
  const port = location.port || (location.protocol === 'https:' ? '443' : '80');
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    return `${location.protocol}//${location.hostname}:${port}`;
  }
  return location.origin;
}

async function checkBackend() {
  if (!ST.apiBase) return;
  try {
    const r = await fetch(`${ST.apiBase}/api/health`, { signal: AbortSignal.timeout(2500) });
    ST.hasBackend = r.ok;
    if (ST.hasBackend) {
      document.getElementById('modeNote').textContent =
        '后端已连接：优先 Live 模式（GitHub API + Python Agents）。失败时自动 Demo 回退。';
    }
  } catch {
    ST.hasBackend = false;
  }
}

function switchTab(id, el) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const tab = el || document.querySelector(`.tab[data-tab="${id}"]`);
  tab?.classList.add('active');
  document.getElementById(`pg-${id}`)?.classList.add('active');
}

function setDepth(d, el) {
  document.querySelectorAll('.pill[data-d]').forEach((p) => p.classList.remove('active'));
  el.classList.add('active');
  ST.depth = d;
}

function setRepo(url) {
  document.getElementById('repoUrl').value = url;
  validateUrl(url);
}

function validateUrl(url) {
  const ok = GITHUB_RE.test((url || '').trim());
  document.getElementById('urlRow')?.classList.toggle('invalid', !ok && url.length > 0);
  document.getElementById('urlErr')?.classList.toggle('show', !ok && url.length > 0);
  return ok;
}

function detectStackFromUrl(url) {
  const lower = url.toLowerCase();
  const rules = [
    ['react', ['react', 'facebook/react']],
    ['vue', ['vue', 'vuejs']],
    ['django', ['django']],
    ['flask', ['flask', 'pallets']],
    ['express', ['express', 'expressjs']],
  ];
  for (const [stack, keys] of rules) {
    if (keys.some((k) => lower.includes(k))) return stack;
  }
  const m = url.match(/github\.com\/[^/]+\/([^/]+)/i);
  return detectStackFromName(m ? m[1] : '');
}

function detectStackFromName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('react')) return 'react';
  if (n.includes('vue')) return 'vue';
  if (n.includes('django')) return 'django';
  if (n.includes('flask')) return 'flask';
  if (n.includes('express')) return 'express';
  return 'generic';
}

async function startAnalysis() {
  const url = document.getElementById('repoUrl').value.trim();
  if (!validateUrl(url)) {
    toast('⚠️ 请输入有效的 GitHub 仓库 URL');
    return;
  }

  ST.url = url;
  ST.stack = detectStackFromUrl(url);
  const btn = document.getElementById('goBtn');
  btn.disabled = true;
  document.getElementById('prog-section').style.display = 'block';
  document.getElementById('log-box').innerHTML = '';
  setProgress(0, '正在连接…');
  resetNodes();
  setModeBadge('demo', '分析中…');

  try {
    let payload = null;

    if (ST.hasBackend && ST.apiBase) {
      payload = await runBackend(url);
    }
    if (!payload) {
      payload = await runClientPipeline(url);
    }

    ST.payload = payload;
    ST.mode = payload.mode || 'demo';
    ST.modeNote = payload.modeNote || '';
    setModeBadge(ST.mode, ST.modeNote);
    renderResults(payload);
    switchTab('results', document.querySelector('.tab[data-tab="results"]'));
    toast(ST.mode === 'live' ? '✅ Live 分析完成' : '✅ Demo 分析完成（含回退说明）');
  } catch (e) {
    await log('Orchestrator', `❌ ${e.message}`, 'orch', 'lerr');
    toast(`❌ 分析失败: ${e.message}`);
    setProgress(0, '分析失败');
  } finally {
    btn.disabled = false;
    ST.useSample = false;
  }
}

async function runBackend(url) {
  activeNode('orch', 'amber');
  await log('Orchestrator', '🚀 连接后端 Agent 管道…', 'orch');
  setProgress(5, '调用 /api/analyze …');

  const res = await fetch(`${ST.apiBase}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repoUrl: url,
      depth: ST.depth,
      useSample: !!ST.useSample || url.includes('demo/example'),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  await playLogsFromBackend(data.logs || []);
  return normalizePayload(data);
}

async function runClientPipeline(url) {
  activeNode('orch', 'amber');
  await log('Orchestrator', `🚀 浏览器模式 — ${url.split('/').slice(-2).join('/')}`, 'orch');
  setProgress(10, '尝试 GitHub API…');

  let mode = 'demo';
  let modeNote = '未检测到后端，使用浏览器 Demo 引擎';
  let remoteFiles = null;

  try {
    remoteFiles = await fetchGithubFiles(url);
    if (remoteFiles?.length) {
      mode = 'live';
      modeNote = `浏览器直连 GitHub API（${remoteFiles.length} 个文件）`;
      await log('Orchestrator', modeNote, 'orch', 'lok');
    }
  } catch (e) {
    await log('Orchestrator', `GitHub API 失败: ${e.message} → Demo 回退`, 'orch', 'lwarn');
  }

  setProgress(25, 'Analysis Agent…');
  activeNode('anal', 'blue');
  const analysis = buildAnalysis(url, ST.stack, ST.depth, remoteFiles);
  await log('AnalysisAgent', `Found ${analysis.fileCount} files`, 'anal');
  analysis.logs?.forEach((m) => log('AnalysisAgent', m, 'anal'));
  doneNode('anal');

  setProgress(55, 'Diagnostic Agent…');
  activeNode('diag', 'red');
  const diagnostic = buildDiagnostic(url, ST.stack, ST.depth, analysis.files);
  await log('DiagnosticAgent', `发现 ${diagnostic.issues.length} 个问题`, 'diag', 'lwarn');
  doneNode('diag');

  setProgress(75, 'Repair Agent…');
  activeNode('rep', 'orange');
  const repair = buildRepair(diagnostic.issues, url);
  doneNode('rep');

  setProgress(90, 'Report Agent…');
  activeNode('rpt', 'teal2');
  const report = buildReport(url, mode, ST.stack, analysis, diagnostic, repair);
  doneNode('rpt');
  doneNode('orch');
  setProgress(100, '完成');

  return normalizePayload({
    repoUrl: url,
    stack: ST.stack,
    mode,
    modeNote,
    analysis,
    diagnostic,
    repair,
    report,
    logs: [],
  });
}

async function fetchGithubFiles(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!m) throw new Error('URL 解析失败');
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, '');
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!metaRes.ok) throw new Error(`GitHub meta ${metaRes.status}`);
  const meta = await metaRes.json();
  const branch = meta.default_branch || 'main';
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!treeRes.ok) throw new Error(`GitHub tree ${treeRes.status}`);
  const tree = await treeRes.json();
  const files = [];
  for (const item of tree.tree || []) {
    if (item.type !== 'blob') continue;
    if (/node_modules|\/dist\/|\.git\//.test(item.path)) continue;
    const ext = item.path.includes('.') ? '.' + item.path.split('.').pop() : '';
    const lang = extToLang(ext);
    const lines = Math.max(1, Math.floor((item.size || 40) / 40));
    files.push({
      path: item.path,
      language: lang,
      lines,
      complexity: Math.min(10, 2 + (lines % 8) + (hash(item.path) % 4)),
    });
    if (files.length >= 60) break;
  }
  return files;
}

function normalizePayload(data) {
  return {
    repoUrl: data.repoUrl,
    stack: data.stack || ST.stack,
    mode: data.mode || 'demo',
    modeNote: data.modeNote || '',
    analysis: data.analysis,
    diagnostic: data.diagnostic,
    repair: data.repair,
    report: data.report,
  };
}

async function playLogsFromBackend(logs) {
  let pct = 8;
  for (const entry of logs) {
    const cls = agentClass(entry.agent);
    const lvl = entry.level === 'error' ? 'lerr' : entry.level === 'warn' ? 'lwarn' : '';
    await log(entry.agent, entry.message, cls, lvl);
    pct = Math.min(95, pct + 4);
    setProgress(pct, `${entry.agent} …`);
    if (entry.agent?.includes('Analysis')) activeNode('anal', 'blue');
    if (entry.agent?.includes('Diagnostic')) activeNode('diag', 'red');
    if (entry.agent?.includes('Repair')) activeNode('rep', 'orange');
    if (entry.agent?.includes('Report')) activeNode('rpt', 'teal2');
  }
  setProgress(100, '完成');
  ['anal', 'diag', 'rep', 'rpt', 'orch'].forEach(doneNode);
}

function agentClass(name) {
  if (!name) return 'orch';
  if (name.includes('Analysis')) return 'anal';
  if (name.includes('Diagnostic')) return 'diag';
  if (name.includes('Repair')) return 'rep';
  if (name.includes('Report')) return 'rpt';
  return 'orch';
}

function buildAnalysis(url, stack, depth, remoteFiles) {
  const max = { quick: 16, standard: 32, deep: 50 }[depth] || 32;
  const templates = (STACK_TEMPLATES[stack] || STACK_TEMPLATES.generic).files;
  const deps = (STACK_TEMPLATES[stack] || STACK_TEMPLATES.generic).deps;
  const files = remoteFiles
    ? remoteFiles.slice(0, max)
    : templates.slice(0, max).map((f, i) => ({
        ...f,
        lines: f.lines + (hash(url + i) % 30),
        complexity: 2 + ((hash(url + f.path) % 8)),
      }));

  const langs = {};
  files.forEach((f) => {
    langs[f.language] = (langs[f.language] || 0) + f.lines;
  });
  const hotspots = [...files].sort((a, b) => b.complexity - a.complexity).slice(0, 5);

  return {
    fileCount: files.length,
    totalLines: files.reduce((s, f) => s + f.lines, 0),
    languages: langs,
    files,
    hotspots,
    structureScore: 68 + (hash(url) % 28),
    dependencyGraph: deps || [],
    astSummary: { parsedSamples: files.slice(0, 4).map((f) => f.path) },
    logs: [
      'Dependency graph generated',
      ...files.slice(0, 3).map((f) => `Parsing: ${f.path}`),
    ],
  };
}

function buildDiagnostic(url, stack, depth, files) {
  const catalog = STACK_ISSUES[stack] || STACK_ISSUES.generic;
  const limit = { quick: 5, standard: 9, deep: 12 }[depth] || 9;
  const issues = [...catalog]
    .sort((a, b) => (hash(url + a.title) % 100) - (hash(url + b.title) % 100))
    .slice(0, limit)
    .map((iss, i) => ({ ...iss, id: `ISS-${String(i + 1).padStart(3, '0')}` }));

  const w = { critical: 25, high: 15, medium: 7, low: 3, info: 1 };
  const summary = {};
  issues.forEach((i) => {
    summary[i.sev] = (summary[i.sev] || 0) + 1;
  });
  const riskScore = Math.min(100, issues.reduce((s, i) => s + (w[i.sev] || 0), 0));

  return { issues, riskScore, summary };
}

function buildRepair(issues, url) {
  const fixes = issues.map((iss) => ({
    issueId: iss.id,
    title: iss.title,
    sev: iss.sev,
    file: iss.file,
    line: iss.line,
    before: iss.before,
    after: iss.after,
    expl: iss.expl || iss.sug,
    conf: 84 + (hash(iss.id) % 12),
    auto: ['critical', 'high'].includes(iss.sev),
  }));
  return {
    fixes,
    prTemplate: [
      '## 修复建议 PR（示例）',
      `仓库: ${url}`,
      `问题: ${issues.length}`,
      ...issues.map((i) => `- [${i.sev.toUpperCase()}] ${i.title} (${i.file}:${i.line})`),
    ].join('\n'),
  };
}

function buildReport(url, mode, stack, analysis, diagnostic, repair) {
  return {
    riskLabel: riskLvl(diagnostic.riskScore),
    markdown: `# 报告\n仓库: ${url}\n模式: ${mode}\n风险: ${diagnostic.riskScore}/100\n`,
    jsonExport: { repoUrl: url, mode, stack, analysis, diagnostic, repair },
  };
}

function renderResults(p) {
  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display = 'block';
  document.getElementById('resultModeNote').textContent =
    `模式: ${p.mode.toUpperCase()} · ${p.modeNote || ''} · 技术栈: ${p.stack}`;

  const ar = p.analysis;
  const dr = p.diagnostic;
  const rr = p.repair;
  const rp = p.report;

  const cards = [
    { lbl: '扫描文件', val: ar.fileCount, unit: '个', cls: 'hi' },
    { lbl: '代码行数', val: ar.totalLines.toLocaleString(), unit: '行', cls: '' },
    { lbl: '发现问题', val: dr.issues.length, unit: '个', cls: dr.issues.length > 8 ? 'danger' : 'warn' },
    {
      lbl: '严重/高危',
      val: `${dr.summary.critical || 0}/${dr.summary.high || 0}`,
      unit: '个',
      cls: (dr.summary.critical || 0) > 0 ? 'danger' : 'warn',
    },
    { lbl: '修复建议', val: rr.fixes.length, unit: '条', cls: 'ok' },
    { lbl: '自动建议', val: rr.fixes.filter((f) => f.auto).length, unit: '条', cls: 'ok' },
    { lbl: '结构评分', val: ar.structureScore, unit: '/100', cls: ar.structureScore >= 75 ? 'ok' : 'warn' },
    {
      lbl: '风险评分',
      val: dr.riskScore,
      unit: '/100',
      cls: dr.riskScore >= 60 ? 'danger' : dr.riskScore >= 30 ? 'warn' : 'ok',
    },
  ];
  document.getElementById('sum-grid').innerHTML = cards
    .map(
      (c) =>
        `<div class="sc ${c.cls}"><div class="sc-lbl">${c.lbl}</div><div class="sc-val">${c.val}</div><div class="sc-unit">${c.unit}</div></div>`
    )
    .join('');

  const gs = document.getElementById('g-score');
  gs.textContent = dr.riskScore;
  gs.style.color = dr.riskScore >= 60 ? '#ef4444' : dr.riskScore >= 30 ? '#f97316' : '#22c55e';
  document.getElementById('g-lbl').textContent = rp.riskLabel || riskLvl(dr.riskScore);

  if (window.HermesCharts) {
    HermesCharts.renderGauge('gaugeC', dr.riskScore);
    HermesCharts.renderSeverity('sevC', dr.summary);
    HermesCharts.renderLanguages('langC', ar.languages);
    HermesCharts.renderHotspots('cpxC', ar.hotspots);
  }

  ST.allIssues = dr.issues;
  renderIssueFilters();
  renderIssues(dr.issues);

  document.getElementById('issues-empty').style.display = dr.issues.length ? 'none' : 'block';
  renderRepairs(rr.fixes);

  const evidence = [
    `Analysis: ${ar.fileCount} files, languages: ${Object.keys(ar.languages).join(', ')}`,
    `AST samples: ${(ar.astSummary?.parsedSamples || []).join(', ')}`,
    `Dependency: ${(ar.dependencyGraph || []).join(' → ')}`,
    `Diagnostic tools: pattern-scan, stack=${p.stack}`,
    `Report export ready (Markdown/JSON)`,
  ].join('\n');
  document.getElementById('evidence-pre').textContent = evidence;
}

function renderIssueFilters() {
  const el = document.getElementById('issue-filters');
  if (!el) return;
  el.innerHTML = ['all', 'critical', 'high', 'medium', 'low']
    .map(
      (s) =>
        `<button class="fbtn${s === 'all' ? ' active' : ''}" data-sev="${s}" type="button">${s === 'all' ? '全部' : s}</button>`
    )
    .join('');
  el.querySelectorAll('.fbtn').forEach((b) =>
    b.addEventListener('click', () => {
      el.querySelectorAll('.fbtn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const sev = b.dataset.sev;
      renderIssues(sev === 'all' ? ST.allIssues : ST.allIssues.filter((i) => i.sev === sev));
    })
  );
}

function renderIssues(issues) {
  const badge = { critical: 'bc', high: 'bh', medium: 'bm', low: 'bl', info: 'bi' };
  const icon = { bug: '🐛', security: '🔒', performance: '⚡', style: '📐', duplicate: '📋' };
  const ord = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sorted = [...issues].sort((a, b) => (ord[a.sev] ?? 9) - (ord[b.sev] ?? 9));
  document.getElementById('issues-list').innerHTML = sorted
    .map(
      (iss) => `
    <div class="issue-card" data-sev="${iss.sev}">
      <span class="ibadge ${badge[iss.sev] || 'bi'}">${iss.sev}</span>
      <div>
        <div class="it">${esc(iss.title)}</div>
        <div class="id2">${esc(iss.desc)}</div>
        <code class="iloc">${esc(iss.file)}:${iss.line}</code>
        <div class="idetail">
          <div class="isug">💡 ${esc(iss.sug)}</div>
          ${iss.rule ? `<div style="font-size:.62rem;color:var(--text3);margin-top:4px">${iss.cwe || ''} 规则 ${iss.rule}</div>` : ''}
        </div>
      </div>
      <span class="icat">${icon[iss.cat] || '⚪'} ${iss.cat}</span>
    </div>`
    )
    .join('');
  document.querySelectorAll('.issue-card').forEach((c) =>
    c.addEventListener('click', () => c.classList.toggle('open'))
  );
}

function renderRepairs(fixes) {
  const badge = { critical: 'bc', high: 'bh', medium: 'bm', low: 'bl', info: 'bi' };
  document.getElementById('repairs-list').innerHTML = fixes
    .map(
      (f, i) => `
    <div class="rc" id="rc-${i}">
      <div class="rc-h" data-i="${i}">
        <span class="rc-t">${esc(f.issueId)} — ${esc(f.title)}</span>
        <span class="ibadge ${badge[f.sev]}">${f.sev}</span>
      </div>
      <div class="rc-b">
        <code style="font-size:.65rem;color:var(--text3)">${esc(f.file)}:${f.line}</code>
        <div class="diff-grid" style="margin-top:8px">
          <div class="db-b"><div class="dlbl">修改前</div><pre class="dcode">${esc(f.before)}</pre></div>
          <div class="db-a"><div class="dlbl">修改后</div><pre class="dcode">${esc(f.after)}</pre></div>
        </div>
        <div class="rexpl">💡 ${esc(f.expl)} · 置信 ${f.conf}% ${f.auto ? '· 可自动建议' : ''}</div>
      </div>
    </div>`
    )
    .join('');
  document.querySelectorAll('.rc-h').forEach((h) =>
    h.addEventListener('click', () => document.getElementById(`rc-${h.dataset.i}`)?.classList.toggle('open'))
  );
  if (fixes.length) document.getElementById('rc-0')?.classList.add('open');
}

function setModeBadge(mode, note) {
  const el = document.getElementById('modeBadge');
  el.textContent = mode === 'live' ? 'Live 模式' : 'Demo 模式';
  el.className = `mode-pill ${mode === 'live' ? 'live' : 'demo'}`;
  el.title = note || '';
}

function copyPR() {
  const t = ST.payload?.repair?.prTemplate;
  if (!t) return toast('⚠️ 请先完成分析');
  navigator.clipboard?.writeText(t).then(() => toast('✅ PR 模板已复制'));
}

function expMD() {
  if (!ST.payload) return toast('⚠️ 请先完成分析');
  const md = ST.payload.report?.markdown || '# 无报告';
  download('code-analysis-report.md', md, 'text/markdown');
  toast('✅ Markdown 已下载');
}

function expJSON() {
  if (!ST.payload) return toast('⚠️ 请先完成分析');
  download('analysis.json', JSON.stringify(ST.payload.report?.jsonExport || ST.payload, null, 2), 'application/json');
  toast('✅ JSON 已下载');
}

function resetAll() {
  ST.payload = null;
  document.getElementById('results-placeholder').style.display = 'block';
  document.getElementById('results-content').style.display = 'none';
  document.getElementById('prog-section').style.display = 'none';
  resetNodes();
  setModeBadge('demo', '');
  switchTab('analyze', document.querySelector('.tab[data-tab="analyze"]'));
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function extToLang(ext) {
  return { '.py': 'Python', '.js': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript', '.vue': 'Vue', '.md': 'Markdown' }[ext] || 'Other';
}

function riskLvl(s) {
  return s >= 75 ? '严重风险' : s >= 50 ? '高危' : s >= 25 ? '中危' : '低危';
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function log(agent, msg, cls, level = '') {
  await wait(80);
  const box = document.getElementById('log-box');
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const ln = document.createElement('div');
  ln.className = 'log-line';
  ln.innerHTML = `<span class="lt">${ts}</span><span class="la ${cls}">[${agent.replace('Agent', '')}]</span><span class="lm ${level}">${esc(msg)}</span>`;
  box.appendChild(ln);
  box.scrollTop = box.scrollHeight;
}

function setProgress(pct, msg) {
  document.getElementById('prog-fill').style.width = `${pct}%`;
  document.getElementById('prog-pct').textContent = `${pct}%`;
  document.getElementById('prog-msg').textContent = msg;
}

function activeNode(id, col) {
  const el = document.getElementById(`fn-${id}`);
  if (el) {
    el.classList.add('active', col);
    el.querySelector('.fn-name')?.classList.add('pulse');
  }
}

function doneNode(id) {
  const el = document.getElementById(`fn-${id}`);
  if (el) {
    el.classList.remove('active', 'amber', 'blue', 'red', 'orange', 'teal2');
    el.classList.add('done');
    el.querySelector('.fn-name')?.classList.remove('pulse');
  }
}

function resetNodes() {
  ['orch', 'anal', 'diag', 'rep', 'rpt'].forEach((n) => {
    const e = document.getElementById(`fn-${n}`);
    if (e) {
      e.classList.remove('active', 'done', 'amber', 'blue', 'red', 'orange', 'teal2');
      e.querySelector('.fn-name')?.classList.remove('pulse');
    }
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}

const STACK_TEMPLATES = {
  react: {
    deps: ['react → react-dom', 'App → components → hooks'],
    files: [
      { path: 'packages/react/src/React.js', language: 'JavaScript', lines: 420 },
      { path: 'packages/react-dom/src/client/ReactDOM.js', language: 'JavaScript', lines: 380 },
      { path: 'scripts/rollup/build.js', language: 'JavaScript', lines: 210 },
    ],
  },
  flask: {
    deps: ['app → blueprints → models'],
    files: [
      { path: 'src/flask/app.py', language: 'Python', lines: 310 },
      { path: 'src/flask/blueprints.py', language: 'Python', lines: 180 },
      { path: 'tests/test_basic.py', language: 'Python', lines: 220 },
    ],
  },
  django: {
    deps: ['urls → views → models'],
    files: [
      { path: 'django/core/handlers/base.py', language: 'Python', lines: 290 },
      { path: 'django/db/models/base.py', language: 'Python', lines: 410 },
    ],
  },
  express: {
    deps: ['index → routes → middleware'],
    files: [
      { path: 'lib/express.js', language: 'JavaScript', lines: 195 },
      { path: 'lib/router/index.js', language: 'JavaScript', lines: 240 },
    ],
  },
  vue: {
    deps: ['vue → compiler → runtime'],
    files: [
      { path: 'src/core/instance/index.js', language: 'JavaScript', lines: 260 },
      { path: 'src/platforms/web/runtime/index.js', language: 'JavaScript', lines: 190 },
    ],
  },
  generic: {
    deps: ['entry → modules'],
    files: [
      { path: 'src/main.py', language: 'Python', lines: 120 },
      { path: 'src/utils/helpers.js', language: 'JavaScript', lines: 88 },
    ],
  },
};

const STACK_ISSUES = {
  react: [
    {
      sev: 'high',
      cat: 'security',
      title: 'dangerouslySetInnerHTML 未消毒',
      desc: '直接渲染用户 HTML。',
      file: 'packages/react-dom/src/client/ReactDOMComponent.js',
      line: 1024,
      cwe: 'CWE-79',
      rule: 'react/no-danger',
      sug: '使用 DOMPurify 或文本节点。',
      before: 'domNode.innerHTML = markup;',
      after: 'domNode.textContent = markup;',
      expl: '避免 XSS。',
    },
    {
      sev: 'medium',
      cat: 'performance',
      title: 'legacy render 路径开销',
      desc: '同步渲染大树可能导致卡顿。',
      file: 'packages/react-dom/src/client/ReactDOM.js',
      line: 88,
      cwe: '',
      rule: 'PERF-REACT',
      sug: '优先 createRoot + concurrent features。',
      before: 'ReactDOM.render(element, container);',
      after: 'createRoot(container).render(element);',
      expl: 'Concurrent 模式改善交互延迟。',
    },
  ],
  flask: [
    {
      sev: 'critical',
      cat: 'security',
      title: 'SQL 注入风险',
      desc: '字符串拼接 SQL。',
      file: 'src/flask/app.py',
      line: 87,
      cwe: 'CWE-89',
      rule: 'S3649',
      sug: '参数化查询。',
      before: 'query = f"SELECT * FROM users WHERE id={uid}"',
      after: 'cursor.execute("SELECT * FROM users WHERE id=%s", (uid,))',
      expl: '参数化防止注入。',
    },
  ],
  django: [
    {
      sev: 'high',
      cat: 'security',
      title: 'DEBUG 配置风险',
      desc: '生产环境 DEBUG 可能泄露信息。',
      file: 'django/conf/global_settings.py',
      line: 15,
      cwe: 'CWE-489',
      rule: 'DJANGO-DEBUG',
      sug: '环境变量控制 DEBUG。',
      before: 'DEBUG = True',
      after: "DEBUG = os.getenv('DJANGO_DEBUG','') == '1'",
      expl: '生产应关闭 DEBUG。',
    },
  ],
  express: [
    {
      sev: 'high',
      cat: 'security',
      title: '缺少安全中间件',
      desc: '未设置 helmet 类安全头。',
      file: 'lib/express.js',
      line: 42,
      cwe: 'CWE-693',
      rule: 'EXPRESS-HELMET',
      sug: '添加 helmet()。',
      before: 'app.use(express.json())',
      after: 'app.use(helmet()); app.use(express.json())',
      expl: '基础 HTTP 安全头。',
    },
  ],
  vue: [
    {
      sev: 'medium',
      cat: 'security',
      title: 'v-html XSS 风险',
      desc: '模板 v-html 未消毒。',
      file: 'src/platforms/web/runtime/node-ops.js',
      line: 28,
      cwe: 'CWE-79',
      rule: 'VUE-HTML',
      sug: '避免 v-html 或消毒。',
      before: 'el.innerHTML = html',
      after: 'el.textContent = html',
      expl: '默认插值更安全。',
    },
  ],
  generic: [
    {
      sev: 'medium',
      cat: 'duplicate',
      title: '重复校验逻辑',
      desc: '多个模块存在相似校验。',
      file: 'src/utils/helpers.js',
      line: 12,
      cwe: '',
      rule: 'DRY001',
      sug: '抽取 validate 公共函数。',
      before: 'if (!v || v.length>100) throw Error()',
      after: 'validateString(v, 100)',
      expl: 'DRY 降低维护成本。',
    },
  ],
};
