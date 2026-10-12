from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf),
    path("login/", views.LoginView.as_view()),
    path("logout/", views.logout_view),
    path("me/", views.me),
    path("password/", views.change_password),
]
