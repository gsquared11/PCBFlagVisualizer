// Global Variables and DOM Elements
let currentPage = 1; // Current page number for pagination
let limit = 25; // Number of rows per page
let offset = 0; // Offset for pagination
let chartInstances = []; // Store chart instances for cleanup

// Get refs to DOM elements
const refreshBtn = document.getElementById("refreshBtn");
const errorContainer = document.getElementById("errorContainer");
const loadingContainer = document.getElementById("loadingContainer");
const tableContainer = document.getElementById("tableContainer");
const tableHeaders = document.getElementById("tableHeaders");
const tableBody = document.getElementById("tableBody");
const DateTime = luxon.DateTime;
const columnNameMap = {
  date_time: "Time and Date",
  flag_type: "Flag Type",
  id: "Entry Number",
};

// Chart elements
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

// Pagination controls
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageDisplay = document.getElementById("currentPage");

// Event listeners
document.addEventListener("DOMContentLoaded", initialize);

// Trigger data load when the table is changed or refresh button is clicked
refreshBtn.addEventListener("click", () => {
  loadTableData();
  loadFlagDistribution();
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

// Initialize the application
async function initialize() {
  try {
    // Load table data, flag distribution charts, and all‑time bar chart
    await Promise.all([
      loadTableData(),
      loadFlagDistribution(),
      loadAllTimeFlagDistribution(),
    ]);
  } catch (error) {
    showError("Failed to initialize: " + error.message);
  }
}

// Load flag distribution data and create pie charts
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
  } catch (error) {
    showError("Failed to load flag distribution: " + error.message);
  }
}

function createPieChart(id, container, monthName, data) {
  // Set the month name as the title
  document.getElementById(`${id}Title`).textContent = monthName;

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

// Function to load all‑time flag distribution data and render the bar chart
async function loadAllTimeFlagDistribution() {
  try {
    const response = await fetch("/api/all-time-flag-distribution");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    console.log("All‑Time Flag Distribution Data:", data);
    // Assume the endpoint returns an object with a "data" property that's an array:
    // [ { flag_type: "Yellow Flag", count: 123 }, { flag_type: "Red Flag", count: 45 }, ... ]
    createBarChart("allTimeBarChart", data.data);
  } catch (error) {
    showError("Failed to load all‑time flag distribution: " + error.message);
  }
}

// Function to create a bar chart using Chart.js
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
    const colors = labels.map(flag => flagColorMapping[flag.trim().toLowerCase()] || 'gray');
  
    // Create the bar chart
    new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'All‑Time Flag Distribution',
            data: counts,
            backgroundColor: colors,
            borderColor: 'black', // increased contrast for lines
            borderWidth: 1
          }]
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

// Load data from flag_data
async function loadTableData() {
  const selectedTable = "flag_data"; // Set default table name

  showLoading(true);
  tableContainer.classList.add("hidden"); // Hide table while loading

  try {
    // Fetch table data with pagination
    const response = await fetch(
      `/api/table-data/${encodeURIComponent(
        selectedTable
      )}?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("API Response:", data);

    // Display the fetched table data
    displayTableData(data);

    // Update pagination controls
    updatePagination(data.pagination);

    hideError(); // Hide error message if any
  } catch (error) {
    showError("Failed to load data: " + error.message);
  } finally {
    showLoading(false); // Hide loading indicator
  }
}

// Display table data
function displayTableData(data) {
  if (!data || !data.data || data.data.length === 0) {
    showError("No data available");
    tableContainer.classList.add("hidden");
    return;
  }

  // Clear existing headers and rows
  tableHeaders.innerHTML = "";
  tableBody.innerHTML = "";

  // Create headers
  const columns = Object.keys(data.data[0]);
  columns.forEach((column) => {
    const th = document.createElement("th");
    // If there's a mapped name, use it; otherwise, use the raw column name
    th.textContent = columnNameMap[column] || column;
    tableHeaders.appendChild(th);
  });

  // Create rows
  data.data.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");

      // Check if the column is 'date_time' and convert from UTC to CST
      if (column === "date_time" && row[column]) {
        // Use Luxon to parse the UTC time and convert to CST
        const date = DateTime.fromISO(row[column], { zone: "utc" }).setZone(
          "America/Chicago"
        );

        // Format the date in CST with a clear timezone indication
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
