"""Orchestrator Agent — schedules multi-agent pipeline."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import analysis_agent, diagnostic_agent, repair_agent, report_agent
from utils.helpers import detect_stack, parse_github_url

SAMPLE_REPO = ROOT / "sample_repos" / "example_repo"


def fetch_github_tree(owner: str, repo: str, max_files: int = 80) -> tuple[list[dict[str, Any]], str | None]:
    """Fetch public repo file list via GitHub API. Returns (files, error)."""
    api = f"https://api.github.com/repos/{owner}/{repo}"
    try:
        with urllib.request.urlopen(api, timeout=12) as resp:
            meta = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        return [], str(e)

    default_branch = meta.get("default_branch", "main")
    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
    try:
        with urllib.request.urlopen(tree_url, timeout=15) as resp:
            tree = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        return [], str(e)

    from utils.helpers import ext_to_language

    files = []
    for item in tree.get("tree", []):
        if item.get("type") != "blob":
            continue
        path = item["path"]
        if any(x in path for x in ["/node_modules/", "/.git/", "/dist/", "/vendor/"]):
            continue
        ext = Path(path).suffix.lower()
        size = int(item.get("size", 0))
        lines = max(1, size // 40)
        files.append(
            {
                "path": path,
                "language": ext_to_language(ext),
                "lines": lines,
                "complexity": min(10, 2 + lines // 120 + (hash(path) % 6)),
            }
        )
        if len(files) >= max_files:
            break
    return files, None


def run_pipeline(
    repo_url: str,
    depth: str = "standard",
    use_sample: bool = False,
) -> dict[str, Any]:
    parsed = parse_github_url(repo_url)
    if not parsed and not use_sample:
        raise ValueError("无效的 GitHub 仓库 URL")

    owner = parsed["owner"] if parsed else "demo"
    repo = parsed["repo"] if parsed else "example_repo"
    full_url = repo_url if parsed else "https://github.com/demo/example_repo"

    mode = "demo"
    mode_note = ""
    remote_files: list[dict[str, Any]] = []
    local_path = SAMPLE_REPO if use_sample else None
    languages_hint: dict[str, int] | None = None

    if use_sample:
        mode = "demo"
        mode_note = "使用 sample_repos/example_repo 本地示例数据"
    elif parsed:
        remote_files, err = fetch_github_tree(owner, repo)
        if remote_files:
            mode = "live"
            mode_note = f"已通过 GitHub API 读取 {len(remote_files)} 个文件（公开仓库）"
            langs: dict[str, int] = {}
            for f in remote_files:
                langs[f["language"]] = langs.get(f["language"], 0) + f["lines"]
            languages_hint = langs
        else:
            mode = "demo"
            mode_note = f"GitHub API 不可用，已回退演示数据 ({err or 'unknown'})"

    stack = detect_stack(repo, languages_hint)
    logs = [
        {"agent": "Orchestrator", "level": "info", "message": f"任务启动 — {owner}/{repo}"},
        {"agent": "Orchestrator", "level": "info", "message": f"模式: {mode.upper()} | 深度: {depth}"},
        {"agent": "Orchestrator", "level": "info", "message": f"技术栈识别: {stack}"},
    ]

    analysis = analysis_agent.run(full_url, stack, local_path, remote_files or None, depth)
    logs.extend({"agent": "AnalysisAgent", "level": "info", "message": m} for m in analysis.get("logs", []))

    diagnostic = diagnostic_agent.run(full_url, stack, analysis["files"], local_path, depth)
    logs.extend({"agent": "DiagnosticAgent", "level": "info", "message": m} for m in diagnostic.get("logs", []))

    repair = repair_agent.run(diagnostic["issues"], full_url)
    logs.extend({"agent": "RepairAgent", "level": "info", "message": m} for m in repair.get("logs", []))

    report = report_agent.run(full_url, mode, stack, analysis, diagnostic, repair)
    logs.extend({"agent": "ReportAgent", "level": "info", "message": m} for m in report.get("logs", []))

    return {
        "repoUrl": full_url,
        "owner": owner,
        "repo": repo,
        "stack": stack,
        "mode": mode,
        "modeNote": mode_note,
        "depth": depth,
        "analysis": analysis,
        "diagnostic": diagnostic,
        "repair": repair,
        "report": report,
        "logs": logs,
    }


def analyze_repository(
    repo_url: str,
    depth: str = "standard",
    use_sample: bool = False,
) -> dict[str, Any]:
    """Public API used by backend/server.py and CLI."""
    return run_pipeline(repo_url, depth, use_sample=use_sample)


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://github.com/demo/example_repo"
    depth = sys.argv[2] if len(sys.argv) > 2 else "standard"
    sample = "--sample" in sys.argv
    result = analyze_repository(url, depth, use_sample=sample)
    print(json.dumps(result, ensure_ascii=False, indent=2))
