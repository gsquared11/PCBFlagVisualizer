export const BEACH_TIME_ZONE = "America/Chicago";
export const DATA_START_DATE = "2025-02-28";

export const API = {
  tableData: "/api/table-data",
  flagDistribution: "/api/flag-distribution",
  allTimeFlagDistribution: "/api/all-time-flag-distribution",
  flagsByDay: "/api/flags-by-day",
  currentMonthFlags: "/api/current-month-flags",
  weatherData: "/api/weather-data",
};

export const WEEKDAYS = [
  { index: 0, shortLabel: "Sun", label: "Sunday" },
  { index: 1, shortLabel: "Mon", label: "Monday" },
  { index: 2, shortLabel: "Tue", label: "Tuesday" },
  { index: 3, shortLabel: "Wed", label: "Wednesday" },
  { index: 4, shortLabel: "Thu", label: "Thursday" },
  { index: 5, shortLabel: "Fri", label: "Friday" },
  { index: 6, shortLabel: "Sat", label: "Saturday" },
];

export const TIME_BUCKETS = [
  { start: 0, shortLabel: "12a", label: "12 AM-4 AM" },
  { start: 4, shortLabel: "4a", label: "4 AM-8 AM" },
  { start: 8, shortLabel: "8a", label: "8 AM-12 PM" },
  { start: 12, shortLabel: "12p", label: "12 PM-4 PM" },
  { start: 16, shortLabel: "4p", label: "4 PM-8 PM" },
  { start: 20, shortLabel: "8p", label: "8 PM-12 AM" },
];
