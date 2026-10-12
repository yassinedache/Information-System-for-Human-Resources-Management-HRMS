import secrets
from collections import Counter
from datetime import date, datetime, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from . import rules
from .models import Application, Attendance, Contract, Employee, JobOffer, Leave, Payslip, Service
from .serializers import (ApplicationSerializer, AttendanceSerializer, ContractSerializer, EmployeeSerializer,
                          JobOfferSerializer, LeaveSerializer, MyLeaveSerializer, PayslipSerializer,
                          PublicApplicationSerializer, PublicJobOfferSerializer, ServiceSerializer)

User = get_user_model()


# ------------------------------------------------------------------------------ permissions
class IsHR(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_hr)


class IsEmployee(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_id)


class HROrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in ("GET", "HEAD", "OPTIONS") or request.user.is_hr


def parse_month(value: str | None) -> date:
    """'2026-03' -> date(2026, 3, 1); default: the current month."""
    if not value:
        return timezone.localdate().replace(day=1)
    try:
        return datetime.strptime(value[:7], "%Y-%m").date()
    except ValueError:
        raise ValidationError({"period": "Use the format YYYY-MM."})


def parse_day(value: str | None) -> date:
    if not value:
        return timezone.localdate()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({"date": "Use the format YYYY-MM-DD."})


def new_password() -> str:
    return secrets.token_urlsafe(9)


def create_account(emp: Employee) -> str:
    """A login for an employee, with a temporary password that HR hands over (shown once)."""
    password = new_password()
    if User.objects.filter(username=emp.email).exists():
        raise ValidationError({"email": "A user account already uses this email."})
    User.objects.create_user(username=emp.email, email=emp.email, password=password, first_name=emp.first_name,
                             last_name=emp.last_name, role=User.Role.EMPLOYEE, employee=emp, must_change_password=True)
    return password


def on_leave_ids(on: date | None = None) -> set:
    on = on or timezone.localdate()
    return set(Leave.objects.filter(status=Leave.Status.APPROVED, start_date__lte=on, end_date__gte=on)
               .values_list("employee_id", flat=True))


# ------------------------------------------------------------------------------ services
class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [HROrReadOnly]

    def get_queryset(self):
        return Service.objects.annotate(employee_count=Count("employees", filter=Q(employees__status="active")))


# ------------------------------------------------------------------------------ employees
class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsHR]

    def get_queryset(self):
        qs = Employee.objects.select_related("service").prefetch_related("contracts")
        p = self.request.query_params
        if p.get("q"):
            q = p["q"].strip()
            qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q) | Q(position__icontains=q))
        if p.get("service"):
            qs = qs.filter(service_id=p["service"])
        if p.get("status") in ("active", "inactive"):
            qs = qs.filter(status=p["status"])
        return qs

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "on_leave_ids": on_leave_ids()}

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        emp = ser.save()
        data = dict(self.get_serializer(emp).data)
        if str(request.data.get("create_account", "true")).lower() not in ("false", "0", "no"):
            data["temporary_password"] = create_account(emp)
            data["has_account"] = True
        return Response(data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        emp = self.get_object()
        data = dict(self.get_serializer(emp).data)
        today = timezone.localdate()
        month_start = today.replace(day=1)
        att = Attendance.objects.filter(employee=emp, date__gte=month_start, date__lte=today)
        data.update({
            "contracts": ContractSerializer(emp.contracts.all(), many=True).data,
            "leaves": LeaveSerializer(emp.leaves.all()[:20], many=True).data,
            "balance": rules.leave_balance(emp).as_dict(),
            "attendance_month": {"present": att.filter(status="present").count(), "absent": att.filter(status="absent").count()},
            "payslips": PayslipSerializer(emp.payslips.all()[:12], many=True).data,
        })
        return Response(data)

    def destroy(self, request, *args, **kwargs):
        emp = self.get_object()
        if emp.contracts.exists() or emp.payslips.exists():
            raise rules.RuleError("has_history", "This employee has contracts or payslips: deactivate instead of deleting.")
        if hasattr(emp, "user") and emp.user:
            emp.user.delete()
        emp.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        emp = self.get_object()
        emp.status = Employee.Status.INACTIVE
        emp.save()
        if hasattr(emp, "user") and emp.user:
            emp.user.is_active = False
            emp.user.save()
        return Response(self.get_serializer(emp).data)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        emp = self.get_object()
        emp.status = Employee.Status.ACTIVE
        emp.save()
        if hasattr(emp, "user") and emp.user:
            emp.user.is_active = True
            emp.user.save()
        return Response(self.get_serializer(emp).data)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        emp = self.get_object()
        if not (hasattr(emp, "user") and emp.user):
            return Response({"temporary_password": create_account(emp)})
        password = new_password()
        emp.user.set_password(password)
        emp.user.must_change_password = True
        emp.user.save()
        return Response({"temporary_password": password})


# ------------------------------------------------------------------------------ contracts
class ContractViewSet(viewsets.ModelViewSet):
    serializer_class = ContractSerializer
    permission_classes = [IsHR]

    def get_queryset(self):
        qs = Contract.objects.select_related("employee")
        p = self.request.query_params
        if p.get("employee"):
            qs = qs.filter(employee_id=p["employee"])
        if p.get("type"):
            qs = qs.filter(type=p["type"])
        return qs

    def list(self, request, *args, **kwargs):
        items = list(self.get_queryset())
        state = request.query_params.get("state")
        if state:
            today = timezone.localdate()
            items = [c for c in items if c.state(today) == state]
        return Response(self.get_serializer(items, many=True).data)

    def perform_create(self, serializer):
        c = Contract(**serializer.validated_data)
        rules.validate_contract(c)
        c.save()
        serializer.instance = c

    def perform_update(self, serializer):
        c = serializer.instance
        for k, v in serializer.validated_data.items():
            setattr(c, k, v)
        rules.validate_contract(c)
        c.save()

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        c = self.get_object()
        c.archived = True
        c.save()
        return Response(self.get_serializer(c).data)


# ------------------------------------------------------------------------------ leave
class LeaveViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveSerializer
    permission_classes = [IsHR]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Leave.objects.select_related("employee__service", "decided_by")
        p = self.request.query_params
        for key in ("status", "type"):
            if p.get(key):
                qs = qs.filter(**{key: p[key]})
        if p.get("employee"):
            qs = qs.filter(employee_id=p["employee"])
        if p.get("year"):
            qs = qs.filter(start_date__year=p["year"])
        return qs

    def perform_create(self, serializer):
        lv = Leave(**serializer.validated_data)
        rules.validate_leave(lv)
        lv.save()
        serializer.instance = lv

    def perform_update(self, serializer):
        lv = serializer.instance
        if lv.status != Leave.Status.PENDING:
            raise rules.RuleError("not_pending", "Only pending requests can be modified.")
        for k, v in serializer.validated_data.items():
            setattr(lv, k, v)
        rules.validate_leave(lv)
        lv.save()

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        lv = rules.decide_leave(self.get_object(), True, request.user, str(request.data.get("comment", "")))
        return Response(self.get_serializer(lv).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        lv = rules.decide_leave(self.get_object(), False, request.user, str(request.data.get("comment", "")))
        return Response(self.get_serializer(lv).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        lv = rules.cancel_leave(self.get_object(), by_employee=False)
        return Response(self.get_serializer(lv).data)


# ------------------------------------------------------------------------------ attendance
class AttendanceViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [IsHR]

    def get_queryset(self):
        qs = Attendance.objects.select_related("employee")
        p = self.request.query_params
        if p.get("employee"):
            qs = qs.filter(employee_id=p["employee"])
        if p.get("month"):
            first, last = rules.month_bounds(parse_month(p["month"]))
            qs = qs.filter(date__gte=first, date__lte=last)
        return qs

    @action(detail=False, methods=["get"])
    def day(self, request):
        on = parse_day(request.query_params.get("date"))
        rows = rules.day_sheet(on)
        counts = Counter(r["state"] for r in rows)
        return Response({
            "date": on.isoformat(), "working_day": rules.is_working_day(on), "counts": counts,
            "rows": [{"employee": r["employee"].id, "employee_name": r["employee"].full_name,
                      "service_name": r["employee"].service.name, "state": r["state"],
                      "attendance": AttendanceSerializer(r["attendance"]).data if r["attendance"] else None} for r in rows],
        })

    @action(detail=False, methods=["post"])
    def mark(self, request):
        emp = get_object_or_404(Employee, pk=request.data.get("employee"))
        on = parse_day(request.data.get("date"))
        state = request.data.get("status")
        if state not in ("present", "absent"):
            raise ValidationError({"status": "present or absent"})
        if on > timezone.localdate():
            raise rules.RuleError("future_date", "Attendance cannot be recorded in the future.")
        rec, _ = Attendance.objects.get_or_create(employee=emp, date=on)
        ser = AttendanceSerializer(rec, data={**request.data, "employee": emp.id, "date": on.isoformat(), "status": state}, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        if state == "absent":
            rec.refresh_from_db()
            rec.check_in = rec.check_out = None
            rec.save()
        return Response(AttendanceSerializer(rec).data)


# ------------------------------------------------------------------------------ payroll
class PayslipViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = PayslipSerializer
    permission_classes = [IsHR]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Payslip.objects.select_related("employee__service")
        p = self.request.query_params
        if p.get("period"):
            qs = qs.filter(period=parse_month(p["period"]))
        if p.get("employee"):
            qs = qs.filter(employee_id=p["employee"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        return qs

    def perform_update(self, serializer):
        p = serializer.instance
        if p.status == Payslip.Status.VALIDATED:
            raise rules.RuleError("already_validated", "A validated payslip cannot be changed.")
        for k, v in serializer.validated_data.items():
            setattr(p, k, v)
        rules.compute_payslip(p).save()

    @action(detail=False, methods=["post"])
    def generate(self, request):
        return Response(rules.generate_payroll(parse_month(request.data.get("period"))))

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        return Response(self.get_serializer(rules.validate_payslip(self.get_object())).data)

    @action(detail=False, methods=["post"], url_path="validate-all")
    def validate_all(self, request):
        period = parse_month(request.data.get("period"))
        n = 0
        for p in Payslip.objects.filter(period=period, status=Payslip.Status.DRAFT):
            rules.validate_payslip(p)
            n += 1
        return Response({"validated": n})


# ------------------------------------------------------------------------------ recruitment
class JobOfferViewSet(viewsets.ModelViewSet):
    serializer_class = JobOfferSerializer
    permission_classes = [IsHR]

    def get_queryset(self):
        return JobOffer.objects.select_related("service").annotate(applications_count=Count("applications"))


class ApplicationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = ApplicationSerializer
    permission_classes = [IsHR]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Application.objects.select_related("offer")
        p = self.request.query_params
        if p.get("offer"):
            qs = qs.filter(offer_id=p["offer"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        return qs

    def perform_update(self, serializer):
        if serializer.validated_data.get("status") == Application.Status.HIRED:
            raise rules.RuleError("use_hire", "Use the hire action to hire a candidate.")
        serializer.save()

    @action(detail=True, methods=["get"])
    def cv(self, request, pk=None):
        app = self.get_object()
        if not app.cv:
            raise NotFound("No CV.")
        return FileResponse(app.cv.open("rb"), content_type="application/pdf", as_attachment=False,
                            filename=f"CV-{app.first_name}-{app.last_name}.pdf")

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def hire(self, request, pk=None):
        """Turn a candidate into an employee (+ login, + contract) in one step."""
        app = self.get_object()
        if app.status == Application.Status.HIRED:
            raise rules.RuleError("already_hired", "This candidate has already been hired.")
        offer = app.offer
        service_id = request.data.get("service") or offer.service_id
        if not service_id:
            raise ValidationError({"service": "Choose the service of the new employee."})
        if Employee.objects.filter(email=app.email).exists():
            raise ValidationError({"email": "An employee already uses this email."})
        start = parse_day(request.data.get("start_date"))
        emp = Employee.objects.create(first_name=app.first_name, last_name=app.last_name, email=app.email, phone=app.phone,
                                      service_id=service_id, position=offer.title, hire_date=start)
        result = {"employee": emp.id}
        salary = request.data.get("monthly_salary")
        if salary not in (None, ""):
            ctype = request.data.get("contract_type") or offer.contract_type
            end = request.data.get("end_date") or None
            c = Contract(employee=emp, type=ctype, start_date=start, end_date=date.fromisoformat(end) if end else None,
                         monthly_salary=salary)
            rules.validate_contract(c)
            c.save()
            result["contract"] = c.id
        result["temporary_password"] = create_account(emp)
        app.status, app.employee = Application.Status.HIRED, emp
        app.save()
        return Response(result, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_jobs(request):
    today = timezone.localdate()
    qs = JobOffer.objects.filter(status=JobOffer.Status.OPEN, deadline__gte=today).select_related("service")
    return Response(PublicJobOfferSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_job(request, pk):
    offer = get_object_or_404(JobOffer, pk=pk)
    if not offer.is_open:
        raise NotFound("This offer is closed.")
    return Response(PublicJobOfferSerializer(offer).data)


class ApplyThrottle(SimpleRateThrottle):
    """At most 20 applications per hour from one address."""
    scope = "apply"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ApplyThrottle])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def public_apply(request, pk):
    offer = get_object_or_404(JobOffer, pk=pk)
    if not offer.is_open:
        raise rules.RuleError("offer_closed", "This offer is closed.")
    ser = PublicApplicationSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    if Application.objects.filter(offer=offer, email=ser.validated_data["email"]).exists():
        raise rules.RuleError("already_applied", "You have already applied to this offer.", "email")
    ser.save(offer=offer)
    return Response({"ok": True}, status=status.HTTP_201_CREATED)



@api_view(["GET"])
@permission_classes([AllowAny])
def public_settings(request):
    r = settings.HR_RULES
    return Response({"currency": r["CURRENCY"], "weekend": r["WEEKEND"], "annual_leave_per_month": float(r["ANNUAL_LEAVE_DAYS_PER_MONTH"]),
                     "max_leave_days": r["MAX_LEAVE_DAYS"], "social_security_rate": float(r["SOCIAL_SECURITY_RATE"]),
                     "demo": bool(getattr(settings, "DEMO", False)), "today": timezone.localdate().isoformat()})


# ------------------------------------------------------------------------------ dashboard
@api_view(["GET"])
@permission_classes([IsHR])
def dashboard(request):
    today = timezone.localdate()
    active = Employee.objects.filter(status=Employee.Status.ACTIVE)
    leave_ids = on_leave_ids(today) & set(active.values_list("id", flat=True))
    contracts = [c for c in Contract.objects.select_related("employee").filter(archived=False) if c.state(today) == "active"]
    ending = sorted([c for c in contracts if c.end_date and c.end_date <= today + timedelta(days=45)], key=lambda c: c.end_date)
    sheet = rules.day_sheet(today)
    last_period = Payslip.objects.order_by("-period").values_list("period", flat=True).first()
    payroll = None
    if last_period:
        agg = Payslip.objects.filter(period=last_period).aggregate(total=Sum("net"), n=Count("id"))
        payroll = {"period": last_period.isoformat(), "total_net": float(agg["total"] or 0), "count": agg["n"],
                   "validated": Payslip.objects.filter(period=last_period, status="validated").count()}
    hires = Counter()
    for d in Employee.objects.filter(hire_date__gte=today.replace(day=1) - timedelta(days=365)).values_list("hire_date", flat=True):
        hires[d.strftime("%Y-%m")] += 1
    months = []
    m = today.replace(day=1)
    for _ in range(12):
        months.append(m.strftime("%Y-%m"))
        m = (m - timedelta(days=1)).replace(day=1)
    return Response({
        "today": today.isoformat(),
        "employees": active.count(),
        "on_leave": len(leave_ids),
        "services": Service.objects.count(),
        "pending_leaves": Leave.objects.filter(status=Leave.Status.PENDING).count(),
        "active_contracts": len(contracts),
        "contracts_by_type": dict(Counter(c.type for c in contracts)),
        "contracts_ending": [{"id": c.id, "employee": c.employee_id, "employee_name": c.employee.full_name, "type": c.type,
                              "end_date": c.end_date.isoformat()} for c in ending[:8]],
        "open_offers": JobOffer.objects.filter(status="open", deadline__gte=today).count(),
        "new_applications": Application.objects.filter(status=Application.Status.RECEIVED).count(),
        "attendance_today": {"working_day": rules.is_working_day(today), **Counter(r["state"] for r in sheet)},
        "headcount_by_service": list(Service.objects.annotate(n=Count("employees", filter=Q(employees__status="active")))
                                     .values("id", "name", "n")),
        "leaves_by_type": dict(Leave.objects.filter(status="approved", start_date__year=today.year)
                               .values_list("type").annotate(d=Sum("days")).values_list("type", "d")),
        "hires_by_month": [{"month": mm, "n": hires.get(mm, 0)} for mm in reversed(months)],
        "payroll": payroll,
        "pending_list": LeaveSerializer(Leave.objects.filter(status="pending").select_related("employee__service")[:6], many=True).data,
    })


# ------------------------------------------------------------------------------ employee portal (/api/me/...)
def me_employee(request) -> Employee:
    return request.user.employee


@api_view(["GET", "PATCH"])
@permission_classes([IsEmployee])
def my_profile(request):
    emp = me_employee(request)
    if request.method == "PATCH":
        allowed = {k: v for k, v in request.data.items() if k in ("phone", "address")}
        ser = EmployeeSerializer(emp, data=allowed, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
    data = dict(EmployeeSerializer(emp).data)
    c = rules.active_contract(emp)
    data["contract_detail"] = ContractSerializer(c).data if c else None
    data["balance"] = rules.leave_balance(emp).as_dict()
    return Response(data)


@api_view(["GET", "POST"])
@permission_classes([IsEmployee])
def my_leaves(request):
    emp = me_employee(request)
    if request.method == "POST":
        ser = MyLeaveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        lv = Leave(employee=emp, **ser.validated_data)
        rules.validate_leave(lv, by_employee=True)
        lv.save()
        return Response(MyLeaveSerializer(lv).data, status=status.HTTP_201_CREATED)
    return Response({"balance": rules.leave_balance(emp).as_dict(),
                     "leaves": MyLeaveSerializer(emp.leaves.select_related("decided_by"), many=True).data})


@api_view(["POST"])
@permission_classes([IsEmployee])
def my_leave_cancel(request, pk):
    lv = get_object_or_404(Leave, pk=pk, employee=me_employee(request))
    return Response(MyLeaveSerializer(rules.cancel_leave(lv, by_employee=True)).data)


@api_view(["GET"])
@permission_classes([IsEmployee])
def my_attendance(request):
    emp = me_employee(request)
    first, last = rules.month_bounds(parse_month(request.query_params.get("month")))
    recs = Attendance.objects.filter(employee=emp, date__gte=first, date__lte=last)
    today = Attendance.objects.filter(employee=emp, date=timezone.localdate()).first()
    hours = sum(r.hours or 0 for r in recs)
    return Response({"month": first.strftime("%Y-%m"), "records": AttendanceSerializer(recs, many=True).data,
                     "today": AttendanceSerializer(today).data if today else None, "total_hours": round(hours, 2),
                     "present": recs.filter(status="present").count(), "absent": recs.filter(status="absent").count(),
                     "state": rules.employee_state(emp)})


@api_view(["POST"])
@permission_classes([IsEmployee])
def my_clock(request):
    return Response(AttendanceSerializer(rules.clock(me_employee(request))).data)


@api_view(["GET"])
@permission_classes([IsEmployee])
def my_payslips(request):
    qs = Payslip.objects.filter(employee=me_employee(request), status=Payslip.Status.VALIDATED).select_related("employee__service")
    return Response(PayslipSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsEmployee])
def my_payslip(request, pk):
    p = get_object_or_404(Payslip, pk=pk, employee=me_employee(request), status=Payslip.Status.VALIDATED)
    return Response(PayslipSerializer(p).data)
