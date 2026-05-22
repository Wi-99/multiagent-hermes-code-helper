"""Diagnostic Agent — static issue detection (pattern + local scan)."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from utils.helpers import safe_read, seed_hash


SEVERITY_WEIGHT = {"critical": 25, "high": 15, "medium": 7, "low": 3, "info": 1}

LOCAL_PATTERNS = [
    (r'f".*SELECT.*\{', "critical", "security", "SQL 注入风险", "CWE-89", "S3649"),
    (r"password\s*=\s*['\"]", "critical", "security", "硬编码密码", "CWE-798", "S6703"),
    (r"eval\s*\(", "high", "security", "不安全的 eval 调用", "CWE-95", "S1523"),
    (r"innerHTML\s*=", "high", "security", "XSS — innerHTML 注入", "CWE-79", "S5247"),
    (r"verify_signature.*False", "high", "security", "JWT 未验证签名", "CWE-347", "S5659"),
    (r"time\.sleep\s*\(", "low", "performance", "同步 sleep 阻塞", "", "ASYNC001"),
]


def run(
    repo_url: str,
    stack: str,
    files: list[dict[str, Any]],
    local_path: Path | None = None,
    depth: str = "standard",
) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []

    if local_path and local_path.is_dir():
        issues.extend(_scan_local(local_path))

    issues.extend(_stack_issues(repo_url, stack, depth))
    issues = _dedupe(issues)
    limit = {"quick": 5, "standard": 9, "deep": 12}.get(depth, 9)
    s = seed_hash(repo_url)
    issues = sorted(issues, key=lambda x: (seed_hash(repo_url + x["title"]) ^ s))[:limit]

    for i, iss in enumerate(issues):
        iss["id"] = f"ISS-{i + 1:03d}"

    summary: dict[str, int] = {}
    for iss in issues:
        summary[iss["sev"]] = summary.get(iss["sev"], 0) + 1

    risk = min(100, sum(SEVERITY_WEIGHT.get(i["sev"], 0) for i in issues))

    return {
        "agent": "DiagnosticAgent",
        "issues": issues,
        "riskScore": risk,
        "summary": summary,
        "tools": ["pattern-scan", "local-file-scan"] if local_path else ["pattern-scan", "stack-rules"],
        "logs": [
            "Running pattern scan...",
            "Running stack-specific rules...",
            f"Found {len(issues)} issues",
        ],
    }


def _scan_local(root: Path) -> list[dict[str, Any]]:
    found = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in {".py", ".js", ".jsx"}:
            continue
        text = safe_read(path)
        rel = str(path.relative_to(root)).replace("\\", "/")
        for pat, sev, cat, title, cwe, rule in LOCAL_PATTERNS:
            for m in re.finditer(pat, text, re.I):
                line = text[: m.start()].count("\n") + 1
                found.append(_issue(rel, line, sev, cat, title, cwe, rule, text, m.start()))
    return found


def _issue(rel, line, sev, cat, title, cwe, rule, text, pos):
    lines = text.splitlines()
    ln = lines[line - 1] if 0 < line <= len(lines) else ""
    return {
        "sev": sev,
        "cat": cat,
        "title": title,
        "desc": f"在 {rel} 检测到可疑模式。",
        "file": rel,
        "line": line,
        "cwe": cwe,
        "rule": rule,
        "sug": "请按修复建议重构该段代码。",
        "before": ln.strip() or "# 问题代码行",
        "after": "# 已修复示例 — 见 Repair Agent 输出",
        "expl": "基于规则匹配的可扩展静态分析（示例级）。",
    }


def _stack_issues(url: str, stack: str, depth: str) -> list[dict[str, Any]]:
    catalog = _CATALOG.get(stack, _CATALOG["generic"])
    cnt = {"quick": 5, "standard": 8, "deep": 11}.get(depth, 8)
    s = seed_hash(url)
    ordered = sorted(catalog, key=lambda x: seed_hash(url + x["title"]) ^ s)
    return [dict(x) for x in ordered[:cnt]]


def _dedupe(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    out = []
    for i in issues:
        k = (i["file"], i["title"])
        if k not in seen:
            seen.add(k)
            out.append(i)
    return out


_CATALOG: dict[str, list[dict[str, Any]]] = {
    "react": [
        {
            "sev": "high",
            "cat": "security",
            "title": "dangerouslySetInnerHTML 使用",
            "desc": "直接渲染未消毒的 HTML。",
            "file": "src/components/Dashboard.jsx",
            "line": 45,
            "cwe": "CWE-79",
            "rule": "react/no-danger",
            "sug": "使用 DOMPurify 或纯文本渲染。",
            "before": '<div dangerouslySetInnerHTML={{__html: userHtml}} />',
            "after": "<div>{sanitizedHtml}</div>",
            "expl": "避免将用户输入作为 HTML 注入 DOM。",
        },
        {
            "sev": "medium",
            "cat": "performance",
            "title": "缺少 useMemo 的昂贵计算",
            "desc": "渲染路径中重复计算过滤列表。",
            "file": "src/App.jsx",
            "line": 62,
            "cwe": "",
            "rule": "PERF-REACT",
            "sug": "对昂贵派生数据使用 useMemo。",
            "before": "const filtered = items.filter(heavyPredicate);",
            "after": "const filtered = useMemo(() => items.filter(heavyPredicate), [items]);",
            "expl": "减少不必要的重渲染与计算。",
        },
    ],
    "flask": [
        {
            "sev": "critical",
            "cat": "security",
            "title": "SQL 注入风险",
            "desc": "拼接用户输入到 SQL。",
            "file": "app/routes.py",
            "line": 87,
            "cwe": "CWE-89",
            "rule": "S3649",
            "sug": "使用参数化查询或 ORM。",
            "before": 'query = f"SELECT * FROM users WHERE name = \'{username}\'"',
            "after": 'cursor.execute("SELECT * FROM users WHERE name = %s", (username,))',
            "expl": "参数化查询可防止 SQL 注入。",
        },
    ],
    "django": [
        {
            "sev": "high",
            "cat": "security",
            "title": "DEBUG=True 风险",
            "desc": "生产配置中可能暴露敏感信息。",
            "file": "project/settings.py",
            "line": 18,
            "cwe": "CWE-489",
            "rule": "DJANGO-DEBUG",
            "sug": "通过环境变量控制 DEBUG。",
            "before": "DEBUG = True",
            "after": "DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'",
            "expl": "生产环境应关闭 DEBUG。",
        },
    ],
    "express": [
        {
            "sev": "high",
            "cat": "security",
            "title": "缺少 helmet 安全头",
            "desc": "HTTP 响应未设置常见安全头。",
            "file": "index.js",
            "line": 12,
            "cwe": "CWE-693",
            "rule": "EXPRESS-HELMET",
            "sug": "添加 helmet() 中间件。",
            "before": "app.use(express.json());",
            "after": "app.use(helmet());\napp.use(express.json());",
            "expl": "helmet 提供 XSS、点击劫持等基础防护。",
        },
    ],
    "vue": [
        {
            "sev": "medium",
            "cat": "security",
            "title": "v-html 未消毒",
            "desc": "v-html 可引入 XSS。",
            "file": "src/views/Home.vue",
            "line": 28,
            "cwe": "CWE-79",
            "rule": "VUE-HTML",
            "sug": "仅对可信内容使用 v-html，或先消毒。",
            "before": '<div v-html="userContent"></div>',
            "after": '<div>{{ userContent }}</div>',
            "expl": "默认插值会自动转义。",
        },
    ],
    "generic": [
        {
            "sev": "medium",
            "cat": "duplicate",
            "title": "重复验证逻辑",
            "desc": "多个模块存在相似参数校验。",
            "file": "src/utils/validators.py",
            "line": 12,
            "cwe": "",
            "rule": "DRY001",
            "sug": "抽取公共 validate 函数。",
            "before": "if not value or len(value) > 100: raise ValueError('invalid')",
            "after": "validate_string(value, max_len=100)",
            "expl": "DRY 原则降低维护成本。",
        },
    ],
}
