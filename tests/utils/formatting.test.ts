import {
  formatPercentage,
  formatDecimal,
  formatHours,
  getPerformanceColor,
  getPerformanceTone,
  getEffortPerDayColor,
  getEffortPerDayTone,
  getRoleColor,
  formatSprintDates,
  getTrendDirection,
  getTrendArrow,
  getSlippageColor,
  formatSlippagePct,
} from "@/utils/formatting";
import { DEFAULT_THRESHOLDS } from "@/models/interfaces";

describe("formatPercentage", () => {
  it("formats with one decimal place and % suffix", () => {
    expect(formatPercentage(85.67)).toBe("85.7%");
  });

  it("formats zero", () => {
    expect(formatPercentage(0)).toBe("0.0%");
  });

  it("formats 100", () => {
    expect(formatPercentage(100)).toBe("100.0%");
  });
});

describe("formatDecimal", () => {
  it("formats with default 1 decimal", () => {
    expect(formatDecimal(3.456)).toBe("3.5");
  });

  it("formats with 2 decimals", () => {
    expect(formatDecimal(1.1, 2)).toBe("1.10");
  });
});

describe("formatHours", () => {
  it("formats with h suffix", () => {
    expect(formatHours(40)).toBe("40.0h");
  });

  it("formats fractional hours", () => {
    expect(formatHours(7.5)).toBe("7.5h");
  });
});

describe("getPerformanceColor", () => {
  it("returns the success token for >= 100%", () => {
    expect(getPerformanceColor(100)).toBe("var(--ax-success)");
    expect(getPerformanceColor(150)).toBe("var(--ax-success)");
  });

  it("returns the info token for >= 80% and < 100%", () => {
    expect(getPerformanceColor(80)).toBe("var(--ax-info)");
    expect(getPerformanceColor(99.9)).toBe("var(--ax-info)");
  });

  it("returns the warn token for >= 60% and < 80%", () => {
    expect(getPerformanceColor(60)).toBe("var(--ax-warn)");
    expect(getPerformanceColor(79.9)).toBe("var(--ax-warn)");
  });

  it("returns the danger token for < 60%", () => {
    expect(getPerformanceColor(59.9)).toBe("var(--ax-danger)");
    expect(getPerformanceColor(0)).toBe("var(--ax-danger)");
  });
});

describe("getPerformanceTone", () => {
  it("bands a percentage into success, info, warn and danger", () => {
    expect(getPerformanceTone(100)).toBe("success");
    expect(getPerformanceTone(80)).toBe("info");
    expect(getPerformanceTone(60)).toBe("warn");
    expect(getPerformanceTone(59.9)).toBe("danger");
  });

  it("follows custom thresholds", () => {
    const thresholds = { ...DEFAULT_THRESHOLDS, perfThresholdExcellent: 95, perfThresholdGood: 70 };
    expect(getPerformanceTone(90, thresholds)).toBe("info");
    expect(getPerformanceTone(95, thresholds)).toBe("success");
    expect(getPerformanceColor(90, thresholds)).toBe("var(--ax-info)");
  });

  it("only ever returns design tokens, never a literal colour", () => {
    for (const pct of [0, 50, 70, 90, 120]) {
      expect(getPerformanceColor(pct)).toMatch(/^var\(--ax-[a-z-]+\)$/);
    }
  });
});

describe("getEffortPerDayTone", () => {
  it("scales effort per day against the 1.0 target", () => {
    expect(getEffortPerDayTone(1.0)).toBe("success");
    expect(getEffortPerDayTone(0.8)).toBe("info");
    expect(getEffortPerDayTone(0.6)).toBe("warn");
    expect(getEffortPerDayTone(0.5)).toBe("danger");
  });
});

describe("getEffortPerDayColor", () => {
  it("returns green for effort per day >= 1.0 (target)", () => {
    expect(getEffortPerDayColor(1.0)).toBe("var(--ax-success)");
    expect(getEffortPerDayColor(1.5)).toBe("var(--ax-success)");
  });

  it("returns blue for effort per day >= 0.8", () => {
    expect(getEffortPerDayColor(0.8)).toBe("var(--ax-info)");
  });

  it("returns orange for effort per day >= 0.6", () => {
    expect(getEffortPerDayColor(0.6)).toBe("var(--ax-warn)");
  });

  it("returns red for effort per day < 0.6", () => {
    expect(getEffortPerDayColor(0.5)).toBe("var(--ax-danger)");
  });
});

describe("getRoleColor", () => {
  it("returns the first chart series for Development", () => {
    expect(getRoleColor("Development")).toBe("var(--ax-chart-1)");
  });

  it("returns the fifth chart series for Testing", () => {
    expect(getRoleColor("Testing")).toBe("var(--ax-chart-5)");
  });

  it("returns the sixth chart series for Design", () => {
    expect(getRoleColor("Design")).toBe("var(--ax-chart-6)");
  });

  it("returns the second chart series for Documentation", () => {
    expect(getRoleColor("Documentation")).toBe("var(--ax-chart-2)");
  });

  it("returns the muted text token for unknown roles", () => {
    expect(getRoleColor("SomeUnknownRole")).toBe("var(--ax-text-4)");
  });
});

describe("formatSprintDates", () => {
  it("formats start and end dates with en-US locale", () => {
    const result = formatSprintDates(new Date("2026-01-05"), new Date("2026-01-16"));
    // Now uses fixed en-US locale, so exact match is reliable
    expect(result).toMatch(/Jan\s+5\s*-\s*Jan\s+16/);
  });
});

describe("getTrendDirection", () => {
  it("returns 'up' when current is more than 5 above previous", () => {
    expect(getTrendDirection(90, 80)).toBe("up");
  });

  it("returns 'down' when current is more than 5 below previous", () => {
    expect(getTrendDirection(70, 80)).toBe("down");
  });

  it("returns 'flat' when difference is within ±5", () => {
    expect(getTrendDirection(82, 80)).toBe("flat");
    expect(getTrendDirection(78, 80)).toBe("flat");
    expect(getTrendDirection(85, 80)).toBe("flat");
    expect(getTrendDirection(75, 80)).toBe("flat");
  });

  it("returns 'flat' for exactly 5 above", () => {
    expect(getTrendDirection(85, 80)).toBe("flat");
  });

  it("returns 'up' for 5.1 above", () => {
    expect(getTrendDirection(85.1, 80)).toBe("up");
  });
});

describe("getTrendArrow", () => {
  it("returns up triangle for improvement", () => {
    expect(getTrendArrow(90, 80)).toBe("\u25B2");
  });

  it("returns down triangle for decline", () => {
    expect(getTrendArrow(70, 80)).toBe("\u25BC");
  });

  it("returns horizontal bar for flat", () => {
    expect(getTrendArrow(82, 80)).toBe("\u2015");
  });
});

describe("getSlippageColor", () => {
  it("returns green for slippage < 100%", () => {
    expect(getSlippageColor(50)).toBe("var(--ax-success)");
    expect(getSlippageColor(99)).toBe("var(--ax-success)");
  });

  it("returns green for slippage at exactly 100%", () => {
    expect(getSlippageColor(100)).toBe("var(--ax-success)");
  });

  it("returns orange for slippage 101-200%", () => {
    expect(getSlippageColor(101)).toBe("var(--ax-warn)");
    expect(getSlippageColor(200)).toBe("var(--ax-warn)");
  });

  it("returns red for slippage > 200%", () => {
    expect(getSlippageColor(201)).toBe("var(--ax-danger)");
    expect(getSlippageColor(500)).toBe("var(--ax-danger)");
  });
});

describe("formatSlippagePct", () => {
  it("formats with no decimal places and % suffix", () => {
    expect(formatSlippagePct(150.7)).toBe("151%");
    expect(formatSlippagePct(200)).toBe("200%");
    expect(formatSlippagePct(0)).toBe("0%");
  });
});
