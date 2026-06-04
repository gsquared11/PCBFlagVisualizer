# PCB Flag Data Visualizer

A web application that displays current and historical beach flag data for Panama City Beach, Florida.

See the website here: <https://pcbflags.gsquared.dev>

Data collection is handled by [PCBFlagScraper](https://github.com/gsquared11/PCBFlagScraper). Consistent flag data collection for this viewer starts on February 28, 2025.

## Screenshots

<table>
  <tr>
    <td><img width="500" alt="Current flag and calendar view" src="https://github.com/user-attachments/assets/ae98bd5d-ba92-4654-b6c5-10486674f767" /></td>
    <td><img width="500" alt="Weather and surf context chart" src="https://github.com/user-attachments/assets/6a080ac0-45df-4fc1-8e01-d3015bc03d13" /></td>
  </tr>
  <tr>
    <td><img width="500" alt="Flag trends dashboard" src="https://github.com/user-attachments/assets/8a7ded29-3f45-43f6-965f-ec0ff2f78a3b" /></td>
    <td><img width="500" alt="Flag distribution charts" src="https://github.com/user-attachments/assets/67e5c73c-0142-4f7d-9af9-26a8be1ceec2" /></td>
  </tr>
  <tr>
    <td><img width="500" alt="About beach flags section" src="https://github.com/user-attachments/assets/4a88fc91-2658-47de-a122-f1d5755517ba" /></td>
    <td><img width="500" alt="Raw data section" src="https://github.com/user-attachments/assets/f5e1f921-cd0f-4d73-88f7-4a54fe87633a" /></td>
  </tr>
</table>

## Features

- **Current Flag Status**: Shows the latest recorded PCB beach flag with hazard context.
- **Interactive Calendar**: Browse recorded flags by month and select individual days for detailed readings.
- **Weather and Surf Context**: Pulls Open-Meteo weather and marine data for a selected date, including wind, gusts, rain, wave height, and ocean current estimates.
- **Flag Trend Charts**: Includes a monthly hazard index, high-hazard share, weekday/time heatmap, three-month stacked flag comparison, and all-time distribution since February 28, 2025.
- **Collapsible Raw Data**: If you like looking at the cold, hard facts.

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript ES modules, Chart.js, Luxon
- **Backend**: Azure Functions (Python) connecting to Azure SQL Server via `pyodbc`
- **Weather Data**: Open-Meteo forecast and marine APIs
- **Deployment**: Azure Static Web Apps

## Data Notes

- Flag data is collected from the public Panama City Beach flag page by my [PCBFlagScraper](https://github.com/gsquared11/PCBFlagScraper).
- Charts and summaries are restricted to records on or after February 28, 2025 because earlier records were not collected consistently.
- Times are displayed in Panama City Beach local time and dynamically reflect CST or CDT.
- Open-Meteo weather and marine values are model estimates. Marine data is useful for context, but it should not be used for navigation or safety-critical decisions.

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
   The Azure Function expects a `SQL_CONNECTION_STRING` setting.

5. Run the application locally:
   - To serve the static frontend only:
     ```bash
     python -m http.server 4173 -d src
     ```
     Then open <http://127.0.0.1:4173>. API-backed sections will show unavailable data unless the functions runtime is also running.
   - To run just the API backend:
     ```bash
     cd api
     func start
     ```
   - To serve the frontend and route API calls to the local functions runtime using the SWA CLI:
     ```bash
     swa start src --api-location api
     ```

## Deployment Notes

- The GitHub Actions workflow deploys `src` as the Static Web Apps frontend and `api` as the Azure Functions backend.
- The production Static Web App must have `SQL_CONNECTION_STRING` configured in its application settings.
- The frontend uses browser-loaded CDN scripts for Luxon and Chart.js, so those CDNs must be reachable by clients.

## API Endpoints

- `/api/table-data`: Historical flag data with pagination
- `/api/flag-distribution`: Recent monthly flag distribution data
- `/api/all-time-flag-distribution`: Flag distribution since February 28, 2025
- `/api/flags-by-day`: Get flag data for a specific date
- `/api/current-month-flags`: Get flag data for the current month
- `/api/weather-data`: Get Open-Meteo weather and marine context for a specific date
