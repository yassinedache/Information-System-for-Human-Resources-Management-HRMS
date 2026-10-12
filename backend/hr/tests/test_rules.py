from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from hr import rules
from hr.models import Attendance, Contract, Employee, Leave, Payslip, Service


def make_employee(**kw):
    service = Service.objects.get_or_create(name=kw.pop("service", "Informatique"))[0]
    defaults = dict(first_name="Test", last_name="User", email=f"t{Employee.objects.count()}@x.dz", service=service,
                    hire_date=date(2020, 1, 1))
    defaults.update(kw)
    return Employee.objects.create(**defaults)


class CalendarTests(TestCase):
    def test_friday_and_saturday_are_off(self):
        # 2026-10-11 is a Sunday: Sunday-Thursday = 5 working days, Friday and Saturday excluded
        self.assertEqual(rules.working_days(date(2026, 10, 11), date(2026, 10, 17)), 5)
        self.assertFalse(rules.is_working_day(date(2026, 10, 16)))   # Friday
        self.assertEqual(rules.working_days(date(2026, 10, 16), date(2026, 10, 17)), 0)

    def test_months_worked(self):
        self.assertEqual(rules.months_worked(date(2026, 1, 1), date(2026, 10, 12)), 9)
        self.assertEqual(rules.months_worked(date(2026, 3, 15), date(2026, 4, 14)), 0)
        self.assertEqual(rules.months_worked(date(2026, 3, 15), date(2026, 4, 15)), 1)


class LeaveTests(TestCase):
    def setUp(self):
        self.emp = make_employee(hire_date=date(2015, 5, 1))
        self.today = timezone.localdate()

    def test_balance_accrues_two_and_a_half_days_per_month(self):
        b = rules.leave_balance(self.emp, 2026, today=date(2026, 10, 12))
        self.assertEqual(b.entitlement, Decimal("22.5"))
        late = make_employee(hire_date=date(2026, 8, 20))
        self.assertEqual(rules.leave_balance(late, 2026, today=date(2026, 10, 12)).entitlement, Decimal("2.5"))
        self.assertEqual(rules.leave_balance(self.emp, 2025, today=date(2026, 10, 12)).entitlement, Decimal("30"))

    def future_period(self, offset, n):
        start = self.today + timedelta(days=offset)
        return start, start + timedelta(days=n)

    def test_overlap_and_sick_reason(self):
        s, e = self.future_period(30, 2)
        Leave.objects.create(employee=self.emp, type="sick", start_date=s, end_date=e, reason="x", status="approved",
                             days=rules.working_days(s, e))
        with self.assertRaises(rules.RuleError) as ctx:
            rules.validate_leave(Leave(employee=self.emp, type="unpaid", start_date=e, end_date=e + timedelta(days=2)))
        self.assertEqual(ctx.exception.code, "leave_overlap")
        with self.assertRaises(rules.RuleError) as ctx:
            rules.validate_leave(Leave(employee=self.emp, type="sick", start_date=e + timedelta(days=10), end_date=e + timedelta(days=11)))
        self.assertEqual(ctx.exception.code, "reason_required")

    def test_insufficient_balance_and_limits(self):
        y = self.today.year
        start = max(self.today + timedelta(days=1), date(y, 1, 1))
        long = Leave(employee=self.emp, type="annual", start_date=start, end_date=date(y, 12, 31))
        if rules.working_days(start, date(y, 12, 31)) > float(rules.leave_balance(self.emp).available):
            with self.assertRaises(rules.RuleError) as ctx:
                rules.validate_leave(long)
            self.assertEqual(ctx.exception.code, "insufficient_balance")
        s, _ = self.future_period(40, 0)
        with self.assertRaises(rules.RuleError) as ctx:
            rules.validate_leave(Leave(employee=self.emp, type="paternity", start_date=s, end_date=s + timedelta(days=10)))
        self.assertEqual(ctx.exception.code, "too_long")
        with self.assertRaises(rules.RuleError) as ctx:
            rules.validate_leave(Leave(employee=self.emp, type="annual", start_date=self.today - timedelta(days=3),
                                       end_date=self.today), by_employee=True)
        self.assertEqual(ctx.exception.code, "leave_in_past")

    def test_approval_happens_once_and_counts_once(self):
        s = self.today + timedelta(days=60)
        while not rules.is_working_day(s) or s.year != (s + timedelta(days=3)).year:
            s -= timedelta(days=1)
        e = s
        lv = Leave(employee=self.emp, type="annual", start_date=s, end_date=e)
        rules.validate_leave(lv)
        lv.save()
        before = rules.leave_balance(self.emp, s.year)
        self.assertEqual(before.pending, lv.days)
        lv = rules.decide_leave(lv, True, None)
        after = rules.leave_balance(self.emp, s.year)
        self.assertEqual((after.taken, after.pending), (lv.days, 0))
        self.assertEqual(after.available, before.available)           # reserved, then taken: counted once
        with self.assertRaises(rules.RuleError):
            rules.decide_leave(lv, True, None)                        # the bug of the 2025 version: deducted on every save
        lv.save()
        self.assertEqual(rules.leave_balance(self.emp, s.year).taken, lv.days)

    def test_state_on_leave(self):
        Leave.objects.create(employee=self.emp, type="sick", start_date=self.today, end_date=self.today, reason="x",
                             status="approved", days=1)
        self.assertEqual(rules.employee_state(self.emp), "on_leave")


class ContractTests(TestCase):
    def test_one_active_contract_at_a_time(self):
        emp = make_employee()
        Contract.objects.create(employee=emp, type="CDI", start_date=date(2020, 1, 1), monthly_salary=100000)
        with self.assertRaises(rules.RuleError) as ctx:
            rules.validate_contract(Contract(employee=emp, type="CDD", start_date=date(2027, 1, 1), end_date=date(2027, 6, 30),
                                             monthly_salary=1))
        self.assertEqual(ctx.exception.code, "contract_overlap")
        with self.assertRaises(rules.RuleError) as ctx:
            rules.validate_contract(Contract(employee=make_employee(), type="CDD", start_date=date(2027, 1, 1), monthly_salary=1))
        self.assertEqual(ctx.exception.code, "contract_end_required")

    def test_successive_contracts_are_fine(self):
        emp = make_employee()
        Contract.objects.create(employee=emp, type="CDD", start_date=date(2025, 1, 1), end_date=date(2025, 12, 31), monthly_salary=1)
        rules.validate_contract(Contract(employee=emp, type="CDI", start_date=date(2026, 1, 1), monthly_salary=2))


class PayrollTests(TestCase):
    def setUp(self):
        self.emp = make_employee(hire_date=date(2024, 1, 1))
        Contract.objects.create(employee=self.emp, type="CDI", start_date=date(2024, 1, 1), monthly_salary=Decimal("90000"))

    def test_absences_unpaid_leave_bonus_advance(self):
        Attendance.objects.create(employee=self.emp, date=date(2026, 3, 2), status="absent")
        Attendance.objects.create(employee=self.emp, date=date(2026, 3, 3), status="present", check_in=time(8), check_out=time(16))
        Leave.objects.create(employee=self.emp, type="unpaid", start_date=date(2026, 3, 8), end_date=date(2026, 3, 9),
                             status="approved", days=2)
        p = rules.compute_payslip(Payslip(employee=self.emp, period=date(2026, 3, 1), bonus=Decimal("6000"), advance=Decimal("10000")))
        self.assertEqual((p.absence_days, p.unpaid_leave_days), (1, 2))
        self.assertEqual(p.base_salary, Decimal("90000.00"))
        self.assertEqual(p.absence_deduction, Decimal("9000.00"))         # 3 days x 90000 / 30
        self.assertEqual(p.gross, Decimal("87000.00"))
        self.assertEqual(p.social_security, Decimal("7830.00"))           # 9 %
        self.assertEqual(p.net, Decimal("69170.00"))                      # 87000 - 7830 - 10000

    def test_prorata_and_generation(self):
        new = make_employee(hire_date=date(2026, 3, 16))
        Contract.objects.create(employee=new, type="CDD", start_date=date(2026, 3, 16), end_date=date(2026, 9, 15),
                                monthly_salary=Decimal("62000"))
        res = rules.generate_payroll(date(2026, 3, 1))
        self.assertEqual(res["created"], 2)
        p = Payslip.objects.get(employee=new)
        self.assertEqual(p.prorata_days, 16)
        self.assertEqual(p.base_salary, Decimal("32000.00"))             # 62000 x 16 / 31
        rules.validate_payslip(p)
        res = rules.generate_payroll(date(2026, 3, 1))
        self.assertEqual((res["updated"], res["skipped_validated"]), (1, 1))
        with self.assertRaises(rules.RuleError):
            rules.validate_payslip(p)


class ClockTests(TestCase):
    def test_clock_in_then_out(self):
        emp = make_employee()
        now = timezone.make_aware(datetime.combine(timezone.localdate(), time(8, 5)))
        a = rules.clock(emp, now)
        self.assertEqual((a.check_in, a.check_out), (time(8, 5), None))
        a = rules.clock(emp, now + timedelta(hours=8, minutes=30))
        self.assertEqual(a.hours, 8.5)
        with self.assertRaises(rules.RuleError):
            rules.clock(emp, now + timedelta(hours=9))
