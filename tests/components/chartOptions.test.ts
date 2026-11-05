import {
  buildTimeSeriesOption,
  buildTooltipHtml,
  escapeHtml,
  withAlpha,
  formatSeriesValue,
  DEFAULT_CHART_THEME,
  chartThemeFrom,
  ChartSeries,
} from "@/components/charts/chartOptions";
import { DailyPoint } from "@/models/interfaces";
import { darkTheme, lightTheme } from "@/utils/theme";

function makePoints(values: number[]): DailyPoint[] {
  return values.map((value, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
}

const barSeries: ChartSeries = {
  key: "commits",
  label: "Commits",
  color: "#0078d4",
  points: makePoints([3, 0, 7, 2, 5]),
  mark: "bars",
};

const trendSeries: ChartSeries = {
  key: "trend",
  label: "7-day average",
  color: "#107c10",
  points: makePoints([3, 1.5, 3.3, 3, 3.4]),
  mark: "line",
  isTrend: true,
};

describe("escapeHtml", () => {
  it("neutralises markup in interpolated text", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("escapes ampersands before other entities", () => {
    expect(escapeHtml("Tom & <Jerry>")).toBe("Tom &amp; &lt;Jerry&gt;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Commits per day")).toBe("Commits per day");
  });
});

describe("withAlpha", () => {
  it("converts a hex colour to rgba", () => {
    expect(withAlpha("#0078d4", 0.2)).toBe("rgba(0, 120, 212, 0.2)");
  });

  it("accepts a hex value without the hash", () => {
    expect(withAlpha("107c10", 1)).toBe("rgba(16, 124, 16, 1)");
  });

  it("returns the input unchanged when it is not a hex colour", () => {
    expect(withAlpha("currentColor", 0.5)).toBe("currentColor");
  });
});

describe("formatSeriesValue", () => {
  it("shows whole counts without decimals", () => {
    expect(formatSeriesValue(7, false)).toBe("7");
  });

  it("shows a trend value to one decimal", () => {
    expect(formatSeriesValue(3, true)).toBe("3.0");
  });

  it("groups thousands", () => {
    expect(formatSeriesValue(1559, false)).toBe((1559).toLocaleString());
  });
});

describe("buildTooltipHtml", () => {
  const params = [
    { axisValue: "2026-08-03", seriesName: "Commits", value: 7, color: "#0078d4", seriesIndex: 0 },
    {
      axisValue: "2026-08-03",
      seriesName: "7-day average",
      value: 3.25,
      color: "#107c10",
      seriesIndex: 1,
    },
  ];

  it("reports every series at the hovered day", () => {
    const html = buildTooltipHtml(params, [barSeries, trendSeries], DEFAULT_CHART_THEME, "");
    expect(html).toContain("Commits");
    expect(html).toContain("7-day average");
    expect(html).toContain("7");
    expect(html).toContain("3.3");
  });

  it("heads the tooltip with the full day label", () => {
    const html = buildTooltipHtml(params, [barSeries, trendSeries], DEFAULT_CHART_THEME, "");
    expect(html).toMatch(/Mon.*3 Aug 2026|Aug.*3.*2026/);
  });

  it("appends the value suffix", () => {
    const html = buildTooltipHtml([params[0]], [barSeries], DEFAULT_CHART_THEME, " commits");
    expect(html).toContain("7 commits");
  });

  it("escapes a series name rather than injecting it as markup", () => {
    const hostile: ChartSeries = { ...barSeries, label: "<script>bad()</script>" };
    const html = buildTooltipHtml(
      [{ ...params[0], seriesName: "<script>bad()</script>" }],
      [hostile],
      DEFAULT_CHART_THEME,
      ""
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an em dash for a missing value", () => {
    const html = buildTooltipHtml(
      [{ ...params[0], value: undefined }],
      [barSeries],
      DEFAULT_CHART_THEME,
      ""
    );
    expect(html).toContain("—");
  });

  it("returns an empty string when there is nothing to report", () => {
    expect(buildTooltipHtml([], [barSeries], DEFAULT_CHART_THEME, "")).toBe("");
  });
});

describe("buildTimeSeriesOption", () => {
  it("maps a bar series to a bar with rounded caps and a width cap", () => {
    const option = buildTimeSeriesOption({ series: [barSeries] });
    expect(option.series).toHaveLength(1);
    expect(option.series[0].type).toBe("bar");
    expect(option.series[0].data).toEqual([3, 0, 7, 2, 5]);
    expect(option.series[0].barMaxWidth).toBe(24);
    expect(option.series[0].itemStyle.borderRadius).toEqual([3, 3, 0, 0]);
  });

  it("maps a line series to a 2px line without per-point markers", () => {
    const option = buildTimeSeriesOption({ series: [trendSeries] });
    expect(option.series[0].type).toBe("line");
    expect(option.series[0].lineStyle.width).toBe(2);
    expect(option.series[0].showSymbol).toBe(false);
  });

  it("uses the day keys as the category axis", () => {
    const option = buildTimeSeriesOption({ series: [barSeries] });
    expect(option.xAxis.data).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
  });

  it("takes the axis from the longest series when lengths differ", () => {
    const shorter: ChartSeries = { ...trendSeries, points: makePoints([1, 2]) };
    const option = buildTimeSeriesOption({ series: [shorter, barSeries] });
    expect(option.xAxis.data).toHaveLength(5);
  });

  it("enables wheel zoom and a range slider", () => {
    const option = buildTimeSeriesOption({ series: [barSeries] });
    const types = option.dataZoom.map((zoom: { type: string }) => zoom.type);
    expect(types).toContain("inside");
    expect(types).toContain("slider");
    expect(option.dataZoom[0].zoomOnMouseWheel).toBe(true);
  });

  it("honours an initial zoom window", () => {
    const option = buildTimeSeriesOption({ series: [barSeries], zoomStartPercent: 70 });
    expect(option.dataZoom[0].start).toBe(70);
    expect(option.dataZoom[1].start).toBe(70);
  });

  it("omits zoom when it is turned off", () => {
    const option = buildTimeSeriesOption({ series: [barSeries], zoomable: false });
    expect(option.dataZoom).toEqual([]);
  });

  it("omits zoom for a single-day range where there is nothing to zoom into", () => {
    const single: ChartSeries = { ...barSeries, points: makePoints([4]) };
    const option = buildTimeSeriesOption({ series: [single] });
    expect(option.dataZoom).toEqual([]);
  });

  it("shows a legend only for two or more series", () => {
    expect(buildTimeSeriesOption({ series: [barSeries] }).legend.show).toBe(false);
    const two = buildTimeSeriesOption({ series: [barSeries, trendSeries] });
    expect(two.legend.show).toBe(true);
    expect(two.legend.data).toEqual(["Commits", "7-day average"]);
  });

  it("leaves legend icons to ECharts so each key matches its series type", () => {
    const option = buildTimeSeriesOption({ series: [barSeries, trendSeries] });
    // A custom path icon measures as zero width and stacks the entries.
    expect(option.legend.icon).toBeUndefined();
    expect(option.legend.data.every((item: unknown) => typeof item === "string")).toBe(true);
  });

  it("reserves grid space for the legend and the zoom slider", () => {
    const withBoth = buildTimeSeriesOption({ series: [barSeries, trendSeries] });
    const withNeither = buildTimeSeriesOption({ series: [barSeries], zoomable: false });
    expect(withBoth.grid.top).toBeGreaterThan(withNeither.grid.top);
    expect(withBoth.grid.bottom).toBeGreaterThan(withNeither.grid.bottom);
  });

  it("washes the area under a lone line but not under stacked lines", () => {
    expect(buildTimeSeriesOption({ series: [trendSeries] }).series[0].areaStyle).toBeDefined();
    const paired = buildTimeSeriesOption({ series: [trendSeries, { ...trendSeries, key: "b" }] });
    expect(paired.series[0].areaStyle).toBeUndefined();
  });

  it("uses a solid hairline for gridlines and hides the y axis line", () => {
    const option = buildTimeSeriesOption({ series: [barSeries] });
    expect(option.yAxis.splitLine.lineStyle.type).toBe("solid");
    expect(option.yAxis.splitLine.lineStyle.width).toBe(1);
    expect(option.yAxis.axisLine.show).toBe(false);
  });

  it("keeps the y axis on whole numbers for count data", () => {
    const option = buildTimeSeriesOption({ series: [barSeries] });
    expect(option.yAxis.minInterval).toBe(1);
  });

  it("triggers the tooltip on the axis so one hover reports every series", () => {
    const option = buildTimeSeriesOption({ series: [barSeries, trendSeries] });
    expect(option.tooltip.trigger).toBe("axis");
    expect(option.tooltip.axisPointer.snap).toBe(true);
  });

  it("wires the tooltip formatter to the escaped builder", () => {
    const option = buildTimeSeriesOption({ series: [barSeries] });
    const html = option.tooltip.formatter([
      {
        axisValue: "2026-08-03",
        seriesName: "Commits",
        value: 7,
        color: "#0078d4",
        seriesIndex: 0,
      },
    ]);
    expect(html).toContain("7");
    expect(html).toContain("Commits");
  });

  it("applies the supplied theme colours to the chrome", () => {
    const theme = { ...DEFAULT_CHART_THEME, textMuted: "#abcdef", splitLine: "#123456" };
    const option = buildTimeSeriesOption({ series: [barSeries], theme });
    expect(option.xAxis.axisLabel.color).toBe("#abcdef");
    expect(option.yAxis.splitLine.lineStyle.color).toBe("#123456");
  });

  it("handles an empty series list without throwing", () => {
    const option = buildTimeSeriesOption({ series: [] });
    expect(option.xAxis.data).toEqual([]);
    expect(option.series).toEqual([]);
    expect(option.dataZoom).toEqual([]);
  });
});

describe("chartThemeFrom", () => {
  it("maps the active palette onto the chart chrome", () => {
    const theme = chartThemeFrom(darkTheme);
    expect(theme.text).toBe(darkTheme.textPrimary);
    expect(theme.textMuted).toBe(darkTheme.textMuted);
    expect(theme.axisLine).toBe(darkTheme.borderInput);
    expect(theme.splitLine).toBe(darkTheme.borderDefault);
    expect(theme.surface).toBe(darkTheme.bgSurface);
    expect(theme.tooltipBackground).toBe(darkTheme.bgSurface);
    expect(theme.zoomFill).toBe(darkTheme.bgSurfaceAlt);
  });

  it("makes the light palette the default chart theme", () => {
    expect(DEFAULT_CHART_THEME).toEqual(chartThemeFrom(lightTheme));
  });

  it("gives light and dark charts different ink", () => {
    expect(chartThemeFrom(lightTheme).text).not.toBe(chartThemeFrom(darkTheme).text);
  });
});
