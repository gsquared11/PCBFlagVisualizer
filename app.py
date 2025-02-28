import os
import pyodbc
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

# Get connection string from environment variable
connection_string = os.environ.get('SQL_CONNECTION_STRING')
if not connection_string:
    # Fallback for development (replace with your connection details)
    server = 'your-server.database.windows.net'
    database = 'your-database'
    username = 'your-username'
    password = 'your-password'
    driver = '{ODBC Driver 17 for SQL Server}'
    connection_string = f'DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password}'

def get_db_connection():
    """Create and return a database connection."""
    return pyodbc.connect(connection_string)

@app.route('/api/tables', methods=['GET'])
def get_tables():
    """Get all table names from the database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query to get user tables from the database
        query = """
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """
        
        cursor.execute(query)
        tables = [row[0] for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return jsonify({"tables": tables})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/table-data/<table_name>', methods=['GET'])
def get_table_data(table_name):
    """Get data from a specific table."""
    try:
        # Basic validation to prevent SQL injection
        if not table_name.isalnum() and not all(c.isalnum() or c == '_' for c in table_name):
            return jsonify({"error": "Invalid table name"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get column names
        cursor.execute(f"SELECT TOP 1 * FROM {table_name}")
        columns = [column[0] for column in cursor.description]
        
        # Get data (limiting to 100 rows for performance)
        cursor.execute(f"SELECT TOP 100 * FROM {table_name}")
        rows = cursor.fetchall()
        
        # Convert to list of dictionaries
        result = []
        for row in rows:
            row_dict = {}
            for i, value in enumerate(row):
                # Convert non-serializable types to strings
                if isinstance(value, (bytearray, bytes)):
                    value = value.hex()
                elif hasattr(value, 'isoformat'):  # datetime objects
                    value = value.isoformat()
                
                row_dict[columns[i]] = value
            result.append(row_dict)
        
        cursor.close()
        conn.close()
        
        return jsonify({"data": result})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Serve the main HTML page."""
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    # Ensure the static directory exists
    os.makedirs('static', exist_ok=True)
    
    # Create the index.html file if it doesn't exist
    index_path = os.path.join('static', 'index.html')
    if not os.path.exists(index_path):
        with open(index_path, 'w') as f:
            f.write('''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Azure SQL Data Viewer</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Azure SQL Data Viewer</h1>
        <div class="controls">
            <div>
                <label for="tableSelect">Select Table:</label>
                <select id="tableSelect">
                    <option value="">Loading tables...</option>
                </select>
            </div>
            <button id="refreshBtn">Refresh Data</button>
        </div>
        <div id="errorContainer" class="error hidden"></div>
        <div id="loadingContainer" class="loading">Loading...</div>
        <div id="tableContainer" class="hidden">
            <table id="dataTable">
                <thead>
                    <tr id="tableHeaders"></tr>
                </thead>
                <tbody id="tableBody"></tbody>
            </table>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>''')
    
    # Create the CSS file
    css_path = os.path.join('static', 'styles.css')
    if not os.path.exists(css_path):
        with open(css_path, 'w') as f:
            f.write('''body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f5f5f5;
}

h1 {
    color: #0078d4;
    text-align: center;
}

.container {
    background-color: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}

th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

th {
    background-color: #0078d4;
    color: white;
}

tr:hover {
    background-color: #f5f5f5;
}

.loading {
    text-align: center;
    margin: 20px 0;
    font-style: italic;
    color: #666;
}

.error {
    color: #d83b01;
    padding: 10px;
    background-color: #fde7e9;
    border-radius: 4px;
    margin: 20px 0;
}

.controls {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
}

button {
    background-color: #0078d4;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
}

button:hover {
    background-color: #106ebe;
}

select {
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #ddd;
}

.hidden {
    display: none;
}''')
    
    # Create the JavaScript file
    js_path = os.path.join('static', 'app.js')
    if not os.path.exists(js_path):
        with open(js_path, 'w') as f:
            f.write('''// DOM elements
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
        const response = await fetch('/api/tables');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
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
        const response = await fetch(`/api/table-data/${encodeURIComponent(selectedTable)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        displayTableData(data);
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
            td.textContent = row[column] !== null ? row[column] : '';
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
}''')
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))