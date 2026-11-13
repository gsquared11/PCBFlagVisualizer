import { BEACH_TIME_ZONE, DATA_START_DATE, TIME_BUCKETS, WEEKDAYS } from "./config.js";
import { DateTime, parseHistoryDateTime, isOnOrAfterDataStart } from "./dates.js";
import { FLAGS, getFlagMeta, mostSevereFlag } from "./flags.js";
import { median } from "./format.js";

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

// One entry per day from the data start to today, placed on a Sunday-first week grid
// so the same weeks line up from one year to the next.
export function yearRibbons(history = []) {
  const flagsByDate = groupFlagsByDate(history);
  const start = DateTime.fromISO(DATA_START_DATE, { zone: BEACH_TIME_ZONE }).startOf("day");
  const today = DateTime.now().setZone(BEACH_TIME_ZONE).startOf("day");
  const years = [];

  for (let year = start.year; year <= today.year; year += 1) {
    const jan1 = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: BEACH_TIME_ZONE });
    const offset = jan1.weekday % 7;
    const weekColumn = (date) => Math.floor((date.ordinal - 1 + offset) / 7);
    const first = year === start.year ? start : jan1;
    const last = year === today.year ? today : jan1.endOf("year").startOf("day");
    const days = [];

    for (let date = first; date <= last; date = date.plus({ days: 1 })) {
      const flags = flagsByDate.get(date.toISODate()) || [];
      days.push({
        date: date.toISODate(),
        column: weekColumn(date),
        row: date.weekday % 7,
        flags,
        dominant: flags.length ? mostSevereFlag(flags) : null,
      });
    }

    years.push({
      year,
      days,
      months: Array.from({ length: 12 }, (_, index) => {
        const firstOfMonth = jan1.set({ month: index + 1 });
        return { label: firstOfMonth.toFormat("LLL"), column: weekColumn(firstOfMonth) };
      }),
    });
  }

  return years;
}

// Unbroken stretches of the same flag. A stretch only gets an end (and a duration) when the
// next reading arrives on schedule; a gap in the readings leaves it open rather than guessing.
export function flagRuns(history = [], maxGapHours = 12) {
  const entries = normalizedFlagEntries(history).sort((a, b) => a.date - b.date);
  const runs = [];
  let run = null;

  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    const hasGap = previous ? entry.date.diff(previous.date).as("hours") > maxGapHours : false;

    if (run && !hasGap && entry.flag.label === run.flag.label) {
      run.readings += 1;
      return;
    }

    if (run && !hasGap) {
      run.end = entry.date;
      run.next = entry.flag;
      run.hours = entry.date.diff(run.start).as("hours");
    }

    run = { flag: entry.flag, start: entry.date, end: null, next: null, hours: null, readings: 1 };
    runs.push(run);
  });

  return runs;
}

export function flagFollowUps(runs = []) {
  const groups = new Map();

  runs.forEach((run) => {
    if (!groups.has(run.flag.label)) {
      groups.set(run.flag.label, { flag: run.flag, stretches: 0, completed: [], next: new Map() });
    }

    const group = groups.get(run.flag.label);
    group.stretches += 1;
    if (run.hours == null) return;

    group.completed.push(run);
    const next = group.next.get(run.next.label) || { flag: run.next, count: 0 };
    next.count += 1;
    group.next.set(run.next.label, next);
  });

  return [...groups.values()]
    .sort((a, b) => a.flag.severity - b.flag.severity)
    .map((group) => ({
      flag: group.flag,
      stretches: group.stretches,
      completed: group.completed.length,
      medianHours: median(group.completed.map((run) => run.hours)),
      longest: group.completed.reduce((best, run) => (!best || run.hours > best.hours ? run : best), null),
      next: [...group.next.values()]
        .sort((a, b) => b.count - a.count)
        .map((item) => ({ ...item, share: item.count / group.completed.length })),
    }));
}

export function monthOfYearMix(history = []) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    label: DateTime.fromObject({ year: 2024, month: index + 1, day: 1 }).toFormat("LLL"),
    total: 0,
    years: new Set(),
    counts: new Map(),
  }));

  normalizedFlagEntries(history).forEach((entry) => {
    const bucket = months[entry.date.month - 1];
    bucket.total += 1;
    bucket.years.add(entry.date.year);
    bucket.counts.set(entry.flag.label, (bucket.counts.get(entry.flag.label) || 0) + 1);
  });

  return months;
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
