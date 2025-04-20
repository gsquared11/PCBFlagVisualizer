// Global Variables and DOM Elements
let currentPage = 1;      // Current page number for pagination
let limit = 25;           // Number of rows per page
let offset = 0;           // Offset for pagination
let chartInstances = [];  // Store chart instances for cleanup
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();
let allFlagData = []; // Store all flag data
let currentTab = 'calendar'; // Track current active tab

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

// Refs to tab elements
const calendarTabBtn = document.getElementById("calendarTabBtn");
const chartsTabBtn = document.getElementById("chartsTabBtn");
const aboutTabBtn = document.getElementById("aboutTabBtn");
const calendarSection = document.getElementById("calendarSection");
const chartsSection = document.getElementById("chartsSection");
const aboutSection = document.getElementById("aboutSection");

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
  "red over purple flag": "#9b525a",
  "yellow over purple flag": "#9da04b"
};
const flagGradientMapping = {
  "yellow flag": "linear-gradient(45deg, #ffd700,rgb(202, 202, 23))",
  "red flag": "linear-gradient(45deg, #ff0000, #ff6666)",
  "double red flag": "linear-gradient(45deg, #8B0000, #4B0000)",
  "red over purple flag": "linear-gradient(45deg, #ff0000, #800080)",
  "yellow over purple flag": "linear-gradient(45deg, #ffd700, #800080)"
};

// Pagination controls
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageDisplay = document.getElementById("currentPage");

// Event listeners (user interactions)
document.addEventListener("DOMContentLoaded", initialize);

// Tab navigation event listeners
calendarTabBtn.addEventListener("click", () => switchTab('calendar'));
chartsTabBtn.addEventListener("click", () => switchTab('charts'));
aboutTabBtn.addEventListener("click", () => switchTab('about'));

// Function to switch between tabs
function switchTab(tabName) {
  // Update currentTab
  currentTab = tabName;
  
  // Remove active class from all tabs and content
  calendarTabBtn.classList.remove('active');
  chartsTabBtn.classList.remove('active');
  aboutTabBtn.classList.remove('active');
  calendarTabBtn.setAttribute('aria-selected', 'false');
  chartsTabBtn.setAttribute('aria-selected', 'false');
  aboutTabBtn.setAttribute('aria-selected', 'false');
  
  calendarSection.classList.remove('active');
  chartsSection.classList.remove('active');
  aboutSection.classList.remove('active');
  
  // Add active class to selected tab and content
  if (tabName === 'calendar') {
    calendarTabBtn.classList.add('active');
    calendarTabBtn.setAttribute('aria-selected', 'true');
    calendarSection.classList.add('active');
    // Refresh calendar view
    if (chart1Container) createCalendar();
    if (allFlagData.length > 0) loadCurrentMonthFlags();
  } else if (tabName === 'charts') {
    chartsTabBtn.classList.add('active');
    chartsTabBtn.setAttribute('aria-selected', 'true');
    chartsSection.classList.add('active');
    // Refresh charts if needed
    if (chartInstances.length === 0) {
      loadFlagDistribution();
      loadAllTimeFlagDistribution();
    }
  }  else if (tabName === 'about') {
    aboutTabBtn.classList.add('active');
    aboutTabBtn.setAttribute('aria-selected', 'true');
    aboutSection.classList.add('active');
  }
}

// Trigger data load when the table is changed or refresh button is clicked
refreshBtn.addEventListener("click", () => {
  // Always refresh table data and current flag
  loadTableData();
  updateCurrentFlag();
  
  // Refresh data based on current tab
  if (currentTab === 'calendar') {
    createCalendar();
    loadCurrentMonthFlags();
  } else if (currentTab === 'charts') {
    loadFlagDistribution();
    loadAllTimeFlagDistribution();
  }
});

// Pagination buttons
prevPageBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (offset > 0) {
    offset -= limit;
    currentPage--;
    loadTableData();
  }
});
nextPageBtn.addEventListener("click", (e) => {
  e.preventDefault();
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

// Add these event listeners after other event listeners
document.getElementById('prevMonthBtn').addEventListener('click', () => {
    if (currentCalendarMonth === 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    } else {
        currentCalendarMonth--;
    }
    createCalendar();
    loadCurrentMonthFlags();
});

document.getElementById('nextMonthBtn').addEventListener('click', () => {
    if (currentCalendarMonth === 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    } else {
        currentCalendarMonth++;
    }
    createCalendar();
    loadCurrentMonthFlags();
});

// Initialize the application
async function initialize() {
  try {
    // Load all flag data first
    const response = await fetch('/api/current-month-flags');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    allFlagData = await response.json();
    
    // Then load everything else
    await Promise.all([
      loadTableData(),
      loadFlagDistribution(),
      loadAllTimeFlagDistribution(),
      updateCurrentFlag(),
      createCalendar(),
      loadCurrentMonthFlags()
    ]);

    // Initialize the tabs - make sure calendar tab is active by default
    switchTab('calendar');
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

        // Remove any existing flag type classes
        currentFlagConditionElement.classList.remove(
          'yellow-flag',
          'red-flag',
          'double-red-flag',
          'purple-flag',
          'green-flag',
          'red-over-purple-flag',
          'yellow-over-purple-flag'
        );

        // Add the appropriate flag type class
        const flagClass = latestFlag.replace(/\s+/g, '-');
        currentFlagConditionElement.classList.add(flagClass);
      }
    }
  } catch (error) {
    // Remove console.error
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
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Count",
            color: "white",
          },
          ticks: {
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
          display: false,
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
    
    // Load weather data
    loadWeatherData(date);
  } catch (error) {
    showError("Failed to load flags for the selected day: " + error.message);
    // Hide the weather container if there's an error
    document.getElementById('weatherChartContainer').classList.add('hidden');
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
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Update calendar title with current month and year
    document.querySelector('.calendar-title').textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
    
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
    const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
    const lastDay = new Date(currentCalendarYear, currentCalendarMonth + 1, 0);
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
        dayCell.dataset.date = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.innerHTML = `
            <div class="calendar-day-number">${day}</div>
            <div class="flags-container"></div>
        `;
        
        // Add click event listener to each day cell
        dayCell.addEventListener('click', () => {
            const selectedDate = dayCell.dataset.date;
            // Remove selected class from any previously selected day
            document.querySelectorAll('.calendar-day').forEach(day => {
                day.classList.remove('selected');
            });
            // Add selected class to clicked day
            dayCell.classList.add('selected');
            // Update the date picker input
            document.getElementById('flagDate').value = selectedDate;
            // Load flags for the selected date
            loadFlagsByDay(selectedDate);
            // Scroll to the date picker section
            document.querySelector('.date-picker-container').scrollIntoView({ behavior: 'smooth' });
        });
        
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
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        
        // Filter data for the current calendar month using string comparison
        const currentMonthData = data.filter(flag => {
            // The date from the API is already in YYYY-MM-DD format
            const [year, month] = flag.date.split('-').map(Number);
            return month === currentCalendarMonth + 1 && // API month is 1-based, JS month is 0-based
                   year === currentCalendarYear;
        });
        
        updateCalendarWithFlags(currentMonthData);
    } catch (error) {
        showError('Failed to load current month flags: ' + error.message);
    }
}

// Initialize calendar when the page loads
document.addEventListener('DOMContentLoaded', () => {
    createCalendar();
    loadCurrentMonthFlags();
    
    // Refresh calendar data every hour
    setInterval(loadCurrentMonthFlags, 3600000);
});

// Function to load weather data and create chart
async function loadWeatherData(date) {
  // Check if the date is in the future
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to compare just dates
  
  if (selectedDate > today) {
    // Hide the weather container for future dates
    document.getElementById('weatherChartContainer').classList.add('hidden');
    return;
  }

  try {
    const response = await fetch(`/api/weather-data?date=${date}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    createWeatherChart(data);
    // Show the weather container after data is loaded
    document.getElementById('weatherChartContainer').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading weather data:', error);
    const weatherChart = document.getElementById('weatherChart');
    weatherChart.innerHTML = '<div class="no-data">Weather data unavailable for this date</div>';
    // Show the weather container even if there's an error
    document.getElementById('weatherChartContainer').classList.remove('hidden');
  }
}

// Function to create the weather chart
function createWeatherChart(data) {
  const weatherChart = document.getElementById('weatherChart');
  weatherChart.innerHTML = ''; // Clear previous chart
  
  // Create canvas element
  const canvas = document.createElement('canvas');
  weatherChart.appendChild(canvas);
  
  // Prepare data for chart
  const times = data.hourly_data.map(item => {
    const time = new Date(item.time);
    // Convert to CST and format as 12-hour time
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      hour12: true,
      timeZone: 'America/Chicago'
    });
  });
  
  const temperatures = data.hourly_data.map(item => item.temperature);
  const pressures = data.hourly_data.map(item => item.pressure);
  const windSpeeds = data.hourly_data.map(item => item.wind_speed);
  const precipitation = data.hourly_data.map(item => item.precipitation);
  
  // Create the chart
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: times,
      datasets: [
        {
          label: 'Surface Temperature (°F)',
          data: temperatures,
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          yAxisID: 'y',
          tension: 0.4
        },
        {
          label: 'Pressure (hPa)',
          data: pressures,
          borderColor: '#4ecdc4',
          backgroundColor: 'rgba(78, 205, 196, 0.1)',
          yAxisID: 'y1',
          tension: 0.4
        },
        {
          label: 'Wind Speed (mph)',
          data: windSpeeds,
          borderColor: '#ffd166',
          backgroundColor: 'rgba(255, 209, 102, 0.1)',
          yAxisID: 'y2',
          tension: 0.4
        },
        {
          label: 'Precipitation (in)',
          data: precipitation,
          borderColor: '#06d6a0',
          backgroundColor: 'rgba(6, 214, 160, 0.1)',
          yAxisID: 'y3',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Temperature (°F)',
            color: '#ffffff'
          },
          ticks: {
            color: '#ffffff'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Pressure (hPa)',
            color: '#ffffff'
          },
          ticks: {
            color: '#ffffff'
          },
          grid: {
            drawOnChartArea: false
          }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Wind Speed (mph)',
            color: '#ffffff'
          },
          ticks: {
            color: '#ffffff'
          },
          grid: {
            drawOnChartArea: false
          }
        },
        y3: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Precipitation (in)',
            color: '#ffffff'
          },
          ticks: {
            color: '#ffffff'
          },
          grid: {
            drawOnChartArea: false
          }
        },
        x: {
          ticks: {
            color: '#ffffff',
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#ffffff'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(2);
              }
              return label;
            }
          }
        }
      }
    }
  });
}

// Add event listener to hide weather container when date is cleared
document.getElementById('flagDate').addEventListener('input', function(e) {
  if (!e.target.value) {
    document.getElementById('weatherChartContainer').classList.add('hidden');
  }
});

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button
      button.classList.add('active');

      // Show corresponding content
      const targetId = button.getAttribute('aria-controls');
      const targetContent = document.getElementById(targetId);
      targetContent.classList.add('active');
    });
  });

  // Initialize first tab as active
  if (tabButtons.length > 0) {
    tabButtons[0].classList.add('active');
    const firstTabId = tabButtons[0].getAttribute('aria-controls');
    document.getElementById(firstTabId).classList.add('active');
  }
});

// Weather data handling
async function fetchWeatherData(date) {
  try {
    const response = await fetch(`/api/weather-data?date=${date}`);
    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
}

function formatTime(timeString) {
  return new Date(timeString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago'
  });
}

function updateWeatherChart(data) {
  const ctx = document.getElementById('weatherChart').getContext('2d');
  
  // Filter data for the selected day (12:01 AM to 11:59 PM CST)
  const filteredData = data.filter(entry => {
    const time = new Date(entry.time);
    return time.getHours() >= 0 && time.getHours() <= 23;
  });

  const chartData = {
    labels: filteredData.map(entry => formatTime(entry.time)),
    datasets: [
      {
        label: 'Temperature (°F)',
        data: filteredData.map(entry => entry.temperature),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y',
        tension: 0.4
      },
      {
        label: 'Wind Speed (mph)',
        data: filteredData.map(entry => entry.wind_speed),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        yAxisID: 'y1',
        tension: 0.4
      },
      {
        label: 'Precipitation (in)',
        data: filteredData.map(entry => entry.precipitation),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'y2',
        tension: 0.4
      }
    ]
  };

  const config = {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: 'Weather Conditions'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time (CST)'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Temperature (°F)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Wind Speed (mph)'
          },
          grid: {
            drawOnChartArea: false
          }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Precipitation (in)'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  };

  // Destroy existing chart if it exists
  if (window.weatherChart) {
    window.weatherChart.destroy();
  }

  // Create new chart
  window.weatherChart = new Chart(ctx, config);
}
