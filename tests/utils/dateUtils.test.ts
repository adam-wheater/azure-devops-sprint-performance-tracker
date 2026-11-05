import {
  isWeekend,
  isInDateRanges,
  countWorkingDays,
  countWeekdaysBetween,
  calculateSprintProgress,
} from "@/utils/dateUtils";

describe("isWeekend", () => {
  it("returns true for Saturday", () => {
    expect(isWeekend(new Date("2026-02-07"))).toBe(true); // Saturday
  });

  it("returns true for Sunday", () => {
    expect(isWeekend(new Date("2026-02-08"))).toBe(true); // Sunday
  });

  it("returns false for Monday", () => {
    expect(isWeekend(new Date("2026-02-09"))).toBe(false);
  });

  it("returns false for Friday", () => {
    expect(isWeekend(new Date("2026-02-06"))).toBe(false);
  });
});

describe("isInDateRanges", () => {
  it("returns true when date falls within a range", () => {
    const ranges = [{ start: new Date("2026-02-09"), end: new Date("2026-02-11") }];
    expect(isInDateRanges(new Date("2026-02-10"), ranges)).toBe(true);
  });

  it("returns true on range start boundary", () => {
    const ranges = [{ start: new Date("2026-02-09"), end: new Date("2026-02-11") }];
    expect(isInDateRanges(new Date("2026-02-09"), ranges)).toBe(true);
  });

  it("returns true on range end boundary", () => {
    const ranges = [{ start: new Date("2026-02-09"), end: new Date("2026-02-11") }];
    expect(isInDateRanges(new Date("2026-02-11"), ranges)).toBe(true);
  });

  it("returns false when date is outside all ranges", () => {
    const ranges = [{ start: new Date("2026-02-09"), end: new Date("2026-02-11") }];
    expect(isInDateRanges(new Date("2026-02-12"), ranges)).toBe(false);
  });

  it("returns false when ranges are empty", () => {
    expect(isInDateRanges(new Date("2026-02-10"), [])).toBe(false);
  });
});

describe("countWorkingDays", () => {
  it("counts weekdays in a standard 2-week sprint (Mon-Fri × 2)", () => {
    // Mon Jan 5 to Fri Jan 16, 2026 = 10 weekdays
    const result = countWorkingDays(new Date("2026-01-05"), new Date("2026-01-16"), [], []);
    expect(result.totalWeekdays).toBe(10);
    expect(result.workingDays).toBe(10);
    expect(result.teamDaysOffCount).toBe(0);
    expect(result.personalDaysOffCount).toBe(0);
  });

  it("excludes team days off from working days", () => {
    // Mon Jan 5 to Fri Jan 16, 2026 = 10 weekdays
    // Team holiday: Jan 8-9 (Thu-Fri) = 2 days off
    const result = countWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-16"),
      [{ start: new Date("2026-01-08"), end: new Date("2026-01-09") }],
      []
    );
    expect(result.totalWeekdays).toBe(10);
    expect(result.teamDaysOffCount).toBe(2);
    expect(result.workingDays).toBe(8);
  });

  it("excludes personal days off from working days", () => {
    const result = countWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-16"),
      [],
      [{ start: new Date("2026-01-12"), end: new Date("2026-01-12") }]
    );
    expect(result.totalWeekdays).toBe(10);
    expect(result.personalDaysOffCount).toBe(1);
    expect(result.workingDays).toBe(9);
  });

  it("does not double-count team days off and personal days off on same day", () => {
    // Team off Jan 8, Personal off Jan 8 — should only subtract once
    const result = countWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-09"),
      [{ start: new Date("2026-01-08"), end: new Date("2026-01-08") }],
      [{ start: new Date("2026-01-08"), end: new Date("2026-01-08") }]
    );
    expect(result.totalWeekdays).toBe(5);
    // Team days off takes priority (checked first)
    expect(result.teamDaysOffCount).toBe(1);
    expect(result.personalDaysOffCount).toBe(0);
    expect(result.workingDays).toBe(4);
  });

  it("returns 0 working days when entire sprint is weekend", () => {
    // Sat Jan 3 to Sun Jan 4, 2026
    const result = countWorkingDays(new Date("2026-01-03"), new Date("2026-01-04"), [], []);
    expect(result.totalWeekdays).toBe(0);
    expect(result.workingDays).toBe(0);
  });

  it("handles single day sprint", () => {
    const result = countWorkingDays(
      new Date("2026-01-05"), // Monday
      new Date("2026-01-05"),
      [],
      []
    );
    expect(result.totalWeekdays).toBe(1);
    expect(result.workingDays).toBe(1);
  });

  it("never returns negative working days", () => {
    // 1 weekday, but mark it as both team and personal off
    const result = countWorkingDays(
      new Date("2026-01-05"),
      new Date("2026-01-05"),
      [{ start: new Date("2026-01-05"), end: new Date("2026-01-05") }],
      []
    );
    expect(result.workingDays).toBe(0);
  });
});

describe("countWeekdaysBetween", () => {
  it("counts weekdays within the same week", () => {
    // Mon Jan 5 to Fri Jan 9, 2026 = 5 weekdays
    expect(countWeekdaysBetween(new Date("2026-01-05"), new Date("2026-01-09"))).toBe(5);
  });

  it("skips weekends", () => {
    // Fri Jan 9 to Mon Jan 12, 2026 = 2 weekdays (Fri + Mon)
    expect(countWeekdaysBetween(new Date("2026-01-09"), new Date("2026-01-12"))).toBe(2);
  });

  it("returns 1 for same weekday", () => {
    expect(countWeekdaysBetween(new Date("2026-01-05"), new Date("2026-01-05"))).toBe(1);
  });

  it("returns 0 for same weekend day", () => {
    // Saturday to Saturday
    expect(countWeekdaysBetween(new Date("2026-01-03"), new Date("2026-01-03"))).toBe(0);
  });

  it("returns 0 when end is before start", () => {
    expect(countWeekdaysBetween(new Date("2026-01-09"), new Date("2026-01-05"))).toBe(0);
  });

  it("counts across two weeks correctly", () => {
    // Mon Jan 5 to Fri Jan 16, 2026 = 10 weekdays
    expect(countWeekdaysBetween(new Date("2026-01-05"), new Date("2026-01-16"))).toBe(10);
  });
});

describe("calculateSprintProgress", () => {
  // Mon Jan 5 to Fri Jan 16, 2026 = 10 weekdays
  const start = new Date("2026-01-05");
  const finish = new Date("2026-01-16");

  it("returns 1.0 when today is after sprint end", () => {
    expect(calculateSprintProgress(start, finish, new Date("2026-01-20"))).toBe(1.0);
  });

  it("returns 1.0 when today is exactly sprint end", () => {
    expect(calculateSprintProgress(start, finish, new Date("2026-01-16"))).toBe(1.0);
  });

  it("returns 0 when today is before sprint start", () => {
    expect(calculateSprintProgress(start, finish, new Date("2026-01-04"))).toBe(0);
  });

  it("returns fraction for mid-sprint", () => {
    // Wednesday Jan 7 = day 3 of 10 weekdays → 3/10 = 0.3
    expect(calculateSprintProgress(start, finish, new Date("2026-01-07"))).toBeCloseTo(0.3, 5);
  });

  it("returns 0.1 on first day of sprint", () => {
    // Monday Jan 5 = day 1 of 10 → 1/10 = 0.1
    expect(calculateSprintProgress(start, finish, new Date("2026-01-05"))).toBeCloseTo(0.1, 5);
  });

  it("returns 0.5 at midpoint of sprint", () => {
    // Friday Jan 9 = day 5 of 10 → 5/10 = 0.5
    expect(calculateSprintProgress(start, finish, new Date("2026-01-09"))).toBeCloseTo(0.5, 5);
  });

  it("handles weekend day as if at end of Friday", () => {
    // Saturday Jan 10 = 5 weekdays elapsed / 10 total = 0.5
    expect(calculateSprintProgress(start, finish, new Date("2026-01-10"))).toBeCloseTo(0.5, 5);
  });
});
