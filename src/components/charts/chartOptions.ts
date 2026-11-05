import { DailyPoint } from "../../models/interfaces";
import { formatDayLabel, formatDayLabelLong } from "../../utils/timeSeries";
import { lightTheme, ThemeColors } from "../../utils/theme";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  points: DailyPoint[];
  /**
   * "bars" renders daily columns, "line" a smoothed trend line. A series marked
   * `isTrend` is a smoothing of another series rather than data in its own
   * right, so its values are shown to one decimal.
   */
  mark: "bars" | "line";
  isTrend?: boolean;
}

/**
 * Chart chrome colours. Taken from the active palette in src/utils/theme.ts,
 * which mirrors the `--ax-*` tokens in src/styles/app.css, so the charts follow
 * light, dark and high contrast. ECharts needs concrete colour strings (it
 * blends them), which is why these are not `var(--ax-*)` references.
 */
export interface ChartTheme {
  text: string;
  textMuted: string;
  axisLine: string;
  splitLine: string;
  surface: string;
  tooltipBackground: string;
  tooltipBorder: string;
  zoomFill: string;
}

export function chartThemeFrom(colors: ThemeColors): ChartTheme {
  return {
    text: colors.textPrimary,
    textMuted: colors.textMuted,
    axisLine: colors.borderInput,
    splitLine: colors.borderDefault,
    surface: colors.bgSurface,
    tooltipBackground: colors.bgSurface,
    tooltipBorder: colors.borderDefault,
    zoomFill: colors.bgSurfaceAlt,
  };
}

export const DEFAULT_CHART_THEME: ChartTheme = chartThemeFrom(lightTheme);

export interface BuildOptionArgs {
  series: ChartSeries[];
  theme?: ChartTheme;
  /** Enables the zoom slider and wheel zoom. */
  zoomable?: boolean;
  /**
   * Initial zoom window as a percentage of the series, e.g. 70 shows the most
   * recent 30%. Defaults to the whole range.
   */
  zoomStartPercent?: number;
  valueSuffix?: string;
}

const BAR_MAX_WIDTH = 24;
const BAR_CORNER_RADIUS = 3;
const LINE_WIDTH = 2;

/** Escapes text interpolated into the tooltip's HTML string. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Expands a #rrggbb colour to an rgba() string at the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return hex;
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatSeriesValue(value: number, isTrend: boolean | undefined): string {
  if (isTrend) return value.toFixed(1);
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

interface TooltipParam {
  axisValue?: string;
  seriesName?: string;
  value?: number | string;
  color?: string;
  seriesIndex?: number;
}

/**
 * Builds the tooltip body: the day, then one row per series with a short
 * stroke of the series colour, the value in strong ink, and the label after
 * it. Every string that reaches the HTML is escaped.
 */
export function buildTooltipHtml(
  params: TooltipParam[],
  series: ChartSeries[],
  theme: ChartTheme,
  valueSuffix: string
): string {
  if (params.length === 0) return "";

  const dayKey = params[0].axisValue ?? "";
  const heading = `<div style="font-size:11px;font-weight:600;color:${theme.textMuted};margin-bottom:4px">${escapeHtml(
    formatDayLabelLong(dayKey)
  )}</div>`;

  const rows = params
    .map((param) => {
      const definition = series[param.seriesIndex ?? 0];
      const numeric = typeof param.value === "number" ? param.value : Number(param.value);
      const value = Number.isFinite(numeric)
        ? formatSeriesValue(numeric, definition?.isTrend)
        : "—";
      const key = `<span style="display:inline-block;width:10px;height:2px;border-radius:1px;background:${escapeHtml(
        param.color ?? "#000"
      )};margin-right:6px;vertical-align:middle"></span>`;
      const strong = `<span style="font-weight:600;color:${theme.text};font-variant-numeric:tabular-nums">${escapeHtml(
        value + valueSuffix
      )}</span>`;
      const label = `<span style="color:${theme.textMuted};margin-left:6px">${escapeHtml(
        param.seriesName ?? ""
      )}</span>`;
      return `<div style="font-size:12px;line-height:1.7;white-space:nowrap">${key}${strong}${label}</div>`;
    })
    .join("");

  return heading + rows;
}

/**
 * Builds the full ECharts option for a daily time series.
 *
 * Kept as a pure function so the whole chart configuration — axes, zoom
 * window, tooltip contents, series marks — is unit-testable without mounting
 * a chart or a canvas.
 */
export function buildTimeSeriesOption({
  series,
  theme = DEFAULT_CHART_THEME,
  zoomable = true,
  zoomStartPercent = 0,
  valueSuffix = "",
}: BuildOptionArgs): Record<string, any> {
  // Every series shares the day axis, so the longest one defines it.
  let dayKeys: string[] = [];
  for (const entry of series) {
    if (entry.points.length > dayKeys.length) {
      dayKeys = entry.points.map((point) => point.date);
    }
  }

  const showLegend = series.length >= 2;
  const showZoom = zoomable && dayKeys.length > 1;

  const echartsSeries = series.map((entry) => {
    const values = entry.points.map((point) => point.value);

    if (entry.mark === "bars") {
      return {
        id: entry.key,
        name: entry.label,
        type: "bar",
        data: values,
        barMaxWidth: BAR_MAX_WIDTH,
        // Rounded data-end, square at the baseline.
        itemStyle: {
          color: entry.color,
          borderRadius: [BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0],
        },
        emphasis: { focus: "series", itemStyle: { color: entry.color, opacity: 0.78 } },
        animationDuration: 420,
      };
    }

    return {
      id: entry.key,
      name: entry.label,
      type: "line",
      data: values,
      // A touch of smoothing reads as a trend without inventing values.
      smooth: 0.25,
      symbol: "circle",
      symbolSize: 8,
      showSymbol: false,
      lineStyle: { width: LINE_WIDTH, color: entry.color, cap: "round", join: "round" },
      itemStyle: { color: entry.color, borderColor: theme.surface, borderWidth: 2 },
      // A single line gets a wash underneath; stacked lines would muddy it.
      areaStyle:
        series.length === 1
          ? {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: withAlpha(entry.color, 0.22) },
                  { offset: 1, color: withAlpha(entry.color, 0.02) },
                ],
              },
            }
          : undefined,
      emphasis: { focus: "series" },
      animationDuration: 420,
    };
  });

  return {
    // ECharts' own generated description; the table view remains the real
    // equivalent-access path for the numbers.
    aria: { enabled: true, decal: { show: false } },
    animationEasing: "cubicOut",
    textStyle: { color: theme.text },
    grid: {
      left: 8,
      right: 12,
      top: showLegend ? 34 : 12,
      bottom: showZoom ? 54 : 8,
      containLabel: true,
    },
    legend: showLegend
      ? {
          show: true,
          top: 0,
          left: 0,
          itemGap: 18,
          itemWidth: 14,
          itemHeight: 10,
          textStyle: { color: theme.textMuted, fontSize: 12 },
          // Plain names, no icon override: ECharts then derives each key from
          // its series type, so a line gets a stroke and a bar gets a block.
          // A custom `path://` icon measures as zero-width and stacks the
          // entries on top of each other.
          data: series.map((entry) => entry.label),
        }
      : { show: false },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "line",
        lineStyle: { color: theme.axisLine, width: 1 },
        // Snap to a day so the reader aims at a date, not a hairline.
        snap: true,
      },
      backgroundColor: theme.tooltipBackground,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      padding: [8, 10],
      extraCssText: "box-shadow: 0 2px 8px rgba(0,0,0,0.16); border-radius: 4px;",
      formatter: (params: TooltipParam | TooltipParam[]) =>
        buildTooltipHtml(Array.isArray(params) ? params : [params], series, theme, valueSuffix),
    },
    xAxis: {
      type: "category",
      data: dayKeys,
      boundaryGap: true,
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 11,
        hideOverlap: true,
        formatter: (value: string) => formatDayLabel(value),
      },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.textMuted, fontSize: 11 },
      // Hairline, solid, recessive — never dashed.
      splitLine: { lineStyle: { color: theme.splitLine, width: 1, type: "solid" } },
    },
    dataZoom: showZoom
      ? [
          // Wheel, pinch and drag inside the plot.
          { type: "inside", start: zoomStartPercent, end: 100, zoomOnMouseWheel: true },
          {
            type: "slider",
            start: zoomStartPercent,
            end: 100,
            height: 22,
            bottom: 8,
            borderColor: theme.splitLine,
            backgroundColor: theme.zoomFill,
            fillerColor: withAlpha(series[0]?.color ?? lightTheme.chart[0], 0.12),
            handleStyle: { color: theme.surface, borderColor: theme.axisLine },
            moveHandleSize: 4,
            textStyle: { color: theme.textMuted, fontSize: 10 },
            labelFormatter: (_index: number, value: string) => formatDayLabel(value),
          },
        ]
      : [],
    series: echartsSeries,
  };
}
