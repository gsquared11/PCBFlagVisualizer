(() => {
  "use strict";

  const { DateTime } = luxon;

  const BEACH_TIME_ZONE = "America/Chicago";
  const DATA_START_DATE = "2025-02-28";
  const API = {
    tableData: "/api/table-data",
    flagDistribution: "/api/flag-distribution",
    allTimeFlagDistribution: "/api/all-time-flag-distribution",
    flagsByDay: "/api/flags-by-day",
    currentMonthFlags: "/api/current-month-flags",
    weatherData: "/api/weather-data",
  };

  const FLAGS = {
    "no flag": {
      label: "No Flag",
      className: "no-flag",
      color: "#6f879e",
      severity: 0,
      description: "No recognized warning flag image was detected by the scraper for this reading.",
    },
    "green flag": {
      label: "Green Flag",
      className: "green-flag",
      color: "#36a06b",
      severity: 1,
      description: "Low surf hazard. Conditions are generally calmer, but normal beach caution still applies.",
    },
    "yellow flag": {
      label: "Yellow Flag",
      className: "yellow-flag",
      color: "#d6a32b",
      severity: 2,
      description: "Medium surf hazard. Moderate surf or currents are possible, so use extra caution.",
    },
    "purple flag": {
      label: "Purple Flag",
      className: "purple-flag",
      color: "#8d6fd1",
      severity: 3,
      description: "Dangerous marine life may be present. Swim with caution and watch posted guidance.",
    },
    "yellow over purple flag": {
      label: "Yellow Over Purple Flag",
      className: "yellow-over-purple-flag",
      color: "#b1897e",
      severity: 4,
      description: "Medium surf hazard plus dangerous marine life. Use caution for both water movement and wildlife.",
    },
    "red flag": {
      label: "Red Flag",
      className: "red-flag",
      color: "#d6504e",
      severity: 5,
      description: "High surf hazard. Strong currents or rough surf make swimming dangerous.",
    },
    "red over purple flag": {
      label: "Red Over Purple Flag",
      className: "red-over-purple-flag",
      color: "#b15f8f",
      severity: 6,
      description: "High surf hazard plus dangerous marine life. Conditions are hazardous in multiple ways.",
    },
    "double red flag": {
      label: "Double Red Flag",
      className: "double-red-flag",
      color: "#a8322f",
      severity: 7,
      description: "Water is closed to public use because conditions are extremely hazardous.",
    },
  };

  const UNKNOWN_FLAG = {
    label: "Unknown",
    className: "unknown-flag",
    color: "#6f879e",
    severity: 0,
    description: "No recognized flag value was returned for this entry.",
  };

  const WEEKDAYS = [
    { index: 0, shortLabel: "Sun", label: "Sunday" },
    { index: 1, shortLabel: "Mon", label: "Monday" },
    { index: 2, shortLabel: "Tue", label: "Tuesday" },
    { index: 3, shortLabel: "Wed", label: "Wednesday" },
    { index: 4, shortLabel: "Thu", label: "Thursday" },
    { index: 5, shortLabel: "Fri", label: "Friday" },
    { index: 6, shortLabel: "Sat", label: "Saturday" },
  ];

  const TIME_BUCKETS = [
    { start: 0, shortLabel: "12a", label: "12 AM-4 AM" },
    { start: 4, shortLabel: "4a", label: "4 AM-8 AM" },
    { start: 8, shortLabel: "8a", label: "8 AM-12 PM" },
    { start: 12, shortLabel: "12p", label: "12 PM-4 PM" },
    { start: 16, shortLabel: "4p", label: "4 PM-8 PM" },
    { start: 20, shortLabel: "8p", label: "8 PM-12 AM" },
  ];

  const state = {
    table: {
      limit: 25,
      offset: 0,
      page: 1,
    },
    calendar: {
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
      selectedDate: null,
      allFlags: [],
      refreshTimer: null,
    },
    tab: "calendar",
  };

  const els = {};
  const charts = new Map();

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    wireEvents();
    applyChartDefaults();
    setDefaultDate();

    try {
      await Promise.allSettled([
        refreshCurrentFlag(),
        refreshTable(),
        refreshCalendarData(),
      ]);
      renderCalendar();
      switchTab("calendar");
      state.calendar.refreshTimer = window.setInterval(refreshCalendarData, 60 * 60 * 1000);
    } catch (error) {
      showError(`Failed to initialize app: ${error.message}`);
    }
  }

  function cacheElements() {
    Object.assign(els, {
      errorContainer: document.getElementById("errorContainer"),
      loadingContainer: document.getElementById("loadingContainer"),
      tableContainer: document.getElementById("tableContainer"),
      tableHeaders: document.getElementById("tableHeaders"),
      tableBody: document.getElementById("tableBody"),
      prevPageBtn: document.getElementById("prevPageBtn"),
      nextPageBtn: document.getElementById("nextPageBtn"),
      currentPage: document.getElementById("currentPage"),
      calendarGrid: document.getElementById("calendar-grid"),
      calendarTitle: document.querySelector(".calendar-title"),
      prevMonthBtn: document.getElementById("prevMonthBtn"),
      nextMonthBtn: document.getElementById("nextMonthBtn"),
      flagDate: document.getElementById("flagDate"),
      loadFlagsByDayBtn: document.getElementById("loadFlagsByDayBtn"),
      datepickerError: document.getElementById("datepickerError"),
      daySummaryContainer: document.getElementById("daySummaryContainer"),
      flagsByDayContainer: document.getElementById("flagsByDayContainer"),
      weatherChartContainer: document.getElementById("weatherChartContainer"),
      weatherSummary: document.getElementById("weatherSummary"),
      weatherChart: document.getElementById("weatherChart"),
      currentFlagCondition: document.getElementById("currentFlagCondition"),
      currentFlagValue: document.querySelector("#currentFlagCondition .flag-value"),
      currentFlagDesc: document.querySelector("#currentFlagCondition .flag-desc"),
      currentFlagStats: document.querySelector("#currentFlagCondition .flag-stats"),
      monthlyTrendChart: document.getElementById("monthlyTrendChart"),
      hazardTrendChart: document.getElementById("hazardTrendChart"),
      patternHeatmap: document.getElementById("patternHeatmap"),
      patternDetail: document.getElementById("patternDetail"),
      allTimeBarChart: document.getElementById("allTimeBarChart"),
      chartInsightGrid: document.getElementById("chartInsightGrid"),
      tabs: Array.from(document.querySelectorAll("[role='tab']")),
      tabPanels: Array.from(document.querySelectorAll(".tab-content")),
    });
  }

  function wireEvents() {
    els.prevPageBtn.addEventListener("click", () => changePage(-1));
    els.nextPageBtn.addEventListener("click", () => changePage(1));
    els.prevMonthBtn.addEventListener("click", () => moveCalendarMonth(-1));
    els.nextMonthBtn.addEventListener("click", () => moveCalendarMonth(1));
    els.loadFlagsByDayBtn.addEventListener("click", () => loadSelectedDate());
    els.flagDate.addEventListener("input", () => {
      if (!els.flagDate.value) clearSelectedDatePanels();
    });

    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });
  }

  function applyChartDefaults() {
    Chart.defaults.color = "#9fb2c6";
    Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
    Chart.defaults.font.family = "'Manrope', system-ui, -apple-system, sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = "#07151f";
    Chart.defaults.plugins.tooltip.borderColor = "rgba(255, 255, 255, 0.14)";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
  }

  function setDefaultDate() {
    const today = DateTime.now().setZone(BEACH_TIME_ZONE).toISODate();
    els.flagDate.max = today;
  }

  async function apiGet(url, params = {}) {
    const endpoint = new URL(url, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        endpoint.searchParams.set(key, value);
      }
    });

    const response = await fetch(endpoint.pathname + endpoint.search);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
  }

  function switchTab(tabName) {
    state.tab = tabName;

    els.tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    els.tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
    });

    if (tabName === "charts") refreshCharts();
    if (tabName === "calendar") renderCalendar();
  }

  async function refreshCurrentFlag() {
    try {
      const payload = await apiGet(API.tableData, { limit: 1, offset: 0 });
      const latest = payload.data?.[0];
      if (!latest) return;

      const flag = getFlagMeta(latest.flag_type);
      const timestamp = formatDateTime(latest.date_time);

      removeFlagClasses(els.currentFlagCondition);
      els.currentFlagCondition.classList.add(flag.className);
      els.currentFlagValue.textContent = flag.label;
      els.currentFlagDesc.textContent = flag.description;
      els.currentFlagStats.innerHTML = "";
      els.currentFlagStats.append(
        statNode("Updated", timestamp || "Unknown"),
        statNode("Hazard", severityLabel(flag.severity))
      );
    } catch (error) {
      els.currentFlagValue.textContent = "Unavailable";
      els.currentFlagDesc.textContent = "Flag API data could not be loaded.";
      els.currentFlagStats.innerHTML = "";
    }
  }

  async function refreshTable() {
    setLoading(true);
    els.tableContainer.classList.remove("hidden");

    try {
      const payload = await apiGet(API.tableData, {
        limit: state.table.limit,
        offset: state.table.offset,
      });
      renderTable(payload);
      renderPagination(payload.pagination);
      hideError();
    } catch (error) {
      showError(`Failed to load raw data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function renderTable(payload) {
    els.tableHeaders.replaceChildren();
    els.tableBody.replaceChildren();

    const rows = payload.data || [];
    if (!rows.length) {
      els.tableContainer.classList.add("hidden");
      showError("No raw flag data is available.");
      return;
    }

    const columns = Object.keys(rows[0]).filter((column) => column !== "id");
    const labelMap = {
      date_time: "Recorded Time",
      flag_type: "Flag",
    };

    columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = labelMap[column] || titleCase(column.replaceAll("_", " "));
      els.tableHeaders.append(th);
    });

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      columns.forEach((column) => {
        const td = document.createElement("td");
        td.textContent = column === "date_time" ? formatDateTime(row[column]) : row[column] ?? "";
        tr.append(td);
      });
      els.tableBody.append(tr);
    });

    els.tableContainer.classList.remove("hidden");
  }

  function renderPagination(pagination = {}) {
    els.currentPage.textContent = `Page ${state.table.page}`;
    els.prevPageBtn.disabled = state.table.offset <= 0;
    els.nextPageBtn.disabled = pagination.next_offset == null;
  }

  function changePage(direction) {
    const nextOffset = state.table.offset + direction * state.table.limit;
    if (nextOffset < 0) return;

    state.table.offset = nextOffset;
    state.table.page += direction;
    refreshTable();
  }

  async function refreshCalendarData() {
    try {
      state.calendar.allFlags = await apiGet(API.currentMonthFlags);
      renderCalendar();
    } catch (error) {
      showError(`Failed to load calendar flags: ${error.message}`);
    }
  }

  function moveCalendarMonth(delta) {
    const next = DateTime.local(state.calendar.year, state.calendar.month + 1, 1).plus({ months: delta });
    state.calendar.month = next.month - 1;
    state.calendar.year = next.year;
    renderCalendar();
  }

  function renderCalendar() {
    const monthStart = DateTime.local(state.calendar.year, state.calendar.month + 1, 1);
    const daysInMonth = monthStart.daysInMonth;
    const startingDay = monthStart.weekday % 7;
    const flagsByDate = groupFlagsByDate(state.calendar.allFlags);

    els.calendarTitle.textContent = monthStart.toFormat("LLLL yyyy");
    els.calendarGrid.replaceChildren();

    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      const header = document.createElement("div");
      header.className = "calendar-day-header";
      header.textContent = day;
      els.calendarGrid.append(header);
    });

    for (let index = 0; index < startingDay; index += 1) {
      const empty = document.createElement("div");
      empty.className = "calendar-day empty";
      els.calendarGrid.append(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = monthStart.set({ day }).toISODate();
      const flags = flagsByDate.get(date) || [];
      els.calendarGrid.append(calendarDayNode(date, day, flags));
    }
  }

  function calendarDayNode(date, day, flags) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.dataset.date = date;
    button.setAttribute("aria-label", `${formatDate(date)} ${flags.length ? summarizeFlags(flags) : "no flags recorded"}`);
    button.classList.toggle("selected", state.calendar.selectedDate === date);

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = day;
    button.append(number);

    if (flags.length) {
      const dominantFlag = mostSevereFlag(flags);
      button.classList.add("has-flags", dominantFlag.className);
      button.append(calendarMetaNode(flags));
    }

    button.addEventListener("click", () => {
      state.calendar.selectedDate = date;
      els.flagDate.value = date;
      renderCalendar();
      loadDay(date);
      document.querySelector(".date-picker-container").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return button;
  }

  function calendarMetaNode(flags) {
    const meta = document.createElement("span");
    meta.className = "calendar-day-meta";
    const uniqueFlags = new Set(flags.map((flag) => getFlagMeta(flag.flag_type).label));
    meta.textContent = uniqueFlags.size > 1 ? `${uniqueFlags.size} types` : getFlagMeta(flags[0].flag_type).label.replace(" Flag", "");
    return meta;
  }

  async function loadSelectedDate() {
    const date = els.flagDate.value;
    if (!date) {
      showDateError("Please select a date.");
      return;
    }

    state.calendar.selectedDate = date;
    hideDateError();
    renderCalendar();
    await loadDay(date);
  }

  async function loadDay(date) {
    clearSelectedDatePanels(false);

    try {
      const flags = await apiGet(API.flagsByDay, { date });
      renderDayFlags(flags, date);
      await loadWeather(date, flags);
    } catch (error) {
      showError(`Failed to load selected date: ${error.message}`);
      els.weatherChartContainer.classList.add("hidden");
    }
  }

  function renderDayFlags(flags, date) {
    els.daySummaryContainer.replaceChildren();
    els.flagsByDayContainer.replaceChildren();

    if (!flags.length) {
      els.daySummaryContainer.append(summaryCard("Flags", "No records", formatDate(date)));
      els.flagsByDayContainer.append(emptyNode(`No flags recorded for ${formatDate(date)}.`));
      return;
    }

    const mostCommon = mostCommonFlag(flags);
    const highestHazard = mostSevereFlag(flags);
    const changes = countFlagChanges(flags);

    els.daySummaryContainer.append(
      summaryCard("Most common", mostCommon.label, `${mostCommon.count} of ${flags.length} readings`),
      summaryCard("Highest hazard", highestHazard.label, severityLabel(highestHazard.severity)),
      summaryCard("Flag changes", String(changes), changes === 1 ? "change recorded" : "changes recorded")
    );

    const list = document.createElement("ol");
    list.className = "flags-list";

    flags.forEach((entry) => {
      const flag = getFlagMeta(entry.flag_type);
      const li = document.createElement("li");
      li.className = "flag-entry";
      li.dataset.flagType = flag.label;
      li.style.setProperty("--fc", flag.color);

      const type = document.createElement("strong");
      type.textContent = flag.label;

      const time = document.createElement("em");
      time.textContent = formatTime(entry.date_time || `${date}T${entry.time}:00`, entry.timezone);

      li.append(type, time);
      list.append(li);
    });

    els.flagsByDayContainer.append(list);
  }

  async function loadWeather(date, flags) {
    if (DateTime.fromISO(date) > DateTime.now().setZone(BEACH_TIME_ZONE).startOf("day")) {
      els.weatherChartContainer.classList.add("hidden");
      return;
    }

    try {
      const weather = await apiGet(API.weatherData, { date });
      renderWeather(weather, flags);
      els.weatherChartContainer.classList.remove("hidden");
    } catch (error) {
      destroyChart("weather");
      els.weatherSummary.replaceChildren(emptyNode("Weather and marine data are unavailable for this date."));
      els.weatherChart.replaceChildren();
      els.weatherChartContainer.classList.remove("hidden");
    }
  }

  function renderWeather(weather, flags) {
    const hourly = weather.hourly_data || [];
    const marine = weather.marine_data || [];

    els.weatherSummary.replaceChildren();
    els.weatherSummary.append(...weatherSummaryCards(weather.summary, hourly, marine));

    if (!hourly.length && !marine.length) {
      destroyChart("weather");
      els.weatherChart.replaceChildren(emptyNode("No hourly weather data was returned."));
      return;
    }

    renderWeatherChart(hourly, marine, flags);
  }

  function weatherSummaryCards(summary = {}, hourly = [], marine = []) {
    const tempValues = hourly.map((row) => row.temperature).filter(isNumber);
    const windValues = hourly.map((row) => row.wind_speed).filter(isNumber);
    const gustValues = hourly.map((row) => row.wind_gust).filter(isNumber);
    const rainTotal = sum(hourly.map((row) => row.precipitation).filter(isNumber));
    const waveValues = marine.map((row) => row.wave_height_ft).filter(isNumber);
    const currentValues = marine.map((row) => row.ocean_current_mph).filter(isNumber);

    return [
      summaryCard("Air", formatRange(summary.temp_min, summary.temp_max, "°F") || formatRange(min(tempValues), max(tempValues), "°F"), "daily temperature range"),
      summaryCard("Wind", `${formatNumber(summary.wind_max ?? max(windValues), 0)} mph`, `gusts to ${formatNumber(summary.wind_gust_max ?? max(gustValues), 0)} mph`),
      summaryCard("Rain", `${formatNumber(summary.precipitation_sum ?? rainTotal, 2)} in`, "daily total"),
      summaryCard("Surf", waveValues.length ? `${formatNumber(max(waveValues), 1)} ft` : "N/A", currentValues.length ? `current ${formatNumber(max(currentValues), 1)} mph` : "marine forecast unavailable"),
    ];
  }

  function renderWeatherChart(hourly, marine, flags) {
    const labels = hourly.map((row) => formatHourLabel(row.time));
    const marineByHour = new Map(marine.map((row) => [formatHourKey(row.time), row]));
    const flagByHour = new Map(flags.map((row) => [formatHourKey(row.date_time || row.time), getFlagMeta(row.flag_type).severity]));

    const waveData = hourly.map((row) => marineByHour.get(formatHourKey(row.time))?.wave_height_ft ?? null);
    const currentData = hourly.map((row) => marineByHour.get(formatHourKey(row.time))?.ocean_current_mph ?? null);
    const flagSeverity = hourly.map((row) => flagByHour.get(formatHourKey(row.time)) ?? null);

    renderChart("weather", els.weatherChart, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            type: "line",
            label: "Wind (mph)",
            data: hourly.map((row) => row.wind_speed),
            borderColor: "#3fa1c0",
            backgroundColor: "rgba(63, 161, 192, 0.12)",
            pointRadius: 0,
            tension: 0.25,
            yAxisID: "wind",
          },
          {
            type: "line",
            label: "Gusts (mph)",
            data: hourly.map((row) => row.wind_gust),
            borderColor: "#f0b84f",
            backgroundColor: "rgba(240, 184, 79, 0.12)",
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.25,
            yAxisID: "wind",
          },
          {
            type: "bar",
            label: "Rain (in)",
            data: hourly.map((row) => row.precipitation),
            backgroundColor: "rgba(92, 141, 220, 0.35)",
            borderColor: "rgba(92, 141, 220, 0.7)",
            borderWidth: 1,
            yAxisID: "rain",
          },
          {
            type: "line",
            label: "Wave height (ft)",
            data: waveData,
            borderColor: "#d6504e",
            backgroundColor: "rgba(214, 80, 78, 0.12)",
            pointRadius: 0,
            tension: 0.25,
            yAxisID: "surf",
            spanGaps: true,
          },
          {
            type: "line",
            label: "Ocean current (mph)",
            data: currentData,
            borderColor: "#8d6fd1",
            backgroundColor: "rgba(141, 111, 209, 0.12)",
            pointRadius: 0,
            tension: 0.25,
            yAxisID: "surf",
            spanGaps: true,
          },
          {
            type: "scatter",
            label: "Flag reading",
            data: flagSeverity.map((severity, index) => (severity == null ? null : { x: labels[index], y: severity })),
            borderColor: "#e7eef6",
            backgroundColor: "#e7eef6",
            pointRadius: 5,
            yAxisID: "flag",
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          },
          wind: {
            position: "left",
            beginAtZero: true,
            title: { display: true, text: "Wind" },
            ticks: { callback: (value) => `${value} mph` },
          },
          surf: {
            position: "right",
            beginAtZero: true,
            title: { display: true, text: "Surf" },
            ticks: { callback: (value) => `${value}` },
            grid: { drawOnChartArea: false },
          },
          rain: {
            position: "right",
            beginAtZero: true,
            suggestedMax: 0.25,
            display: false,
          },
          flag: {
            position: "right",
            min: 0,
            max: 7,
            display: false,
          },
        },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            callbacks: {
              label: weatherTooltipLabel,
            },
          },
        },
      },
    });
  }

  async function refreshCharts() {
    try {
      const [recent, allTime, history] = await Promise.all([
        apiGet(API.flagDistribution),
        apiGet(API.allTimeFlagDistribution),
        apiGet(API.currentMonthFlags),
      ]);

      state.calendar.allFlags = history || state.calendar.allFlags;
      renderHazardTrendChart(state.calendar.allFlags);
      renderPatternHeatmap(state.calendar.allFlags);
      renderMonthlyTrendChart(recent);
      renderAllTimeChart(allTime.data || []);
      renderChartInsights(recent, allTime.data || [], state.calendar.allFlags);
      hideError();
    } catch (error) {
      showError(`Failed to load charts: ${error.message}`);
    }
  }

  function renderHazardTrendChart(history) {
    const months = monthlyHazardBuckets(history);

    if (!months.length) {
      destroyChart("hazardTrend");
      els.hazardTrendChart.replaceChildren(emptyNode("No historical flag records are available."));
      return;
    }

    renderChart("hazardTrend", els.hazardTrendChart, {
      type: "line",
      data: {
        labels: months.map((month) => month.label),
        datasets: [
          {
            label: "Average hazard index",
            data: months.map((month) => month.averageSeverity),
            borderColor: "#48b7cf",
            backgroundColor: "rgba(72, 183, 207, 0.16)",
            pointRadius: 3,
            tension: 0.25,
            yAxisID: "severity",
          },
          {
            label: "High hazard share",
            data: months.map((month) => month.highHazardShare),
            borderColor: "#d6504e",
            backgroundColor: "rgba(214, 80, 78, 0.12)",
            pointRadius: 3,
            tension: 0.25,
            yAxisID: "share",
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          },
          severity: {
            position: "left",
            min: 0,
            max: 7,
            title: { display: true, text: "Hazard index" },
          },
          share: {
            position: "right",
            min: 0,
            max: 100,
            title: { display: true, text: "High hazard" },
            ticks: { callback: (value) => `${value}%` },
            grid: { drawOnChartArea: false },
          },
        },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (context.dataset.yAxisID === "share") return `High hazard: ${formatNumber(context.raw, 0)}%`;
                return `Hazard index: ${formatNumber(context.raw, 2)} / 7`;
              },
              footer: (items) => {
                const month = months[items[0].dataIndex];
                return `${month.count} readings`;
              },
            },
          },
        },
      },
    });
  }

  function renderPatternHeatmap(history) {
    const cells = weekdayTimeBuckets(history);
    const populatedCells = cells.filter((cell) => cell.count > 0);

    els.patternHeatmap.replaceChildren();
    els.patternDetail.replaceChildren();

    if (!populatedCells.length) {
      els.patternHeatmap.append(emptyNode("No historical flag records are available."));
      return;
    }

    const selectedCell = populatedCells.reduce((best, cell) => {
      if (!best) return cell;
      return cell.averageSeverity > best.averageSeverity ? cell : best;
    }, null);

    const corner = document.createElement("div");
    corner.className = "heatmap-corner";
    els.patternHeatmap.append(corner);

    TIME_BUCKETS.forEach((bucket) => {
      const label = document.createElement("div");
      label.className = "heatmap-axis heatmap-time";
      label.textContent = bucket.shortLabel;
      els.patternHeatmap.append(label);
    });

    WEEKDAYS.forEach((weekday) => {
      const day = document.createElement("div");
      day.className = "heatmap-axis heatmap-day";
      day.textContent = weekday.shortLabel;
      els.patternHeatmap.append(day);

      TIME_BUCKETS.forEach((bucket) => {
        const cell = cells.find((item) => item.weekday === weekday.index && item.bucket === bucket.start);
        els.patternHeatmap.append(heatmapCellNode(cell, selectedCell));
      });
    });

    if (selectedCell) renderPatternDetail(selectedCell);
  }

  function heatmapCellNode(cell, selectedCell) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "heatmap-cell";

    if (!cell || cell.count === 0) {
      button.classList.add("empty");
      button.disabled = true;
      button.textContent = "—";
      return button;
    }

    button.classList.add(`level-${Math.min(7, Math.ceil(cell.averageSeverity))}`);
    button.classList.toggle(
      "selected",
      selectedCell && selectedCell.weekday === cell.weekday && selectedCell.bucket === cell.bucket
    );
    button.textContent = formatNumber(cell.averageSeverity, 1);
    button.setAttribute(
      "aria-label",
      `${cell.weekdayLabel} ${cell.bucketLabel}: average hazard ${formatNumber(cell.averageSeverity, 1)} from ${cell.count} readings`
    );
    button.addEventListener("click", () => {
      els.patternHeatmap.querySelectorAll(".heatmap-cell").forEach((node) => node.classList.remove("selected"));
      button.classList.add("selected");
      renderPatternDetail(cell);
    });

    return button;
  }

  function renderPatternDetail(cell) {
    const topFlag = mostCommonFlag(cell.entries);
    els.patternDetail.replaceChildren(
      summaryCard("Selected window", `${cell.weekdayLabel}, ${cell.bucketLabel}`, `${cell.count} readings`),
      summaryCard("Average hazard", `${formatNumber(cell.averageSeverity, 1)} / 7`, severityLabel(cell.averageSeverity)),
      summaryCard("Most common", topFlag?.label || "No data", topFlag ? `${topFlag.count} readings` : "")
    );
  }

  function monthlyHazardBuckets(history = []) {
    const buckets = new Map();

    normalizedFlagEntries(history).forEach((entry) => {
      const key = entry.date.toFormat("yyyy-MM");
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          label: entry.date.toFormat("LLL yyyy"),
          count: 0,
          severityTotal: 0,
          highHazardCount: 0,
        });
      }

      const bucket = buckets.get(key);
      bucket.count += 1;
      bucket.severityTotal += entry.flag.severity;
      if (entry.flag.severity >= FLAGS["red flag"].severity) bucket.highHazardCount += 1;
    });

    return [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((bucket) => ({
        ...bucket,
        averageSeverity: bucket.count ? bucket.severityTotal / bucket.count : 0,
        highHazardShare: bucket.count ? (bucket.highHazardCount / bucket.count) * 100 : 0,
      }));
  }

  function weekdayTimeBuckets(history = []) {
    const buckets = new Map();

    WEEKDAYS.forEach((weekday) => {
      TIME_BUCKETS.forEach((bucket) => {
        const key = `${weekday.index}-${bucket.start}`;
        buckets.set(key, {
          key,
          weekday: weekday.index,
          bucket: bucket.start,
          weekdayLabel: weekday.label,
          bucketLabel: bucket.label,
          count: 0,
          severityTotal: 0,
          entries: [],
        });
      });
    });

    normalizedFlagEntries(history).forEach((entry) => {
      const weekday = entry.date.weekday % 7;
      const bucketStart = Math.floor(entry.date.hour / 4) * 4;
      const bucket = buckets.get(`${weekday}-${bucketStart}`);
      if (!bucket) return;

      bucket.count += 1;
      bucket.severityTotal += entry.flag.severity;
      bucket.entries.push({ flag_type: entry.flag.label });
    });

    return [...buckets.values()].map((bucket) => ({
      ...bucket,
      averageSeverity: bucket.count ? bucket.severityTotal / bucket.count : 0,
    }));
  }

  function normalizedFlagEntries(history = []) {
    return history
      .map((entry) => {
        const date = parseHistoryDateTime(entry);
        if (!isOnOrAfterDataStart(date)) return null;
        return {
          date,
          flag: getFlagMeta(entry.flag_type),
          raw: entry,
        };
      })
      .filter(Boolean);
  }

  function parseHistoryDateTime(entry) {
    if (entry.date_time) return parseLocalOrZonedDateTime(entry.date_time);
    if (entry.date && entry.time) return DateTime.fromISO(`${entry.date}T${entry.time}:00`, { zone: BEACH_TIME_ZONE });
    if (entry.date) return DateTime.fromISO(entry.date, { zone: BEACH_TIME_ZONE });
    return DateTime.invalid("Missing flag date");
  }

  function isOnOrAfterDataStart(date) {
    return date.isValid && date >= DateTime.fromISO(DATA_START_DATE, { zone: BEACH_TIME_ZONE }).startOf("day");
  }

  function renderMonthlyTrendChart(payload) {
    const months = [payload.month3, payload.month2, payload.month1].filter(Boolean);
    const flags = orderedFlagsFrom(months.flatMap((month) => month.data || []));

    renderChart("monthlyTrend", els.monthlyTrendChart, {
      type: "bar",
      data: {
        labels: months.map((month) => month.name),
        datasets: flags.map((flag) => ({
          label: flag.label,
          data: months.map((month) => countForFlag(month.data, flag.label)),
          backgroundColor: flag.color,
          borderWidth: 0,
          stack: "flags",
        })),
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: "Readings" },
          },
          y: {
            stacked: true,
            grid: { display: false },
          },
        },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            callbacks: {
              footer: (items) => {
                const month = months[items[0].dataIndex];
                const total = totalCount(month.data);
                return `Total readings: ${total}`;
              },
              label: (context) => {
                const month = months[context.dataIndex];
                const total = totalCount(month.data);
                const pct = total ? Math.round((context.raw / total) * 100) : 0;
                return `${context.dataset.label}: ${context.raw} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function renderAllTimeChart(data) {
    const total = totalCount(data);
    const sorted = [...data].sort((a, b) => getFlagMeta(a.flag_type).severity - getFlagMeta(b.flag_type).severity);

    renderChart("allTime", els.allTimeBarChart, {
      type: "bar",
      data: {
        labels: sorted.map((item) => getFlagMeta(item.flag_type).label),
        datasets: [
          {
            label: "Readings",
            data: sorted.map((item) => item.count),
            backgroundColor: sorted.map((item) => getFlagMeta(item.flag_type).color),
            borderWidth: 0,
          },
        ],
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: "Readings" },
          },
          y: {
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const pct = total ? Math.round((context.raw / total) * 100) : 0;
                return `${context.raw} readings (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function renderChartInsights(recent, allTime, history = []) {
    if (!els.chartInsightGrid) return;

    const months = [recent.month3, recent.month2, recent.month1].filter(Boolean);
    const latest = months[months.length - 1];
    const latestMostCommon = latest?.data?.length ? mostCommonFlag(latest.data.map((item) => ({
      flag_type: item.flag_type,
      count: item.count,
    }))) : null;
    const hazardCount = allTime
      .filter((item) => getFlagMeta(item.flag_type).severity >= FLAGS["red flag"].severity)
      .reduce((total, item) => total + item.count, 0);
    const total = totalCount(allTime);
    const peakWindow = weekdayTimeBuckets(history)
      .filter((cell) => cell.count >= 3)
      .sort((a, b) => b.averageSeverity - a.averageSeverity || b.count - a.count)[0];

    els.chartInsightGrid.replaceChildren(
      summaryCard("Latest month", latestMostCommon?.label || "No data", latest ? latest.name : "No month returned"),
      summaryCard("Hazard share", total ? `${Math.round((hazardCount / total) * 100)}%` : "N/A", "red, double red, or red over purple"),
      summaryCard("Peak window", peakWindow ? `${peakWindow.weekdayLabel}, ${peakWindow.bucketLabel}` : "N/A", peakWindow ? `${formatNumber(peakWindow.averageSeverity, 1)} average hazard` : "not enough readings"),
      summaryCard("Total readings", formatInteger(total), `flag entries since ${formatDate(DATA_START_DATE)}`)
    );
  }

  function renderChart(key, container, config) {
    destroyChart(key);
    container.replaceChildren();

    const canvas = document.createElement("canvas");
    container.append(canvas);
    const chart = new Chart(canvas.getContext("2d"), config);
    charts.set(key, chart);
  }

  function destroyChart(key) {
    const chart = charts.get(key);
    if (chart) {
      chart.destroy();
      charts.delete(key);
    }
  }

  function clearSelectedDatePanels(hideWeather = true) {
    els.daySummaryContainer.replaceChildren();
    els.flagsByDayContainer.replaceChildren();
    els.weatherSummary.replaceChildren();
    els.weatherChart.replaceChildren();
    destroyChart("weather");
    if (hideWeather) els.weatherChartContainer.classList.add("hidden");
  }

  function setLoading(isLoading) {
    els.loadingContainer.style.display = isLoading ? "flex" : "none";
  }

  function showError(message) {
    els.errorContainer.textContent = message;
    els.errorContainer.classList.remove("hidden");
  }

  function hideError() {
    els.errorContainer.classList.add("hidden");
    els.errorContainer.textContent = "";
  }

  function showDateError(message) {
    els.datepickerError.textContent = message;
    els.datepickerError.classList.remove("hidden");
  }

  function hideDateError() {
    els.datepickerError.textContent = "";
    els.datepickerError.classList.add("hidden");
  }

  function getFlagMeta(value) {
    return FLAGS[normalizeFlag(value)] || {
      ...UNKNOWN_FLAG,
      label: value ? titleCase(String(value).trim()) : UNKNOWN_FLAG.label,
    };
  }

  function normalizeFlag(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function removeFlagClasses(node) {
    Object.values(FLAGS).forEach((flag) => node.classList.remove(flag.className));
    node.classList.remove(UNKNOWN_FLAG.className);
  }

  function groupFlagsByDate(flags) {
    const groups = new Map();
    flags.forEach((flag) => {
      if (!groups.has(flag.date)) groups.set(flag.date, []);
      groups.get(flag.date).push(flag);
    });
    return groups;
  }

  function mostSevereFlag(flags) {
    return flags
      .map((flag) => getFlagMeta(flag.flag_type))
      .sort((a, b) => b.severity - a.severity)[0] || UNKNOWN_FLAG;
  }

  function mostCommonFlag(flags) {
    const counts = new Map();

    flags.forEach((flag) => {
      const meta = getFlagMeta(flag.flag_type);
      const existing = counts.get(meta.label) || { ...meta, count: 0 };
      existing.count += flag.count || 1;
      counts.set(meta.label, existing);
    });

    return [...counts.values()].sort((a, b) => b.count - a.count || b.severity - a.severity)[0];
  }

  function countFlagChanges(flags) {
    return flags.reduce((changes, flag, index) => {
      if (index === 0) return 0;
      return normalizeFlag(flag.flag_type) === normalizeFlag(flags[index - 1].flag_type) ? changes : changes + 1;
    }, 0);
  }

  function summarizeFlags(flags) {
    const highest = mostSevereFlag(flags);
    return `${flags.length} readings, highest hazard ${highest.label}`;
  }

  function orderedFlagsFrom(items) {
    const flags = new Map();
    items.forEach((item) => {
      const flag = getFlagMeta(item.flag_type);
      flags.set(flag.label, flag);
    });
    return [...flags.values()].sort((a, b) => a.severity - b.severity);
  }

  function countForFlag(items = [], flagLabel) {
    return items
      .filter((item) => getFlagMeta(item.flag_type).label === flagLabel)
      .reduce((total, item) => total + item.count, 0);
  }

  function totalCount(items = []) {
    return items.reduce((total, item) => total + (item.count || 0), 0);
  }

  function statNode(label, value) {
    const item = document.createElement("span");
    item.className = "flag-stat";

    const key = document.createElement("span");
    key.className = "flag-stat-k";
    key.textContent = label;

    const val = document.createElement("span");
    val.className = "flag-stat-v";
    val.textContent = value;

    item.append(key, val);
    return item;
  }

  function summaryCard(label, value, detail) {
    const card = document.createElement("article");
    card.className = "summary-card";

    const k = document.createElement("span");
    k.className = "summary-k";
    k.textContent = label;

    const v = document.createElement("strong");
    v.className = "summary-v";
    v.textContent = value || "N/A";

    const d = document.createElement("span");
    d.className = "summary-d";
    d.textContent = detail || "";

    card.append(k, v, d);
    return card;
  }

  function emptyNode(message) {
    const node = document.createElement("div");
    node.className = "no-data";
    node.textContent = message;
    return node;
  }

  function weatherTooltipLabel(context) {
    const value = context.parsed.y;
    if (value == null) return null;

    if (context.dataset.label === "Rain (in)") return `Rain: ${formatNumber(value, 2)} in`;
    if (context.dataset.label === "Flag reading") return `Flag severity: ${value}/7`;
    if (context.dataset.label.includes("Wave")) return `Wave height: ${formatNumber(value, 1)} ft`;
    if (context.dataset.label.includes("current")) return `Ocean current: ${formatNumber(value, 1)} mph`;
    return `${context.dataset.label}: ${formatNumber(value, 0)}`;
  }

  function severityLabel(severity) {
    if (severity >= 7) return "Extreme";
    if (severity >= 5) return "High";
    if (severity >= 3) return "Moderate";
    if (severity >= 1) return "Low";
    return "Unknown";
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = parseUtcDateTime(value);
    return date.isValid ? `${date.toFormat("MMM d, yyyy h:mm a")} ${timeZoneAbbr(date)}` : "";
  }

  function formatDate(value) {
    const date = DateTime.fromISO(value, { zone: BEACH_TIME_ZONE });
    return date.isValid ? date.toFormat("MMM d, yyyy") : value;
  }

  function formatTime(value, explicitZone = "") {
    const date = parseLocalOrZonedDateTime(value);
    if (date.isValid) return `${date.toFormat("h:mm a")} ${explicitZone || timeZoneAbbr(date)}`;
    const fallback = DateTime.fromFormat(value, "HH:mm", { zone: BEACH_TIME_ZONE });
    return fallback.isValid ? `${fallback.toFormat("h:mm a")} ${explicitZone || timeZoneAbbr(fallback)}` : value;
  }

  function formatHourLabel(value) {
    const date = parseLocalOrZonedDateTime(value);
    return date.isValid ? date.toFormat("ha") : value;
  }

  function formatHourKey(value) {
    const parsed = parseLocalOrZonedDateTime(value);
    if (parsed.isValid) return parsed.setZone(BEACH_TIME_ZONE).toFormat("yyyy-MM-dd-HH");

    const fallback = DateTime.fromFormat(value, "HH:mm", { zone: BEACH_TIME_ZONE });
    return fallback.isValid ? fallback.toFormat("yyyy-MM-dd-HH") : value;
  }

  function parseUtcDateTime(value) {
    return DateTime.fromISO(value, { zone: "utc" }).setZone(BEACH_TIME_ZONE);
  }

  function parseLocalOrZonedDateTime(value) {
    const text = String(value || "");
    const hasExplicitZone = /(?:z|Z|[+-]\d{2}:?\d{2})$/.test(text);
    const date = DateTime.fromISO(text, hasExplicitZone ? { setZone: true } : { zone: BEACH_TIME_ZONE });
    return date.isValid ? date.setZone(BEACH_TIME_ZONE) : date;
  }

  function timeZoneAbbr(date) {
    return date.offsetNameShort || "CT";
  }

  function formatRange(minValue, maxValue, suffix) {
    if (!isNumber(minValue) || !isNumber(maxValue)) return "";
    return `${formatNumber(minValue, 0)}-${formatNumber(maxValue, 0)}${suffix}`;
  }

  function formatNumber(value, digits = 1) {
    return isNumber(value) ? Number(value).toFixed(digits) : "N/A";
  }

  function formatInteger(value) {
    return new Intl.NumberFormat("en-US").format(value || 0);
  }

  function titleCase(value) {
    return String(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function min(values) {
    return values.length ? Math.min(...values) : null;
  }

  function max(values) {
    return values.length ? Math.max(...values) : null;
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }
})();
