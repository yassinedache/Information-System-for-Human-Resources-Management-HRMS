from django.conf import settings
from django.http import FileResponse, Http404
from django.urls import include, path, re_path


def spa(request):
    """Serve the built React app (frontend/dist/index.html) for every non-API URL."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        raise Http404("Build the frontend first: cd frontend && npm install && npm run build")
    return FileResponse(open(index, "rb"), content_type="text/html")


urlpatterns = [
    path("api/auth/", include("accounts.urls")),
    path("api/", include("hr.urls")),
    re_path(r"^(?!api/|admin/|static/|media/).*$", spa),
]

if "django.contrib.admin" in settings.INSTALLED_APPS:   # the in-browser demo leaves the admin out
    from django.contrib import admin

    urlpatterns.insert(0, path("admin/", admin.site.urls))
