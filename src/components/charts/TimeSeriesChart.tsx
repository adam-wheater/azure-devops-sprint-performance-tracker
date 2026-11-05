import * as React from "react";
import { useRef, useEffect, useMemo, useCallback } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { useTheme } from "../../utils/theme";
import { EmptyState } from "../ui";
import { buildTimeSeriesOption, ChartSeries, chartThemeFrom } from "./chartOptions";

export type { ChartSeries } from "./chartOptions";

// Registered once per module rather than per mount. Only the pieces the
// department charts actually use are pulled in, so the bundle does not carry
// the whole of ECharts.
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
  SVGRenderer,
]);

interface Props {
  series: ChartSeries[];
  /** Describes the whole chart for screen readers. */
  ariaLabel: string;
  height?: number;
  valueSuffix?: string;
  emptyMessage?: string;
}

const DEFAULT_HEIGHT = 300;
const FALLBACK_WIDTH = 720;

/**
 * Daily time-series chart backed by ECharts: hover crosshair with a combined
 * tooltip, wheel/pinch/drag zoom plus a range slider, and a legend.
 *
 * The chart is a canvas-style visual even under the SVG renderer, so it is not
 * itself readable by a screen reader. Arrow keys drive the tooltip for keyboard
 * users, and every card that hosts a chart also offers a table view carrying
 * the same numbers.
 */
export const TimeSeriesChart: React.FC<Props> = ({
  series,
  ariaLabel,
  height = DEFAULT_HEIGHT,
  valueSuffix = "",
  emptyMessage = "No activity in this range.",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const focusedIndexRef = useRef<number | null>(null);
  const colors = useTheme();
  const theme = useMemo(() => chartThemeFrom(colors), [colors]);

  const dayCount = useMemo(
    () => series.reduce((max, entry) => Math.max(max, entry.points.length), 0),
    [series]
  );

  const hasSeries = dayCount > 0;

  // Create the instance once; option updates are a separate effect so that
  // re-rendering with new data never tears down and rebuilds the chart (which
  // would drop the reader's current zoom window).
  useEffect(() => {
    const element = containerRef.current;
    if (!element || !hasSeries) return;

    const chart = echarts.init(element, undefined, {
      renderer: "svg",
      width: element.clientWidth || FALLBACK_WIDTH,
      height,
    });
    chartRef.current = chart;

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        // Ignore a collapsed subtree (hidden tab) so the chart keeps its size.
        if (element.clientWidth > 0) chart.resize({ width: element.clientWidth, height });
      });
      observer.observe(element);
    }

    return () => {
      observer?.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [hasSeries, height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.setOption(
      buildTimeSeriesOption({
        series,
        theme,
        valueSuffix,
      }),
      // Replace the series wholesale so a shorter range cannot leave stale
      // points behind, but keep the instance (and its zoom state) alive.
      { replaceMerge: ["series", "dataZoom"] }
    );
  }, [series, theme, valueSuffix]);

  // Keyboard parity with the pointer: step the tooltip along the days.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const chart = chartRef.current;
      if (!chart || dayCount === 0) return;

      const showAt = (index: number) => {
        focusedIndexRef.current = index;
        chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
      };

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const current = focusedIndexRef.current;
        const base = current ?? (event.key === "ArrowRight" ? -1 : dayCount);
        const next = event.key === "ArrowRight" ? base + 1 : base - 1;
        showAt(Math.min(dayCount - 1, Math.max(0, next)));
      } else if (event.key === "Home") {
        event.preventDefault();
        showAt(0);
      } else if (event.key === "End") {
        event.preventDefault();
        showAt(dayCount - 1);
      } else if (event.key === "Escape") {
        focusedIndexRef.current = null;
        chart.dispatchAction({ type: "hideTip" });
      }
    },
    [dayCount]
  );

  const handleBlur = useCallback(() => {
    focusedIndexRef.current = null;
    chartRef.current?.dispatchAction({ type: "hideTip" });
  }, []);

  if (!hasSeries) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div
      tabIndex={0}
      role="application"
      aria-label={`${ariaLabel}. Use arrow keys to read individual days, or the table view for all values.`}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <div ref={containerRef} style={{ height }} />
    </div>
  );
};
