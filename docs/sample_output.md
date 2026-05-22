# 代码分析报告（示例输出）

**仓库**: https://github.com/demo/example_repo  
**模式**: DEMO  
**深度**: standard  
**生成时间**: 2026-05-21 12:00 UTC

## 执行摘要

| 指标 | 数值 |
|------|------|
| 技术栈 | flask |
| 扫描文件 | 2 |
| 发现问题 | 4 |
| 风险评分 | **65/100** (高危) |
| 结构评分 | 78/100 |

## Analysis Agent 产出

- 语言分布: Python(32), JavaScript(26)
- 文件树: `file1.py`, `file2.js`

## Diagnostic Agent 产出

- **[CRITICAL]** 硬编码密钥 — `file1.py:7` (S6703 / CWE-798)
- **[CRITICAL]** SQL 注入风险 — `file1.py:12` (S3649 / CWE-89)
- **[HIGH]** XSS innerHTML — `file2.js:8` (S5247 / CWE-79)

## Repair Agent 产出

- ISS-001: 迁移密钥至环境变量（置信 92%，示例自动）
- ISS-002: 使用参数化 SQL（置信 88%）

---

*由 Multi-Agent Hermes Code Helper 生成 — 示例/可扩展分析流程*
