# MultiAgent Hermes Code Helper

参考 **Hermes Agent** 任务流调度思路构建的**多 Agent 代码理解与修复助手**（可运行原型）。面向**零编程经验用户**：粘贴 GitHub 公开仓库链接，即可获得结构化分析报告、问题清单、示例修复 diff 与导出文件。

> **说明**：本项目为可交付演示原型，包含 **Live**（GitHub API + Python Agent 管道）与 **Demo**（`sample_repos` / 技术栈规则）双模式；**不声称**已接入完整 Bandit/ESLint/Semgrep 或自动合并 PR，相关能力标注为**可扩展 / 示例级**。

---

## 核心功能

| Agent | 职责 | 具体产出 |
|-------|------|----------|
| **Orchestrator** | 调度与模式选择 | 任务 ID、Live/Demo 标识、执行日志 |
| **Analysis** | 结构扫描 | 文件数、语言分布、复杂度热点、依赖图、AST 采样路径 |
| **Diagnostic** | 静态问题识别 | 严重度分级、CWE/规则 ID、问题清单 |
| **Repair** | 修复建议 | before/after diff、置信度、PR 模板（需人工审核） |
| **Report** | 汇总导出 | 风险分、Chart.js 图表、Markdown/JSON |

---

## 技术栈

- **前端**：HTML5、CSS3、Vanilla JavaScript、Chart.js
- **后端**：Python 3.10+（标准库 `http.server` + `urllib`）
- **可视化**：Chart.js（已实现）、Mermaid 定义见 `visual/diagrams.md`
- **AI / 工具链（规划可扩展）**：Claude/GPT API、OpenClaw/Aider 等可作为后续接入层

---

## 目录结构

```
multiagent-hermes-code-helper/
├── README.md
├── requirements.txt
├── start.py                   # 一键启动（前端 + API，端口 8765）
├── run_server.py              # 同上（别名）
├── sample_output.md
├── sample_output.json
├── .gitignore
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   ├── orchestrator.py
│   ├── analysis_agent.py
│   ├── diagnostic_agent.py
│   ├── repair_agent.py
│   └── report_agent.py
├── visual/
│   ├── charts.js
│   └── diagrams.md
├── sample_repos/
│   └── example_repo/
│       ├── file1.py
│       └── file2.js
├── utils/
│   └── helpers.py
├── demo/
│   └── example-report.html
└── screenshots/
    └── README.md
```

---

## 本地运行（推荐）

### 方式一：一键服务（Live + Demo）

```bash
cd multiagent-hermes-code-helper
python run_server.py
```

浏览器打开：**http://127.0.0.1:8080/**

- 右上角显示 **Live 模式**：后端成功调用 GitHub API 读取公开仓库
- 显示 **Demo 模式**：API 失败或离线时自动回退，并展示 `modeNote` 说明

### 方式二：仅静态预览（浏览器 Demo）

```bash
cd multiagent-hermes-code-helper/frontend
python -m http.server 5500
```

打开 http://127.0.0.1:5500/ — 无后端时将尝试浏览器直连 GitHub API，失败则使用技术栈规则 Demo。

### 方式三：命令行跑 Agent 管道

```bash
python backend/orchestrator.py https://github.com/pallets/flask standard
python backend/orchestrator.py https://github.com/demo/example_repo standard --sample
```

---

## 在线 Demo / GitHub Pages

1. 将仓库推送到 GitHub
2. **Settings → Pages → Source**：选择 `main` 分支，目录选 `/frontend` 或整仓后用 `run_server` 部署到 Render/Replit
3. 打开 `index.html`，使用示例仓库按钮体验

> GitHub Pages **纯静态**时仅为浏览器 Demo 模式；完整 Live 模式请在本地或云端运行 `python start.py`。

---

## 示例输入 / 输出

**输入**

```
https://github.com/pallets/flask
https://github.com/facebook/react
https://github.com/demo/example_repo  （本地 sample，需 run_server.py）
```

**输出**

- 页面：风险评分、严重度柱状图、语言环图、问题卡片、修复 diff
- 文件：[`sample_output.md`](sample_output.md)、[`sample_output.json`](sample_output.json)
- 快照：[`demo/example-report.html`](demo/example-report.html)

**交互流程**

1. 输入 GitHub URL → 选择分析深度 → 点击「开始分析」
2. 观察 Orchestrator 日志与各 Agent 节点高亮
3. 自动跳转「报告」页 → 筛选严重度 → 导出 MD/JSON → 复制 PR 模板

---

## GitHub 上传

```bash
git init
git add .
git commit -m "Initial commit of multiagent hermes-style code helper"
git branch -M main
git remote add origin <你的GitHub仓库地址>
git push -u origin main
```

---

## 成果描述（≥150 词）

我构建了一个参考 Hermes Agent 架构的多 Agent 代码理解与修复助手。该系统面向 GitHub 公开仓库，帮助用户在缺乏编程背景时仍能理解代码库健康状况：包括结构扫描、示例级静态问题识别、性能/安全类规则提示、修复建议与可视化报告导出。系统采用五 Agent 协作——Orchestrator 负责调度与 Live/Demo 模式切换，Analysis Agent 输出文件树与语言/热点数据，Diagnostic Agent 输出分级问题与规则 ID，Repair Agent 生成 before/after 示例 diff 与 PR 模板，Report Agent 汇总图表与 Markdown/JSON。项目通过 `run_server.py` 提供可运行后端，在无法访问 GitHub API 时自动回退至 `sample_repos` 或技术栈规则，并在 UI 明确标注模式，避免“伪造功能”误解。前端拆分为独立 HTML/CSS/JS，配套交付样例报告、示例 JSON、架构 Mermaid 与截图说明，可直接上传 GitHub 演示，具备清晰产品形态与可扩展技术路线。

---

## 已知限制

- 不执行真实代码修复或自动提 PR
- 未内置 GitHub Token，私有仓库与 API 限流可能触发 Demo 回退
- Bandit/ESLint/Semgrep 为架构预留，当前以规则/本地样例扫描为主
- `file://` 直接打开时无法调用 `/api/analyze`，请使用 `run_server.py`

---

## License

MIT — 示例与教育演示用途。
