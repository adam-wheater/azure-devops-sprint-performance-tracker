import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { ChartSeries } from "@/components/charts/chartOptions";
import { DailyPoint } from "@/models/interfaces";
import { darkTheme, lightTheme, THEME_STORAGE_KEY, ThemeProvider } from "@/utils/theme";

// ECharts needs real layout to render, so the subpath entries resolve to the
// shared mock in __mocks__/echarts.ts. The option object the chart receives is
// covered exhaustively in chartOptions.test.ts; here we assert the wrapper's
// contract with ECharts: one instance, option updates without a teardown,
// keyboard actions and disposal.
// Imported by path, not as "echarts/core": the moduleNameMapper resolves the
// component's import to this same file, so both share one module instance,
// while TypeScript still gets the mock's types rather than the real package's.
import { init, __lastInstance, __resetInstances } from "../__mocks__/echarts";

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

describe("TimeSeriesChart", () => {
  beforeEach(() => {
    __resetInstances();
  });

  it("initialises one chart with the SVG renderer", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits per day" />);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][2]).toMatchObject({ renderer: "svg" });
  });

  it("passes the built option through to the chart", () => {
    render(<TimeSeriesChart series={[barSeries, trendSeries]} ariaLabel="Both" />);
    expect(__lastInstance().setOption).toHaveBeenCalledTimes(1);

    const option = __lastInstance().setOption.mock.calls[0][0];
    expect(option.series).toHaveLength(2);
    expect(option.xAxis.data).toHaveLength(5);
    expect(option.dataZoom.length).toBeGreaterThan(0);
  });

  it("updates the option in place rather than recreating the chart", () => {
    const { rerender } = render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    expect(init).toHaveBeenCalledTimes(1);

    rerender(
      <TimeSeriesChart
        series={[{ ...barSeries, points: makePoints([1, 2, 3]) }]}
        ariaLabel="Commits"
      />
    );

    // A rebuild here would silently reset the reader's zoom window.
    expect(init).toHaveBeenCalledTimes(1);
    expect(__lastInstance().dispose).not.toHaveBeenCalled();
    expect(__lastInstance().setOption).toHaveBeenCalledTimes(2);
  });

  it("replaces series wholesale so a shorter range leaves nothing stale", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    expect(__lastInstance().setOption.mock.calls[0][1]).toMatchObject({
      replaceMerge: ["series", "dataZoom"],
    });
  });

  it("disposes the chart on unmount", () => {
    const { unmount } = render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    const instance = __lastInstance();
    unmount();
    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });

  it("exposes the chart and its keyboard affordance to assistive tech", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits per day" />);
    const chart = screen.getByRole("application");
    expect(chart).toHaveAttribute("aria-label", expect.stringContaining("Commits per day"));
    expect(chart).toHaveAttribute("aria-label", expect.stringContaining("arrow keys"));
  });

  it("steps the tooltip along the days with arrow keys", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    const chart = screen.getByRole("application");

    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: 0,
    });

    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: 1,
    });
  });

  it("jumps to the ends with Home and End", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    const chart = screen.getByRole("application");

    fireEvent.keyDown(chart, { key: "End" });
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: 4,
    });

    fireEvent.keyDown(chart, { key: "Home" });
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: 0,
    });
  });

  it("does not step past either end of the series", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    const chart = screen.getByRole("application");

    for (let i = 0; i < 20; i++) fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: 4,
    });

    for (let i = 0; i < 20; i++) fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: 0,
    });
  });

  it("hides the tooltip on Escape and on blur", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    const chart = screen.getByRole("application");

    fireEvent.keyDown(chart, { key: "ArrowRight" });
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({ type: "hideTip" });

    fireEvent.keyDown(chart, { key: "ArrowRight" });
    fireEvent.blur(chart);
    expect(__lastInstance().dispatchAction).toHaveBeenLastCalledWith({ type: "hideTip" });
  });

  it("shows the empty message and creates no chart when there are no days", () => {
    render(
      <TimeSeriesChart
        series={[{ ...barSeries, points: [] }]}
        ariaLabel="Nothing"
        emptyMessage="No commits yet."
      />
    );
    expect(screen.getByText("No commits yet.")).toBeInTheDocument();
    expect(init).not.toHaveBeenCalled();
  });

  it("ignores keyboard input when there is no chart", () => {
    render(<TimeSeriesChart series={[{ ...barSeries, points: [] }]} ariaLabel="Nothing" />);
    expect(screen.queryByRole("application")).toBeNull();
    expect(init).not.toHaveBeenCalled();
  });

  it("draws the chart chrome in the light palette by default", () => {
    render(<TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />);
    const option = __lastInstance().setOption.mock.calls[0][0];
    expect(option.textStyle.color).toBe(lightTheme.textPrimary);
    expect(option.yAxis.splitLine.lineStyle.color).toBe(lightTheme.borderDefault);
  });

  it("follows the dark palette without recreating the chart", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    try {
      render(
        <ThemeProvider>
          <TimeSeriesChart series={[barSeries]} ariaLabel="Commits" />
        </ThemeProvider>
      );
      const option = __lastInstance().setOption.mock.lastCall![0];
      expect(option.textStyle.color).toBe(darkTheme.textPrimary);
      expect(option.yAxis.axisLabel.color).toBe(darkTheme.textMuted);
      expect(init).toHaveBeenCalledTimes(1);
    } finally {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  });
});
