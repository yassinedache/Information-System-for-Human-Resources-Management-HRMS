from django.shortcuts import render,get_object_or_404, redirect
from django.http import HttpResponse
from django.utils.timezone import now
from .models import Employe, Contrat, Service, Poste


# Create your views here.
def index(request):
    # Calcul des statistiques
    employee_count = Employe.objects.count()  # Nombre total d'employés
    service_count = Service.objects.count()  # Nombre total de services
    active_contract_count = Contrat.objects.filter(date_fin__gt=now()).count()  # Contrats actifs (date fin > aujourd'hui)
    offres = Poste.objects.all()
    services = Service.objects.all()  
    employes = Employe.objects.all()
    contrats = Contrat.objects.select_related('employe').all()
    return render(request,'index.html',{'offres': offres,'employes': employes, 'contrats': contrats ,'services': services, 'employee_count': employee_count,
        'service_count': service_count,
        'active_contract_count': active_contract_count,})

def ajouter_conge(request):
    return render(request,'ajouter/conge.html',)

def ajouter_contrat(request):
    if request.method == "POST":
        employe_id = request.POST.get("employe")
        type_contrat = request.POST.get("type_contrat")
        date_debut = request.POST.get("date_debut")
        date_fin = request.POST.get("date_fin")

        try:
            employe = Employe.objects.get(id=employe_id)
            contrat = Contrat.objects.create(
                employe=employe,
                type_contrat=type_contrat,
                date_debut=date_debut,
                date_fin=date_fin
            )
            return redirect('index')  # Redirige vers la page principale après l'ajout
        except Employe.DoesNotExist:
            return render(request, 'ajouter_contrat.html', {'error': "Employé introuvable."})

    # Si ce n'est pas une requête POST, afficher le formulaire
    employes = Employe.objects.all()
    return render (request,'ajouter/contrat.html',{'employes': employes})

def ajouter_employe(request):
    if request.method == 'POST':
        # Récupérer les données
        nom = request.POST.get('nom')
        prenom = request.POST.get('prenom')
        date_naissance = request.POST.get('date_naissance')
        email = request.POST.get('email')
        telephone = request.POST.get('telephone')
        adresse = request.POST.get('adresse')
        service_id = request.POST.get('service')
        etat = request.POST.get('etat')
        salaire_base = request.POST.get('salaire_base')
        solde_conges = request.POST.get('solde_conges')

        # Récupérer l'objet Service
        service = Service.objects.get(id=service_id)

        # Enregistrer l'employé
        Employe.objects.create(
            nom=nom,
            prenom=prenom,
            date_naissance=date_naissance,
            email=email,
            telephone=telephone,
            adresse=adresse,
            service=service,
            etat=etat,
            salaire_base=salaire_base,
            solde_conges=solde_conges
        )
        return redirect('index')  # Redirection après succès
    services = Service.objects.all()
    return render(request,'ajouter/employe.html',{'services': services})

def ajouter_offre(request):
    if request.method == 'POST':
        titre = request.POST.get('titre')
        contrat = request.POST.get('typeContrat')
        service_name = request.POST.get('service')
        description = request.POST.get('description')
        date_limite = request.POST.get('dateLimite')

        # Trouver ou créer le service (assurez-vous qu'un service avec ce nom existe ou créez-le)
        service, created = Service.objects.get_or_create(nom_service=service_name)

        # Créer le poste
        Poste.objects.create(
            titre=titre,
            contrat=contrat,
            service=service,
            description=description,
            date_limite=date_limite,
            statut="Ouvert"  # Statut par défaut, peut être modifié selon le besoin
        )
        return redirect('index')  # Rediriger vers la page d'index après l'ajout
    return render(request,'ajouter/offre.html',)

def ajouter_service(request):
    if request.method == 'POST':
        nom_service = request.POST.get('nom_service')
        description = request.POST.get('description', '')  # Par défaut, vide si non fourni

        # Création du service
        service = Service.objects.create(
            nom_service=nom_service,
            description=description
        )
        return redirect('index')
    return render(request,'ajouter/service.html',)

def modify_employe(request, employe_id):
    employe = get_object_or_404(Employe, id=employe_id)  # Récupérer l'employé par ID
    services = Service.objects.all()  # Récupérer tous les services pour le formulaire

    if request.method == 'POST':
        # Mise à jour des informations de l'employé
        employe.nom = request.POST.get('nom')
        employe.prenom = request.POST.get('prenom')
        employe.date_naissance = request.POST.get('dateNaissance')
        employe.email = request.POST.get('email')
        employe.etat = request.POST.get('etat')

        # Assigner un objet Service
        service_id = request.POST.get('service')
        employe.service = Service.objects.get(id=service_id) if service_id else None

        employe.save()
        return redirect('index')  # Redirection après modification

    # Rendre le formulaire avec les données de l'employé
    return render(request, 'modifier/employe.html', {'employe': employe, 'services': services})

def modify_contrat(request):
    return render(request,'modifier/contrat.html',)

def modify_conge(request):
    return render(request,'modifier/conge.html',)

def Employe(request):
    return render(request,'employe/employe.html',)

def modify_info(request):
    return render(request,'employe/modif_info.html',)

def demende_conge(request):
    return render(request,'employe/demenderconge.html',)


