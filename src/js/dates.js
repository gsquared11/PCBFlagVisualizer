import { BEACH_TIME_ZONE, DATA_START_DATE } from "./config.js";

export const DateTime = window.luxon.DateTime;

export function formatDateTime(value) {
  if (!value) return "";
  const date = parseUtcDateTime(value);
  return date.isValid ? `${date.toFormat("MMM d, yyyy h:mm a")} ${timeZoneAbbr(date)}` : "";
}

export function formatDate(value) {
  const date = DateTime.fromISO(value, { zone: BEACH_TIME_ZONE });
  return date.isValid ? date.toFormat("MMM d, yyyy") : value;
}

export function formatTime(value, explicitZone = "") {
  const date = parseLocalOrZonedDateTime(value);
  if (date.isValid) return `${date.toFormat("h:mm a")} ${explicitZone || timeZoneAbbr(date)}`;

  const fallback = DateTime.fromFormat(value, "HH:mm", { zone: BEACH_TIME_ZONE });
  return fallback.isValid ? `${fallback.toFormat("h:mm a")} ${explicitZone || timeZoneAbbr(fallback)}` : value;
}

export function formatHourLabel(value) {
  const date = parseLocalOrZonedDateTime(value);
  return date.isValid ? date.toFormat("ha") : value;
}

export function formatHourKey(value) {
  const parsed = parseLocalOrZonedDateTime(value);
  if (parsed.isValid) return parsed.setZone(BEACH_TIME_ZONE).toFormat("yyyy-MM-dd-HH");

  const fallback = DateTime.fromFormat(value, "HH:mm", { zone: BEACH_TIME_ZONE });
  return fallback.isValid ? fallback.toFormat("yyyy-MM-dd-HH") : value;
}

export function parseUtcDateTime(value) {
  return DateTime.fromISO(value, { zone: "utc" }).setZone(BEACH_TIME_ZONE);
}

export function parseLocalOrZonedDateTime(value) {
  const text = String(value || "");
  const hasExplicitZone = /(?:z|Z|[+-]\d{2}:?\d{2})$/.test(text);
  const date = DateTime.fromISO(text, hasExplicitZone ? { setZone: true } : { zone: BEACH_TIME_ZONE });
  return date.isValid ? date.setZone(BEACH_TIME_ZONE) : date;
}

export function parseHistoryDateTime(entry) {
  if (entry.date_time) return parseLocalOrZonedDateTime(entry.date_time);
  if (entry.date && entry.time) return DateTime.fromISO(`${entry.date}T${entry.time}:00`, { zone: BEACH_TIME_ZONE });
  if (entry.date) return DateTime.fromISO(entry.date, { zone: BEACH_TIME_ZONE });
  return DateTime.invalid("Missing flag date");
}

export function isOnOrAfterDataStart(date) {
  return date.isValid && date >= DateTime.fromISO(DATA_START_DATE, { zone: BEACH_TIME_ZONE }).startOf("day");
}

export function timeZoneAbbr(date) {
  return date.offsetNameShort || "CT";
}
