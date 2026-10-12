// Service CRUD Functions
let serviceCount = 0; // Variable to keep track of the number of services
let employeeCount = 0; // Variable to keep track of the number of employees
let contractCount = 0; // Variable to keep track of the number of contracts
let leaveCount = 0; // Variable to keep track of the number of leaves
let offerCount = 0; // Variable to keep track of the number of offers

function editService(id) {
    window.location.href = `modifierService.html?id=${id}`;
}

// Employee CRUD Functions
function editEmployee(id) {
    window.location.href = `modifierEmploye.html?id=${id}`;
}

// Contract CRUD Functions
function editContract(id) {
    window.location.href = `modifierContrat.html?id=${id}`;
}

// Leave CRUD Functions
function editLeave(id) {
    window.location.href = `modifierConge.html?id=${id}`;
}

// Offer CRUD Functions
function editOffer(id) {
    window.location.href = `modifierOffre.html?id=${id}`;
}

// Sidebar Section Switching
const navLinks = document.querySelectorAll('.nav-links li');
const contentSections = document.querySelectorAll('.content-section');

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        // Hide all content sections
        contentSections.forEach(section => {
            section.style.display = 'none';
        });

        // Remove active class from all links
        navLinks.forEach(item => {
            item.classList.remove('active');
        });

        // Show the selected section
        const sectionToShow = document.getElementById(`${link.dataset.section}-section`);
        if (sectionToShow) {
            sectionToShow.style.display = 'block';
        }

        // Set the clicked link as active
        link.classList.add('active');
    });
});

// Function to add a new row to a table
function addRowToTable(tableId, rowData) {
    const table = document.getElementById(tableId);
    const newRow = table.insertRow();

    rowData.forEach(data => {
        const newCell = newRow.insertCell();
        newCell.textContent = data;
    });
}

// Function to handle adding a service
function handleAddService(event) {
    event.preventDefault();
    const serviceName = document.getElementById('serviceNameInput').value;
    addRowToTable('servicesTable', [serviceName, 'Actions']);
    serviceCount++; // Increment the service count
    document.getElementById('serviceCount').textContent = serviceCount; // Update the displayed count
    document.getElementById('addServiceForm').reset(); // Reset the form
}

// Function to handle adding an employee
function handleAddEmployee(event) {
    event.preventDefault();
    const employeeData = [
        document.getElementById('employeeNameInput').value,
        document.getElementById('employeePositionInput').value,
        'Actions'
    ];
    addRowToTable('employeesTable', employeeData);
    employeeCount++; // Increment the employee count
    document.getElementById('employeeCount').textContent = employeeCount; // Update the displayed count
    document.getElementById('addEmployeeForm').reset(); // Reset the form
}

// Function to handle adding a leave
function handleAddLeave(event) {
    event.preventDefault();
    const leaveData = [
        document.getElementById('leaveEmployeeInput').value,
        document.getElementById('leaveTypeInput').value,
        'Actions'
    ];
    addRowToTable('pendingCongesTable', leaveData);
    leaveCount++; // Increment the leave count
    document.getElementById('leaveCount').textContent = leaveCount; // Update the displayed count
    document.getElementById('addLeaveForm').reset(); // Reset the form
}

// Function to handle adding an offer
function handleAddOffer(event) {
    event.preventDefault();
    const offerData = [
        document.getElementById('offerTitleInput').value,
        document.getElementById('offerDescriptionInput').value,
        'Actions'
    ];
    addRowToTable('offresTable', offerData);
    offerCount++; // Increment the offer count
    document.getElementById('offerCount').textContent = offerCount; // Update the displayed count
    document.getElementById('addOfferForm').reset(); // Reset the form
}

// Function to handle adding a contract
function handleAddContract(event) {
    event.preventDefault();
    const contractData = [
        document.getElementById('contractEmployeeInput').value,
        document.getElementById('contractTypeInput').value,
        'Actions'
    ];
    addRowToTable('contratsTable', contractData);
    contractCount++; // Increment the contract count
    document.getElementById('contractCount').textContent = contractCount; // Update the displayed count
    document.getElementById('addContractForm').reset(); // Reset the form
}

// Attach event listeners to forms
document.getElementById('addServiceForm').addEventListener('submit', handleAddService);
document.getElementById('addEmployeeForm').addEventListener('submit', handleAddEmployee);
document.getElementById('addLeaveForm').addEventListener('submit', handleAddLeave);
document.getElementById('addOfferForm').addEventListener('submit', handleAddOffer);
document.getElementById('addContractForm').addEventListener('submit', handleAddContract);
