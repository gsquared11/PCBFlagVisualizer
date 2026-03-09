# PCB Flag Data Visualizer

A web application that displays current and historical beach flag data for Panama City Beach, Florida.

See the website here: https://pcb-flag-viewer.azurewebsites.net/

Data from https://github.com/gsquared11/PCBFlagScraper

![image](https://github.com/user-attachments/assets/56490105-6e2d-4363-ab95-b0d2c1baa6fb)
![image](https://github.com/user-attachments/assets/cb6f0c33-1f7f-44ff-ae60-6e0ad4af6a6c)

## Features
- **Current Flag Status**: Real-time display of the most recent beach flag condition.
- **Historical Data Table**: View historical flag data with timezone conversion.
- **Monthly Distribution**: Pie charts showing flag distribution for the last three months.
- **All-Time Statistics**: Bar chart of historical flag distribution.
- **Date-Specific Views**: Search for specific dates to see trends and hourly weather data.
- **Interactive Calendar**: Visual calendar to browse dates.

## Technology Stack
- **Frontend**: HTML, CSS, JavaScript (Chart.js, Luxon)
- **Backend**: Azure Functions (Python) connecting to an Azure SQL Server database via `pyodbc`
- **Deployment**: Azure Static Web Apps

## Local Development

1. Clone the repository.
2. Install dependencies:
   - Python 3.9+
   - [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
   - [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) (optional, for full-stack local testing)

3. Set up the Python virtual environment for the backend:
   ```bash
   cd api
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   pip install -r requirements.txt
   ```

4. Create a `local.settings.json` file in the `api` folder with your required database credentials.

5. Run the application locally:
   - To run just the API backend:
     ```bash
     cd api
     func start
     ```
   - To serve the frontend and route API calls to the local functions runtime using the SWA CLI:
     ```bash
     swa start src --api-location api
     ```

## API Endpoints
- `/api/table-data`: Historical flag data with pagination
- `/api/flag-distribution`: Monthly flag distribution data
- `/api/all-time-flag-distribution`: All-time flag statistics
- `/api/flags-by-day`: Get flag data for a specific date
- `/api/current-month-flags`: Get flag data for the current month

## License
MIT License
