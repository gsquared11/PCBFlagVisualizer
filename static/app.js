// Global Variables and DOM Elements
let currentPage = 1;                // Current page number for pagination
let limit = 50;                     // Number of rows per page
let offset = 0;                     // Offset for pagination

// Get refs to DOM elements
const refreshBtn = document.getElementById('refreshBtn');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const tableContainer = document.getElementById('tableContainer');
const tableHeaders = document.getElementById('tableHeaders');
const tableBody = document.getElementById('tableBody');
const DateTime = luxon.DateTime;

// Pagination controls
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const currentPageDisplay = document.getElementById('currentPage');

// Event listeners
document.addEventListener('DOMContentLoaded', initialize);

// Trigger data load when the table is changed or refresh button is clicked
refreshBtn.addEventListener('click', loadTableData);

// Pagination buttons
prevPageBtn.addEventListener('click', () => {
    if (offset > 0) {
        offset -= limit;
        currentPage--;
        loadTableData();
    }
});
nextPageBtn.addEventListener('click', () => {
    offset += limit;
    currentPage++;
    loadTableData();
});

// Initialize the application
async function initialize() {
    try {
        // Load data for the default table
        await loadTableData();
    } catch (error) {
        showError('Failed to initialize: ' + error.message);
    }
}

// Load data from flag_data
async function loadTableData() {
    const selectedTable = 'flag_data'; // Set default table name
    
    showLoading(true);
    tableContainer.classList.add('hidden');  // Hide table while loading
    
    try {
        // Fetch table data with pagination
        const response = await fetch(`/api/table-data/${encodeURIComponent(selectedTable)}?limit=${limit}&offset=${offset}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);

        // Display the fetched table data
        displayTableData(data);
        
        // Update pagination controls
        updatePagination(data.pagination);
        
        hideError();  // Hide error message if any
    } catch (error) {
        showError('Failed to load data: ' + error.message);
    } finally {
        showLoading(false);  // Hide loading indicator
    }
}

// Display table data
function displayTableData(data) {
    if (!data || !data.data || data.data.length === 0) {
        showError('No data available');
        tableContainer.classList.add('hidden');
        return;
    }
    
    // Clear existing headers and rows
    tableHeaders.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Create headers
    const columns = Object.keys(data.data[0]);
    columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        tableHeaders.appendChild(th);
    });
    
    // Create rows
    data.data.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach(column => {
            const td = document.createElement('td');

            // Check if the column is 'date_time' and convert from UTC to CST
            if (column === 'date_time' && row[column]) {
                // Use Luxon to parse the UTC time and convert to CST
                const date = DateTime.fromISO(row[column], { zone: 'utc' })
                    .setZone('America/Chicago');

                // Format the date in CST with a clear timezone indication
                td.textContent = date.toFormat('MMMM d, yyyy h:mm a') + ' CST';
            } else {
                td.textContent = row[column] !== null ? row[column] : '';
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
    
    tableContainer.classList.remove('hidden');
}

// Show loading indicator
function showLoading(isLoading) {
    loadingContainer.style.display = isLoading ? 'block' : 'none';
}

// Show error message
function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorContainer.classList.add('hidden');
}

// Update the pagination controls
function updatePagination(pagination) {
    currentPageDisplay.textContent = `Page ${currentPage}`;
    
    // Disable Previous button on the first page
    prevPageBtn.disabled = offset <= 0;

    // Disable Next button if there's no more data
    nextPageBtn.disabled = !pagination.next_offset;
}