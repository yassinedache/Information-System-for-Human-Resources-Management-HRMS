"""Build the archive that the online demo loads into Pyodide (Python compiled to WebAssembly).

    python demo/build_bundle.py            # -> frontend/public-demo/backend.zip

It contains the backend code (backend/: config, accounts, hr), demo/demo_server.py, and the pure-Python
packages it needs (Django, Django REST framework, asgiref, sqlparse, tzdata), trimmed of what the demo
never uses (other database drivers, GIS, the admin, translations other than French and English,
static files) to keep the download small.
"""

from __future__ import annotations

import io
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public-demo" / "backend.zip"
REQUIREMENTS = ROOT / "demo" / "requirements-demo.txt"

DROP_DIRS = {
    "django/contrib/gis", "django/contrib/postgres", "django/contrib/admin/static",
    "django/contrib/flatpages", "django/contrib/redirects", "django/contrib/sitemaps", "django/contrib/syndication",
    "django/contrib/humanize", "django/db/backends/mysql", "django/db/backends/oracle",
    "django/db/backends/postgresql", "rest_framework/static",
}
KEEP_LANGS = {"en", "fr"}
KEEP_ZONES = {"Africa/Algiers", "UTC", "Etc/UTC"}


def keep(path: str) -> bool:
    if path.endswith((".pyc", ".pyi")) or "/__pycache__/" in path or ".dist-info/" in path:
        return False
    if any(path == d or path.startswith(d + "/") for d in DROP_DIRS):
        return False
    parts = path.split("/")
    if "locale" in parts:                                   # translations: only French and English
        i = parts.index("locale")
        if len(parts) > i + 2 and parts[i + 1] not in KEEP_LANGS:
            return False
    if path.startswith("tzdata/zoneinfo/") and not path.endswith("__init__.py"):
        return path[len("tzdata/zoneinfo/"):] in KEEP_ZONES
    return True


def build() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, "-m", "pip", "download", "--quiet", "--no-deps", "--only-binary", ":all:",
                        "-r", str(REQUIREMENTS), "-d", tmp], check=True)
        wheels = sorted(Path(tmp).glob("*.whl"))
        n = 0
        with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as out:
            for w in wheels:
                with zipfile.ZipFile(w) as z:
                    for info in z.infolist():
                        if info.is_dir() or not keep(info.filename):
                            continue
                        out.writestr("site/" + info.filename, z.read(info))
                        n += 1
            for pkg in ("config", "accounts", "hr"):
                for f in sorted((ROOT / "backend" / pkg).rglob("*.py")):
                    if "tests" in f.relative_to(ROOT / "backend").parts:
                        continue
                    out.write(f, "app/" + f.relative_to(ROOT / "backend").as_posix())
                    n += 1
            out.write(ROOT / "demo" / "demo_server.py", "app/demo_server.py")
    print(f"{OUT.relative_to(ROOT)}: {n + 1} files, {OUT.stat().st_size / 1e6:.1f} MB "
          f"({', '.join(w.name.split('-')[0] + ' ' + w.name.split('-')[1] for w in wheels)})")
    return OUT


if __name__ == "__main__":
    build()
