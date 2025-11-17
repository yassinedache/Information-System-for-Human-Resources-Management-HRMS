from django.contrib import admin

# Register your models here.

from .models import Service, Employe, Contrat, Conge, Salaire, Pointage

admin.site.register(Service),
admin.site.register(Employe),
admin.site.register(Contrat),
admin.site.register(Conge),
admin.site.register(Salaire),
admin.site.register(Pointage),