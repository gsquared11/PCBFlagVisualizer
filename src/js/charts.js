const charts = new Map();

export const isCompact = () => window.matchMedia("(max-width: 640px)").matches;

export function applyChartDefaults() {
  const { defaults } = window.Chart;
  defaults.color = "#9fb2c6";
  defaults.borderColor = "rgba(255, 255, 255, 0.08)";
  defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  defaults.font.size = 14;
  defaults.maintainAspectRatio = false;
  defaults.plugins.legend.position = "bottom";
  Object.assign(defaults.plugins.legend.labels, { usePointStyle: true, boxWidth: 8, boxHeight: 7, padding: 16 });
  Object.assign(defaults.plugins.tooltip, {
    backgroundColor: "#07151f",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    padding: 12,
  });
}

export function renderChart(key, container, config) {
  destroyChart(key);
  container.replaceChildren();

  const canvas = document.createElement("canvas");
  container.append(canvas);
  charts.set(key, new window.Chart(canvas.getContext("2d"), config));
}

export function destroyChart(key) {
  charts.get(key)?.destroy();
  charts.delete(key);
}

// Smaller type and tighter legends on phones, for the charts that carry the most labels.
export const tickFont = () => ({ size: isCompact() ? 12 : 14 });

export const compactLegend = () => ({
  labels: isCompact() ? { boxWidth: 7, padding: 12, font: { size: 13 } } : {},
});

export function lineSeries(label, data, borderColor, backgroundColor, yAxisID, extra = {}) {
  return { label, data, borderColor, backgroundColor, yAxisID, pointRadius: 0, tension: 0.25, ...extra };
}
