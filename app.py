import os
import pyodbc
import json
import pytz
import calendar
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app and enable CORS for all routes (multiple connections)
app = Flask(__name__, static_folder='static')
CORS(app)

# Get connection string from environment variable on Azure
connection_string = os.environ.get('SQL_CONNECTION_STRING')

def get_db_connection():
    """Create and return a database connection."""
    return pyodbc.connect(connection_string)

def init_db():
    """Initialize the database with required tables."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create reports table if it doesn't exist
        cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'flag_reports')
        CREATE TABLE flag_reports (
            id INT IDENTITY(1,1) PRIMARY KEY,
            report_date DATE NOT NULL,
            report_time TIME NOT NULL,
            flag_type NVARCHAR(50) NOT NULL,
            description NVARCHAR(MAX) NOT NULL,
            email NVARCHAR(255),
            submission_date DATETIME DEFAULT GETDATE(),
            status NVARCHAR(20) DEFAULT 'pending'
        )
        """)
        
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error initializing database: {str(e)}")

# Initialize database on startup
init_db()

# Create an API response specifically for the 'flag_data' table
@app.route('/api/table-data', methods=['GET'])
def get_flag_data():
    """Fetch data only from the 'flag_data' table with pagination."""
    try:
        # Get limit and offset from query parameters
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get column names for 'flag_data' table
        cursor.execute("SELECT TOP 1 * FROM flag_data")
        columns = [column[0] for column in cursor.description]
        
        # Fetch paginated data from 'flag_data', sorted by id DESC (most recent first)
        query = """
            SELECT * 
            FROM flag_data 
            ORDER BY id DESC 
            OFFSET ? ROWS 
            FETCH NEXT ? ROWS ONLY
        """
        cursor.execute(query, (offset, limit))
        rows = cursor.fetchall()
        
        # Convert rows into a list of dictionaries with column names as keys
        result = []
        for row in rows:
            row_dict = {}
            for i, value in enumerate(row):
                # Convert non-serializable types to strings
                if isinstance(value, (bytearray, bytes)):
                    value = value.hex()
                elif hasattr(value, 'isoformat'):  # Handle datetime objects
                    value = value.isoformat()
                
                row_dict[columns[i]] = value
            result.append(row_dict)
        
        # Get the total number of rows for pagination purposes
        cursor.execute("SELECT COUNT(*) FROM flag_data")
        total_rows = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        # Return data along with pagination details
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

# Create an API response for the last 3 months of flag distribution
@app.route('/api/flag-distribution', methods=['GET'])
def get_flag_distribution():
    """Get the distribution of flags for the last three complete months."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        today = datetime.now()
        print(f"Current date: {today}")
        
        # Get last full month (month1)
        last_month = today - relativedelta(months=1)
        month1_start = last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month1_end = last_month.replace(day=calendar.monthrange(last_month.year, last_month.month)[1], hour=23, minute=59, second=59, microsecond=999999)
        print(f"Month 1: {month1_start.strftime('%B %Y')} to {month1_end.strftime('%B %Y')}")
        
        # Get the month before that (month2)
        two_months_ago = today - relativedelta(months=2)
        month2_start = two_months_ago.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month2_end = two_months_ago.replace(day=calendar.monthrange(two_months_ago.year, two_months_ago.month)[1], hour=23, minute=59, second=59, microsecond=999999)
        print(f"Month 2: {month2_start.strftime('%B %Y')} to {month2_end.strftime('%B %Y')}")
        
        # Get three months ago (month3)
        three_months_ago = today - relativedelta(months=3)
        month3_start = three_months_ago.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month3_end = three_months_ago.replace(day=calendar.monthrange(three_months_ago.year, three_months_ago.month)[1], hour=23, minute=59, second=59, microsecond=999999)
        print(f"Month 3: {month3_start.strftime('%B %Y')} to {month3_end.strftime('%B %Y')}")
        
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
        
        # Debug: Print the raw counts for each month
        print("\nRaw counts from database:")
        for row in rows:
            flag_type, month1_count, month2_count, month3_count = row
            print(f"{flag_type}:")
            print(f"  Month 1 ({month1_start.strftime('%B %Y')}): {month1_count}")
            print(f"  Month 2 ({month2_start.strftime('%B %Y')}): {month2_count}")
            print(f"  Month 3 ({month3_start.strftime('%B %Y')}): {month3_count}")
        
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
        
        print(f"\nReturning result: {result}")
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in get_flag_distribution: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Create an API response for the bar chart (all time flag distribution)
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
    
# Create an API resposne for flags by day
@app.route('/api/flags-by-day', methods=['GET'])
def get_flags_by_day():
    """Return all flags for a specific day (12:00 AM CST - 11:59 PM CST)."""
    try:
        date_str = request.args.get('date')
        if not date_str:
            return jsonify([])  # No date provided, return empty list

        # Define CST timezone
        cst = pytz.timezone('America/Chicago')
        utc = pytz.UTC  # Use UTC constant instead of function

        # Parse input date and set time to 12:00 AM CST
        day_start_naive = datetime.strptime(date_str, '%Y-%m-%d')
        day_start_cst = cst.localize(day_start_naive.replace(hour=0, minute=0, second=0, microsecond=0))
        day_end_cst = cst.localize(day_start_naive.replace(hour=23, minute=59, second=59, microsecond=999999))

        # Convert to UTC for database query
        day_start_utc = day_start_cst.astimezone(utc)
        day_end_utc = day_end_cst.astimezone(utc)

        conn = get_db_connection()
        cursor = conn.cursor()

        # Query all records that fall within the CST day
        query = """
            SELECT 
                CONVERT(varchar(5), DATEADD(hour, -5, date_time), 108) as time_cst,
                flag_type,
                date_time
            FROM flag_data
            WHERE date_time >= ? AND date_time <= ?
            ORDER BY date_time ASC
        """
        cursor.execute(query, (day_start_utc, day_end_utc))
        rows = cursor.fetchall()

        # Process results
        result = []
        for row in rows:
            time_cst, flag_type, date_time = row
            # Convert UTC datetime to CST
            dt_cst = date_time.astimezone(cst)
            result.append({
                'time': time_cst,
                'flag_type': flag_type.strip() if flag_type else None,
                'date_time': dt_cst.isoformat()
            })

        cursor.close()
        conn.close()
        return jsonify(result)

    except Exception as e:
        print(f"Error in get_flags_by_day: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/current-month-flags', methods=['GET'])
def get_current_month_flags():
    """Get all flags for all months."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Define CST timezone
        cst = pytz.timezone('America/Chicago')
        utc = pytz.utc
        
        # Get all flags ordered by date
        query = """
        SELECT 
            CONVERT(date, DATEADD(hour, -5, date_time)) as date_cst,
            CONVERT(varchar(5), DATEADD(hour, -5, date_time), 108) as time_cst,
            flag_type
        FROM flag_data
        ORDER BY date_time ASC
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Convert to list of dictionaries with date and flag type
        result = []
        for row in rows:
            date_cst, time_cst, flag_type = row
            result.append({
                "date": date_cst.strftime("%Y-%m-%d"),
                "time": time_cst,
                "flag_type": flag_type.strip() if flag_type else None  # Handle any whitespace in flag_type
            })
        
        cursor.close()
        conn.close()
        
        print(f"Returning {len(result)} flags for all months")
        print("Sample of flags:", result[:5] if result else "No flags found")
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in get_current_month_flags: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/submit-report', methods=['POST'])
def submit_report():
    """Handle submission of flag data reports."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        required_fields = ['date', 'time', 'flag_type', 'description']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Parse date in America/Chicago timezone
        cst = pytz.timezone('America/Chicago')
        current_date = datetime.now(cst).date()
        
        # Parse the input date (which is in YYYY-MM-DD format)
        report_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        if report_date > current_date:
            return jsonify({"error": "Cannot submit reports for future dates"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Insert the report into the database
        query = """
        INSERT INTO flag_reports (
            report_date,
            report_time,
            flag_type,
            description,
            email
        ) VALUES (?, ?, ?, ?, ?)
        """
        
        cursor.execute(query, (
            data['date'],  # Keep the original date string
            data['time'],
            data['flag_type'],
            data['description'],
            data.get('email')  # Optional field
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"message": "Report submitted successfully"}), 201
        
    except Exception as e:
        print(f"Error submitting report: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recent-reports', methods=['GET'])
def get_recent_reports():
    """Get the 5 most recent flag reports."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
        SELECT TOP 5
            report_date,
            report_time,
            flag_type,
            submission_date
        FROM flag_reports
        ORDER BY submission_date DESC
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Convert to list of dictionaries
        reports = []
        for row in rows:
            report_date, report_time, flag_type, submission_date = row
            reports.append({
                'date': report_date.strftime('%Y-%m-%d'),
                'time': report_time.strftime('%H:%M'),
                'flag_type': flag_type,
                'submitted': submission_date.isoformat()
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(reports)
    
    except Exception as e:
        print(f"Error fetching recent reports: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Serve the main HTML page."""
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=3000)