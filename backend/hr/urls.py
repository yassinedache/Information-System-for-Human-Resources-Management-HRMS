from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.register("services", views.ServiceViewSet, basename="service")
router.register("employees", views.EmployeeViewSet, basename="employee")
router.register("contracts", views.ContractViewSet, basename="contract")
router.register("leaves", views.LeaveViewSet, basename="leave")
router.register("attendance", views.AttendanceViewSet, basename="attendance")
router.register("payslips", views.PayslipViewSet, basename="payslip")
router.register("jobs", views.JobOfferViewSet, basename="job")
router.register("applications", views.ApplicationViewSet, basename="application")

urlpatterns = [
    path("dashboard/", views.dashboard),
    path("public/settings/", views.public_settings),
    path("public/jobs/", views.public_jobs),
    path("public/jobs/<int:pk>/", views.public_job),
    path("public/jobs/<int:pk>/apply/", views.public_apply),
    path("me/profile/", views.my_profile),
    path("me/leaves/", views.my_leaves),
    path("me/leaves/<int:pk>/cancel/", views.my_leave_cancel),
    path("me/attendance/", views.my_attendance),
    path("me/attendance/clock/", views.my_clock),
    path("me/payslips/", views.my_payslips),
    path("me/payslips/<int:pk>/", views.my_payslip),
    path("", include(router.urls)),
]
