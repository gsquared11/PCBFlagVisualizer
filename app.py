import os
import pyodbc
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Initialize Flask app and enable CORS for all routes (multiple connections)
app = Flask(__name__, static_folder='static')
CORS(app)

# Get connection string from environment variable on Azure
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
        
        # Returns a list of table names as jsons
        return jsonify({"tables": tables})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/table-data/<table_name>', methods=['GET'])
def get_table_data(table_name):
    """Get data from a specific table with pagination."""
    try:
        # Basic validation to prevent SQL injection
        if not table_name.isalnum() and not all(c.isalnum() or c == '_' for c in table_name):
            return jsonify({"error": "Invalid table name"}), 400
        
        # Get limit and offset from query parameters
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get column names for the table
        cursor.execute(f"SELECT TOP 1 * FROM {table_name}")
        columns = [column[0] for column in cursor.description]
        
        # Get data using OFFSET and FETCH NEXT for pagination, sorted by id DESC (most recent)
        query = f"""
            SELECT * 
            FROM {table_name} 
            ORDER BY id DESC 
            OFFSET {offset} ROWS 
            FETCH NEXT {limit} ROWS ONLY
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Convert rows to list of dictionaries with column names as keys
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
        
        # Get the total number of rows for pagination info
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        total_rows = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        # Return data along with pagination info
        return jsonify({
            "data": result,
            "pagination": {
                "total_rows": total_rows,
                "limit": limit,
                "offset": offset,
                "next_offset": offset + limit if offset + limit < total_rows else None
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Serve the main HTML page."""
    return send_from_directory('static', 'index.html')