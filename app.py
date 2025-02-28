import os
import pyodbc
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

# Get connection string from environment variable
connection_string = os.environ.get('SQL_CONNECTION_STRING')

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

app.run(host='0.0.0.0', port=8000)