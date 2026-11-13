# PCB Flag Data Visualizer

A web application that displays current and historical beach flag data for Panama City Beach, Florida.

See the website here: <https://pcbflags.gsquared.dev>

Data collection is handled by [PCBFlagScraper](https://github.com/gsquared11/PCBFlagScraper). Consistent flag data collection for this viewer starts on February 28, 2025.

## Features

- **Current Flag Status**: Shows the latest recorded PCB beach flag with current wind, gusts, surf, and rain. The flag on the page waves harder as the wind picks up.
- **Interactive Calendar**: Browse recorded flags by month and select individual days for detailed readings.
- **Weather and Surf Context**: Pulls Open-Meteo weather and marine data for a selected date, including wind, gusts, rain, wave height, and ocean current estimates.
- **Charts**, grouped into four sections:
  - *At a glance*: key figures and every day on record as one colored square, with a flag filter and a play-through of the history.
  - *Through the year*: the flag mix for each calendar month and a monthly hazard index.
  - *Day to day*: how long each flag usually stays up and what replaces it, plus a weekday/time heatmap.
  - *Flag counts*: the last three months and the all-time distribution since February 28, 2025.
- **Collapsible Raw Data**: If you like looking at the cold, hard facts.

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript ES modules, Chart.js, Luxon
- **Backend**: Azure Functions (Python) connecting to Azure SQL Server via `pyodbc`
- **Weather Data**: Open-Meteo forecast and marine APIs
- **Deployment**: Azure Static Web Apps

## Data Notes

- Flag data is collected from the public Panama City Beach flag page by my [PCBFlagScraper](https://github.com/gsquared11/PCBFlagScraper).
- Charts and summaries are restricted to records on or after February 28, 2025 because earlier records were not collected consistently.
- Readings are taken every four hours, so flag changes shorter than that are not captured. Stretch lengths in "When a flag goes up" skip any stretch interrupted by a gap of more than 12 hours in the readings.
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
- The frontend loads Luxon and Chart.js from a CDN and the Inter typeface from Google Fonts, so those must be reachable by clients.

## API Endpoints

- `/api/table-data`: Historical flag data with pagination
- `/api/flag-distribution`: Recent monthly flag distribution data
- `/api/all-time-flag-distribution`: Flag distribution since February 28, 2025
- `/api/flags-by-day`: Get flag data for a specific date
- `/api/flag-history`: Every flag reading since February 28, 2025
- `/api/weather-data`: Get Open-Meteo weather and marine context for a specific date
