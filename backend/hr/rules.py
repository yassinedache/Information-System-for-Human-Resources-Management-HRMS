"""Business rules of the HRMS (section 2.1.2 of the 2025 report), in one place.

Every function here is plain Python on the models, so it is used by the API, the admin,
the demo seeding and the tests alike. Rule violations raise RuleError with a stable code
that the frontend translates.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from .models import Attendance, Contract, Employee, Leave, Payslip

CENT = Decimal("0.01")


class RuleError(Exception):
    def __init__(self, code: str, message: str, field: str | None = None, **params):
        super().__init__(message)
        self.code, self.message, self.field, self.params = code, message, field, params


def R(key):
    return settings.HR_RULES[key]


def money(x) -> Decimal:
    return Decimal(x).quantize(CENT, rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------------------- calendar
def is_working_day(d: date) -> bool:
    return d.weekday() not in R("WEEKEND")


def working_days(start: date, end: date) -> int:
    """Working days between start and end, both included (Friday and Saturday off by default)."""
    if end < start:
        return 0
    return sum(1 for i in range((end - start).days + 1) if is_working_day(start + timedelta(days=i)))


def month_bounds(period: date) -> tuple[date, date]:
    first = period.replace(day=1)
    return first, first.replace(day=calendar.monthrange(first.year, first.month)[1])


def overlap(a1: date, a2: date | None, b1: date, b2: date | None) -> bool:
    """Do the date ranges [a1, a2] and [b1, b2] intersect? None means open-ended."""
    return (a2 is None or b1 <= a2) and (b2 is None or a1 <= b2)


# ------------------------------------------------------------------------------- employees
def employee_state(emp: Employee, on: date | None = None) -> str:
    """'inactive', 'on_leave' (an approved leave covers the day) or 'active'."""
    on = on or timezone.localdate()
    if emp.status == Employee.Status.INACTIVE:
        return "inactive"
    if emp.leaves.filter(status=Leave.Status.APPROVED, start_date__lte=on, end_date__gte=on).exists():
        return "on_leave"
    return "active"


# ------------------------------------------------------------------------------- contracts
def validate_contract(c: Contract) -> None:
    """One active contract at a time: an employee's contracts may not overlap."""
    if c.type == Contract.Type.CDI:
        pass                                   # a CDI may get an end date when it is terminated
    elif c.end_date is None:
        raise RuleError("contract_end_required", "A fixed-term contract, internship or temporary contract needs an end date.", "end_date")
    if c.end_date and c.end_date < c.start_date:
        raise RuleError("end_before_start", "The end date is before the start date.", "end_date")
    others = Contract.objects.filter(employee=c.employee, archived=False).exclude(pk=c.pk)
    for o in others:
        if overlap(c.start_date, c.end_date, o.start_date, o.end_date):
            raise RuleError("contract_overlap", "This employee already has a contract over these dates.", "start_date",
                            other=f"{o.type} {o.start_date}" + (f" → {o.end_date}" if o.end_date else ""))


def active_contract(emp: Employee, on: date | None = None) -> Contract | None:
    on = on or timezone.localdate()
    return (emp.contracts.filter(archived=False, start_date__lte=on).filter(Q(end_date__isnull=True) | Q(end_date__gte=on))
            .order_by("-start_date").first())


# ------------------------------------------------------------------------------- leave
def months_worked(start: date, end: date) -> int:
    """Completed months between start and end (hired on 15 March: one month on 15 April)."""
    if end < start:
        return 0
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(months, 0)


@dataclass
class Balance:
    year: int
    entitlement: Decimal
    taken: int
    pending: int

    @property
    def available(self) -> Decimal:
        return self.entitlement - self.taken - self.pending

    def as_dict(self):
        return {"year": self.year, "entitlement": float(self.entitlement), "taken": self.taken,
                "pending": self.pending, "available": float(self.available)}


def leave_balance(emp: Employee, year: int | None = None, today: date | None = None, exclude: Leave | None = None) -> Balance:
    """Annual leave accrues at 2.5 days per completed month worked in the year (30 days a year),
    counted from the hire date. Approved annual leave is taken; pending requests are reserved."""
    today = today or timezone.localdate()
    year = year or today.year
    start = max(emp.hire_date, date(year, 1, 1))
    end = min(today, date(year + 1, 1, 1))            # a full past year counts 12 months
    accrued = Decimal(R("ANNUAL_LEAVE_DAYS_PER_MONTH")) * months_worked(start, end) if start <= end else Decimal(0)
    entitlement = min(accrued, Decimal(R("ANNUAL_LEAVE_MAX")))
    qs = emp.leaves.filter(type=Leave.Type.ANNUAL, start_date__year=year)
    if exclude is not None and exclude.pk:
        qs = qs.exclude(pk=exclude.pk)
    taken = qs.filter(status=Leave.Status.APPROVED).aggregate(s=Sum("days"))["s"] or 0
    pending = qs.filter(status=Leave.Status.PENDING).aggregate(s=Sum("days"))["s"] or 0
    return Balance(year, entitlement, taken, pending)


def validate_leave(lv: Leave, by_employee: bool = False) -> None:
    """Checks a leave request and fills lv.days (working days). Raises RuleError."""
    if lv.end_date < lv.start_date:
        raise RuleError("end_before_start", "The end date is before the start date.", "end_date")
    if by_employee and lv.start_date < timezone.localdate():
        raise RuleError("leave_in_past", "A leave request cannot start in the past.", "start_date")
    if lv.employee.status != Employee.Status.ACTIVE:
        raise RuleError("employee_inactive", "This employee is no longer active.")
    lv.days = working_days(lv.start_date, lv.end_date)
    if lv.days == 0:
        raise RuleError("no_working_day", "The period contains no working day.", "end_date")
    clash = (Leave.objects.filter(employee=lv.employee, status__in=[Leave.Status.PENDING, Leave.Status.APPROVED])
             .exclude(pk=lv.pk).filter(start_date__lte=lv.end_date, end_date__gte=lv.start_date).first())
    if clash:
        raise RuleError("leave_overlap", "Another leave already covers part of these dates.", "start_date",
                        other=f"{clash.start_date} → {clash.end_date}")
    if lv.type == Leave.Type.SICK and not lv.reason.strip():
        raise RuleError("reason_required", "Sick leave needs a reason or a medical certificate reference.", "reason")
    limits = R("MAX_LEAVE_DAYS")
    if lv.type == Leave.Type.MATERNITY and (lv.end_date - lv.start_date).days + 1 > limits["maternity"]:
        raise RuleError("too_long", "Maternity leave is limited to {max} calendar days.", "end_date", max=limits["maternity"])
    if lv.type == Leave.Type.PATERNITY and lv.days > limits["paternity"]:
        raise RuleError("too_long", "Paternity leave is limited to {max} working days.", "end_date", max=limits["paternity"])
    if lv.type == Leave.Type.ANNUAL:
        if lv.start_date.year != lv.end_date.year:
            raise RuleError("cross_year", "Split annual leave that spans two years into two requests.", "end_date")
        bal = leave_balance(lv.employee, lv.start_date.year, exclude=lv)
        if lv.days > bal.available:
            raise RuleError("insufficient_balance", "Not enough annual leave: {available} days available.", "end_date",
                            available=float(bal.available))


@transaction.atomic
def decide_leave(lv: Leave, approve: bool, user, comment: str = "") -> Leave:
    """Approve or reject a pending request, exactly once (the balance cannot be deducted twice)."""
    lv = Leave.objects.select_for_update().get(pk=lv.pk)
    if lv.status != Leave.Status.PENDING:
        raise RuleError("not_pending", "This request has already been processed.")
    if approve:
        validate_leave(lv)                     # dates may have become invalid since the request
        lv.status = Leave.Status.APPROVED
    else:
        lv.status = Leave.Status.REJECTED
    lv.decided_by, lv.decided_at, lv.decision_comment = user, timezone.now(), comment
    lv.save()
    return lv


def cancel_leave(lv: Leave, by_employee: bool) -> Leave:
    if by_employee and lv.status != Leave.Status.PENDING:
        raise RuleError("not_pending", "Only pending requests can be cancelled; ask HR for an approved leave.")
    if lv.status not in (Leave.Status.PENDING, Leave.Status.APPROVED):
        raise RuleError("not_cancellable", "This leave cannot be cancelled.")
    if lv.status == Leave.Status.APPROVED and lv.start_date <= timezone.localdate():
        raise RuleError("already_started", "This leave has already started.")
    lv.status = Leave.Status.CANCELLED
    lv.save()
    return lv


# ------------------------------------------------------------------------------- attendance
def clock(emp: Employee, now: datetime | None = None) -> Attendance:
    """First call of the day records the arrival, the second the departure."""
    now = timezone.localtime(now) if now else timezone.localtime()
    today = now.date()
    if employee_state(emp, today) == "on_leave":
        raise RuleError("on_leave", "You are on leave today.")
    rec, created = Attendance.objects.get_or_create(employee=emp, date=today,
                                                    defaults={"status": Attendance.Status.PRESENT, "check_in": now.time()})
    if created:
        return rec
    if rec.status == Attendance.Status.ABSENT or rec.check_in is None:
        rec.status, rec.check_in = Attendance.Status.PRESENT, now.time()
    elif rec.check_out is None:
        rec.check_out = now.time()
    else:
        raise RuleError("already_clocked_out", "You have already clocked out today.")
    rec.save()
    return rec


def day_sheet(on: date) -> list[dict]:
    """Attendance of every active employee on one day: present / absent / on_leave / not_recorded."""
    emps = Employee.objects.filter(status=Employee.Status.ACTIVE, hire_date__lte=on).select_related("service")
    recs = {a.employee_id: a for a in Attendance.objects.filter(date=on)}
    on_leave = set(Leave.objects.filter(status=Leave.Status.APPROVED, start_date__lte=on, end_date__gte=on)
                   .values_list("employee_id", flat=True))
    rows = []
    for e in emps:
        a = recs.get(e.id)
        state = "on_leave" if e.id in on_leave else (a.status if a else "not_recorded")
        rows.append({"employee": e, "attendance": a, "state": state})
    return rows


# ------------------------------------------------------------------------------- payroll
def compute_payslip(p: Payslip) -> Payslip:
    """Fill a payslip for its employee and month (bonus and advance are kept as entered).

    base     = contract salary, pro rata of the calendar days covered by the contract this month
    absences = (days marked absent + unpaid leave working days) x monthly salary / 30
    gross    = base + bonus - absences;   social security = 9 % of gross;   net = gross - social security - advance
    """
    first, last = month_bounds(p.period)
    p.period = first
    contract = (p.employee.contracts.filter(archived=False, start_date__lte=last)
                .filter(Q(end_date__isnull=True) | Q(end_date__gte=first)).order_by("-start_date").first())
    if contract is None:
        raise RuleError("no_contract", "No contract covers this month.")
    covered_from = max(first, contract.start_date)
    covered_to = min(last, contract.end_date) if contract.end_date else last
    covered = (covered_to - covered_from).days + 1
    month_days = (last - first).days + 1
    p.contract_type = contract.type
    p.prorata_days = covered
    p.base_salary = money(contract.monthly_salary * covered / month_days)
    p.absence_days = Attendance.objects.filter(employee=p.employee, status=Attendance.Status.ABSENT,
                                               date__gte=covered_from, date__lte=covered_to).count()
    unpaid = 0
    for lv in p.employee.leaves.filter(type=Leave.Type.UNPAID, status=Leave.Status.APPROVED,
                                       start_date__lte=covered_to, end_date__gte=covered_from):
        unpaid += working_days(max(lv.start_date, covered_from), min(lv.end_date, covered_to))
    p.unpaid_leave_days = unpaid
    daily = contract.monthly_salary / Decimal(R("DAYS_FOR_DAILY_RATE"))
    p.absence_deduction = money(daily * (p.absence_days + unpaid))
    p.gross = money(max(p.base_salary + p.bonus - p.absence_deduction, Decimal(0)))
    p.social_security = money(p.gross * Decimal(R("SOCIAL_SECURITY_RATE")))
    p.net = money(p.gross - p.social_security - p.advance)
    return p


@transaction.atomic
def generate_payroll(period: date) -> dict:
    """Create or refresh the draft payslips of a month for every employee with a contract in it."""
    first, last = month_bounds(period)
    created = updated = skipped = 0
    emps = Employee.objects.filter(contracts__archived=False, contracts__start_date__lte=last).filter(
        Q(contracts__end_date__isnull=True) | Q(contracts__end_date__gte=first)).distinct()
    for emp in emps:
        p = Payslip.objects.filter(employee=emp, period=first).first()
        if p and p.status == Payslip.Status.VALIDATED:
            skipped += 1
            continue
        is_new = p is None
        p = p or Payslip(employee=emp, period=first)
        compute_payslip(p).save()
        created += is_new
        updated += not is_new
    return {"period": first.isoformat(), "created": created, "updated": updated, "skipped_validated": skipped}


def validate_payslip(p: Payslip) -> Payslip:
    if p.status == Payslip.Status.VALIDATED:
        raise RuleError("already_validated", "This payslip is already validated.")
    compute_payslip(p)
    p.status, p.validated_at = Payslip.Status.VALIDATED, timezone.now()
    p.save()
    return p
