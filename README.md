# HRMS: Information System for Human Resources Management

A complete HR web application: employees and departments, contracts, leave, attendance, payroll with printable payslips, recruitment with online applications, an HR dashboard and a self-service space for employees. Interface in **French and English**, light and dark themes, usable on a phone.

**[Live demo](https://yassine-portfolio-virid.vercel.app/demos/hrms/)**: the real Django backend runs inside your browser (Pyodide / WebAssembly) with a fictional company. Log in with one click as HR or as an employee; your changes are kept on your device until you press *Reset*.

> *Version française en bas de page.*

![HR dashboard](docs/screenshots/dashboard.png)

Originally a university project (2025, see [credits](#credits)), rebuilt as a **Django REST Framework API + React** application, with the business rules of the project report implemented and tested.

---

## Features

| Module | What it does |
|---|---|
| **Employees & departments** | Full records, every employee belongs to a department, search and filters, deactivation on departure (history kept), login creation with a temporary password |
| **Contracts** | Permanent (CDI), fixed-term (CDD), internship, temporary; **one active contract at a time** (overlaps refused); end-of-contract alerts; archiving |
| **Leave** | Annual, sick, maternity, paternity, unpaid; balance computed from the hire date; overlap checks; HR approval or rejection with a comment; the balance is deducted exactly once |
| **Attendance** | Employees clock in and out; HR daily sheet (present / absent / on leave / not clocked), manual corrections |
| **Payroll** | Monthly payslips generated from contracts: pro rata, absences, unpaid leave, bonus, salary advance (*MASSROUF*), social security; draft → validated; printable payslip (print / save as PDF) |
| **Recruitment** | Public careers page, online applications with a PDF CV, application tracking and interviews, **hire in one click** (employee record + contract + login) |
| **Dashboard** | Headcount by department, hires over 12 months, pending leave with quick approval, contracts ending soon, today's attendance, last payroll |
| **Employee space** | Profile and contact details, clock in/out, leave requests and balance, monthly attendance calendar, validated payslips |
| **Security** | HR / employee roles, session authentication with CSRF protection, throttled login and applications, temporary passwords that must be changed, CV type and size checks, no secret in the code |

<table>
<tr>
<td><img src="docs/screenshots/employee.png" alt="Employee record"></td>
<td><img src="docs/screenshots/payroll.png" alt="Payroll"></td>
</tr>
<tr>
<td><img src="docs/screenshots/recruitment.png" alt="Recruitment"></td>
<td><img src="docs/screenshots/employee-portal.png" alt="Employee space"></td>
</tr>
<tr>
<td><img src="docs/screenshots/careers.png" alt="Careers page"></td>
<td><img src="docs/screenshots/dashboard-dark-en.png" alt="Dashboard in English, dark theme"></td>
</tr>
</table>

<p align="center">
<img src="docs/screenshots/payslip.png" alt="Payslip" width="520">
&nbsp;
<img src="docs/screenshots/mobile.png" alt="On a phone" width="220">
</p>

## Business rules

The rules of section 2.1.2 of the project report live in one module, [`backend/hr/rules.py`](backend/hr/rules.py), used by the API, the admin, the demo data and the tests. Defaults follow Algerian practice and are set in `HR_RULES` ([`backend/config/settings.py`](backend/config/settings.py)).

| Rule | Default |
|---|---|
| Weekend | Friday and Saturday (leave counts working days only) |
| Annual leave | 2.5 days per completed month worked, counted from the hire date, 30 days a year at most |
| Leave requests | No overlap with another pending or approved leave; sick leave needs a reason or certificate reference; maternity ≤ 98 calendar days; paternity ≤ 3 working days; an annual leave cannot span two years or exceed the available balance |
| Approval | Only HR approves or rejects; a request is processed once (the balance cannot be deducted twice) |
| Contracts | An employee's contracts may not overlap; CDD, internships and temporary contracts need an end date |
| Payroll | base = monthly salary × days covered by the contract / days in the month; absences and unpaid leave = monthly salary / 30 per day; gross = base + bonus − absences; social security (CNAS) = 9 % of gross; net = gross − social security − advance |
| Currency, time zone | DZD, Africa/Algiers |

Rule violations return a stable error code (`leave_overlap`, `insufficient_balance`, `contract_overlap`…) that the interface translates.

## What changed from the 2025 version

The original code is kept, unchanged, in [`legacy/2025-django-mvt/`](legacy/2025-django-mvt/).

- **It did not run past the home page**: a view function named `Employe` replaced the `Employe` model in `views.py`, so every page that queried employees failed (`'function' object has no attribute 'objects'`). Several pages (contracts, leave, the employee space) were static templates not connected to any data, and there was no login.
- **Leave balance bug**: an approved leave subtracted its length from the balance on *every* save, and counted weekends.
- **Repository clean-up**: the committed Windows virtual environment (thousands of files), the `db.sqlite3` database and the collected static files were removed; the hard-coded `SECRET_KEY` and `DEBUG = True` were replaced by environment variables. The old key and database still exist in the Git history: the key must never be reused, and the history can be rewritten if needed.
- **New architecture**: a JSON API (Django REST Framework), a React interface, roles and permissions, the business rules above, automated tests, a seeded demo company, Docker and continuous integration.

## Architecture

```
frontend/  React 18 + Vite: public careers site, HR application, employee space (FR/EN)
   │  fetch /api/...  (session cookie + CSRF token)
backend/   Django 5.2 + Django REST Framework
   ├─ accounts/   users with a role (hr / employee), login, password change
   ├─ hr/         models, business rules (rules.py), API, demo data (seed_demo)
   └─ config/     settings from environment variables, WhiteNoise serves the built frontend
demo/      packs the backend for the online demo (Pyodide)
legacy/    the 2025 version, for reference
docs/      project report, appendix, screenshots
```

In production, one Django process serves both the API (`/api/`) and the built React app; the Django admin is at `/admin/`.

### How the online demo works

The demo is a static site, yet it runs the same Django code: [`demo/build_bundle.py`](demo/build_bundle.py) packs Django, DRF and the `backend/` apps into `backend.zip` (1.8 MB); a Web Worker ([`frontend/public-demo/demo-worker.js`](frontend/public-demo/demo-worker.js)) loads Pyodide (CPython compiled to WebAssembly), unpacks the bundle, migrates and seeds an SQLite database, then answers every API call through Django's WSGI handler ([`demo/demo_server.py`](demo/demo_server.py)). The SQLite file, uploaded CVs and the session are saved in the browser's IndexedDB after each change. Nothing is sent to a server.

## Run it locally

Requirements: Python 3.10+ and Node.js 18+.

**Windows (cmd)**

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
cd backend
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

**macOS / Linux**

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python manage.py migrate && python manage.py seed_demo && python manage.py runserver
```

Then, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (Vite forwards `/api` to Django on port 8000). To serve everything from Django instead, run `npm run build` once and open http://127.0.0.1:8000.

`seed_demo` creates a fictional company (7 departments, 28 employees, contracts, leave, 45 days of attendance, two months of validated payroll, job offers and applications), with dates relative to today. Demo logins, for local use only:

| Role | Email | Password |
|---|---|---|
| HR | `hr@demo.dz` | `demo1234` |
| Employee | `employe@demo.dz` | `demo1234` |

`python manage.py seed_demo --reset` starts over. For the Django admin, create a superuser with `python manage.py createsuperuser`.

## Tests

```bash
cd backend && python manage.py test hr          # business rules and API (roles, CSRF, leave, payroll, recruitment)
cd frontend && npm run check:i18n               # every text exists in French and English
```

GitHub Actions runs the tests, the frontend build and the demo build on every push ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Production

Configuration comes from environment variables, never from the code:

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | **required**; a long random value (`python -c "import secrets; print(secrets.token_urlsafe(50))"`) |
| `DJANGO_ALLOWED_HOSTS` | comma-separated host names, e.g. `hr.example.com` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | e.g. `https://hr.example.com` |
| `DATABASE_URL` | e.g. `postgres://user:password@host:5432/hrms` (default: SQLite file) |
| `DJANGO_MEDIA_ROOT` | where uploaded CVs are stored (a persistent volume) |
| `DJANGO_SECURE_SSL_REDIRECT` | `0` only if HTTPS is handled entirely by a proxy that already redirects |

With Docker:

```bash
docker build -t hrms .
docker run -p 8000:8000 -e DJANGO_SECRET_KEY=... -e DJANGO_ALLOWED_HOSTS=hr.example.com \
           -e DATABASE_URL=postgres://... hrms
```

The image builds the React app, collects the static files, applies the migrations at start-up and runs gunicorn. Without `DJANGO_SECRET_KEY` the project starts in development mode (DEBUG on) and refuses to start with DEBUG off.

## Rebuild the online demo

```bash
python demo/build_bundle.py        # -> frontend/public-demo/backend.zip
cd frontend && npm run build:demo   # -> frontend/dist-demo/ (static files, any host)
```

## Credits

University mini-project, *Information System for Human Resources Management* (2025), supervised by **Mr Rachid BOUDOUR**:

- Mohamed Tahar Chadouli
- Yassine Abderrezak Dache
- Imad Eddine Boumaza

The project report and its appendix are in [`docs/`](docs/). All people, emails and phone numbers in the demo data are invented.

---

## Version française

Application web de gestion des ressources humaines : employés et services, contrats, congés, présences, paie avec bulletins imprimables, recrutement avec candidatures en ligne, tableau de bord RH et espace employé. Interface en français et en anglais, thème clair ou sombre, utilisable sur téléphone.

**[Démo en ligne](https://yassine-portfolio-virid.vercel.app/demos/hrms/)** : le vrai backend Django tourne dans votre navigateur (Pyodide / WebAssembly) avec une entreprise fictive. Connexion en un clic en tant que RH ou employé ; vos modifications restent sur votre appareil jusqu'au bouton *Réinitialiser*.

Projet universitaire de 2025 (M. T. Chadouli, Y. A. Dache, I. E. Boumaza, encadré par M. Rachid Boudour), refondu en **API Django REST Framework + React** :

- les règles de gestion du rapport sont implémentées et testées (`backend/hr/rules.py`) : week-end vendredi-samedi, 2,5 jours de congé par mois travaillé, un seul contrat actif, validation des congés par les RH, paie avec retenues d'absence (salaire / 30), CNAS 9 % et avance (MASSROUF) ;
- la version 2025 ne fonctionnait pas au-delà de la page d'accueil (la vue `Employe` masquait le modèle `Employe`) et déduisait le solde de congé à chaque enregistrement ; elle est conservée dans `legacy/` ;
- le dépôt a été nettoyé : environnement virtuel, base de données et clé secrète retirés (ils restent dans l'historique Git ; l'ancienne clé ne doit plus servir).

Lancer en local : voir [Run it locally](#run-it-locally) (commandes Windows incluses), puis se connecter avec `hr@demo.dz` / `demo1234` (RH) ou `employe@demo.dz` / `demo1234` (employé).
