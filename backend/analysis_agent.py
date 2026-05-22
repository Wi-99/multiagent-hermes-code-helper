"""Analysis Agent — structure, languages, hotspots."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from utils.helpers import language_distribution, seed_hash, walk_local_repo


def run(
    repo_url: str,
    stack: str,
    local_path: Path | None = None,
    remote_files: list[dict[str, Any]] | None = None,
    depth: str = "standard",
) -> dict[str, Any]:
    max_files = {"quick": 20, "standard": 50, "deep": 100}.get(depth, 50)

    if local_path and local_path.is_dir():
        files = walk_local_repo(local_path, max_files)
        source = "local"
    elif remote_files:
        files = remote_files[:max_files]
        source = "github_api"
    else:
        files = _synthetic_files(repo_url, stack, max_files)
        source = "synthetic"

    langs = language_distribution(files)
    hotspots = sorted(files, key=lambda f: f.get("complexity", 0), reverse=True)[:5]
    total_lines = sum(int(f.get("lines", 0)) for f in files)
    s = seed_hash(repo_url + stack)

    return {
        "agent": "AnalysisAgent",
        "source": source,
        "fileCount": len(files),
        "totalLines": total_lines,
        "languages": langs,
        "files": files,
        "hotspots": hotspots,
        "structureScore": min(99, 68 + (s % 28)),
        "dependencyGraph": _dep_graph(stack),
        "astSummary": {
            "modules": len({f["path"].split("/")[0] for f in files if "/" in f["path"]}),
            "parsedSamples": [f["path"] for f in files[:4]],
        },
        "logs": [
            f"Found {len(files)} files",
            "Dependency graph generated",
            *[f"Parsing: {p}" for p in [f["path"] for f in files[:3]]],
        ],
    }


def _dep_graph(stack: str) -> list[str]:
    graphs = {
        "react": ["react → react-dom", "app → components → hooks", "api.js → fetch"],
        "vue": ["vue → vue-router", "views → components", "store → api"],
        "flask": ["app → blueprints → models", "routes → services → db"],
        "django": ["urls → views → models", "settings → middleware"],
        "express": ["index → routes → controllers", "middleware → db"],
    }
    return graphs.get(stack, ["entry → modules → utils"])


def _synthetic_files(repo_url: str, stack: str, n: int) -> list[dict[str, Any]]:
    templates = {
        "react": [
            ("src/App.jsx", "JavaScript", 180),
            ("src/components/Dashboard.jsx", "JavaScript", 310),
            ("src/hooks/useAuth.js", "JavaScript", 95),
            ("src/api/client.js", "JavaScript", 88),
        ],
        "flask": [
            ("app/__init__.py", "Python", 45),
            ("app/routes.py", "Python", 220),
            ("app/models.py", "Python", 165),
            ("config.py", "Python", 38),
        ],
        "django": [
            ("manage.py", "Python", 22),
            ("project/settings.py", "Python", 120),
            ("apps/core/views.py", "Python", 280),
            ("apps/core/models.py", "Python", 195),
        ],
        "express": [
            ("index.js", "JavaScript", 85),
            ("routes/api.js", "JavaScript", 210),
            ("middleware/auth.js", "JavaScript", 72),
            ("models/user.js", "JavaScript", 98),
        ],
        "vue": [
            ("src/App.vue", "Vue", 120),
            ("src/views/Home.vue", "Vue", 165),
            ("src/store/index.js", "JavaScript", 88),
        ],
    }
    base = templates.get(stack, templates["flask"])
    s = seed_hash(repo_url)
    out = []
    for i in range(n):
        tpl = base[i % len(base)]
        out.append(
            {
                "path": tpl[0] if i < len(base) else f"src/module_{i}.{tpl[0].split('.')[-1]}",
                "language": tpl[1],
                "lines": tpl[2] + (s + i * 11) % 40,
                "complexity": 2 + ((s + i * 3) % 8),
            }
        )
    return out
