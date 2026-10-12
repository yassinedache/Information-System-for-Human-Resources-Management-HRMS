"""Settings for the online demo, where this backend runs inside the visitor's browser (Pyodide).

Everything lives in the browser's memory: an SQLite file in Pyodide's virtual file system,
seeded with fictional data. A fresh random secret key is generated for every session.
"""

import os
import secrets

os.environ.setdefault("DJANGO_SECRET_KEY", secrets.token_urlsafe(40))
os.environ.setdefault("DJANGO_DEBUG", "0")

from .settings import *  # noqa: E402,F401,F403

ALLOWED_HOSTS = ["*"]
INSTALLED_APPS = [a for a in INSTALLED_APPS if a not in ("django.contrib.admin", "django.contrib.messages")]  # noqa: F405
MIDDLEWARE = [m for m in MIDDLEWARE if "messages" not in m]  # noqa: F405
TEMPLATES[0]["OPTIONS"]["context_processors"] = [  # noqa: F405
    "django.template.context_processors.request", "django.contrib.auth.context_processors.auth"]
MIDDLEWARE = [m for m in MIDDLEWARE if "whitenoise" not in m]  # noqa: F405
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": "/tmp/hrms.sqlite3"}}
MEDIA_ROOT = "/tmp/media"
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
# PBKDF2 with 870,000 iterations takes seconds in WebAssembly; the demo's fictional accounts use fewer.
PASSWORD_HASHERS = ["accounts.hashers.DemoPBKDF2PasswordHasher"]
DEMO = True
