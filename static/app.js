// DOM elements
let currentPage = 1;
let limit = 50;
let offset = 0;
const tableSelect = document.getElementById('tableSelect');
const refreshBtn = document.getElementById('refreshBtn');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const tableContainer = document.getElementById('tableContainer');
const tableHeaders = document.getElementById('tableHeaders');
const tableBody = document.getElementById('tableBody');

// Event listeners
document.addEventListener('DOMContentLoaded', initialize);
tableSelect.addEventListener('change', loadTableData);
refreshBtn.addEventListener('click', loadTableData);
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const currentPageDisplay = document.getElementById('currentPage');
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
        await loadTables();
        if (tableSelect.options.length > 0) {
            await loadTableData();
        }
    } catch (error) {
        showError('Failed to initialize: ' + error.message);
    }
}

// Load available tables from the database
async function loadTables() {
    showLoading(true);
    try {
        const response = await fetch(`${window.location.origin}/api/tables`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        // Clear existing options
        tableSelect.innerHTML = '';
        
        // Add table options
        if (data.tables && data.tables.length > 0) {
            data.tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table;
                option.textContent = table;
                tableSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No tables found';
            tableSelect.appendChild(option);
        }
        
        hideError();
    } catch (error) {
        showError('Failed to load tables: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Load data from selected table
async function loadTableData() {
    const selectedTable = tableSelect.value;
    if (!selectedTable) return;
    
    showLoading(true);
    tableContainer.classList.add('hidden');
    
    try {
        // Include limit and offset in the API request
        const response = await fetch(`/api/table-data/${encodeURIComponent(selectedTable)}?limit=${limit}&offset=${offset}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);

        displayTableData(data);
        updatePagination(data.pagination);  // Update pagination controls
        
        hideError();
    } catch (error) {
        showError('Failed to load data: ' + error.message);
    } finally {
        showLoading(false);
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