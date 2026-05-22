"""Shared utilities for multi-agent code helper."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

GITHUB_RE = re.compile(
    r"^https?://(?:www\.)?github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$",
    re.I,
)


def parse_github_url(url: str) -> dict[str, str] | None:
    url = (url or "").strip().rstrip("/")
    m = GITHUB_RE.match(url)
    if not m:
        return None
    owner, repo = m.group(1), m.group(2)
    if repo.endswith(".git"):
        repo = repo[:-4]
    return {"owner": owner, "repo": repo, "full_name": f"{owner}/{repo}"}


def detect_stack(repo_name: str, languages: dict[str, int] | None = None) -> str:
    name = (repo_name or "").lower()
    langs = {k.lower(): v for k, v in (languages or {}).items()}
    rules = [
        ("react", ["react"]),
        ("vue", ["vue"]),
        ("django", ["django"]),
        ("flask", ["flask", "pallets"]),
        ("express", ["express"]),
        ("node", ["node", "express", "nestjs"]),
        ("python", ["python", "django", "flask"]),
    ]
    for stack, keys in rules:
        if any(k in name for k in keys):
            return stack
    if langs:
        top = max(langs, key=langs.get)
        mapping = {
            "javascript": "node",
            "typescript": "react",
            "python": "python",
            "vue": "vue",
            "html": "node",
        }
        return mapping.get(top, "generic")
    return "generic"


def seed_hash(text: str) -> int:
    return int(hashlib.md5(text.encode()).hexdigest()[:8], 16)


def walk_local_repo(root: Path, max_files: int = 200) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    if not root.is_dir():
        return files
    for path in sorted(root.rglob("*")):
        if path.is_file() and not any(p.startswith(".") for p in path.parts):
            rel = str(path.relative_to(root)).replace("\\", "/")
            ext = path.suffix.lower()
            lang = ext_to_language(ext)
            try:
                lines = len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
            except OSError:
                lines = 0
            files.append(
                {
                    "path": rel,
                    "language": lang,
                    "lines": lines,
                    "complexity": min(10, 2 + (lines // 80) + (seed_hash(rel) % 5)),
                }
            )
            if len(files) >= max_files:
                break
    return files


def ext_to_language(ext: str) -> str:
    return {
        ".py": "Python",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".vue": "Vue",
        ".json": "JSON",
        ".md": "Markdown",
        ".yaml": "YAML",
        ".yml": "YAML",
    }.get(ext, "Other")


def language_distribution(files: list[dict[str, Any]]) -> dict[str, int]:
    dist: dict[str, int] = {}
    for f in files:
        lang = f.get("language", "Other")
        dist[lang] = dist.get(lang, 0) + int(f.get("lines", 0))
    return dict(sorted(dist.items(), key=lambda x: -x[1]))


def risk_level(score: int) -> str:
    if score >= 75:
        return "严重风险"
    if score >= 50:
        return "高危"
    if score >= 25:
        return "中危"
    return "低危"


def safe_read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""
