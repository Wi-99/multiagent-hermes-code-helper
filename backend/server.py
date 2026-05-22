"""HTTP API server — serves /api/analyze and static frontend."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.orchestrator import analyze_repository

FRONTEND = ROOT / "frontend"
PORT = 8765


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[server] {fmt % args}")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self._json({"ok": True, "service": "hermes-code-helper", "version": "2.0"})
            return

        if path == "/api/analyze":
            qs = parse_qs(parsed.query)
            url = (qs.get("url") or [""])[0]
            depth = (qs.get("depth") or ["standard"])[0]
            if not url:
                self._json({"ok": False, "error": "缺少 url 参数"}, 400)
                return
            result = analyze_repository(url, depth)
            self._json(result)
            return

        self._static(path)

    def do_POST(self):
        if self.path != "/api/analyze":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._json({"ok": False, "error": "无效 JSON"}, 400)
            return
        url = data.get("repoUrl") or data.get("url", "")
        depth = data.get("depth", "standard")
        use_sample = bool(data.get("useSample"))
        if not url.strip():
            self._json({"ok": False, "error": "缺少 repoUrl"}, 400)
            return
        self._json(analyze_repository(url.strip(), depth, use_sample=use_sample))

    def _json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    def _static(self, path: str):
        if path in ("/", ""):
            path = "/index.html"
        rel = path.lstrip("/")
        if rel.startswith("frontend/"):
            rel = rel[9:]
        fp = FRONTEND / rel
        if not fp.exists() or not fp.is_file():
            # visual/
            fp2 = ROOT / rel
            if fp2.exists():
                fp = fp2
            else:
                self.send_error(404)
                return
        ext = fp.suffix.lower()
        ctype = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".md": "text/markdown",
            ".svg": "image/svg+xml",
        }.get(ext, "application/octet-stream")
        data = fp.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8")
        self._cors()
        self.end_headers()
        self.wfile.write(data)


def main():
    httpd = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Hermes Code Helper running at http://127.0.0.1:{PORT}")
    print("  Frontend: http://127.0.0.1:{PORT}/index.html")
    print("  API:      http://127.0.0.1:{PORT}/api/analyze?url=...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
