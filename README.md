


# PCB Flag Data Visualizer - Flask Web Application
https://pcb-flag-viewer.azurewebsites.net/

<img width="937" alt="Screenshot 2025-04-07 at 7 08 34 PM" src="https://github.com/user-attachments/assets/5c0d7e20-60f6-4871-8b1c-0a4649d0a15d" />


This Flask Web Application hosted on Azure visualizes historical and current beach flag status data collected from my database of flag data (see https://github.com/gsquared11/PCBFlagScraper/tree/main). The web app provides interactive charts, tables, and date-specific views to enhance public awareness about water safety conditions.

## Features

### 1. Current Flag Condition Display
- **Function Name:** `updateCurrentFlag()`
- **Purpose:** Displays the most recent beach flag status.
- **Approach:**
  - Fetches the latest flag status from the backend API.
  - Dynamically updates the UI with the current flag color and description.

### 2. Historical Flag Data Table
- **Purpose:** Displays historical flag data with pagination.
- **Functionality:**
  - Fetches paginated data (25 entries per page) from the backend API.
  - Converts timestamps from UTC to CST for improved readability.
  - Provides controls for navigating between pages of data.

### 3. Monthly Flag Distribution (Pie Charts)
- **Purpose:** Visualizes the flag distribution for the last three months.
- **Approach:**
  - Retrieves monthly aggregated data via API.
  - Displays data in three interactive pie charts generated using Chart.js.

### 4. All-Time Flag Distribution (Bar Chart)
- **Purpose:** Provides a bar chart overview of historical flag distribution data.
- **Approach:**
  - Fetches all-time aggregated flag data from the backend.
  - Visualizes data in an interactive bar chart using Chart.js.

### 5. Flag Data by Date
- **Purpose:** Allows users to view flag records for a specific date.
- **Approach:**
  - Accepts user-selected date inputs.
  - Fetches and displays corresponding flag entries, including timestamps converted to Central Standard Time (CST).

## Technology Stack

### Frontend
- **HTML/CSS/JavaScript:** For interactive UI and responsive design.
- **Chart.js:** For creating responsive pie and bar charts.
- **Luxon:** Manages timezone conversions and date manipulations.

### Backend
- **Flask:** (Python) Serves APIs for retrieving historical and aggregated flag data.

### Cloud Platform
- **Microsoft Azure:** Utilized for deploying and hosting the Flask application via Gunicorn

## Prerequisites
- **Flask:** Python 3.9 to maintain compatibility with dependencies shown in requirements.txt
- **Chart.js:** Included via CDN.
- **Luxon:** Included via CDN.

Ensure the Flask backend API endpoints (`/api/table-data`, `/api/flag-distribution`, and `/api/all-time-flag-distribution`) are properly configured and accessible in your Azure service.


