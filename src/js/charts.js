import { formatNumber } from "./format.js";

const charts = new Map();

export function applyChartDefaults() {
  const Chart = window.Chart;
  Chart.defaults.color = "#9fb2c6";
  Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
  Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  Chart.defaults.plugins.tooltip.backgroundColor = "#07151f";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(255, 255, 255, 0.14)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
}

export function renderChart(key, container, config) {
  destroyChart(key);
  container.replaceChildren();

  const canvas = document.createElement("canvas");
  container.append(canvas);
  const chart = new window.Chart(canvas.getContext("2d"), config);
  charts.set(key, chart);
}

export function destroyChart(key) {
  const chart = charts.get(key);
  if (chart) {
    chart.destroy();
    charts.delete(key);
  }
}

export function weatherTooltipLabel(context) {
  const value = context.parsed.y;
  if (value == null) return null;

  if (context.dataset.label === "Rain (in)") return `Rain: ${formatNumber(value, 2)} in`;
  if (context.dataset.label === "Flag reading") return `Flag severity: ${value}/7`;
  if (context.dataset.label.includes("Wave")) return `Wave height: ${formatNumber(value, 1)} ft`;
  if (context.dataset.label.includes("current")) return `Ocean current: ${formatNumber(value, 1)} mph`;
  return `${context.dataset.label}: ${formatNumber(value, 0)}`;
}
