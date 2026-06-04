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
