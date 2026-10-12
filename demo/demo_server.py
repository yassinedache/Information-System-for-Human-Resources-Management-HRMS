"""Runs the Django backend inside the browser (Pyodide) for the online demo.

The web app's Web Worker calls handle() for every API request: the request becomes a WSGI
environ, Django answers exactly as it would on a server, and the response goes back to the
page. Cookies (session, CSRF) are kept in a small jar, since there is no real HTTP client.
"""

import io
import os
import sys
import time
from http.cookies import SimpleCookie

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_demo")
os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"   # Pyodide always runs inside an event loop

import django  # noqa: E402

django.setup()

from django.core.handlers.wsgi import WSGIHandler  # noqa: E402
from django.core.management import call_command  # noqa: E402

app = WSGIHandler()
jar: dict[str, str] = {}


def boot(fresh: bool) -> float:
    """Create the schema and the fictional company (fresh=True), or reuse a restored database."""
    t = time.time()
    call_command("migrate", verbosity=0, interactive=False)
    if fresh:
        call_command("seed_demo", verbosity=0)
    return time.time() - t


def handle(method: str, path: str, query: str, headers: dict, body: bytes):
    if body is not None and not isinstance(body, (bytes, bytearray)):
        body = body.to_bytes()                          # a JavaScript Uint8Array
    if headers is not None and not isinstance(headers, dict):
        headers = headers.to_py()
    environ = {
        "REQUEST_METHOD": method.upper(), "PATH_INFO": path, "QUERY_STRING": query or "",
        "SERVER_NAME": "demo.local", "SERVER_PORT": "80", "HTTP_HOST": "demo.local", "REMOTE_ADDR": "127.0.0.1",
        "SERVER_PROTOCOL": "HTTP/1.1", "wsgi.version": (1, 0), "wsgi.url_scheme": "http", "wsgi.input": io.BytesIO(body or b""),
        "wsgi.errors": sys.stderr, "wsgi.multithread": False, "wsgi.multiprocess": False, "wsgi.run_once": False,
        "CONTENT_LENGTH": str(len(body or b"")),
    }
    for k, v in (headers or {}).items():
        k = k.lower()
        if k == "content-type":
            environ["CONTENT_TYPE"] = v
        elif k not in ("content-length", "cookie", "host"):
            environ["HTTP_" + k.upper().replace("-", "_")] = v
    if jar:
        environ["HTTP_COOKIE"] = "; ".join(f"{k}={v}" for k, v in jar.items())
    out = {}

    def start_response(status, response_headers, exc_info=None):
        out["status"], out["headers"] = status, response_headers

    result = app(environ, start_response)
    try:
        data = b"".join(result)
    finally:
        if hasattr(result, "close"):
            result.close()
    keep = []
    for k, v in out["headers"]:
        if k.lower() == "set-cookie":
            c = SimpleCookie()
            c.load(v)
            for name, morsel in c.items():
                if morsel["max-age"] == "0" or (morsel["expires"] and "1970" in morsel["expires"]):
                    jar.pop(name, None)
                else:
                    jar[name] = morsel.value
        else:
            keep.append([k, v])
    return int(out["status"].split()[0]), keep, data


def get_jar() -> dict:
    return dict(jar)


def set_jar(cookies: dict) -> None:
    jar.clear()
    jar.update(cookies or {})
