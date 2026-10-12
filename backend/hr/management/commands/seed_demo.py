"""Fill the database with a fictional company, with dates relative to today.

    python manage.py seed_demo            # adds the data (run it on an empty database)
    python manage.py seed_demo --reset    # deletes all HR data and users first

Logins:  hr@demo.dz / demo1234 (HR)      employe@demo.dz / demo1234 (employee)
All names, emails and phone numbers are invented.
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from hr import rules
from hr.models import Application, Attendance, Contract, Employee, JobOffer, Leave, Payslip, Service

User = get_user_model()
PASSWORD = "demo1234"

SERVICES = [
    ("Direction générale", "Pilotage de l'entreprise"),
    ("Ressources humaines", "Recrutement, paie, formation et relations sociales"),
    ("Informatique", "Systèmes d'information, développement et support"),
    ("Finance et comptabilité", "Comptabilité, trésorerie et contrôle de gestion"),
    ("Commercial", "Ventes, relation client et marketing"),
    ("Production", "Fabrication et contrôle qualité"),
    ("Logistique", "Achats, stocks et transport"),
]
# (first name, last name, service index, position, monthly salary in DZD)
PEOPLE = [
    ("Karim", "Mansouri", 0, "Directeur général", 320000),
    ("Leila", "Hamidi", 1, "Responsable RH", 190000),
    ("Sofiane", "Belkacem", 1, "Chargé de paie", 95000),
    ("Meriem", "Saadi", 1, "Chargée de recrutement", 88000),
    ("Yasmine", "Kaci", 2, "Développeuse web", 140000),
    ("Amine", "Benali", 2, "Responsable informatique", 210000),
    ("Rania", "Ouali", 2, "Administratrice systèmes", 125000),
    ("Nassim", "Ferhat", 2, "Développeur mobile", 118000),
    ("Ines", "Touati", 2, "Stagiaire en data science", 25000),
    ("Hichem", "Meziane", 3, "Directeur financier", 230000),
    ("Samira", "Boukhalfa", 3, "Comptable", 92000),
    ("Walid", "Cherif", 3, "Contrôleur de gestion", 128000),
    ("Lina", "Brahimi", 3, "Assistante comptable", 64000),
    ("Mehdi", "Larbi", 4, "Directeur commercial", 205000),
    ("Sarah", "Amrani", 4, "Commerciale", 78000),
    ("Rachid", "Djebbar", 4, "Commercial", 76000),
    ("Asma", "Rahmani", 4, "Chargée de marketing", 86000),
    ("Bilal", "Zerrouki", 4, "Commercial junior", 58000),
    ("Mourad", "Slimani", 5, "Responsable de production", 175000),
    ("Kamel", "Haddad", 5, "Technicien de maintenance", 72000),
    ("Fatima", "Bouzid", 5, "Contrôleuse qualité", 81000),
    ("Djamel", "Aissaoui", 5, "Opérateur de production", 52000),
    ("Nabil", "Hadj Ali", 5, "Opérateur de production", 50000),
    ("Imene", "Guerfi", 5, "Technicienne qualité", 69000),
    ("Farid", "Khelifi", 6, "Responsable logistique", 150000),
    ("Hanane", "Mebarki", 6, "Acheteuse", 84000),
    ("Youcef", "Benamar", 6, "Magasinier", 47000),
    ("Malika", "Ziani", 6, "Agent de transit", 61000),
]
DISTRICTS = ["Bab Ezzouar", "Hydra", "Kouba", "El Biar", "Bir Mourad Raïs", "Chéraga", "Dely Ibrahim", "Ben Aknoun",
             "Birkhadem", "Rouiba", "Draria", "Hussein Dey", "Bordj El Kiffan", "Saoula"]
SKILLS = {0: "Stratégie, Management", 1: "Droit du travail, Paie, Recrutement", 2: "Python, Django, React, SQL",
          3: "Comptabilité, Excel, Fiscalité", 4: "Négociation, CRM, Marketing digital", 5: "Qualité, Maintenance, Sécurité",
          6: "Achats, Gestion de stock, Transport"}


def tiny_pdf(text: str) -> bytes:
    """A valid one-page PDF with a line of text (stands in for a candidate's CV)."""
    stream = f"BT /F1 18 Tf 72 720 Td ({text}) Tj ET".encode("latin-1", "replace")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return out


def working_days_back(today: date, n: int) -> list[date]:
    days, d = [], today - timedelta(days=1)
    while len(days) < n:
        if rules.is_working_day(d):
            days.append(d)
        d -= timedelta(days=1)
    return days


class Command(BaseCommand):
    help = "Create a fictional company with employees, contracts, leaves, attendance, payslips and job offers."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="delete all HR data and users first")
        parser.add_argument("--seed", type=int, default=7)

    @transaction.atomic
    def handle(self, *args, reset=False, seed=7, **opts):
        if reset:
            for m in (Application, JobOffer, Payslip, Attendance, Leave, Contract):
                m.objects.all().delete()
            User.objects.all().delete()
            Employee.objects.all().delete()
            Service.objects.all().delete()
        if Employee.objects.exists():
            self.stdout.write("The database already has employees: use --reset to start over.")
            return
        rng = random.Random(seed)
        today = timezone.localdate()
        services = [Service.objects.create(name=n, description=d) for n, d in SERVICES]

        employees = []
        for i, (first, last, s, position, salary) in enumerate(PEOPLE):
            years = rng.choice([0, 1, 1, 2, 3, 4, 5, 6, 8, 10, 12])
            hire = today - timedelta(days=365 * years + rng.randint(30, 330))
            if first == "Ines":
                hire = today - timedelta(days=75)            # an intern who started recently
            if first == "Bilal":
                hire = today - timedelta(days=150)
            email = f"{first}.{last}".lower().replace(" ", "") .replace("é", "e").replace("ï", "i") + "@entreprise-demo.dz"
            emp = Employee.objects.create(
                first_name=first, last_name=last, email=email, service=services[s], position=position, hire_date=hire,
                birth_date=date(rng.randint(1968, 2002), rng.randint(1, 12), rng.randint(1, 28)),
                phone=f"+213 5{rng.randint(50, 69)} {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
                address=f"{rng.randint(1, 120)}, rue {rng.choice(['des Frères Bouadou', 'Didouche Mourad', 'Hassiba Ben Bouali', 'Larbi Ben Mhidi', 'des Martyrs'])}, {rng.choice(DISTRICTS)}, Alger",
                skills=SKILLS[s])
            employees.append((emp, salary))

        # contracts: mostly CDI; a few fixed-term contracts end soon; interns
        for k, (emp, salary) in enumerate(employees):
            if emp.first_name == "Ines":
                Contract.objects.create(employee=emp, type=Contract.Type.INTERNSHIP, start_date=emp.hire_date,
                                        end_date=emp.hire_date + timedelta(days=180), monthly_salary=salary)
            elif emp.first_name in ("Bilal", "Nabil", "Malika"):
                end = today + timedelta(days={"Bilal": 18, "Nabil": 33, "Malika": 140}[emp.first_name])
                Contract.objects.create(employee=emp, type=Contract.Type.CDD, start_date=max(emp.hire_date, end - timedelta(days=365)),
                                        end_date=end, monthly_salary=salary)
                if emp.hire_date < end - timedelta(days=365):          # an earlier, finished contract
                    Contract.objects.create(employee=emp, type=Contract.Type.CDD, start_date=emp.hire_date,
                                            end_date=end - timedelta(days=366), monthly_salary=int(salary * 0.9))
            else:
                Contract.objects.create(employee=emp, type=Contract.Type.CDI, start_date=emp.hire_date, monthly_salary=salary)

        emps = [e for e, _ in employees]
        by_name = {e.first_name: e for e in emps}

        # accounts
        hr_user = User.objects.create_user(username="hr@demo.dz", email="hr@demo.dz", password=PASSWORD, first_name="Leila",
                                           last_name="Hamidi", role=User.Role.HR, employee=by_name["Leila"])
        User.objects.create_user(username="employe@demo.dz", email="employe@demo.dz", password=PASSWORD, first_name="Yasmine",
                                 last_name="Kaci", role=User.Role.EMPLOYEE, employee=by_name["Yasmine"])
        for name in ("Amine", "Sarah", "Kamel"):
            e = by_name[name]
            User.objects.create_user(username=e.email, email=e.email, password=PASSWORD, first_name=e.first_name,
                                     last_name=e.last_name, role=User.Role.EMPLOYEE, employee=e)

        # leave: past approved ones, people on leave today, pending requests, one rejected, one unpaid
        def leave(emp, typ, start, end, status, reason=""):
            lv = Leave(employee=emp, type=typ, start_date=start, end_date=end, reason=reason, status=status,
                       days=rules.working_days(start, end))
            if status in (Leave.Status.APPROVED, Leave.Status.REJECTED):
                lv.decided_by, lv.decided_at = hr_user, timezone.now() - timedelta(days=rng.randint(3, 40))
            lv.save()
            return lv

        y0 = date(today.year, 1, 1)
        for emp in rng.sample(emps, 12):
            start = y0 + timedelta(days=rng.randint(5, max(6, (today - y0).days - 20)))
            if start < emp.hire_date or start >= today - timedelta(days=3):
                continue
            end = start + timedelta(days=rng.choice([2, 4, 6, 9]))
            if end < today and rules.working_days(start, end) <= float(rules.leave_balance(emp).available):
                leave(emp, Leave.Type.ANNUAL, start, end, Leave.Status.APPROVED)
        leave(by_name["Rachid"], Leave.Type.ANNUAL, today - timedelta(days=2), today + timedelta(days=6), Leave.Status.APPROVED)
        leave(by_name["Fatima"], Leave.Type.SICK, today - timedelta(days=1), today + timedelta(days=3), Leave.Status.APPROVED,
              "Certificat médical n° 2417")
        leave(by_name["Samira"], Leave.Type.MATERNITY, today - timedelta(days=30), today + timedelta(days=67), Leave.Status.APPROVED)
        leave(by_name["Walid"], Leave.Type.SICK, today - timedelta(days=50), today - timedelta(days=48), Leave.Status.APPROVED,
              "Grippe, certificat médical")
        last_month_first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        leave(by_name["Youcef"], Leave.Type.UNPAID, last_month_first + timedelta(days=9), last_month_first + timedelta(days=11),
              Leave.Status.APPROVED, "Raisons familiales")
        nxt = today + timedelta(days=12)
        leave(by_name["Yasmine"], Leave.Type.ANNUAL, nxt, nxt + timedelta(days=4), Leave.Status.PENDING, "Voyage en famille")
        leave(by_name["Kamel"], Leave.Type.ANNUAL, today + timedelta(days=20), today + timedelta(days=27), Leave.Status.PENDING)
        leave(by_name["Asma"], Leave.Type.ANNUAL, today + timedelta(days=5),
              today + timedelta(days=7), Leave.Status.PENDING, "Mariage d'un proche")
        leave(by_name["Hichem"], Leave.Type.PATERNITY, today + timedelta(days=9), today + timedelta(days=11), Leave.Status.PENDING,
              "Naissance prévue")
        leave(by_name["Djamel"], Leave.Type.ANNUAL, today + timedelta(days=3), today + timedelta(days=14), Leave.Status.REJECTED)
        Leave.objects.filter(employee=by_name["Djamel"], status=Leave.Status.REJECTED).update(
            decision_comment="Période de forte production : merci de proposer d'autres dates.")

        # attendance: the last 45 working days, plus this morning for part of the team
        leaves = list(Leave.objects.filter(status=Leave.Status.APPROVED))
        rows = []
        for d in working_days_back(today, 45):
            for emp in emps:
                if d < emp.hire_date or any(lv.employee_id == emp.id and lv.start_date <= d <= lv.end_date for lv in leaves):
                    continue
                if rng.random() < 0.025:
                    rows.append(Attendance(employee=emp, date=d, status=Attendance.Status.ABSENT, note="Absence non justifiée"))
                    continue
                cin = datetime.combine(d, time(7, 30)) + timedelta(minutes=rng.randint(0, 95))
                cout = datetime.combine(d, time(16, 0)) + timedelta(minutes=rng.randint(0, 100))
                rows.append(Attendance(employee=emp, date=d, status=Attendance.Status.PRESENT, check_in=cin.time(), check_out=cout.time()))
        if rules.is_working_day(today):
            for emp in emps:
                if rules.employee_state(emp, today) == "active" and emp.first_name != "Yasmine" and rng.random() < 0.75:
                    cin = datetime.combine(today, time(7, 35)) + timedelta(minutes=rng.randint(0, 70))
                    rows.append(Attendance(employee=emp, date=today, status=Attendance.Status.PRESENT, check_in=cin.time()))
        Attendance.objects.bulk_create(rows)

        # payroll: the two previous months, validated, with a few bonuses and one salary advance
        for months_back in (2, 1):
            period = today.replace(day=1)
            for _ in range(months_back):
                period = (period - timedelta(days=1)).replace(day=1)
            rules.generate_payroll(period)
            for p in Payslip.objects.filter(period=period):
                if rng.random() < 0.25:
                    p.bonus = Decimal(rng.choice([5000, 8000, 10000, 15000]))
                if p.employee.first_name == "Kamel" and months_back == 1:
                    p.advance = Decimal(20000)
                rules.validate_payslip(p)

        # recruitment
        offers = [
            JobOffer.objects.create(title="Développeur·se Python / Django", service=services[2], contract_type="CDI",
                                    location="Alger (Bab Ezzouar)", deadline=today + timedelta(days=24),
                                    description="Vous rejoignez l'équipe informatique pour développer nos applications internes (RH, finance, logistique).",
                                    requirements="Python, Django, SQL ; bonus : React, Docker. 2 ans d'expérience."),
            JobOffer.objects.create(title="Comptable confirmé·e", service=services[3], contract_type="CDI", location="Alger",
                                    deadline=today + timedelta(days=15),
                                    description="Tenue de la comptabilité générale, déclarations fiscales et sociales, clôtures mensuelles.",
                                    requirements="Licence en comptabilité, 3 ans d'expérience, maîtrise d'un ERP."),
            JobOffer.objects.create(title="Stage : analyse de données RH", service=services[1], contract_type="STAGE",
                                    location="Alger (hybride)", deadline=today + timedelta(days=40),
                                    description="Stage de 6 mois : tableaux de bord RH, analyse de l'absentéisme et du turnover.",
                                    requirements="Master 1 ou 2 en mathématiques appliquées, statistique ou informatique. Python ou R."),
            JobOffer.objects.create(title="Technicien·ne de maintenance", service=services[5], contract_type="CDD",
                                    location="Rouiba", deadline=today - timedelta(days=10), status=JobOffer.Status.CLOSED,
                                    description="Maintenance préventive et corrective des lignes de production.",
                                    requirements="BTS en électromécanique."),
        ]
        candidates = [("Adel", "Hamdi", 0, "interview"), ("Nour", "Benyahia", 0, "shortlisted"), ("Sami", "Rezig", 0, "received"),
                      ("Kenza", "Mokrani", 1, "received"), ("Omar", "Ait Ouali", 1, "rejected"), ("Lydia", "Sahraoui", 2, "received"),
                      ("Ryad", "Boudjemaa", 2, "shortlisted"), ("Anis", "Taleb", 3, "hired")]
        for first, last, o, status in candidates:
            a = Application(offer=offers[o], first_name=first, last_name=last, status=status,
                            email=f"{first}.{last}".lower().replace(" ", "") + "@mail-demo.dz",
                            phone=f"+213 6{rng.randint(60, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
                            cover_letter="Madame, Monsieur, votre offre correspond à mon parcours et je serais heureux·se d'en discuter.")
            if status == "interview":
                a.interview_at = timezone.make_aware(datetime.combine(today + timedelta(days=4), time(10, 0)))
            a.cv.save(f"cv-{first}-{last}.pdf", ContentFile(tiny_pdf(f"CV - {first} {last}")), save=False)
            a.save()
        if opts.get("verbosity", 1) > 0:
            self.stdout.write(self.style.SUCCESS(
                f"{Employee.objects.count()} employees, {Contract.objects.count()} contracts, {Leave.objects.count()} leaves, "
                f"{Attendance.objects.count()} attendance records, {Payslip.objects.count()} payslips, "
                f"{JobOffer.objects.count()} offers, {Application.objects.count()} applications. "
                f"Logins: hr@demo.dz / {PASSWORD} and employe@demo.dz / {PASSWORD}"))
