from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from . import rules
from .models import Application, Attendance, Contract, Employee, JobOffer, Leave, Payslip, Service


class ServiceSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Service
        fields = ["id", "name", "description", "employee_count"]


class ContractSummary(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = ["id", "type", "start_date", "end_date", "monthly_salary"]


class EmployeeSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    state = serializers.SerializerMethodField()
    has_account = serializers.SerializerMethodField()
    contract = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ["id", "first_name", "last_name", "email", "phone", "address", "birth_date", "service", "service_name",
                  "position", "hire_date", "status", "state", "skills", "has_account", "contract", "created_at"]
        read_only_fields = ["created_at"]

    def get_state(self, obj):
        on_leave = self.context.get("on_leave_ids")
        if on_leave is not None:
            return "inactive" if obj.status == Employee.Status.INACTIVE else ("on_leave" if obj.id in on_leave else "active")
        return rules.employee_state(obj)

    def get_has_account(self, obj):
        return hasattr(obj, "user") and obj.user is not None

    def get_contract(self, obj):
        c = rules.active_contract(obj)
        return ContractSummary(c).data if c else None

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, data):
        birth = data.get("birth_date")
        if birth and birth > timezone.localdate():
            raise serializers.ValidationError({"birth_date": "The date of birth is in the future."})
        return data


class ContractSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    daily_salary = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    state = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = ["id", "employee", "employee_name", "type", "start_date", "end_date", "monthly_salary", "daily_salary",
                  "archived", "notes", "state", "created_at"]
        read_only_fields = ["archived", "created_at"]

    def get_state(self, obj):
        return obj.state()


class LeaveSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    service_name = serializers.CharField(source="employee.service.name", read_only=True)
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Leave
        fields = ["id", "employee", "employee_name", "service_name", "type", "start_date", "end_date", "days", "reason",
                  "status", "decided_by_name", "decided_at", "decision_comment", "created_at"]
        read_only_fields = ["days", "status", "decided_at", "decision_comment", "created_at"]

    def get_decided_by_name(self, obj):
        u = obj.decided_by
        return None if u is None else (f"{u.first_name} {u.last_name}".strip() or u.email)


class MyLeaveSerializer(LeaveSerializer):
    class Meta(LeaveSerializer.Meta):
        read_only_fields = LeaveSerializer.Meta.read_only_fields + ["employee"]


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    hours = serializers.FloatField(read_only=True)

    class Meta:
        model = Attendance
        fields = ["id", "employee", "employee_name", "date", "status", "check_in", "check_out", "hours", "note"]


class PayslipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    service_name = serializers.CharField(source="employee.service.name", read_only=True)
    position = serializers.CharField(source="employee.position", read_only=True)
    hire_date = serializers.DateField(source="employee.hire_date", read_only=True)
    social_security_rate = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    class Meta:
        model = Payslip
        fields = ["id", "employee", "employee_name", "service_name", "position", "hire_date", "period", "contract_type",
                  "base_salary", "prorata_days", "bonus", "advance", "absence_days", "unpaid_leave_days",
                  "absence_deduction", "gross", "social_security", "social_security_rate", "net", "currency",
                  "status", "created_at", "validated_at"]
        read_only_fields = [f for f in fields if f not in ("bonus", "advance")]

    def get_social_security_rate(self, obj):
        return float(settings.HR_RULES["SOCIAL_SECURITY_RATE"])

    def get_currency(self, obj):
        return settings.HR_RULES["CURRENCY"]


class JobOfferSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True, default=None)
    is_open = serializers.BooleanField(read_only=True)
    applications_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = JobOffer
        fields = ["id", "title", "service", "service_name", "contract_type", "location", "description", "requirements",
                  "deadline", "status", "is_open", "applications_count", "created_at"]
        read_only_fields = ["created_at"]


class PublicJobOfferSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True, default=None)

    class Meta:
        model = JobOffer
        fields = ["id", "title", "service_name", "contract_type", "location", "description", "requirements", "deadline"]


class ApplicationSerializer(serializers.ModelSerializer):
    offer_title = serializers.CharField(source="offer.title", read_only=True)
    has_cv = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = ["id", "offer", "offer_title", "first_name", "last_name", "email", "phone", "cover_letter", "has_cv",
                  "status", "interview_at", "hr_notes", "employee", "created_at"]
        read_only_fields = ["offer", "first_name", "last_name", "email", "phone", "cover_letter", "employee", "created_at"]

    def get_has_cv(self, obj):
        return bool(obj.cv)


class PublicApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ["first_name", "last_name", "email", "phone", "cover_letter", "cv"]

    def validate_email(self, value):
        return value.strip().lower()

    def validate_cv(self, f):
        if f.size > settings.HR_RULES["CV_MAX_BYTES"]:
            raise serializers.ValidationError("The CV must be a PDF of 2 MB at most.")
        head = f.read(5)
        f.seek(0)
        if head != b"%PDF-" or not f.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("The CV must be a PDF file.")
        return f
