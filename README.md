# PCB Flag Data Viewer

This project is a web-based application that displays PCB (Panama City Beach) flag data using a Flask backend and a responsive frontend. It fetches and displays flag data in a paginated table, updating the data on-demand with a refresh button.
https://pcb-flag-viewer.azurewebsites.net/

## Features

- **Dynamic Table Display**: Shows flag data in a table format with pagination.
- **Automatic Date Conversion**: Dates are converted from UTC to CST using Luxon.
- **Error Handling and Loading States**: Displays appropriate messages for loading and error scenarios.
- **Responsive Design**: Styled for desktop and mobile using modern CSS techniques.

## Tech Stack

- **Frontend**:
  - **HTML/CSS** for layout and styling.
  - **JavaScript** for dynamic DOM manipulation and data fetching.
  - **Luxon** for timezone conversion.
- **Backend**:
  - **Flask** as the web framework for serving data via a RESTful API.
- **Database**:
  - Azure SQL Database for storing flag data (see https://github.com/gsquared11/PCBFlagScraper).

