from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """A login. HR staff manage everything; employees only see their own data (via /api/me/)."""

    class Role(models.TextChoices):
        HR = "hr", "HR"
        EMPLOYEE = "employee", "Employee"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.EMPLOYEE)
    employee = models.OneToOneField("hr.Employee", null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="user")
    must_change_password = models.BooleanField(default=False)

    @property
    def is_hr(self) -> bool:
        return self.is_active and (self.role == self.Role.HR or self.is_superuser)

    def __str__(self):
        return self.email or self.username
