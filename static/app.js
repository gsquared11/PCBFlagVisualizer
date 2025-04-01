// Global Variables and DOM Elements
let currentPage = 1;      // Current page number for pagination
let limit = 25;           // Number of rows per page
let offset = 0;           // Offset for pagination
let chartInstances = [];  // Store chart instances for cleanup

// Get refs to DOM elements
const refreshBtn = document.getElementById("refreshBtn");
const errorContainer = document.getElementById("errorContainer");
const loadingContainer = document.getElementById("loadingContainer");
const tableContainer = document.getElementById("tableContainer");
const tableHeaders = document.getElementById("tableHeaders");
const tableBody = document.getElementById("tableBody");
const flagDate = document.getElementById("flagDate");
const loadFlagsByDayBtn = document.getElementById("loadFlagsByDayBtn");
const flagsByDayContainer = document.getElementById("flagsByDayContainer");
const DateTime = luxon.DateTime;
const columnNameMap = {
  date_time: "Time and Date (recorded every 4 hours)",
  flag_type: "Flag Type",
  id: "Entry Number",
};

// Refs to chart elements
const chart1Title = document.getElementById("chart1Title");
const chart2Title = document.getElementById("chart2Title");
const chart3Title = document.getElementById("chart3Title");
const chart1Container = document.getElementById("chart1");
const chart2Container = document.getElementById("chart2");
const chart3Container = document.getElementById("chart3");
const flagColorMapping = {
  "yellow flag": "yellow",
  "red flag": "red",
  "double red flag": "#800000",
};
const flagGradientMapping = {
  "yellow flag": "linear-gradient(45deg, #ffff66, #ffd700)",
  "red flag": "linear-gradient(45deg, #ff6666, #ff0000)",
  "double red flag": "linear-gradient(45deg, #ff9999, #cc0000)",
};

// Pagination controls
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageDisplay = document.getElementById("currentPage");

// Event listeners (user interactions)
document.addEventListener("DOMContentLoaded", initialize);

// Trigger data load when the table is changed or refresh button is clicked
refreshBtn.addEventListener("click", () => {
  loadTableData();
  loadFlagDistribution();
  loadAllTimeFlagDistribution();
  updateCurrentFlag()
});

// Pagination buttons
prevPageBtn.addEventListener("click", () => {
  if (offset > 0) {
    offset -= limit;
    currentPage--;
    loadTableData();
  }
});
nextPageBtn.addEventListener("click", () => {
  offset += limit;
  currentPage++;
  loadTableData();
});

// Listen for a click on "Show Flags"
loadFlagsByDayBtn.addEventListener("click", () => {
  const selectedDate = flagDate.value; 
  const datepickerError = document.getElementById("datepickerError");
  
  if (!selectedDate) {
    datepickerError.textContent = "Please select a date.";
    datepickerError.classList.remove("hidden");
    return;
  }
  
  datepickerError.classList.add("hidden");
  loadFlagsByDay(selectedDate);
});

// Initialize the application
async function initialize() {
  try {
    // Load table data, flag distribution charts, all‑time bar chart, and current flag stats.
    await Promise.all([
      loadTableData(),
      loadFlagDistribution(),
      loadAllTimeFlagDistribution(),
      updateCurrentFlag()
    ]);
  } catch (error) {
    showError("Failed to initialize: " + error.message);
  }
}

// Displays the most recent flag (id entry) at the top of the website
async function updateCurrentFlag() {
  try {
    // Request only the most recent record.
    const response = await fetch('/api/table-data?limit=1&offset=0');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const json = await response.json();
    if (json.data && json.data.length > 0) {
      const latestFlagRaw = json.data[0].flag_type || "unknown";
      const latestFlag = latestFlagRaw.trim().toLowerCase();

      // Update the flag display element
      const currentFlagConditionElement = document.getElementById("currentFlagCondition");
      if (currentFlagConditionElement) {
        // Update only the flag value portion
        currentFlagConditionElement.querySelector(".flag-value").textContent = latestFlagRaw;

        // Determine the gradient for the current flag; fallback if not mapped
        const flagGradient = flagGradientMapping[latestFlag] || "linear-gradient(45deg, gray, darkgray)";
        // Set the CSS variable for the gradient
        currentFlagConditionElement.style.setProperty('--flag-gradient', flagGradient);
      }
    }
  } catch (error) {
    console.error("Error fetching the most recent flag:", error);
  }
}

/************
 * FEATURES RELATING TO FLAG DISTRIBUTION DATA FROM THE LAST 3 MONTHS (3 pie charts)
 ************/

// Load flag distribution data from the last 3 months and create 3 pie charts
async function loadFlagDistribution() {
  try {
    // Fetch flag distribution data
    const response = await fetch("/api/flag-distribution");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Flag Distribution Data:", data);

    // Clear existing chart instances
    destroyChartInstances();

    // Create pie charts for each month
    createPieChart(
      "chart1",
      chart1Container,
      data.month1.name,
      data.month1.data
    );
    createPieChart(
      "chart2",
      chart2Container,
      data.month2.name,
      data.month2.data
    );
    createPieChart(
      "chart3",
      chart3Container,
      data.month3.name,
      data.month3.data
    );

    // Update chart titles
    chart1Title.textContent = data.month1.name;
    chart2Title.textContent = data.month2.name;
    chart3Title.textContent = data.month3.name;
  } catch (error) {
    showError("Failed to load flag distribution: " + error.message);
  }
}

// Generate a singular instance of a pie chart using chart.js
function createPieChart(id, container, monthName, data) {
  // If no data, show message
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="no-data">No data available</div>';
    return;
  }

  // Prepare data for Chart.js
  const labels = data.map((item) => item.flag_type);
  const values = data.map((item) => item.count);

  // Directly assign colors based on the flag type mapping
  const colors = labels.map(
    (flag) => flagColorMapping[flag.trim().toLowerCase()] || "gray"
  );

  // Create the canvas element
  const canvas = document.createElement("canvas");
  container.innerHTML = "";
  container.appendChild(canvas);

  // Create the pie chart
  const ctx = canvas.getContext("2d");
  const chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: "rgba(255, 255, 255, 0.5)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: "white",
            font: {
              size: 12,
            },
            padding: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${context.label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
    },
  });

  // Store the chart instance for later cleanup
  chartInstances.push(chart);
}

// Destroy chart instances to prevent memory leaks
function destroyChartInstances() {
  chartInstances.forEach((chart) => chart.destroy());
  chartInstances = [];
}

/************
 * FEATURES RELATING TO ALL-TIME FLAG DISTRIBUTION DATA (bar graph)
 ************/

// Function to load all‑time flag distribution data and render the bar chart
async function loadAllTimeFlagDistribution() {
  try {
    // Fetch all-time flag distro. data
    const response = await fetch("/api/all-time-flag-distribution");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // Parse json from API
    const data = await response.json();
    console.log("All‑Time Flag Distribution Data:", data);

    createBarChart("allTimeBarChart", data.data);
  } catch (error) {
    showError("Failed to load all‑time flag distribution: " + error.message);
  }
}

// Create a singular bar graph using Chart.js
function createBarChart(containerId, data) {
  const container = document.getElementById(containerId);

  // Clear existing content
  container.innerHTML = "";

  // Create and append a canvas element for the bar chart
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // Prepare data for the chart
  const labels = data.map((item) => item.flag_type);
  const counts = data.map((item) => item.count);

  // Use the same flag color mapping as before
  const colors = labels.map(
    (flag) => flagColorMapping[flag.trim().toLowerCase()] || "gray"
  );

  // Create the bar chart
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "All‑Time Flag Distribution",
          data: counts,
          backgroundColor: colors,
          borderColor: "black",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Count",
            color: "white",
          },
          ticks: {
            stepSize: 1,
            color: "white",
          },
          // Light grid lines for contrast
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
          },
        },
        x: {
          title: {
            display: true,
            text: "Flag Type",
            color: "white",
          },
          ticks: {
            color: "white",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
          },
        },
      },
      plugins: {
        // White chart title
        title: {
          display: true,
          text: "All-Time Flag Distribution",
          color: "white",
          font: {
            size: 18,
          },
        },
        legend: {
          display: false,
          labels: {
            color: "white",
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.raw}`;
            },
          },
        },
      },
    },
  });
}

/************
 * FEATURES RELATING TO FETCHING DATA BY DAY (user-select menu)
 ************/

// Fetch and display flags for the selected day
async function loadFlagsByDay(date) {
  try {
    const response = await fetch(`/api/flags-by-day?date=${date}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    displayFlagsByDay(data, date);
  } catch (error) {
    showError("Failed to load flags for the selected day: " + error.message);
  }
}

// Display the flags for the chosen day in CST
function displayFlagsByDay(data, date) {
  // If no data is available for the selected date, show a message
  if (!data || data.length === 0) {
    flagsByDayContainer.innerHTML = `<div class="no-data">No flags recorded for ${date}</div>`;
    return;
  }

  // Create the heading for the selected date
  let html = `<h3>Flags for ${date} (CST)</h3>`;
  html += "<ul class='flags-list'>";

  // Loop through the data and process each flag record in a list
  data.forEach((row) => {
    // Format the time from the API response (convert from 24hr to 12hr format)
    const time24 = row.time;
    const [hours24, minutes] = time24.split(':');
    const hours12 = (hours24 % 12) || 12;
    const ampm = hours24 < 12 ? 'AM' : 'PM';
    const time12 = `${hours12}:${minutes} ${ampm}`;
    
    const flagType = row.flag_type || 'Unknown';

    // Append each flag entry as a list item with flag type in bold and time in italics
    html += `<li class='flag-entry' data-flag-type="${flagType}">
               <strong>${flagType}</strong> 
               <em>(${time12} CST)</em>
             </li>`;
  });

  html += "</ul>";
  flagsByDayContainer.innerHTML = html;
}

/************
 * FEATURES RELATING TO DISPLAYING ALL OF THE DATA FROM THE DATABASE IN THE TABLE
 ************/

// Load flag data from table API
async function loadTableData() {
  // Show loading indicator before data loaded
  showLoading(true);
  tableContainer.classList.add("hidden");

  try {
    // Fetch table data with pagination from the API
    const response = await fetch(`/api/table-data?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Table API Response:", data);

    // Display the fetched table data
    displayTableData(data);

    // Update pagination controls based on the response
    updatePagination(data.pagination);

    hideError();  // Hide error messages if any
  } catch (error) {
    showError("Failed to load data: " + error.message);
  } finally {
    showLoading(false); // Hide loading indicator
  }
}

// Generate the HTML to display the data & process it to be more readable
function displayTableData(data) {
  // Clear existing table headers and rows first
  tableHeaders.innerHTML = "";
  tableBody.innerHTML = "";

  // Check if the received data is empty
  if (!data || !data.data || data.data.length === 0) {
    showError("No data available");
    tableContainer.classList.add("hidden");
    return;
  }

  // Create table headers
  const columns = Object.keys(data.data[0]);
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = columnNameMap[column] || column;
    tableHeaders.appendChild(th);
  });

  // Populate table rows
  data.data.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      if (column === "date_time" && row[column]) {
        const date = DateTime.fromISO(row[column], { zone: "utc" })
          .setZone("America/Chicago");
        td.textContent = date.toFormat("MMMM d, yyyy h:mm a") + " CST";
      } else {
        td.textContent = row[column] !== null ? row[column] : "";
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  tableContainer.classList.remove("hidden");
}

/************
 * HELPER FUNCTIONS
 ************/

// Show loading indicator
function showLoading(isLoading) {
  loadingContainer.style.display = isLoading ? "block" : "none";
}

// Show error message
function showError(message) {
  errorContainer.textContent = message;
  errorContainer.classList.remove("hidden");
}

// Hide error message
function hideError() {
  errorContainer.classList.add("hidden");
}

// Update the pagination controls
function updatePagination(pagination) {
  currentPageDisplay.textContent = `Page ${currentPage}`;

  // Disable Previous button on the first page
  prevPageBtn.disabled = offset <= 0;

  // Disable Next button if there's no more data
  nextPageBtn.disabled = !pagination.next_offset;
}

// Calendar functionality
function createCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Update calendar title with current month and year
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.querySelector('.calendar-title').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Clear existing calendar
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    // Get first day of month and total days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const totalDays = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.dataset.date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.innerHTML = `
            <div class="calendar-day-number">${day}</div>
            <div class="flags-container"></div>
        `;
        calendarGrid.appendChild(dayCell);
    }
}

function updateCalendarWithFlags(flagData) {
    const days = document.querySelectorAll('.calendar-day:not(.empty)');
    const flagsByDate = {};
    
    // Group flags by date
    flagData.forEach(flag => {
        const date = flag.date;
        if (!flagsByDate[date]) {
            flagsByDate[date] = [];
        }
        // Clean up flag type and ensure proper formatting
        const flagType = flag.flag_type.toLowerCase().trim().replace(/\s+/g, '-');
        flagsByDate[date].push({
            type: flagType,
            time: flag.time,
            originalType: flag.flag_type
        });
    });
    
    // Update each day cell
    days.forEach(day => {
        const date = day.dataset.date;
        const flagsContainer = day.querySelector('.flags-container');
        flagsContainer.innerHTML = '';
        
        if (flagsByDate[date]) {
            day.classList.add('has-flags');
            
            // Sort flags by time
            const sortedFlags = flagsByDate[date].sort((a, b) => {
                return a.time.localeCompare(b.time);
            });
            
            // Add flag indicators
            sortedFlags.forEach(flag => {
                const flagIndicator = document.createElement('div');
                flagIndicator.className = `calendar-flag ${flag.type}`;
                flagIndicator.title = `${flag.originalType} at ${flag.time}`;
                flagsContainer.appendChild(flagIndicator);
            });

            // Add flag count if there are many flags
            if (sortedFlags.length > 15) {
                const countBadge = document.createElement('div');
                countBadge.style.position = 'absolute';
                countBadge.style.top = '25px';
                countBadge.style.right = '5px';
                countBadge.style.fontSize = '0.7em';
                countBadge.style.color = 'rgba(255, 255, 255, 0.8)';
                countBadge.textContent = `${sortedFlags.length} flags`;
                day.appendChild(countBadge);
            }

            // Log flag counts for debugging
            console.log(`${date} has ${sortedFlags.length} flags:`, 
                sortedFlags.map(f => f.originalType).join(', '));
        } else {
            day.classList.remove('has-flags');
        }
    });
}

// Function to load current month's flag data
async function loadCurrentMonthFlags() {
    try {
        const response = await fetch('/api/current-month-flags');
        if (!response.ok) {
            throw new Error('Failed to fetch flag data');
        }
        const data = await response.json();
        updateCalendarWithFlags(data);
    } catch (error) {
        console.error('Error loading current month flags:', error);
    }
}

// Initialize calendar when the page loads
document.addEventListener('DOMContentLoaded', () => {
    createCalendar();
    loadCurrentMonthFlags();
    
    // Refresh calendar data every minute
    setInterval(loadCurrentMonthFlags, 60000);
});
