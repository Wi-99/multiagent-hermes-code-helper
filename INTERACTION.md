# 用户交互流程说明

## 步骤 1 — 打开 Demo

```bash
cd multiagent-hermes-code-helper
python start.py
```

浏览器访问：**http://127.0.0.1:8765/index.html**

模式说明：右上角 **Live** = GitHub API 成功；**Demo** = API 失败或本地 `sample_repos` 回退。

（仅静态预览：`cd frontend && python -m http.server 8080`，为 **Demo 离线模式**）

## 步骤 2 — 输入仓库

1. 在输入框粘贴 GitHub URL，或点击快捷按钮（Flask / React / Vue 等）
2. 选择分析深度：快速 / 标准 / 深度
3. 点击 **开始分析 →**

## 步骤 3 — 观察 Agent 协作

- 顶部徽章显示 **LIVE** 或 **DEMO**
- 流程图节点依次高亮：Orchestrator → Analysis + Diagnostic（并行）→ Repair → Report
- 日志区显示各 Agent 证据链（文件数、规则 ID 等）

## 步骤 4 — 查看报告

自动切换到 **报告** 标签：

| 区块 | 来源 Agent |
|------|------------|
| 汇总卡片、语言图、文件树 | Analysis |
| 风险评分、问题列表、严重度图 | Diagnostic |
| Before/After diff、PR 模板 | Repair |
| Markdown/JSON 导出 | Report |

## 步骤 5 — 导出与分享

- **导出 Markdown** / **JSON**
- **复制 PR 模板**
- 打开 **示例报告页**（`demo/sample-report.html`）

## 模式说明

| 模式 | 条件 |
|------|------|
| **LIVE** | 后端运行且 GitHub API 成功返回文件树 |
| **DEMO** | API 失败、离线、或未启动后端时自动兜底 |
