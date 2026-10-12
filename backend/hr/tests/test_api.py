from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from hr.models import Application, Employee, JobOffer, Leave, Payslip

User = get_user_model()
PDF = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"


@override_settings(MEDIA_ROOT="/tmp/hrms-test-media")
class ApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", verbosity=0)

    def setUp(self):
        cache.clear()                     # the login throttle (10 per minute) is shared between tests

    def login(self, email, password="demo1234"):
        c = APIClient(enforce_csrf_checks=True)
        token = c.get("/api/auth/csrf/").json()["csrfToken"]
        r = c.post("/api/auth/login/", {"email": email, "password": password}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code, 200, r.content)
        c.credentials(HTTP_X_CSRFTOKEN=r.json()["csrfToken"])
        return c

    def test_login_requires_csrf_and_valid_password(self):
        c = APIClient(enforce_csrf_checks=True)
        self.assertEqual(c.post("/api/auth/login/", {"email": "hr@demo.dz", "password": "demo1234"}, format="json").status_code, 403)
        token = c.get("/api/auth/csrf/").json()["csrfToken"]
        r = c.post("/api/auth/login/", {"email": "hr@demo.dz", "password": "wrong"}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.json()["code"], "invalid_credentials")
        self.assertEqual(APIClient().get("/api/employees/").status_code, 403)

    def test_roles(self):
        hr = self.login("hr@demo.dz")
        emp = self.login("employe@demo.dz")
        self.assertEqual(hr.get("/api/auth/me/").json()["role"], "hr")
        self.assertIsNone(APIClient().get("/api/auth/me/").json())                # a visitor
        self.assertEqual(emp.get("/api/auth/me/").json()["role"], "employee")
        for url in ("/api/employees/", "/api/leaves/", "/api/payslips/", "/api/dashboard/", "/api/applications/"):
            self.assertEqual(hr.get(url).status_code, 200, url)
            self.assertEqual(emp.get(url).status_code, 403, url)
        self.assertEqual(emp.get("/api/services/").status_code, 200)            # read-only for everyone
        self.assertEqual(emp.post("/api/services/", {"name": "X"}, format="json").status_code, 403)
        self.assertEqual(hr.get("/api/me/profile/").status_code, 200)            # the HR manager is also an employee

    def test_employee_only_sees_own_data(self):
        emp = self.login("employe@demo.dz")
        me = emp.get("/api/me/profile/").json()
        self.assertEqual(me["email"], Employee.objects.get(first_name="Yasmine").email)
        other = Payslip.objects.exclude(employee__first_name="Yasmine").first()
        self.assertEqual(emp.get(f"/api/me/payslips/{other.id}/").status_code, 404)
        r = emp.patch("/api/me/profile/", {"phone": "+213 555 00 00 00", "service": 1, "position": "CEO"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["phone"], "+213 555 00 00 00")
        self.assertNotEqual(r.json()["position"], "CEO")                       # only phone and address are editable

    def test_leave_request_flow(self):
        emp = self.login("employe@demo.dz")
        hr = self.login("hr@demo.dz")
        start = timezone.localdate() + timedelta(days=45)
        if start.year != (start + timedelta(days=1)).year:
            start += timedelta(days=3)
        r = emp.post("/api/me/leaves/", {"type": "annual", "start_date": start.isoformat(),
                                         "end_date": (start + timedelta(days=1)).isoformat()}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        lv = r.json()
        self.assertEqual(lv["status"], "pending")
        r = emp.post("/api/me/leaves/", {"type": "sick", "start_date": start.isoformat(), "end_date": start.isoformat(),
                                         "reason": "x"}, format="json")
        self.assertEqual(r.json()["code"], "leave_overlap")
        self.assertEqual(hr.post(f"/api/leaves/{lv['id']}/approve/", {}, format="json").json()["status"], "approved")
        self.assertEqual(hr.post(f"/api/leaves/{lv['id']}/approve/", {}, format="json").json()["code"], "not_pending")
        self.assertEqual(emp.post(f"/api/me/leaves/{lv['id']}/cancel/").json()["code"], "not_pending")

    def test_contract_rule_through_api(self):
        hr = self.login("hr@demo.dz")
        emp = Employee.objects.get(first_name="Yasmine")
        r = hr.post("/api/contracts/", {"employee": emp.id, "type": "CDD", "start_date": timezone.localdate().isoformat(),
                                        "end_date": (timezone.localdate() + timedelta(days=90)).isoformat(),
                                        "monthly_salary": "100000"}, format="json")
        self.assertEqual((r.status_code, r.json()["code"]), (400, "contract_overlap"))

    def test_create_employee_gives_a_temporary_password(self):
        hr = self.login("hr@demo.dz")
        service = hr.get("/api/services/").json()[0]["id"]
        r = hr.post("/api/employees/", {"first_name": "Nouvel", "last_name": "Employé", "email": "Nouvel@Exemple.dz",
                                        "service": service, "position": "Analyste"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pw = r.json()["temporary_password"]
        new = self.login("nouvel@exemple.dz", pw)
        self.assertTrue(new.get("/api/auth/me/").json()["must_change_password"])

    def test_payroll_generation_and_validation(self):
        hr = self.login("hr@demo.dz")
        period = timezone.localdate().strftime("%Y-%m")
        res = hr.post("/api/payslips/generate/", {"period": period}, format="json").json()
        self.assertGreater(res["created"], 20)
        p = hr.get(f"/api/payslips/?period={period}").json()[0]
        r = hr.patch(f"/api/payslips/{p['id']}/", {"bonus": "5000"}, format="json").json()
        self.assertEqual(float(r["bonus"]), 5000)
        self.assertEqual(hr.post(f"/api/payslips/{p['id']}/validate/").json()["status"], "validated")
        self.assertEqual(hr.patch(f"/api/payslips/{p['id']}/", {"bonus": "1"}, format="json").json()["code"], "already_validated")

    def test_public_application_and_hire(self):
        offer = JobOffer.objects.filter(status="open").first()
        anon = APIClient()
        self.assertEqual(len(anon.get("/api/public/jobs/").json()), 3)
        bad = anon.post(f"/api/public/jobs/{offer.id}/apply/", {"first_name": "A", "last_name": "B", "email": "a@b.dz",
                                                               "cv": SimpleUploadedFile("cv.pdf", b"not a pdf")}, format="multipart")
        self.assertEqual(bad.status_code, 400)
        ok = anon.post(f"/api/public/jobs/{offer.id}/apply/", {"first_name": "Amel", "last_name": "Test", "email": "amel@b.dz",
                                                              "cv": SimpleUploadedFile("cv.pdf", PDF, "application/pdf")}, format="multipart")
        self.assertEqual(ok.status_code, 201, ok.content)
        again = anon.post(f"/api/public/jobs/{offer.id}/apply/", {"first_name": "Amel", "last_name": "Test", "email": "AMEL@b.dz",
                                                                 "cv": SimpleUploadedFile("cv.pdf", PDF)}, format="multipart")
        self.assertEqual(again.json()["code"], "already_applied")
        closed = JobOffer.objects.filter(status="closed").first()
        self.assertEqual(anon.get(f"/api/public/jobs/{closed.id}/").status_code, 404)
        hr = self.login("hr@demo.dz")
        app = Application.objects.get(email="amel@b.dz")
        cv = hr.get(f"/api/applications/{app.id}/cv/")
        self.assertEqual((cv.status_code, b"".join(cv.streaming_content)[:5]), (200, b"%PDF-"))
        r = hr.post(f"/api/applications/{app.id}/hire/", {"monthly_salary": "120000", "contract_type": "CDI"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        emp = Employee.objects.get(pk=r.json()["employee"])
        self.assertEqual((emp.email, emp.contracts.count(), emp.user.must_change_password), ("amel@b.dz", 1, True))
        self.assertEqual(hr.post(f"/api/applications/{app.id}/hire/", {}, format="json").json()["code"], "already_hired")

    def test_dashboard_and_clock(self):
        hr = self.login("hr@demo.dz")
        d = hr.get("/api/dashboard/").json()
        self.assertEqual(d["employees"], 28)
        self.assertEqual(d["on_leave"], 3)
        self.assertEqual(d["pending_leaves"], 4)
        self.assertGreaterEqual(len(d["contracts_ending"]), 2)
        emp = self.login("employe@demo.dz")
        first = emp.post("/api/me/attendance/clock/").json()
        self.assertIsNotNone(first["check_in"])
        self.assertIsNone(first["check_out"])
        self.assertIsNotNone(emp.post("/api/me/attendance/clock/").json()["check_out"])
        day = hr.get(f"/api/attendance/day/?date={timezone.localdate().isoformat()}").json()
        self.assertEqual(len(day["rows"]), 28)
