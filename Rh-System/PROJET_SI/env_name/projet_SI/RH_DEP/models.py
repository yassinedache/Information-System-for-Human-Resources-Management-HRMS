from django.db import models
import datetime
# Create your models here.
# Table Service
class Service(models.Model):
    nom_service = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nom_service

# Table Employe
class Employe(models.Model):
    ETAT_CHOICES = [
        ('actif', 'Actif'),
        ('conge', 'Congé'),
        ('inactive', 'Inactive')
    ]

    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    email = models.EmailField(unique=True)
    telephone = models.CharField(max_length=20, blank=True, null=True)
    adresse = models.TextField(blank=True, null=True)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, related_name='employes')
    etat = models.CharField(max_length=10, choices=ETAT_CHOICES, default='actif')
    salaire_base = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    solde_conges = models.IntegerField(default=30)

    def __str__(self):
        return f"{self.nom} {self.prenom}"

# Table Contrat
class Contrat(models.Model):
    TYPE_CHOICES = [
        ('CDI', 'CDI'),
        ('CDD', 'CDD'),
        ('Stage', 'Stage'),
        ('Interim', 'Intérim')
    ]

    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name='contrats')
    type_contrat = models.CharField(max_length=10, choices=TYPE_CHOICES)
    date_debut = models.DateField()
    date_fin = models.DateField(blank=True, null=True)

    def __str__(self):
        return f"{self.type_contrat} - {self.employe.nom}"

# Table Conge
class Conge(models.Model):
    TYPE_CONGE_CHOICES = [
        ('Annuel', 'Annuel'),
        ('Maladie', 'Maladie'),
        ('Sans Solde', 'Sans Solde'),
        ('Maternité', 'Maternité'),
        ('Paternité', 'Paternité')
    ]

    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name='conges')
    type_conge = models.CharField(max_length=20, choices=TYPE_CONGE_CHOICES)
    date_debut = models.DateField()
    date_fin = models.DateField()
    approuve = models.BooleanField(default=False)

    @property
    def duree(self):
        return (self.date_fin - self.date_debut).days + 1

    def save(self, *args, **kwargs):
        if self.approuve:
            self.employe.etat = 'conge'
            self.employe.solde_conges -= self.duree
            self.employe.save()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.type_conge} ({self.date_debut} - {self.date_fin})"

# Table Salaire
class Salaire(models.Model):
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name='salaires')
    mois_annee = models.DateField()
    montant_prime = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    montant_absence = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    @property
    def montant_total(self):
        jours_ouvrables = 30  # Peut être modifié en fonction du mois
        salaire_jour = self.employe.salaire_base / jours_ouvrables
        return (self.employe.salaire_base + self.montant_prime) - self.montant_absence

    def __str__(self):
        return f"Salaire de {self.employe.nom} pour {self.mois_annee}"

# Table Pointage
class Pointage(models.Model):
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name='pointages')
    date_pointage = models.DateField()
    present = models.BooleanField()

    def __str__(self):
        return f"Pointage {self.date_pointage} - {self.employe.nom}"
    

class Poste(models.Model):
    TYPE_CHOICES = [
        ('CDI', 'CDI'),
        ('CDD', 'CDD'),
        ('Stage', 'Stage'),
        ('Interim', 'Intérim'),
    ]
    
    titre = models.CharField(max_length=100)  # Titre du poste
    contrat = models.CharField(max_length=10, choices=TYPE_CHOICES)  # Type de contrat
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, related_name='postes')  # Service lié à ce poste
    description = models.TextField(blank=True, null=True)  # Description du poste
    date_limite = models.DateField()  # Date limite pour postuler
    statut = models.CharField(max_length=20, default='Ouvert')  # Statut du poste (par exemple: Ouvert, Fermé)

    def __str__(self):
        return f"{self.titre} ({self.contrat})"
