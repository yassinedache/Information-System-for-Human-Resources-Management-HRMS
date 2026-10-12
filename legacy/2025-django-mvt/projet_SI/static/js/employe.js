document.addEventListener('DOMContentLoaded', function() {
    // Get all sidebar links
    const sidebarLinks = document.querySelectorAll('.sidebar nav ul li a');
    const contentArea = document.getElementById('content-area');

    // Add click event listeners to all sidebar links
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            sidebarLinks.forEach(l => l.parentElement.classList.remove('active'));
            
            // Add active class to clicked link
            this.parentElement.classList.add('active');
            
            // Get the section id from href
            const section = this.getAttribute('href').substring(1);
            
            // Update content based on selected section
            updateContent(section);
        });
    });

    // Function to calculate working hours
    function calculateWorkingHours(entryTime, exitTime) {
        const entry = new Date(`2024-01-01 ${entryTime}`);
        const exit = new Date(`2024-01-01 ${exitTime}`);
        
        // Validate time inputs
        if (isNaN(entry.getTime()) || isNaN(exit.getTime())) {
            return 'Invalid time';
        }
        
        const diff = (exit - entry) / (1000 * 60 * 60); // Convert to hours
        return diff.toFixed(2);
    }

    // Function to update content
    function updateContent(section) {
        let content = '';
        
        switch(section) {
            case 'profile':
                content = `
                    <div class="profile-container">
                        <h1>Profile</h1>
                        <div class="profile-info">
                            <div class="info-group">
                                <p><strong>Nom:</strong> Dupont</p>
                                <p><strong>Prénom:</strong> Jean</p>
                                <p><strong>Adresse:</strong> 123 Rue de la République, Paris</p>
                                <p><strong>Numéro de téléphone:</strong> +33 6 12 34 56 78</p>
                                <p><strong>Email:</strong> jean.dupont@email.com</p>
                                <p><strong>Date de naissance:</strong> 15/03/1985</p>
                            </div>
                            <div class="edit-button">
                                <a href="ModifierInformation.html" class="btn-modifier">Modifier Information</a>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'conge':
                content = `
                    <div class="conge-container">
                        <div class="conge-header">
                            <h1>Historique des Congés</h1>
                            <a href="demanderconge.html" class="btn-demande">Demander Congé</a>
                        </div>
                        <div class="conge-content">
                            <table class="conge-table">
                                <thead>
                                    <tr>
                                        <th>Date de début</th>
                                        <th>Date de fin</th>
                                        <th>Type de congé</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>01/07/2023</td>
                                        <td>15/07/2023</td>
                                        <td>Congé payé</td>
                                        <td>Approuvé</td>
                                    </tr>
                                    <tr>
                                        <td>10/04/2023</td>
                                        <td>14/04/2023</td>
                                        <td>RTT</td>
                                        <td>Approuvé</td>
                                    </tr>
                                    <tr>
                                        <td>23/12/2022</td>
                                        <td>02/01/2023</td>
                                        <td>Congé payé</td>
                                        <td>Approuvé</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                break;
            case 'pointage':
                content = `
                    <div class="pointage-container">
                        <h1>Pointage</h1>
                        <div class="pointage-content">
                            <div class="pointage-buttons">
                                <button class="btn-pointage btn-entree">Pointer Entrée</button>
                                <button class="btn-pointage btn-sortie">Pointer Sortie</button>
                            </div>
                            <div class="pointage-info">
                                <p>Dernier pointage: <span id="last-pointage">--:--</span></p>
                            </div>
                            <table class="pointage-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Heure d'entrée</th>
                                        <th>Heure de sortie</th>
                                        <th>Heures travaillées</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>25/03/2024</td>
                                        <td>08:30</td>
                                        <td>17:30</td>
                                        <td>${calculateWorkingHours('08:30', '17:30')} h</td>
                                    </tr>
                                    <tr>
                                        <td>24/03/2024</td>
                                        <td>08:45</td>
                                        <td>17:45</td>
                                        <td>${calculateWorkingHours('08:45', '17:45')} h</td>
                                    </tr>
                                    <tr>
                                        <td>23/03/2024</td>
                                        <td>08:15</td>
                                        <td>17:15</td>
                                        <td>${calculateWorkingHours('08:15', '17:15')} h</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                break;
            case 'salaire':
                content = `
                    <div class="salaire-container">
                        <h1>Information Salariale</h1>
                        <div class="salaire-info">
                            <div class="employe-details">
                                <h2>Jean Dupont</h2>
                                <p><strong>Service:</strong> Développement Informatique</p>
                                <p><strong>Poste:</strong> Développeur Senior</p>
                                <p><strong>Date d'entrée:</strong> 01/01/2020</p>
                            </div>
                            <div class="salaire-details">
                                <h3>Détails du Salaire</h3>
                                <p><strong>Salaire de base:</strong> 45,000 € / an</p>
                                <p><strong>Prime annuelle:</strong> 3,000 €</p>
                                <p><strong>Prime d'ancienneté:</strong> 1,500 €</p>
                                <p><strong>Total annuel:</strong> 49,500 €</p>
                            </div>
                            <button class="btn-print" id="print-button">Imprimer Fiche de paie</button>
                        </div>
                    </div>
                `;
                break;
            default:
                content = `<div class="error-container"><h1>Section non trouvée</h1></div>`;
        }
        
        contentArea.innerHTML = content;

        // Add print functionality
        if (section === 'salaire') {
            document.getElementById('print-button').addEventListener('click', function() {
                const printContent = `
                    <div>
                        <h1>Information Salariale</h1>
                        <div class="salaire-info">
                            <div class="employe-details">
                                <h2>Jean Dupont</h2>
                                <p><strong>Service:</strong> Développement Informatique</p>
                                <p><strong>Poste:</strong> Développeur Senior</p>
                                <p><strong>Date d'entrée:</strong> 01/01/2020</p>
                            </div>
                            <div class="salaire-details">
                                <h3>Détails du Salaire</h3>
                                <p><strong>Salaire de base:</strong> 45,000 € / an</p>
                                <p><strong>Prime annuelle:</strong> 3,000 €</p>
                                <p><strong>Prime d'ancienneté:</strong> 1,500 €</p>
                                <p><strong>Total annuel:</strong> 49,500 €</p>
                            </div>
                        </div>
                    </div>
                `;
                const printWindow = window.open('', '', 'height=600,width=800');
                printWindow.document.write('<html><head><title>Print</title></head><body>');
                printWindow.document.write(printContent);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.print();
            });
        }
    }

    // Initialize with Profile section
    updateContent('profile');
});
