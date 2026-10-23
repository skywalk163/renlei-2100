"""人类协议 2100 · 传输层（薄壳）

只负责静态文件与 HTTP 转发；推演逻辑 100% 在 Light（引擎.light / api.light）。
之所以有这一层：本机 Light v0.4.0 的 HTTP 服务端在 contrib 里只有 Python 腿，
`创建HTTP服务端` 在 light run 下不可见，因此用标准库起服务，业务仍走 Light。
"""
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LIGHT = Path(r"G:\dswork\duan-light-merge\light-merge\.venv\Scripts\light.exe")
API = ROOT / "api.light"
HOST, PORT = "127.0.0.1", 2100

STATIC = {
    "/": ("web/index.html", "text/html; charset=utf-8"),
    "/style.css": ("web/style.css", "text/css; charset=utf-8"),
    "/app.js": ("web/app.js", "application/javascript; charset=utf-8"),
}


class Handler(BaseHTTPRequestHandler):
    server_version = "Renlei2100/1.0"

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, data) -> None:
        self._send(code, json.dumps(data, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            self._json(200, {"ok": True, "服务": "人类协议2100"})
            return
        if path in STATIC:
            rel, ctype = STATIC[path]
            try:
                self._send(200, (ROOT / rel).read_bytes(), ctype)
            except OSError:
                self._send(500, "静态文件缺失".encode("utf-8"), "text/plain; charset=utf-8")
            return
        self._json(404, {"错误": "接口不存在", "路径": path})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path != "/api/simulate":
            self._json(404, {"错误": "接口不存在", "路径": path})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(payload, dict):
                raise ValueError("请求体必须是 JSON 对象")
        except (ValueError, json.JSONDecodeError) as exc:
            self._json(400, {"错误": f"请求体不是合法 JSON：{exc}"})
            return

        env = dict(os.environ)
        env["PYTHONIOENCODING"] = "utf-8"
        params = {key: payload.get(key, 60) for key in ("技术", "共情", "选择")}
        (ROOT / "_input.json").write_text(
            json.dumps(params, ensure_ascii=False), encoding="utf-8"
        )

        try:
            proc = subprocess.run(
                [str(LIGHT), "run", str(API)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env,
                timeout=30,
                cwd=str(ROOT),
            )
        except subprocess.TimeoutExpired:
            self._json(504, {"错误": "Light 推演超时"})
            return

        if proc.returncode != 0:
            self._json(500, {"错误": "Light 推演失败", "详情": (proc.stderr or proc.stdout)[-400:]})
            return

        line = next((ln.strip() for ln in reversed(proc.stdout.splitlines()) if ln.strip().startswith("{")), "")
        if not line:
            self._json(500, {"错误": "Light 没有返回 JSON", "输出": proc.stdout[-400:]})
            return
        try:
            self._send(200, line.encode("utf-8"), "application/json; charset=utf-8")
        except json.JSONDecodeError:
            self._json(500, {"错误": "Light 返回的不是合法 JSON", "输出": line[:400]})

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write("[2100] " + (fmt % args) + "\n")


if __name__ == "__main__":
    print(f"人类协议 2100 · 服务启动：http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
