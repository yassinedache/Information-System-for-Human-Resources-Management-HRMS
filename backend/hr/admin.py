from django.contrib import admin

from .models import Application, Attendance, Contract, Employee, JobOffer, Leave, Payslip, Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["last_name", "first_name", "email", "service", "position", "status", "hire_date"]
    list_filter = ["service", "status"]
    search_fields = ["first_name", "last_name", "email"]


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ["employee", "type", "start_date", "end_date", "monthly_salary", "archived"]
    list_filter = ["type", "archived"]


@admin.register(Leave)
class LeaveAdmin(admin.ModelAdmin):
    list_display = ["employee", "type", "start_date", "end_date", "days", "status"]
    list_filter = ["type", "status"]


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ["employee", "date", "status", "check_in", "check_out"]
    list_filter = ["status", "date"]


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ["employee", "period", "gross", "net", "status"]
    list_filter = ["period", "status"]


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ["title", "service", "contract_type", "deadline", "status"]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["last_name", "first_name", "offer", "status", "created_at"]
    list_filter = ["status", "offer"]
