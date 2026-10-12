from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class HRUserAdmin(UserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "employee", "is_active")
    list_filter = ("role", "is_active")
    fieldsets = UserAdmin.fieldsets + (("HRMS", {"fields": ("role", "employee", "must_change_password")}),)
