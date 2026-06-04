import { titleCase } from "./format.js";

export const FLAGS = {
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

export const UNKNOWN_FLAG = {
  label: "Unknown",
  className: "unknown-flag",
  color: "#6f879e",
  severity: 0,
  description: "No recognized flag value was returned for this entry.",
};

export function getFlagMeta(value) {
  return FLAGS[normalizeFlag(value)] || {
    ...UNKNOWN_FLAG,
    label: value ? titleCase(String(value).trim()) : UNKNOWN_FLAG.label,
  };
}

export function normalizeFlag(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function removeFlagClasses(node) {
  Object.values(FLAGS).forEach((flag) => node.classList.remove(flag.className));
  node.classList.remove(UNKNOWN_FLAG.className);
}

export function severityLabel(severity) {
  if (severity >= 7) return "Extreme";
  if (severity >= 5) return "High";
  if (severity >= 3) return "Moderate";
  if (severity >= 1) return "Low";
  return "Unknown";
}

export function mostSevereFlag(flags) {
  return flags
    .map((flag) => getFlagMeta(flag.flag_type))
    .sort((a, b) => b.severity - a.severity)[0] || UNKNOWN_FLAG;
}

export function mostCommonFlag(flags) {
  const counts = new Map();

  flags.forEach((flag) => {
    const meta = getFlagMeta(flag.flag_type);
    const existing = counts.get(meta.label) || { ...meta, count: 0 };
    existing.count += flag.count || 1;
    counts.set(meta.label, existing);
  });

  return [...counts.values()].sort((a, b) => b.count - a.count || b.severity - a.severity)[0];
}

export function countFlagChanges(flags) {
  return flags.reduce((changes, flag, index) => {
    if (index === 0) return 0;
    return normalizeFlag(flag.flag_type) === normalizeFlag(flags[index - 1].flag_type) ? changes : changes + 1;
  }, 0);
}

export function summarizeFlags(flags) {
  const highest = mostSevereFlag(flags);
  return `${flags.length} readings, highest hazard ${highest.label}`;
}

export function orderedFlagsFrom(items) {
  const flags = new Map();
  items.forEach((item) => {
    const flag = getFlagMeta(item.flag_type);
    flags.set(flag.label, flag);
  });
  return [...flags.values()].sort((a, b) => a.severity - b.severity);
}

export function countForFlag(items = [], flagLabel) {
  return items
    .filter((item) => getFlagMeta(item.flag_type).label === flagLabel)
    .reduce((total, item) => total + item.count, 0);
}

export function totalCount(items = []) {
  return items.reduce((total, item) => total + (item.count || 0), 0);
}
