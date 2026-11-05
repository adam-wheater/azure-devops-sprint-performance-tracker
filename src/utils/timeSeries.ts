import { DailyPoint } from "../models/interfaces";

/**
 * Day-bucketing helpers for the department stats charts.
 *
 * Everything here works in the viewer's local timezone: a commit pushed at
 * 23:00 local should land on the day the author experienced, not on the UTC
 * day. Day keys are "YYYY-MM-DD" strings so they sort lexicographically and
 * survive a round trip through a Map without Date identity surprises.
 */

export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isWeekendKey(key: string): boolean {
  const day = fromDayKey(key).getDay();
  return day === 0 || day === 6;
}

/**
 * Every day key from `from` to `to` inclusive, oldest first.
 * Returns [] when the range is inverted.
 */
export function enumerateDays(from: Date, to: Date): string[] {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const keys: string[] = [];
  while (cursor <= end) {
    keys.push(toDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/**
 * Buckets dated items into one point per day across the whole range.
 *
 * Days with no items are emitted as zeroes rather than skipped — a gap in a
 * daily chart must read as "nothing happened", not as "the line jumps".
 * Items whose date falls outside the range, or that have no date at all, are
 * ignored.
 */
export function bucketByDay<T>(
  items: T[],
  getDate: (item: T) => Date | null | undefined,
  from: Date,
  to: Date
): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const key of enumerateDays(from, to)) {
    counts.set(key, 0);
  }

  for (const item of items) {
    const date = getDate(item);
    if (!date || Number.isNaN(date.getTime())) continue;
    const key = toDayKey(date);
    const current = counts.get(key);
    if (current === undefined) continue; // outside the requested window
    counts.set(key, current + 1);
  }

  return Array.from(counts.entries()).map(([date, value]) => ({ date, value }));
}

/**
 * Trailing moving average over `windowSize` days.
 *
 * The first points average over however many days exist so far, so the line
 * starts at the left edge instead of floating in after a week of nothing.
 */
export function movingAverage(points: DailyPoint[], windowSize: number): DailyPoint[] {
  if (windowSize <= 1) return points.map((p) => ({ ...p }));

  const result: DailyPoint[] = [];
  let runningTotal = 0;

  for (let i = 0; i < points.length; i++) {
    runningTotal += points[i].value;
    if (i >= windowSize) {
      runningTotal -= points[i - windowSize].value;
    }
    const span = Math.min(i + 1, windowSize);
    result.push({ date: points[i].date, value: runningTotal / span });
  }

  return result;
}

export interface SeriesSummary {
  total: number;
  /** Mean across every day in the range, including zero days. */
  dailyAverage: number;
  /** Mean across Mon–Fri only — the number most teams actually mean by "per day". */
  weekdayAverage: number;
  peakValue: number;
  peakDate: string | null;
}

export function summarizeSeries(points: DailyPoint[]): SeriesSummary {
  if (points.length === 0) {
    return { total: 0, dailyAverage: 0, weekdayAverage: 0, peakValue: 0, peakDate: null };
  }

  let total = 0;
  let weekdayTotal = 0;
  let weekdayCount = 0;
  let peakValue = -Infinity;
  let peakDate: string | null = null;

  for (const point of points) {
    total += point.value;
    if (!isWeekendKey(point.date)) {
      weekdayTotal += point.value;
      weekdayCount++;
    }
    if (point.value > peakValue) {
      peakValue = point.value;
      peakDate = point.date;
    }
  }

  return {
    total,
    dailyAverage: total / points.length,
    weekdayAverage: weekdayCount > 0 ? weekdayTotal / weekdayCount : 0,
    peakValue: peakValue === -Infinity ? 0 : peakValue,
    peakDate,
  };
}

/** Short axis/tooltip label, e.g. "3 Aug". */
export function formatDayLabel(key: string): string {
  return fromDayKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Longer tooltip label, e.g. "Mon, 3 Aug 2026". */
export function formatDayLabelLong(key: string): string {
  return fromDayKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Picks a tick interval that keeps roughly `targetTicks` labels on the axis,
 * so a 30-day chart labels every few days and a 120-day chart every couple of
 * weeks without the labels ever colliding.
 */
export function selectTickIndices(count: number, targetTicks: number = 6): number[] {
  if (count <= 0) return [];
  if (count <= targetTicks) return Array.from({ length: count }, (_, i) => i);

  const step = Math.ceil(count / targetTicks);
  const indices: number[] = [];
  for (let i = 0; i < count; i += step) {
    indices.push(i);
  }
  // Always anchor the most recent day — it is the one readers look for.
  if (indices[indices.length - 1] !== count - 1) {
    if (count - 1 - indices[indices.length - 1] < step / 2) {
      indices.pop();
    }
    indices.push(count - 1);
  }
  return indices;
}

/**
 * Rounds a max value up to a clean axis ceiling (1/2/5 x 10^n) and returns
 * evenly spaced gridline values including 0.
 */
export function buildYAxisTicks(maxValue: number, tickCount: number = 4): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [0, 1];

  const rawStep = maxValue / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceMultiplier * magnitude;

  // Keep stepping until the top tick is at or above the max — the chart scales
  // its plot height off the last tick, so a ceiling below the max would push
  // the tallest bar out through the top of the chart.
  const ticks: number[] = [];
  for (let i = 0; ; i++) {
    const value = Number((step * i).toFixed(10));
    ticks.push(value);
    if (value >= maxValue && ticks.length >= 2) break;
  }
  return ticks;
}
