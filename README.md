# PCB Flag Data Visualizer

A Flask web application that visualizes historical and current beach flag status data for Panama City Beach, Florida. The application provides interactive visualizations and real-time updates of water safety conditions.

This application serves as a public safety tool, helping beachgoers and residents stay informed about water conditions through an intuitive interface. By aggregating and visualizing flag data collected from the PCB Flag Scraper project, it provides valuable insights into historical water safety patterns and current conditions. The interactive features allow users to:
- Review historical flag patterns to plan beach visits
- Analyze seasonal trends in water safety
- Make informed decisions about beach activities based on historical data

<img width="937" alt="Screenshot 2025-04-07 at 7 08 34 PM" src="https://github.com/user-attachments/assets/5c0d7e20-60f6-4871-8b1c-0a4649d0a15d" />

## Features

- **Current Flag Status**: Real-time display of the most recent beach flag condition
- **Historical Data Table**: Paginated view of historical flag data with timezone conversion
- **Monthly Distribution**: Interactive pie charts showing flag distribution for the last three months
- **All-Time Statistics**: Bar chart visualization of historical flag distribution
- **Date-Specific Views**: Search and view flag records for specific dates
- **Interactive Calendar**: Visual calendar interface to browse and select dates with flag status indicators

## Technology Stack

### Frontend
- HTML/CSS/JavaScript
- Chart.js for data visualization
- Luxon for timezone management

### Backend
- Flask (Python)
- SQL Server database connection via pyodbc
- RESTful API endpoints

### Deployment
- Microsoft Azure App Service
- Gunicorn WSGI server

## Prerequisites
- Python 3.9+
- Dependencies listed in requirements.txt:
  - Flask
  - Flask-CORS
  - pyodbc
  - Werkzeug==2.0.3
  - python-dateutil
  - pytz
  - python-dotenv

## Setup
1. Clone the repository
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment
4. Install dependencies: `pip install -r requirements.txt`
5. Configure environment variables in `.env`
6. Run the application: `flask run`

## API Endpoints (from https://github.com/gsquared11/PCBFlagScraper)
- `/api/table-data`: Historical flag data with pagination
- `/api/flag-distribution`: Monthly flag distribution data
- `/api/all-time-flag-distribution`: All-time flag statistics
- `/api/flags-by-day`: Get flag data for a specific date
- `/api/current-month-flags`: Get flag data for the current month

## License
MIT License


