import azure.functions as func
import os
import json
import pyodbc
import pytz
import calendar
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
import requests
import openmeteo_requests
import pandas as pd
from retry_requests import retry

# Load environment variables
load_dotenv()

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

connection_string = os.environ.get('SQL_CONNECTION_STRING')

def get_db_connection():
    return pyodbc.connect(connection_string)

def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
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

# Initialize DB
init_db()

def make_json_response(data, status_code=200):
    return func.HttpResponse(
        body=json.dumps(data), 
        mimetype="application/json", 
        status_code=status_code
    )

@app.route(route="table-data", methods=["GET"])
def get_flag_data(req: func.HttpRequest) -> func.HttpResponse:
    try:
        limit_str = req.params.get('limit')
        offset_str = req.params.get('offset')
        limit = int(limit_str) if limit_str else 100
        offset = int(offset_str) if offset_str else 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT TOP 1 * FROM flag_data")
        columns = [column[0] for column in cursor.description]
        
        query = """
            SELECT * 
            FROM flag_data 
            ORDER BY date_time DESC 
            OFFSET ? ROWS 
            FETCH NEXT ? ROWS ONLY
        """
        cursor.execute(query, (offset, limit))
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            row_dict = {}
            for i, value in enumerate(row):
                if isinstance(value, (bytearray, bytes)):
                    value = value.hex()
                elif hasattr(value, 'isoformat'):
                    value = value.isoformat()
                row_dict[columns[i]] = value
            result.append(row_dict)
            
        cursor.execute("SELECT COUNT(*) FROM flag_data")
        total_rows = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return make_json_response({
            "data": result,
            "pagination": {
                "total_rows": total_rows,
                "limit": limit,
                "offset": offset,
                "next_offset": offset + limit if offset + limit < total_rows else None
            }
        })
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

@app.route(route="flag-distribution", methods=["GET"])
def get_flag_distribution(req: func.HttpRequest) -> func.HttpResponse:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        today = datetime.now()
        last_month = today - relativedelta(months=1)
        month1_start = last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month1_end = last_month.replace(day=calendar.monthrange(last_month.year, last_month.month)[1], hour=23, minute=59, second=59, microsecond=999999)
        
        two_months_ago = today - relativedelta(months=2)
        month2_start = two_months_ago.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month2_end = two_months_ago.replace(day=calendar.monthrange(two_months_ago.year, two_months_ago.month)[1], hour=23, minute=59, second=59, microsecond=999999)
        
        three_months_ago = today - relativedelta(months=3)
        month3_start = three_months_ago.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month3_end = three_months_ago.replace(day=calendar.monthrange(three_months_ago.year, three_months_ago.month)[1], hour=23, minute=59, second=59, microsecond=999999)
        
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
        cursor.execute(query, (
            month1_start.isoformat(), month1_end.isoformat(),
            month2_start.isoformat(), month2_end.isoformat(),
            month3_start.isoformat(), month3_end.isoformat(),
            min_date.isoformat(),
            month1_start.isoformat(), month1_end.isoformat(),
            month2_start.isoformat(), month2_end.isoformat(),
            month3_start.isoformat(), month3_end.isoformat()
        ))
        rows = cursor.fetchall()
        
        result = {
            "month1": {"name": month1_start.strftime("%B %Y"), "data": []},
            "month2": {"name": month2_start.strftime("%B %Y"), "data": []},
            "month3": {"name": month3_start.strftime("%B %Y"), "data": []}
        }
        
        for row in rows:
            flag_type, month1_count, month2_count, month3_count = row
            if month1_count > 0:
                result["month1"]["data"].append({"flag_type": flag_type, "count": month1_count})
            if month2_count > 0:
                result["month2"]["data"].append({"flag_type": flag_type, "count": month2_count})
            if month3_count > 0:
                result["month3"]["data"].append({"flag_type": flag_type, "count": month3_count})
                
        cursor.close()
        conn.close()
        return make_json_response(result)
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

@app.route(route="all-time-flag-distribution", methods=["GET"])
def get_all_time_flag_distribution(req: func.HttpRequest) -> func.HttpResponse:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "SELECT flag_type, COUNT(*) AS count FROM flag_data GROUP BY flag_type ORDER BY count DESC"
        cursor.execute(query)
        rows = cursor.fetchall()
        result = [{"flag_type": row[0], "count": row[1]} for row in rows]
        cursor.close()
        conn.close()
        return make_json_response({"data": result})
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

@app.route(route="flags-by-day", methods=["GET"])
def get_flags_by_day(req: func.HttpRequest) -> func.HttpResponse:
    try:
        date_str = req.params.get('date')
        if not date_str:
            return make_json_response([])

        cst = pytz.timezone('America/Chicago')
        utc = pytz.UTC
        
        day_start_naive = datetime.strptime(date_str, '%Y-%m-%d')
        day_start_cst = cst.localize(day_start_naive.replace(hour=0, minute=0, second=0, microsecond=0))
        day_end_cst = cst.localize(day_start_naive.replace(hour=23, minute=59, second=59, microsecond=999999))
        
        day_start_utc = day_start_cst.astimezone(utc)
        day_end_utc = day_end_cst.astimezone(utc)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT 
                CONVERT(varchar(5), DATEADD(hour, -5, date_time), 108) as time_cst,
                flag_type,
                date_time
            FROM flag_data
            WHERE date_time >= ? AND date_time <= ?
            ORDER BY date_time ASC
        """
        cursor.execute(query, (day_start_utc.isoformat(), day_end_utc.isoformat()))
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            time_cst, flag_type, date_time = row
            dt_cst = date_time.astimezone(cst)
            result.append({
                'time': time_cst,
                'flag_type': flag_type.strip() if flag_type else None,
                'date_time': dt_cst.isoformat()
            })
            
        cursor.close()
        conn.close()
        return make_json_response(result)
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

@app.route(route="current-month-flags", methods=["GET"])
def get_current_month_flags(req: func.HttpRequest) -> func.HttpResponse:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
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
        result = []
        for row in rows:
            date_cst, time_cst, flag_type = row
            result.append({
                "date": date_cst.strftime("%Y-%m-%d"),
                "time": time_cst,
                "flag_type": flag_type.strip() if flag_type else None
            })
        cursor.close()
        conn.close()
        return make_json_response(result)
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

@app.route(route="submit-report", methods=["POST"])
def submit_report(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
        if not data:
            return make_json_response({"error": "No data provided"}, 400)
            
        required_fields = ['date', 'time', 'flag_type', 'description']
        for field in required_fields:
            if field not in data or not data[field]:
                return make_json_response({"error": f"Missing required field: {field}"}, 400)

        cst = pytz.timezone('America/Chicago')
        current_date = datetime.now(cst).date()
        report_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        if report_date > current_date:
            return make_json_response({"error": "Cannot submit reports for future dates"}, 400)
            
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
        INSERT INTO flag_reports (
            report_date, report_time, flag_type, description, email
        ) VALUES (?, ?, ?, ?, ?)
        """
        cursor.execute(query, (
            data['date'], data['time'], data['flag_type'], data['description'], data.get('email')
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return make_json_response({"message": "Report submitted successfully"}, 201)
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

@app.route(route="recent-reports", methods=["GET"])
def get_recent_reports(req: func.HttpRequest) -> func.HttpResponse:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
        SELECT TOP 5 report_date, report_time, flag_type, submission_date 
        FROM flag_reports ORDER BY submission_date DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
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
        return make_json_response(reports)
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

retry_session = retry(requests.Session(), retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

@app.route(route="weather-data", methods=["GET"])
def get_weather_data(req: func.HttpRequest) -> func.HttpResponse:
    try:
        date_str = req.params.get('date')
        if not date_str:
            return make_json_response({"error": "No date provided"}, 400)

        requested_date = datetime.strptime(date_str, '%Y-%m-%d')
        current_date = datetime.now()
        date_diff = (current_date - requested_date).days

        if date_diff > 2:
            url = "https://archive-api.open-meteo.com/v1/archive"
        else:
            url = "https://api.open-meteo.com/v1/forecast"
            
        start_date = requested_date
        end_date = requested_date + timedelta(days=1)  
        
        params = {
            "latitude": 30.1766,
            "longitude": -85.8055,
            "start_date": start_date.strftime('%Y-%m-%d'),
            "end_date": end_date.strftime('%Y-%m-%d'),
            "hourly": ["temperature_2m", "surface_pressure", "precipitation", "wind_speed_10m"],
            "timezone": "UTC",
            "wind_speed_unit": "mph",
            "temperature_unit": "fahrenheit",
            "precipitation_unit": "inch"
        }
        
        responses = openmeteo.weather_api(url, params=params)
        response = responses[0]
        
        hourly = response.Hourly()
        hourly_temperature_2m = hourly.Variables(0).ValuesAsNumpy()
        hourly_surface_pressure = hourly.Variables(1).ValuesAsNumpy()
        hourly_precipitation = hourly.Variables(2).ValuesAsNumpy()
        hourly_wind_speed_10m = hourly.Variables(3).ValuesAsNumpy()
        
        hourly_data = {"date": pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s"),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s"),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left"
        )}
        hourly_data["temperature_2m"] = hourly_temperature_2m.tolist()
        hourly_data["surface_pressure"] = hourly_surface_pressure.tolist()
        hourly_data["precipitation"] = hourly_precipitation.tolist()
        hourly_data["wind_speed_10m"] = hourly_wind_speed_10m.tolist()
        
        df = pd.DataFrame(data=hourly_data)
        df['date'] = df['date'].dt.tz_localize('UTC').dt.tz_convert('America/Chicago')
        
        start_time = pd.Timestamp(date_str + ' 00:00:00').tz_localize('America/Chicago')
        end_time = pd.Timestamp(date_str + ' 23:59:59').tz_localize('America/Chicago')
        df = df[(df['date'] >= start_time) & (df['date'] <= end_time)]
        
        result = []
        for _, row in df.iterrows():
            result.append({
                "time": row["date"].isoformat(),
                "temperature": row["temperature_2m"],
                "pressure": row["surface_pressure"],
                "precipitation": row["precipitation"],
                "wind_speed": row["wind_speed_10m"]
            })
            
        return make_json_response({
            'date': date_str,
            'hourly_data': result
        })
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)
