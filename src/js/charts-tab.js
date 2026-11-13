import { monthOfYearMix, monthlyHazardBuckets, weekdayTimeBuckets } from "./analytics.js";
import { apiGet, loadHistory } from "./api.js";
import { compactLegend, destroyChart, isCompact, lineSeries, renderChart, tickFont } from "./charts.js";
import { API, DATA_START_DATE } from "./config.js";
import { formatDate } from "./dates.js";
import { emptyNode, hideError, showError, summaryCard } from "./dom.js";
import { FLAGS, countForFlag, getFlagMeta, mostCommonFlag, orderedFlagsFrom, totalCount } from "./flags.js";
import { renderFollowUps } from "./follow-ups.js";
import { formatInteger, formatNumber } from "./format.js";
import { renderPatternHeatmap } from "./heatmap.js";
import { renderRibbon } from "./ribbon.js";

const insightGrid = document.getElementById("chartInsightGrid");
const hazardTrendChart = document.getElementById("hazardTrendChart");
const typicalYearChart = document.getElementById("typicalYearChart");
const monthlyTrendChart = document.getElementById("monthlyTrendChart");
const allTimeChart = document.getElementById("allTimeBarChart");

const NO_HISTORY = "No historical flag records are available.";
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const recentMonths = (payload) => [payload.month3, payload.month2, payload.month1].filter(Boolean);

export async function refreshCharts() {
  try {
    const [recent, allTime, history] = await Promise.all([
      apiGet(API.flagDistribution),
      apiGet(API.allTimeFlagDistribution),
      loadHistory(),
    ]);
    const totals = allTime.data || [];

    renderRibbon(history);
    renderHazardTrend(history);
    renderTypicalYear(history);
    renderFollowUps(history);
    renderPatternHeatmap(history);
    renderRecentMonths(recent);
    renderAllTime(totals);
    renderInsights(recent, totals, history);
    hideError();
  } catch (error) {
    showError(`Failed to load charts: ${error.message}`);
  }
}

function renderHazardTrend(history) {
  const compact = isCompact();
  const font = tickFont();
  const months = monthlyHazardBuckets(history);

  if (!months.length) {
    destroyChart("hazardTrend");
    hazardTrendChart.replaceChildren(emptyNode(NO_HISTORY));
    return;
  }

  const points = { pointRadius: compact ? 2 : 3 };

  renderChart("hazardTrend", hazardTrendChart, {
    type: "line",
    data: {
      labels: months.map((month) => month.label),
      datasets: [
        lineSeries("Average hazard index", months.map((month) => month.averageSeverity), "#48b7cf", "rgba(72, 183, 207, 0.16)", "severity", points),
        lineSeries("High hazard share", months.map((month) => month.highHazardShare), "#d6504e", "rgba(214, 80, 78, 0.12)", "share", points),
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
            font,
            // Month and year on separate lines so the labels fit a half-width chart.
            callback: function tickLabel(value, index) {
              return !compact || index % 3 === 0 ? this.getLabelForValue(value).split(" ") : "";
            },
          },
        },
        severity: {
          position: "left",
          min: 0,
          max: 7,
          title: { display: !compact, text: "Hazard index" },
          ticks: { font, maxTicksLimit: compact ? 5 : 8 },
        },
        share: {
          position: "right",
          min: 0,
          max: 100,
          title: { display: !compact, text: "High hazard" },
          ticks: { callback: (value) => `${value}%`, font, maxTicksLimit: compact ? 5 : 8 },
          grid: { drawOnChartArea: false },
        },
      },
      plugins: {
        legend: compactLegend(),
        tooltip: {
          callbacks: {
            label: (context) => (context.dataset.yAxisID === "share"
              ? `High hazard: ${formatNumber(context.raw, 0)}%`
              : `Hazard index: ${formatNumber(context.raw, 2)} / 7`),
            footer: (items) => `${months[items[0].dataIndex].count} readings`,
          },
        },
      },
    },
  });
}

function renderTypicalYear(history) {
  const font = tickFont();
  const months = monthOfYearMix(history);

  if (!months.some((month) => month.total)) {
    destroyChart("typicalYear");
    typicalYearChart.replaceChildren(emptyNode(NO_HISTORY));
    return;
  }

  const flags = orderedFlagsFrom(months.flatMap((month) => [...month.counts.keys()].map((label) => ({ flag_type: label }))));

  renderChart("typicalYear", typicalYearChart, {
    type: "bar",
    data: {
      labels: months.map((month) => month.label),
      datasets: flags.map((flag) => ({
        label: flag.label,
        data: months.map((month) => (month.total ? ((month.counts.get(flag.label) || 0) / month.total) * 100 : 0)),
        backgroundColor: flag.color,
        borderWidth: 0,
        stack: "flags",
      })),
    },
    options: {
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font } },
        y: {
          stacked: true,
          min: 0,
          max: 100,
          title: { display: !isCompact(), text: "Share of readings" },
          ticks: { callback: (value) => `${value}%`, font },
        },
      },
      plugins: {
        tooltip: {
          filter: (item) => item.raw > 0,
          callbacks: {
            label: (context) => {
              const count = months[context.dataIndex].counts.get(context.dataset.label) || 0;
              return `${context.dataset.label}: ${formatNumber(context.raw, 0)}% (${formatInteger(count)} readings)`;
            },
            footer: (items) => {
              const { total, years } = months[items[0].dataIndex];
              return `${formatInteger(total)} readings across ${years.size} ${years.size === 1 ? "year" : "years"}`;
            },
          },
        },
      },
    },
  });
}

function renderRecentMonths(payload) {
  const months = recentMonths(payload);
  const flags = orderedFlagsFrom(months.flatMap((month) => month.data || []));

  renderChart("monthlyTrend", monthlyTrendChart, {
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
      scales: {
        x: { stacked: true, beginAtZero: true, title: { display: true, text: "Readings" } },
        y: { stacked: true, grid: { display: false } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const total = totalCount(months[context.dataIndex].data);
              return `${context.dataset.label}: ${context.raw} (${percent(context.raw, total)}%)`;
            },
            footer: (items) => `Total readings: ${totalCount(months[items[0].dataIndex].data)}`,
          },
        },
      },
    },
  });
}

function renderAllTime(data) {
  const total = totalCount(data);
  const flags = data
    .map((item) => ({ ...getFlagMeta(item.flag_type), count: item.count }))
    .sort((a, b) => a.severity - b.severity);

  renderChart("allTime", allTimeChart, {
    type: "bar",
    data: {
      labels: flags.map((flag) => flag.label),
      datasets: [{
        label: "Readings",
        data: flags.map((flag) => flag.count),
        backgroundColor: flags.map((flag) => flag.color),
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: "y",
      scales: {
        x: { beginAtZero: true, title: { display: true, text: "Readings" } },
        y: { grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.raw} readings (${percent(context.raw, total)}%)` } },
      },
    },
  });
}

function renderInsights(recent, allTime, history) {
  const latest = recentMonths(recent).pop();
  const latestMostCommon = latest?.data?.length ? mostCommonFlag(latest.data) : null;
  const total = totalCount(allTime);
  const highHazard = totalCount(allTime.filter((item) => getFlagMeta(item.flag_type).severity >= FLAGS["red flag"].severity));
  const peak = weekdayTimeBuckets(history)
    .filter((cell) => cell.count >= 3)
    .sort((a, b) => b.averageSeverity - a.averageSeverity || b.count - a.count)[0];

  insightGrid.replaceChildren(
    summaryCard("Latest month", latestMostCommon?.label || "No data", latest ? latest.name : "No month returned"),
    summaryCard("Hazard share", total ? `${percent(highHazard, total)}%` : "N/A", "red, double red, or red over purple"),
    summaryCard("Peak window", peak ? `${peak.weekdayLabel}, ${peak.bucketLabel}` : "N/A", peak ? `${formatNumber(peak.averageSeverity, 1)} average hazard` : "not enough readings"),
    summaryCard("Total readings", formatInteger(total), `flag entries since ${formatDate(DATA_START_DATE)}`)
  );
}
