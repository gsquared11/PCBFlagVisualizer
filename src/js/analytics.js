import { TIME_BUCKETS, WEEKDAYS } from "./config.js";
import { parseHistoryDateTime, isOnOrAfterDataStart } from "./dates.js";
import { FLAGS, getFlagMeta } from "./flags.js";

export function groupFlagsByDate(flags) {
  const groups = new Map();
  flags.forEach((flag) => {
    if (!groups.has(flag.date)) groups.set(flag.date, []);
    groups.get(flag.date).push(flag);
  });
  return groups;
}

export function monthlyHazardBuckets(history = []) {
  const buckets = new Map();

  normalizedFlagEntries(history).forEach((entry) => {
    const key = entry.date.toFormat("yyyy-MM");
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: entry.date.toFormat("LLL yyyy"),
        count: 0,
        severityTotal: 0,
        highHazardCount: 0,
      });
    }

    const bucket = buckets.get(key);
    bucket.count += 1;
    bucket.severityTotal += entry.flag.severity;
    if (entry.flag.severity >= FLAGS["red flag"].severity) bucket.highHazardCount += 1;
  });

  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({
      ...bucket,
      averageSeverity: bucket.count ? bucket.severityTotal / bucket.count : 0,
      highHazardShare: bucket.count ? (bucket.highHazardCount / bucket.count) * 100 : 0,
    }));
}

export function weekdayTimeBuckets(history = []) {
  const buckets = new Map();

  WEEKDAYS.forEach((weekday) => {
    TIME_BUCKETS.forEach((bucket) => {
      const key = `${weekday.index}-${bucket.start}`;
      buckets.set(key, {
        key,
        weekday: weekday.index,
        bucket: bucket.start,
        weekdayLabel: weekday.label,
        bucketLabel: bucket.label,
        count: 0,
        severityTotal: 0,
        entries: [],
      });
    });
  });

  normalizedFlagEntries(history).forEach((entry) => {
    const weekday = entry.date.weekday % 7;
    const bucketStart = Math.floor(entry.date.hour / 4) * 4;
    const bucket = buckets.get(`${weekday}-${bucketStart}`);
    if (!bucket) return;

    bucket.count += 1;
    bucket.severityTotal += entry.flag.severity;
    bucket.entries.push({ flag_type: entry.flag.label });
  });

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    averageSeverity: bucket.count ? bucket.severityTotal / bucket.count : 0,
  }));
}

function normalizedFlagEntries(history = []) {
  return history
    .map((entry) => {
      const date = parseHistoryDateTime(entry);
      if (!isOnOrAfterDataStart(date)) return null;
      return {
        date,
        flag: getFlagMeta(entry.flag_type),
        raw: entry,
      };
    })
    .filter(Boolean);
}
