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
import pandas as pd
from retry_requests import retry

load_dotenv()

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

connection_string = os.environ.get('SQL_CONNECTION_STRING')
CENTRAL_TZ = pytz.timezone('America/Chicago')
UTC_TZ = pytz.UTC
DATA_START_CENTRAL = CENTRAL_TZ.localize(datetime(2025, 2, 28))
DATA_START_UTC = DATA_START_CENTRAL.astimezone(UTC_TZ)
DATA_START_UTC_NAIVE = DATA_START_UTC.replace(tzinfo=None)

def get_db_connection():
    return pyodbc.connect(connection_string)

def make_json_response(data, status_code=200):
    return func.HttpResponse(
        body=json.dumps(data), 
        mimetype="application/json", 
        status_code=status_code
    )

def as_utc(value):
    if value.tzinfo is None:
        return UTC_TZ.localize(value)
    return value.astimezone(UTC_TZ)

def as_central(value):
    return as_utc(value).astimezone(CENTRAL_TZ)

@app.route(route="table-data", methods=["GET"])
def get_flag_data(req: func.HttpRequest) -> func.HttpResponse:
    try:
        limit = req.params.get('limit')
        offset = req.params.get('offset')
        limit = int(limit) if limit else 100
        offset = int(offset) if offset else 0
        
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
        min_date = max(month3_start, DATA_START_UTC_NAIVE)
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
        query = """
            SELECT flag_type, COUNT(*) AS count
            FROM flag_data
            WHERE date_time >= ?
            GROUP BY flag_type
            ORDER BY count DESC
        """
        cursor.execute(query, (DATA_START_UTC_NAIVE,))
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

        day_start_naive = datetime.strptime(date_str, '%Y-%m-%d')
        day_start_central = CENTRAL_TZ.localize(day_start_naive.replace(hour=0, minute=0, second=0, microsecond=0))
        day_end_central = CENTRAL_TZ.localize(day_start_naive.replace(hour=23, minute=59, second=59, microsecond=999999))
        
        day_start_utc = day_start_central.astimezone(UTC_TZ)
        day_end_utc = day_end_central.astimezone(UTC_TZ)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT 
                flag_type,
                date_time
            FROM flag_data
            WHERE date_time >= ? AND date_time <= ?
            ORDER BY date_time ASC
        """
        cursor.execute(query, (day_start_utc, day_end_utc))
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            flag_type, date_time = row
            dt_central = as_central(date_time)
            result.append({
                'time': dt_central.strftime('%H:%M'),
                'timezone': dt_central.tzname(),
                'flag_type': flag_type.strip() if flag_type else None,
                'date_time': dt_central.isoformat()
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
            date_time,
            flag_type
        FROM flag_data
        WHERE date_time >= ?
        ORDER BY date_time ASC
        """
        cursor.execute(query, (DATA_START_UTC_NAIVE,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            date_time, flag_type = row
            dt_central = as_central(date_time)
            result.append({
                "date": dt_central.strftime("%Y-%m-%d"),
                "time": dt_central.strftime("%H:%M"),
                "timezone": dt_central.tzname(),
                "flag_type": flag_type.strip() if flag_type else None
            })
        cursor.close()
        conn.close()
        return make_json_response(result)
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

retry_session = retry(requests.Session(), retries=5, backoff_factor=0.2)

@app.route(route="weather-data", methods=["GET"])
def get_weather_data(req: func.HttpRequest) -> func.HttpResponse:
    try:
        date_str = req.params.get('date')
        if not date_str:
            return make_json_response({"error": "No date provided"}, 400)

        requested_date = CENTRAL_TZ.localize(datetime.strptime(date_str, '%Y-%m-%d'))
        current_date = datetime.now(CENTRAL_TZ)
        date_diff = (current_date.date() - requested_date.date()).days

        if date_diff > 5:
            weather_url = "https://archive-api.open-meteo.com/v1/archive"
            data_source = "historical_weather"
        else:
            weather_url = "https://api.open-meteo.com/v1/forecast"
            data_source = "forecast"

        weather_params = {
            "latitude": 30.1766,
            "longitude": -85.8055,
            "start_date": date_str,
            "end_date": date_str,
            "timezone": "America/Chicago",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "hourly": [
                "temperature_2m",
                "apparent_temperature",
                "relative_humidity_2m",
                "precipitation",
                "surface_pressure",
                "wind_speed_10m",
                "wind_gusts_10m",
                "wind_direction_10m",
                "weather_code"
            ],
            "daily": [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "apparent_temperature_max",
                "apparent_temperature_min",
                "precipitation_sum",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "wind_direction_10m_dominant"
            ]
        }

        weather_payload = openmeteo_json(weather_url, weather_params)
        marine_payload = get_marine_payload(date_str)

        return make_json_response({
            'date': date_str,
            'source': data_source,
            'summary': build_daily_summary(weather_payload),
            'hourly_data': build_hourly_weather(weather_payload),
            'marine_data': build_hourly_marine(marine_payload)
        })
    except Exception as e:
        return make_json_response({"error": str(e)}, 500)

def openmeteo_json(url, params):
    response = retry_session.get(url, params=params, timeout=15)
    response.raise_for_status()
    payload = response.json()
    if "error" in payload:
        raise ValueError(payload.get("reason", "Open-Meteo returned an error"))
    return payload

def get_marine_payload(date_str):
    try:
        return openmeteo_json(
            "https://marine-api.open-meteo.com/v1/marine",
            {
                "latitude": 30.1766,
                "longitude": -85.8055,
                "start_date": date_str,
                "end_date": date_str,
                "timezone": "America/Chicago",
                "hourly": [
                    "wave_height",
                    "wave_period",
                    "wave_direction",
                    "ocean_current_velocity",
                    "ocean_current_direction",
                    "sea_surface_temperature"
                ],
                "current_velocity_unit": "mph"
            }
        )
    except Exception:
        return {}

def build_daily_summary(payload):
    daily = payload.get("daily", {})
    return {
        "weather_code": first_value(daily.get("weather_code")),
        "temp_max": first_value(daily.get("temperature_2m_max")),
        "temp_min": first_value(daily.get("temperature_2m_min")),
        "apparent_temp_max": first_value(daily.get("apparent_temperature_max")),
        "apparent_temp_min": first_value(daily.get("apparent_temperature_min")),
        "precipitation_sum": first_value(daily.get("precipitation_sum")),
        "wind_max": first_value(daily.get("wind_speed_10m_max")),
        "wind_gust_max": first_value(daily.get("wind_gusts_10m_max")),
        "wind_direction": first_value(daily.get("wind_direction_10m_dominant"))
    }

def build_hourly_weather(payload):
    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    result = []

    for index, time_value in enumerate(times):
        result.append({
            "time": local_openmeteo_time(time_value),
            "temperature": list_value(hourly, "temperature_2m", index),
            "apparent_temperature": list_value(hourly, "apparent_temperature", index),
            "humidity": list_value(hourly, "relative_humidity_2m", index),
            "precipitation": list_value(hourly, "precipitation", index),
            "pressure": list_value(hourly, "surface_pressure", index),
            "wind_speed": list_value(hourly, "wind_speed_10m", index),
            "wind_gust": list_value(hourly, "wind_gusts_10m", index),
            "wind_direction": list_value(hourly, "wind_direction_10m", index),
            "weather_code": list_value(hourly, "weather_code", index)
        })

    return result

def build_hourly_marine(payload):
    hourly = payload.get("hourly", {})
    units = payload.get("hourly_units", {})
    times = hourly.get("time", [])
    result = []

    for index, time_value in enumerate(times):
        wave_height_m = list_value(hourly, "wave_height", index)
        current_velocity = list_value(hourly, "ocean_current_velocity", index)
        result.append({
            "time": local_openmeteo_time(time_value),
            "wave_height_ft": meters_to_feet(wave_height_m),
            "wave_period": list_value(hourly, "wave_period", index),
            "wave_direction": list_value(hourly, "wave_direction", index),
            "ocean_current_mph": current_to_mph(current_velocity, units.get("ocean_current_velocity")),
            "ocean_current_direction": list_value(hourly, "ocean_current_direction", index),
            "sea_surface_temperature_c": list_value(hourly, "sea_surface_temperature", index)
        })

    return result

def list_value(values, key, index):
    items = values.get(key, [])
    if index >= len(items):
        return None
    value = items[index]
    return None if pd.isna(value) else value

def first_value(values):
    if not values:
        return None
    value = values[0]
    return None if pd.isna(value) else value

def local_openmeteo_time(value):
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        return CENTRAL_TZ.localize(dt).isoformat()
    return dt.astimezone(CENTRAL_TZ).isoformat()

def meters_to_feet(value):
    return None if value is None else value * 3.28084

def current_to_mph(value, unit):
    if value is None:
        return None
    if unit in ("mph", "mp/h"):
        return value
    if unit == "km/h":
        return value * 0.621371
    if unit == "m/s":
        return value * 2.23694
    if unit == "kn":
        return value * 1.15078
    return value
