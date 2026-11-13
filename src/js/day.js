import { API, BEACH_TIME_ZONE } from "./config.js";
import { apiGet } from "./api.js";
import { compactLegend, destroyChart, isCompact, lineSeries, renderChart, tickFont } from "./charts.js";
import { DateTime, formatDate, formatHourKey, formatHourLabel, formatTime } from "./dates.js";
import { emptyNode, h, showError, summaryCard } from "./dom.js";
import { countFlagChanges, getFlagMeta, mostCommonFlag, mostSevereFlag, severityLabel } from "./flags.js";
import { formatNumber, formatRange, isNumber, max, min, sum } from "./format.js";

export const dateInput = document.getElementById("flagDate");
const dateError = document.getElementById("datepickerError");
const daySummary = document.getElementById("daySummaryContainer");
const dayFlags = document.getElementById("flagsByDayContainer");
const weatherPanel = document.getElementById("weatherChartContainer");
const weatherSummary = document.getElementById("weatherSummary");
const weatherChart = document.getElementById("weatherChart");

export function initDayLookup({ onLookup }) {
  const today = DateTime.now().setZone(BEACH_TIME_ZONE).toISODate();
  dateInput.max = today;
  if (!dateInput.value) dateInput.value = today;

  dateInput.addEventListener("input", () => {
    if (!dateInput.value) clearDay();
  });

  document.getElementById("loadFlagsByDayBtn").addEventListener("click", () => {
    const missing = !dateInput.value;
    dateError.textContent = missing ? "Please select a date." : "";
    dateError.classList.toggle("hidden", !missing);
    if (!missing) onLookup(dateInput.value);
  });
}

export async function loadDay(date) {
  clearDay(false);

  try {
    const flags = await apiGet(API.flagsByDay, { date });
    renderFlags(flags, date);
    await loadWeather(date, flags);
  } catch (error) {
    showError(`Failed to load selected date: ${error.message}`);
    weatherPanel.classList.add("hidden");
  }
}

function clearDay(hideWeather = true) {
  [daySummary, dayFlags, weatherSummary, weatherChart].forEach((node) => node.replaceChildren());
  destroyChart("weather");
  if (hideWeather) weatherPanel.classList.add("hidden");
}

function renderFlags(flags, date) {
  if (!flags.length) {
    daySummary.replaceChildren(summaryCard("Flags", "No records", formatDate(date)));
    dayFlags.replaceChildren(emptyNode(`No flags recorded for ${formatDate(date)}.`));
    return;
  }

  const mostCommon = mostCommonFlag(flags);
  const highest = mostSevereFlag(flags);
  const changes = countFlagChanges(flags);

  daySummary.replaceChildren(
    summaryCard("Most common", mostCommon.label, `${mostCommon.count} of ${flags.length} readings`),
    summaryCard("Highest hazard", highest.label, severityLabel(highest.severity)),
    summaryCard("Flag changes", String(changes), changes === 1 ? "change recorded" : "changes recorded")
  );

  dayFlags.replaceChildren(h("ol.flags-list", flags.map((entry) => {
    const flag = getFlagMeta(entry.flag_type);
    return h(
      "li.flag-entry",
      { dataset: { flagType: flag.label }, style: { "--fc": flag.color } },
      h("strong", flag.label),
      h("em", formatTime(entry.date_time || `${date}T${entry.time}:00`, entry.timezone))
    );
  })));
}

async function loadWeather(date, flags) {
  if (DateTime.fromISO(date, { zone: BEACH_TIME_ZONE }) > DateTime.now().setZone(BEACH_TIME_ZONE).startOf("day")) {
    weatherPanel.classList.add("hidden");
    return;
  }

  try {
    renderWeather(await apiGet(API.weatherData, { date }), flags);
  } catch (error) {
    destroyChart("weather");
    weatherSummary.replaceChildren(emptyNode("Weather and marine data are unavailable for this date."));
    weatherChart.replaceChildren();
  }
  weatherPanel.classList.remove("hidden");
}

function renderWeather(weather, flags) {
  const hourly = weather.hourly_data || [];
  const marine = weather.marine_data || [];

  weatherSummary.replaceChildren(...summaryCards(weather.summary, hourly, marine));

  if (!hourly.length && !marine.length) {
    destroyChart("weather");
    weatherChart.replaceChildren(emptyNode("No hourly weather data was returned."));
    return;
  }

  renderWeatherChart(hourly, marine, flags);
}

function summaryCards(summary = {}, hourly = [], marine = []) {
  const values = (rows, key) => rows.map((row) => row[key]).filter(isNumber);
  const temps = values(hourly, "temperature");
  const waves = values(marine, "wave_height_ft");
  const currents = values(marine, "ocean_current_mph");

  return [
    summaryCard("Air", formatRange(summary.temp_min, summary.temp_max, "°F") || formatRange(min(temps), max(temps), "°F"), "daily temperature range"),
    summaryCard("Wind", `${formatNumber(summary.wind_max ?? max(values(hourly, "wind_speed")), 0)} mph`, `gusts to ${formatNumber(summary.wind_gust_max ?? max(values(hourly, "wind_gust")), 0)} mph`),
    summaryCard("Rain", `${formatNumber(summary.precipitation_sum ?? sum(values(hourly, "precipitation")), 2)} in`, "daily total"),
    summaryCard("Surf", waves.length ? `${formatNumber(max(waves), 1)} ft` : "N/A", currents.length ? `current ${formatNumber(max(currents), 1)} mph` : "marine forecast unavailable"),
  ];
}

function renderWeatherChart(hourly, marine, flags) {
  const compact = isCompact();
  const font = tickFont();
  const labels = hourly.map((row) => formatHourLabel(row.time));
  const marineByHour = new Map(marine.map((row) => [formatHourKey(row.time), row]));
  const flagByHour = new Map(flags.map((row) => [formatHourKey(row.date_time || row.time), getFlagMeta(row.flag_type).severity]));
  const marineValues = (key) => hourly.map((row) => marineByHour.get(formatHourKey(row.time))?.[key] ?? null);

  renderChart("weather", weatherChart, {
    type: "line",
    data: {
      labels,
      datasets: [
        lineSeries("Wind (mph)", hourly.map((row) => row.wind_speed), "#3fa1c0", "rgba(63, 161, 192, 0.12)", "wind", { type: "line" }),
        lineSeries("Gusts (mph)", hourly.map((row) => row.wind_gust), "#f0b84f", "rgba(240, 184, 79, 0.12)", "wind", { type: "line", borderDash: [5, 5] }),
        {
          type: "bar",
          label: "Rain (in)",
          data: hourly.map((row) => row.precipitation),
          backgroundColor: "rgba(92, 141, 220, 0.35)",
          borderColor: "rgba(92, 141, 220, 0.7)",
          borderWidth: 1,
          yAxisID: "rain",
        },
        lineSeries("Wave height (ft)", marineValues("wave_height_ft"), "#d6504e", "rgba(214, 80, 78, 0.12)", "surf", { type: "line", spanGaps: true }),
        lineSeries("Ocean current (mph)", marineValues("ocean_current_mph"), "#8d6fd1", "rgba(141, 111, 209, 0.12)", "surf", { type: "line", spanGaps: true }),
        {
          type: "scatter",
          label: "Flag reading",
          data: hourly.map((row, index) => {
            const severity = flagByHour.get(formatHourKey(row.time));
            return severity == null ? null : { x: labels[index], y: severity };
          }),
          borderColor: "#e7eef6",
          backgroundColor: "#e7eef6",
          pointRadius: compact ? 4 : 5,
          yAxisID: "flag",
        },
      ],
    },
    options: {
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: !compact,
            maxTicksLimit: compact ? 4 : 8,
            autoSkipPadding: compact ? 20 : 8,
            font,
            callback: function tickLabel(value, index) {
              return !compact || index % 6 === 0 ? this.getLabelForValue(value) : "";
            },
          },
        },
        wind: {
          position: "left",
          beginAtZero: true,
          title: { display: !compact, text: "Wind" },
          ticks: { callback: (value) => (compact ? value : `${value} mph`), font, maxTicksLimit: compact ? 6 : 8 },
        },
        surf: {
          position: "right",
          beginAtZero: true,
          title: { display: !compact, text: "Surf" },
          ticks: { callback: (value) => `${value}`, font, maxTicksLimit: compact ? 6 : 8 },
          grid: { drawOnChartArea: false },
        },
        rain: { position: "right", beginAtZero: true, suggestedMax: 0.25, display: false },
        flag: { position: "right", min: 0, max: 7, display: false },
      },
      plugins: {
        legend: compactLegend(),
        tooltip: { callbacks: { label: tooltipLabel } },
      },
    },
  });
}

function tooltipLabel(context) {
  const value = context.parsed.y;
  if (value == null) return null;

  const { label } = context.dataset;
  if (label === "Rain (in)") return `Rain: ${formatNumber(value, 2)} in`;
  if (label === "Flag reading") return `Flag severity: ${value}/7`;
  if (label.includes("Wave")) return `Wave height: ${formatNumber(value, 1)} ft`;
  if (label.includes("current")) return `Ocean current: ${formatNumber(value, 1)} mph`;
  return `${label}: ${formatNumber(value, 0)}`;
}
