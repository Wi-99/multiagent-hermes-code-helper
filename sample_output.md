# 代码分析报告（示例输出）

- **仓库**: https://github.com/pallets/flask
- **模式**: DEMO（GitHub API 不可用时的技术栈规则回退）
- **技术栈**: flask
- **风险评分**: 47/100（中危）

## Analysis Agent 产出

| 指标 | 数值 |
|------|------|
| 扫描文件 | 28 |
| 代码行数 | 4,820 |
| 结构评分 | 82/100 |

**语言分布**: Python, Markdown

**复杂度热点**:

- `src/flask/app.py`
- `src/flask/blueprints.py`

**依赖图**: app → blueprints → models

## Diagnostic Agent 产出

| 严重度 | 数量 |
|--------|------|
| Critical | 1 |
| High | 2 |
| Medium | 2 |

- [CRITICAL] SQL 注入风险 — `src/flask/app.py:87` (CWE-89, S3649)
- [HIGH] XSS 相关模式 — 示例规则匹配

## Repair Agent 产出

- 修复建议 6 条，其中 3 条标记为「可自动建议」（仍需人工审核）
- 提供 before/after diff 与 PR 模板

## Report Agent 产出

- 风险仪表盘 + Chart.js 图表
- 可导出 `analysis.json` / Markdown

---

*由 MultiAgent Hermes Code Helper 生成 — 示例级可扩展分析框架*
