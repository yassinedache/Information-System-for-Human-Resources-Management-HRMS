# Information System for Human Resources Management (HRMS)

A comprehensive Human Resources Management System built with Django to streamline HR operations and employee management.

## Features

- **Employee Management**: Add, update, and manage employee information
- **Contract Management**: Track and manage employee contracts
- **Leave Management**: Handle employee leave requests and approvals
- **Job Offers**: Manage job postings and recruitment
- **Service/Department Management**: Organize employees by departments and services
- **Employee Portal**: Dedicated interface for employees to manage their information and submit requests

## Technology Stack

- **Backend**: Django 5.1.5
- **Database**: SQLite3
- **Frontend**: HTML, CSS, JavaScript
- **Python**: 3.13

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

## Database Schema

The system includes the following main models:
- **Employee**: Store employee information
- **Contract**: Manage employment contracts
- **Leave**: Handle leave requests
- **Job Offer**: Manage recruitment postings
- **Service/Department**: Organize company structure

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is available for educational and commercial use.

## Contact

**Author**: Yassine Dache  
**Email**: dache.yassine@gmail.com  
**GitHub**: [@yassinedache](https://github.com/yassinedache)

## Acknowledgments

This project was developed as part of an Information Systems course to demonstrate practical HR management solutions.
