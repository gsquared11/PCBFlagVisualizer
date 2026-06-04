import { API, BEACH_TIME_ZONE, DATA_START_DATE, TIME_BUCKETS, WEEKDAYS } from "./js/config.js";
import { apiGet } from "./js/api.js";
import { groupFlagsByDate, monthlyHazardBuckets, weekdayTimeBuckets } from "./js/analytics.js";
import { applyChartDefaults, destroyChart, renderChart, weatherTooltipLabel } from "./js/charts.js";
import {
  DateTime,
  formatDate,
  formatDateTime,
  formatHourKey,
  formatHourLabel,
  formatTime,
} from "./js/dates.js";
import { emptyNode, statNode, summaryCard } from "./js/dom.js";
import {
  FLAGS,
  countFlagChanges,
  countForFlag,
  getFlagMeta,
  mostCommonFlag,
  mostSevereFlag,
  orderedFlagsFrom,
  removeFlagClasses,
  severityLabel,
  summarizeFlags,
  totalCount,
} from "./js/flags.js";
import { formatInteger, formatNumber, formatRange, isNumber, max, min, sum, titleCase } from "./js/format.js";

const state = {
  table: {
    limit: 25,
    offset: 0,
    page: 1,
    hasLoaded: false,
  },
  calendar: {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    selectedDate: null,
    allFlags: [],
    refreshTimer: null,
  },
  nav: {
    stickyAt: 0,
    ticking: false,
  },
  tab: "calendar",
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  wireEvents();
  applyChartDefaults();
  setDefaultDate();

  try {
    await Promise.allSettled([
      refreshCurrentFlag(),
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
    rawDataDetails: document.getElementById("rawDataDetails"),
    paginationContainer: document.getElementById("paginationContainer"),
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
    siteMenu: document.querySelector(".site-menu"),
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
  els.rawDataDetails.addEventListener("toggle", handleRawDataToggle);
  els.prevMonthBtn.addEventListener("click", () => moveCalendarMonth(-1));
  els.nextMonthBtn.addEventListener("click", () => moveCalendarMonth(1));
  els.loadFlagsByDayBtn.addEventListener("click", () => loadSelectedDate());
  els.flagDate.addEventListener("input", () => {
    if (!els.flagDate.value) clearSelectedDatePanels();
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  measureStickyNav();
  window.addEventListener("resize", measureStickyNav);
  window.addEventListener("scroll", handleStickyNavScroll, { passive: true });
}

function handleRawDataToggle() {
  if (els.rawDataDetails.open && !state.table.hasLoaded) refreshTable();
  if (!els.rawDataDetails.open) els.paginationContainer.classList.add("hidden");
  if (els.rawDataDetails.open && state.table.hasLoaded) els.paginationContainer.classList.remove("hidden");
}

function setDefaultDate() {
  const today = DateTime.now().setZone(BEACH_TIME_ZONE).toISODate();
  els.flagDate.max = today;
  if (!els.flagDate.value) els.flagDate.value = today;
}

function measureStickyNav() {
  state.nav.stickyAt = els.siteMenu ? els.siteMenu.offsetTop : 0;
  updateStickyNav();
}

function handleStickyNavScroll() {
  if (state.nav.ticking) return;

  state.nav.ticking = true;
  window.requestAnimationFrame(() => {
    updateStickyNav();
    state.nav.ticking = false;
  });
}

function updateStickyNav() {
  if (!els.siteMenu) return;
  els.siteMenu.classList.toggle("is-stuck", window.scrollY > state.nav.stickyAt - 8);
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
    state.table.hasLoaded = true;
    els.paginationContainer.classList.toggle("hidden", !els.rawDataDetails.open);
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
  const next = DateTime
    .fromObject({ year: state.calendar.year, month: state.calendar.month + 1, day: 1 }, { zone: BEACH_TIME_ZONE })
    .plus({ months: delta });
  state.calendar.month = next.month - 1;
  state.calendar.year = next.year;
  renderCalendar();
}

function renderCalendar() {
  const monthStart = DateTime.fromObject(
    { year: state.calendar.year, month: state.calendar.month + 1, day: 1 },
    { zone: BEACH_TIME_ZONE }
  );
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
  if (DateTime.fromISO(date, { zone: BEACH_TIME_ZONE }) > DateTime.now().setZone(BEACH_TIME_ZONE).startOf("day")) {
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
  const isCompact = window.matchMedia("(max-width: 640px)").matches;
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
          pointRadius: isCompact ? 4 : 5,
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
          ticks: {
            maxRotation: 0,
            autoSkip: !isCompact,
            maxTicksLimit: isCompact ? 4 : 8,
            autoSkipPadding: isCompact ? 20 : 8,
            font: { size: isCompact ? 10 : 12 },
            callback: function tickLabel(value, index) {
              const label = this.getLabelForValue(value);
              return !isCompact || index % 6 === 0 ? label : "";
            },
          },
        },
        wind: {
          position: "left",
          beginAtZero: true,
          title: { display: !isCompact, text: "Wind" },
          ticks: {
            callback: (value) => (isCompact ? value : `${value} mph`),
            font: { size: isCompact ? 10 : 12 },
            maxTicksLimit: isCompact ? 6 : 8,
          },
        },
        surf: {
          position: "right",
          beginAtZero: true,
          title: { display: !isCompact, text: "Surf" },
          ticks: {
            callback: (value) => `${value}`,
            font: { size: isCompact ? 10 : 12 },
            maxTicksLimit: isCompact ? 6 : 8,
          },
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
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: isCompact ? 7 : 8,
            padding: isCompact ? 8 : 10,
            font: { size: isCompact ? 11 : 12 },
          },
        },
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
  const isCompact = window.matchMedia("(max-width: 640px)").matches;
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
          pointRadius: isCompact ? 2 : 3,
          tension: 0.25,
          yAxisID: "severity",
        },
        {
          label: "High hazard share",
          data: months.map((month) => month.highHazardShare),
          borderColor: "#d6504e",
          backgroundColor: "rgba(214, 80, 78, 0.12)",
          pointRadius: isCompact ? 2 : 3,
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
          ticks: {
            maxRotation: 0,
            autoSkip: !isCompact,
            maxTicksLimit: isCompact ? 4 : 8,
            font: { size: isCompact ? 10 : 12 },
            callback: function tickLabel(value, index) {
              const label = this.getLabelForValue(value);
              return !isCompact || index % 3 === 0 ? label.replace(" ", "\n") : "";
            },
          },
        },
        severity: {
          position: "left",
          min: 0,
          max: 7,
          title: { display: !isCompact, text: "Hazard index" },
          ticks: {
            font: { size: isCompact ? 10 : 12 },
            maxTicksLimit: isCompact ? 5 : 8,
          },
        },
        share: {
          position: "right",
          min: 0,
          max: 100,
          title: { display: !isCompact, text: "High hazard" },
          ticks: {
            callback: (value) => `${value}%`,
            font: { size: isCompact ? 10 : 12 },
            maxTicksLimit: isCompact ? 5 : 8,
          },
          grid: { drawOnChartArea: false },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: isCompact ? 7 : 8,
            padding: isCompact ? 8 : 10,
            font: { size: isCompact ? 11 : 12 },
          },
        },
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
    button.textContent = "-";
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
