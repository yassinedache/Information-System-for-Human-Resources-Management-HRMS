# Information System for Human Resources Management (HRMS)

## 📖 Project Description
This project consists of designing and developing a complete web-based Human Resources Management System (HRMS). It centralizes, automates, and secures essential HR processes such as employee management, leave requests, contracts, salaries, recruitment, and reporting dashboards.

The application aims to improve productivity, reduce administrative workload, and provide HR managers with clear and actionable insights through dashboards and structured data visualization. It features a modern and intuitive interface for both administrators and employees.

This system was developed as part of an academic mini-project under the supervision of Mr. Rachid BOUDOUR.

## 🏷️ Key Features

- **👥 Employee Management**: Add, edit, delete records; track personal/professional info; view profiles and history; monitor skills, training, performance (Annexe.pdf pp. 7–8).
- **🏖️ Leave Management**: Multiple leave types (annual, sick, unpaid); automatic balance calculation; admin approval workflow; employee leave history (Annexe.pdf pp. 9, 16–17).
- **💼 Contract Management**: Create, renew, archive contracts; supports CDI, CDD, internships (Annexe.pdf p. 10).
- **💰 Salary Management**: Automated salary calculation; bonuses, deductions, absences; generate digital payslips (Annexe.pdf p. 19).
- **🎯 Recruitment Module**: Publish job offers; receive and manage applications; candidates upload CV online (Annexe.pdf pp. 2–3, 13).
- **📊 Dashboard & Reporting**: Overview of key HR metrics: employees, leaves, services, contracts (Annexe.pdf p. 6).
- **👤 Employee Portal**: Profile management, leave requests, attendance marking, payslip visualization (Annexe.pdf pp. 14–19).

## 🖥️ User Interfaces
- **🏠 Landing Page**: Highlights main features and invites candidates to explore opportunities.
- **🔐 Login & Registration**: Simple and secure authentication (Annexe.pdf pp. 3–4).
- **📌 Admin Dashboard**: Quick overview and shortcuts to all modules (Annexe.pdf p. 6).
- **📑 Management Pages**: Employee list, leave requests, contracts, salaries, recruitment offers, attendance (Annexe.pdf pp. 7–12).

## 🛠️ Technologies Used

- **Front-End**: HTML5 (structure), CSS3 (responsive design), JavaScript (dynamic behavior) — E49 report p. 8.
- **Back-End**: Python 3.13 / Django 5.1.5 with secure MVT architecture; protections against XSS, CSRF, SQL injection — E49 report pp. 8–9.
- **Database**: Django ORM (default SQLite3; compatible with PostgreSQL/MySQL); easy migrations and seamless integration — E49 report p. 9.

## Project Structure

```
Rh-System/
├── PROJET_SI/
│   └── env_name/              # Virtual environment
│       └── projet_SI/          # Main Django project
│           ├── manage.py       # Django management script
│           ├── projet_SI/      # Project settings
│           ├── RH_DEP/         # HR Department app
│           ├── templates/      # HTML templates
│           └── static/         # CSS, JS, images
```

## 🗂️ Database Modeling
- **🧩 Conceptual Data Model (CDM/MCD)**: Entities such as Employee, Service, Leave, Contract, Salary, Recruitment, Job Offer, Candidate (E49 report p. 6).
- **🧾 Logical Data Model (LDM/MLD)**: Detailed tables and relationships (E49 report p. 7; includes SERVICE, EMPLOYE, CONTRAT, CONGE, SALAIRE, etc.).

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yassinedache/Information-System-for-Human-Resources-Management-HRMS.git
   cd Information-System-for-Human-Resources-Management-HRMS
   ```

2. **Set up virtual environment**
   ```bash
   cd PROJET_SI
   python -m venv env_name
   ```

3. **Activate virtual environment**
   - Windows:
     ```bash
     env_name\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source env_name/bin/activate
     ```

4. **Install dependencies**
   ```bash
   pip install django
   pip install sqlparse
   ```

5. **Navigate to project directory**
   ```bash
   cd env_name/projet_SI
   ```

6. **Run migrations**
   ```bash
   python manage.py migrate
   ```

7. **Create superuser (admin)**
   ```bash
   python manage.py createsuperuser
   ```

8. **Run the development server**
   ```bash
   python manage.py runserver
   ```

9. **Access the application**
   - Open your browser and navigate to: `http://127.0.0.1:8000/`
   - Admin panel: `http://127.0.0.1:8000/admin/`

## Usage

### Admin Functions
- Manage employees, contracts, and leave requests
- Post and manage job offers
- Organize departments and services
- View and approve employee requests

### Employee Functions
- View personal information
- Submit leave requests
- Update profile information
- View assigned contracts

## 🎯 Project Objectives
- Centralize all HR operations
- Automate administrative tasks
- Ensure data security and consistency
- Improve decision-making using dashboards
- Provide a modern and intuitive user experience

## References
- Annexe: `Rh-System/Annexe.pdf`
- Detailed report: `Rh-System/E49_DACHE_CHADOULI_BOUMAZA.pdf`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is available for educational and commercial use.

## Contact

**Author**: Yassine Dache  
**Email**: dache.yassine@gmail.com  
**GitHub**: [@yassinedache](https://github.com/yassinedache)

## Acknowledgments
Developed as an academic mini-project under the supervision of Mr. Rachid BOUDOUR.
