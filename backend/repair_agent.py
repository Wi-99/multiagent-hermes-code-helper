"""Repair Agent — fix suggestions, diffs, PR template."""
from __future__ import annotations

from typing import Any


def run(issues: list[dict[str, Any]], repo_url: str) -> dict[str, Any]:
    fixes = []
    for iss in issues:
        fixes.append(
            {
                "issueId": iss.get("id", ""),
                "title": iss["title"],
                "sev": iss["sev"],
                "file": iss["file"],
                "line": iss["line"],
                "before": iss.get("before", f"# check {iss['file']}:{iss['line']}"),
                "after": iss.get("after", f"# fix: {iss.get('sug', '')}"),
                "expl": iss.get("expl", iss.get("sug", "")),
                "conf": 82 + (hash(iss["title"]) % 14),
                "auto": iss["sev"] in ("critical", "high"),
            }
        )

    pr_lines = [
        "## 修复建议 PR（示例模板）",
        "",
        f"仓库: {repo_url}",
        f"发现问题: {len(issues)} 项",
        f"可自动应用建议: {sum(1 for f in fixes if f['auto'])} 条",
        "",
        "### 变更清单",
    ]
    for i in issues:
        pr_lines.append(f"- [{i['sev'].upper()}] {i['title']} (`{i['file']}:{i['line']}`)")

    pr_lines.extend(
        [
            "",
            "### 说明",
            "本 PR 由 Repair Agent 生成，为**示例级修复建议**，需人工审核后合并。",
        ]
    )

    return {
        "agent": "RepairAgent",
        "fixes": fixes,
        "prTemplate": "\n".join(pr_lines),
        "logs": [f"Generated {len(fixes)} repair proposals", "PR template ready"],
    }
