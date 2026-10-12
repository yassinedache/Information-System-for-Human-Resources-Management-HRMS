from django.urls import path 
from . import views


urlpatterns = [
    path('index/', views.index, name='index'),
    path('aj_employe/', views.ajouter_employe, name='aj_employe',),
    path('aj_contrat/', views.ajouter_contrat, name='aj_contrat',),
    path('aj_conge/', views.ajouter_conge, name='aj_conge',),
    path('aj_service/', views.ajouter_service, name='aj_service',),
    path('aj_offre/', views.ajouter_offre, name='aj_offre',),
    path('mod_employe/<int:employe_id>/', views.modify_employe, name='mod_employe',),
    path('mod_contrat/', views.modify_contrat, name='mod_contrat',),
    path('mod_conge/', views.modify_conge, name='mod_conge',),
    path('EMP/', views.Employe, name='employe',),
    path('dmcong/', views.demende_conge, name='dmcong',),
    path('modinf/', views.modify_info, name='modinfo',),
]
