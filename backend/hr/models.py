"""Data model, following the conceptual model (MCD) of the 2025 report:
SERVICE, EMPLOYE, CONTRAT, CONGE, SALAIRE (payslips), POINTAGE (attendance), OFFRE and CANDIDATURE.
The business rules live in hr/rules.py so that they can be tested without the API.
"""

from datetime import date
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Service(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Employee(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"   # left the company; kept for history

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    birth_date = models.DateField(null=True, blank=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="employees")  # rule: every employee has a service
    position = models.CharField(max_length=120, blank=True)
    hire_date = models.DateField(default=date.today)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    skills = models.CharField(max_length=300, blank=True, help_text="comma-separated")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class Contract(models.Model):
    class Type(models.TextChoices):
        CDI = "CDI", "CDI"            # permanent
        CDD = "CDD", "CDD"            # fixed-term
        INTERNSHIP = "STAGE", "Stage"
        TEMPORARY = "INTERIM", "Intérim"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="contracts")
    type = models.CharField(max_length=10, choices=Type.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)      # empty for a CDI
    monthly_salary = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    archived = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.type} – {self.employee}"

    @property
    def daily_salary(self) -> Decimal:
        days = Decimal(settings.HR_RULES["DAYS_FOR_DAILY_RATE"])
        return (self.monthly_salary / days).quantize(Decimal("0.01"))

    def state(self, on: date | None = None) -> str:
        on = on or timezone.localdate()
        if self.archived:
            return "archived"
        if self.start_date > on:
            return "upcoming"
        if self.end_date and self.end_date < on:
            return "ended"
        return "active"


class Leave(models.Model):
    class Type(models.TextChoices):
        ANNUAL = "annual", "Annual"
        SICK = "sick", "Sick"
        MATERNITY = "maternity", "Maternity"
        PATERNITY = "paternity", "Paternity"
        UNPAID = "unpaid", "Unpaid"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leaves")
    type = models.CharField(max_length=10, choices=Type.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.PositiveIntegerField(default=0)            # working days, computed by the rules
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.get_type_display()} {self.employee} ({self.start_date} → {self.end_date})"


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["employee", "date"], name="one_attendance_per_day")]

    @property
    def hours(self) -> float | None:
        if not (self.check_in and self.check_out):
            return None
        minutes = (self.check_out.hour * 60 + self.check_out.minute) - (self.check_in.hour * 60 + self.check_in.minute)
        return round(max(minutes, 0) / 60, 2)


class Payslip(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        VALIDATED = "validated", "Validated"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="payslips")
    period = models.DateField(help_text="first day of the month")
    contract_type = models.CharField(max_length=10, blank=True)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    prorata_days = models.PositiveIntegerField(default=0)
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(Decimal("0"))])
    advance = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(Decimal("0"))],
                                  help_text="salary advance (MASSROUF) deducted this month")
    absence_days = models.PositiveIntegerField(default=0)
    unpaid_leave_days = models.PositiveIntegerField(default=0)
    absence_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    social_security = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-period", "employee__last_name"]
        constraints = [models.UniqueConstraint(fields=["employee", "period"], name="one_payslip_per_month")]


class JobOffer(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    title = models.CharField(max_length=150)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name="offers")
    contract_type = models.CharField(max_length=10, choices=Contract.Type.choices)
    location = models.CharField(max_length=100, blank=True)
    description = models.TextField()
    requirements = models.TextField(blank=True)
    deadline = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def is_open(self) -> bool:
        return self.status == self.Status.OPEN and self.deadline >= timezone.localdate()


def cv_path(instance, filename):
    return f"cvs/{timezone.now():%Y/%m}/application-{instance.offer_id}-{timezone.now():%H%M%S%f}.pdf"


class Application(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        SHORTLISTED = "shortlisted", "Shortlisted"
        INTERVIEW = "interview", "Interview"
        REJECTED = "rejected", "Rejected"
        HIRED = "hired", "Hired"

    offer = models.ForeignKey(JobOffer, on_delete=models.CASCADE, related_name="applications")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    cover_letter = models.TextField(blank=True)
    cv = models.FileField(upload_to=cv_path)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RECEIVED)
    interview_at = models.DateTimeField(null=True, blank=True)
    hr_notes = models.TextField(blank=True)
    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["offer", "email"], name="one_application_per_offer")]
