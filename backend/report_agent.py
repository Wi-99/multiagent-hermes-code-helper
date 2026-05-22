"""Report Agent — aggregate outputs into exportable report."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from utils.helpers import risk_level


def run(
    repo_url: str,
    mode: str,
    stack: str,
    analysis: dict[str, Any],
    diagnostic: dict[str, Any],
    repair: dict[str, Any],
) -> dict[str, Any]:
    dr = diagnostic
    ar = analysis
    rr = repair
    now = datetime.now(timezone.utc).isoformat()

    markdown = _to_markdown(repo_url, mode, stack, ar, dr, rr, now)
    summary_cards = [
        {"label": "扫描文件", "value": ar["fileCount"], "unit": "个", "tone": "hi"},
        {"label": "代码行数", "value": f"{ar['totalLines']:,}", "unit": "行", "tone": ""},
        {
            "label": "发现问题",
            "value": len(dr["issues"]),
            "unit": "个",
            "tone": "danger" if len(dr["issues"]) > 8 else "warn",
        },
        {
            "label": "风险评分",
            "value": dr["riskScore"],
            "unit": "/ 100",
            "tone": "danger" if dr["riskScore"] >= 60 else "warn",
        },
        {"label": "修复建议", "value": len(rr["fixes"]), "unit": "条", "tone": "ok"},
        {
            "label": "可自动建议",
            "value": sum(1 for f in rr["fixes"] if f["auto"]),
            "unit": "条",
            "tone": "ok",
        },
    ]

    return {
        "agent": "ReportAgent",
        "generatedAt": now,
        "mode": mode,
        "stack": stack,
        "riskLabel": risk_level(dr["riskScore"]),
        "summaryCards": summary_cards,
        "markdown": markdown,
        "jsonExport": {
            "repoUrl": repo_url,
            "mode": mode,
            "stack": stack,
            "generatedAt": now,
            "analysis": ar,
            "diagnostic": dr,
            "repair": rr,
        },
        "logs": ["Report assembled", "Charts data ready", "Export formats prepared"],
    }


def _to_markdown(url, mode, stack, ar, dr, rr, ts):
    lines = [
        "# 代码分析报告",
        "",
        f"- **仓库**: {url}",
        f"- **模式**: {mode}",
        f"- **技术栈**: {stack}",
        f"- **时间**: {ts}",
        f"- **风险评分**: {dr['riskScore']}/100 ({risk_level(dr['riskScore'])})",
        "",
        "## Analysis Agent",
        f"- 文件数: {ar['fileCount']}",
        f"- 语言: {', '.join(list(ar['languages'].keys())[:5])}",
        "",
        "## Diagnostic Agent",
    ]
    for iss in dr["issues"]:
        lines.append(f"- [{iss['sev'].upper()}] {iss['title']} — `{iss['file']}:{iss['line']}` ({iss.get('rule', '')})")
    lines.extend(["", "## Repair Agent", f"- 建议数: {len(rr['fixes'])}", "", "---", "*MultiAgent Hermes Code Helper*"])
    return "\n".join(lines)
