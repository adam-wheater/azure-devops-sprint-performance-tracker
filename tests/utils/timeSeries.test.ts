import {
  toDayKey,
  fromDayKey,
  isWeekendKey,
  enumerateDays,
  bucketByDay,
  movingAverage,
  summarizeSeries,
  selectTickIndices,
  buildYAxisTicks,
} from "@/utils/timeSeries";

describe("toDayKey / fromDayKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(toDayKey(new Date(2026, 7, 3))).toBe("2026-08-03");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDayKey(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("uses the local day, not the UTC day", () => {
    // Late-evening local time can already be the next day in UTC. The key must
    // follow the author's calendar, not the server's.
    const lateEvening = new Date(2026, 7, 3, 23, 30);
    expect(toDayKey(lateEvening)).toBe("2026-08-03");
  });

  it("round-trips through fromDayKey", () => {
    const key = "2026-02-28";
    expect(toDayKey(fromDayKey(key))).toBe(key);
  });
});

describe("isWeekendKey", () => {
  it("identifies Saturday and Sunday", () => {
    expect(isWeekendKey("2026-08-01")).toBe(true); // Saturday
    expect(isWeekendKey("2026-08-02")).toBe(true); // Sunday
  });

  it("identifies weekdays", () => {
    expect(isWeekendKey("2026-08-03")).toBe(false); // Monday
    expect(isWeekendKey("2026-08-07")).toBe(false); // Friday
  });
});

describe("enumerateDays", () => {
  it("includes both endpoints", () => {
    const days = enumerateDays(new Date(2026, 7, 1), new Date(2026, 7, 4));
    expect(days).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
  });

  it("returns a single day when from equals to", () => {
    expect(enumerateDays(new Date(2026, 7, 3), new Date(2026, 7, 3))).toEqual(["2026-08-03"]);
  });

  it("returns empty for an inverted range", () => {
    expect(enumerateDays(new Date(2026, 7, 5), new Date(2026, 7, 1))).toEqual([]);
  });

  it("crosses month and year boundaries", () => {
    const days = enumerateDays(new Date(2025, 11, 30), new Date(2026, 0, 2));
    expect(days).toEqual(["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]);
  });

  it("handles a leap day", () => {
    const days = enumerateDays(new Date(2028, 1, 28), new Date(2028, 2, 1));
    expect(days).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });
});

describe("bucketByDay", () => {
  const from = new Date(2026, 7, 1);
  const to = new Date(2026, 7, 5);

  it("counts items into their day", () => {
    const items = [
      { at: new Date(2026, 7, 1, 9) },
      { at: new Date(2026, 7, 1, 17) },
      { at: new Date(2026, 7, 3, 12) },
    ];
    const points = bucketByDay(items, (i) => i.at, from, to);
    expect(points.map((p) => p.value)).toEqual([2, 0, 1, 0, 0]);
  });

  it("emits a zero for every day with no items", () => {
    const points = bucketByDay([], () => null, from, to);
    expect(points).toHaveLength(5);
    expect(points.every((p) => p.value === 0)).toBe(true);
  });

  it("keeps days in chronological order", () => {
    const points = bucketByDay([{ at: new Date(2026, 7, 4) }], (i) => i.at, from, to);
    expect(points.map((p) => p.date)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
  });

  it("ignores items outside the range", () => {
    const items = [{ at: new Date(2026, 6, 20) }, { at: new Date(2026, 8, 1) }];
    const points = bucketByDay(items, (i) => i.at, from, to);
    expect(points.reduce((sum, p) => sum + p.value, 0)).toBe(0);
  });

  it("ignores items with a null or invalid date", () => {
    const items = [{ at: null }, { at: new Date("nonsense") }, { at: new Date(2026, 7, 2) }];
    const points = bucketByDay(items, (i) => i.at, from, to);
    expect(points.reduce((sum, p) => sum + p.value, 0)).toBe(1);
  });
});

describe("movingAverage", () => {
  const points = [1, 2, 3, 4, 5, 6, 7].map((value, index) => ({
    date: `2026-08-0${index + 1}`,
    value,
  }));

  it("averages over the trailing window once it is full", () => {
    const result = movingAverage(points, 3);
    // Days 3..7 average the previous three values.
    expect(result[2].value).toBeCloseTo(2);
    expect(result[6].value).toBeCloseTo(6);
  });

  it("averages over the days available so far at the start", () => {
    const result = movingAverage(points, 3);
    expect(result[0].value).toBeCloseTo(1);
    expect(result[1].value).toBeCloseTo(1.5);
  });

  it("preserves the dates and length of the input", () => {
    const result = movingAverage(points, 7);
    expect(result).toHaveLength(points.length);
    expect(result.map((p) => p.date)).toEqual(points.map((p) => p.date));
  });

  it("returns a copy unchanged for a window of 1", () => {
    const result = movingAverage(points, 1);
    expect(result.map((p) => p.value)).toEqual(points.map((p) => p.value));
    expect(result[0]).not.toBe(points[0]);
  });

  it("handles an empty series", () => {
    expect(movingAverage([], 7)).toEqual([]);
  });
});

describe("summarizeSeries", () => {
  it("totals every day but averages weekdays separately", () => {
    // Sat 1st and Sun 2nd carry the big numbers; Mon–Wed carry 3 each.
    const points = [
      { date: "2026-08-01", value: 10 },
      { date: "2026-08-02", value: 10 },
      { date: "2026-08-03", value: 3 },
      { date: "2026-08-04", value: 3 },
      { date: "2026-08-05", value: 3 },
    ];
    const summary = summarizeSeries(points);
    expect(summary.total).toBe(29);
    expect(summary.dailyAverage).toBeCloseTo(29 / 5);
    expect(summary.weekdayAverage).toBeCloseTo(3);
  });

  it("reports the peak day", () => {
    const points = [
      { date: "2026-08-03", value: 2 },
      { date: "2026-08-04", value: 9 },
      { date: "2026-08-05", value: 4 },
    ];
    const summary = summarizeSeries(points);
    expect(summary.peakValue).toBe(9);
    expect(summary.peakDate).toBe("2026-08-04");
  });

  it("returns zeroes for an empty series", () => {
    expect(summarizeSeries([])).toEqual({
      total: 0,
      dailyAverage: 0,
      weekdayAverage: 0,
      peakValue: 0,
      peakDate: null,
    });
  });

  it("reports a zero weekday average when the range is all weekend", () => {
    const summary = summarizeSeries([
      { date: "2026-08-01", value: 5 },
      { date: "2026-08-02", value: 5 },
    ]);
    expect(summary.weekdayAverage).toBe(0);
    expect(summary.total).toBe(10);
  });
});

describe("selectTickIndices", () => {
  it("labels every point when there are few", () => {
    expect(selectTickIndices(4, 6)).toEqual([0, 1, 2, 3]);
  });

  it("thins the labels for a long range", () => {
    const indices = selectTickIndices(120, 6);
    expect(indices.length).toBeLessThanOrEqual(8);
    expect(indices[0]).toBe(0);
  });

  it("always anchors the most recent day", () => {
    for (const count of [30, 45, 90, 120, 180]) {
      const indices = selectTickIndices(count, 6);
      expect(indices[indices.length - 1]).toBe(count - 1);
    }
  });

  it("never emits an out-of-range index", () => {
    const indices = selectTickIndices(37, 6);
    expect(indices.every((i) => i >= 0 && i < 37)).toBe(true);
  });

  it("returns empty for no points", () => {
    expect(selectTickIndices(0)).toEqual([]);
  });
});

describe("buildYAxisTicks", () => {
  it("starts at zero and covers the max", () => {
    const ticks = buildYAxisTicks(17);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(17);
  });

  it("uses round step values", () => {
    expect(buildYAxisTicks(40)).toEqual([0, 10, 20, 30, 40]);
  });

  it("falls back to a 0-1 axis for an empty or flat series", () => {
    expect(buildYAxisTicks(0)).toEqual([0, 1]);
    expect(buildYAxisTicks(-5)).toEqual([0, 1]);
  });

  it("scales to large values without fractional steps", () => {
    const ticks = buildYAxisTicks(4200);
    expect(ticks.every((t) => Number.isInteger(t))).toBe(true);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(4200);
  });
});
