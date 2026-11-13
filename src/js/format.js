export function formatRange(minValue, maxValue, suffix) {
  if (!isNumber(minValue) || !isNumber(maxValue)) return "";
  return `${formatNumber(minValue, 0)}-${formatNumber(maxValue, 0)}${suffix}`;
}

export function formatNumber(value, digits = 1) {
  return isNumber(value) ? Number(value).toFixed(digits) : "N/A";
}

export function formatInteger(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

export function titleCase(value) {
  return String(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function min(values) {
  return values.length ? Math.min(...values) : null;
}

export function max(values) {
  return values.length ? Math.max(...values) : null;
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function formatDuration(hours) {
  if (!isNumber(hours)) return "N/A";
  if (hours < 48) return `${formatNumber(hours, 0)} hours`;
  return `${formatNumber(hours / 24, 1)} days`;
}
