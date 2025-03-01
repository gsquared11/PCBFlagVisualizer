import os
import pyodbc
import json
import calendar
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

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

@app.route('/api/flag-distribution', methods=['GET'])
def get_flag_distribution():
    """Get the distribution of flags for the last three complete months."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        today = datetime.now()
        
        # Get last full month (month1)
        last_month = today - relativedelta(months=1)
        month1_start = last_month.replace(day=1)
        month1_end = last_month.replace(day=calendar.monthrange(last_month.year, last_month.month)[1])
        
        # Get the month before that (month2)
        two_months_ago = today - relativedelta(months=2)
        month2_start = two_months_ago.replace(day=1)
        month2_end = two_months_ago.replace(day=calendar.monthrange(two_months_ago.year, two_months_ago.month)[1])
        
        # Get three months ago (month3)
        three_months_ago = today - relativedelta(months=3)
        month3_start = three_months_ago.replace(day=1)
        month3_end = three_months_ago.replace(day=calendar.monthrange(three_months_ago.year, three_months_ago.month)[1])
        
        # SQL query: count flags per month based on the computed ranges.
        query = """
        SELECT 
            flag_type,
            COUNT(CASE WHEN date_time >= ? AND date_time <= ? THEN 1 END) AS month1_count,
            COUNT(CASE WHEN date_time >= ? AND date_time <= ? THEN 1 END) AS month2_count,
            COUNT(CASE WHEN date_time >= ? AND date_time <= ? THEN 1 END) AS month3_count
        FROM flag_data
        WHERE date_time >= ?
        GROUP BY flag_type
        ORDER BY 
            (COUNT(CASE WHEN date_time >= ? AND date_time <= ? THEN 1 END) +
             COUNT(CASE WHEN date_time >= ? AND date_time <= ? THEN 1 END) +
             COUNT(CASE WHEN date_time >= ? AND date_time <= ? THEN 1 END)) DESC
        """
        
        # Use month3_start as the minimum date so that only records in the last three full months are considered.
        min_date = month3_start
        
        cursor.execute(query, (
            month1_start, month1_end,
            month2_start, month2_end,
            month3_start, month3_end,
            min_date,
            month1_start, month1_end,
            month2_start, month2_end,
            month3_start, month3_end
        ))
        
        rows = cursor.fetchall()
        
        # Build the result dictionary with a list for each month.
        result = {
            "month1": {
                "name": month1_start.strftime("%B %Y"),
                "data": []
            },
            "month2": {
                "name": month2_start.strftime("%B %Y"),
                "data": []
            },
            "month3": {
                "name": month3_start.strftime("%B %Y"),
                "data": []
            }
        }
        
        for row in rows:
            flag_type, month1_count, month2_count, month3_count = row
            
            if month1_count > 0:
                result["month1"]["data"].append({
                    "flag_type": flag_type,
                    "count": month1_count
                })
            if month2_count > 0:
                result["month2"]["data"].append({
                    "flag_type": flag_type,
                    "count": month2_count
                })
            if month3_count > 0:
                result["month3"]["data"].append({
                    "flag_type": flag_type,
                    "count": month3_count
                })
        
        cursor.close()
        conn.close()
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/all-time-flag-distribution', methods=['GET'])
def get_all_time_flag_distribution():
    """Get the all‑time flag distribution."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
        SELECT flag_type, COUNT(*) AS count
        FROM flag_data
        GROUP BY flag_type
        ORDER BY count DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        result = []
        for row in rows:
            flag_type, count = row
            result.append({"flag_type": flag_type, "count": count})
        cursor.close()
        conn.close()
        return jsonify({"data": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/flags-by-day', methods=['GET'])
def get_flags_by_day():
    """Return all flags for a specific day (YYYY-MM-DD)."""
    try:
        date_str = request.args.get('date')
        if not date_str:
            # No date provided, return empty
            return jsonify([])

        # Convert the date string to a datetime object
        day_start = datetime.strptime(date_str, '%Y-%m-%d')
        # End of the day is day_start + 1 day, exclusive
        day_end = day_start + timedelta(days=1)

        conn = get_db_connection()
        cursor = conn.cursor()
        # Query all records that fall on the specified day
        query = """
            SELECT *
            FROM flag_data
            WHERE date_time >= ? AND date_time < ?
            ORDER BY date_time ASC
        """
        cursor.execute(query, (day_start, day_end))
        rows = cursor.fetchall()

        # Gather column names
        columns = [col[0] for col in cursor.description]
        result = []
        for row in rows:
            row_dict = {}
            for i, val in enumerate(row):
                # Convert datetime objects to ISO strings, etc.
                if hasattr(val, 'isoformat'):
                    val = val.isoformat()
                row_dict[columns[i]] = val
            result.append(row_dict)

        cursor.close()
        conn.close()
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Serve the main HTML page."""
    return send_from_directory('static', 'index.html')