import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ProjectContext, DepartmentStatsData, DailyPoint } from "../models/interfaces";
import { DepartmentStatsService } from "../services/DepartmentStatsService";
import { TimeSeriesChart, ChartSeries } from "./charts/TimeSeriesChart";
import { useTheme } from "../utils/theme";
import { Banner, Button, Card, IconDownload, IconRefresh, Metric, Progress } from "./ui";
import {
  bucketByDay,
  movingAverage,
  summarizeSeries,
  formatDayLabel,
  formatDayLabelLong,
} from "../utils/timeSeries";
import { escapeCsvField } from "../utils/csvExport";
import {
  DEPT_STATS_RANGE_PRESETS,
  DEPT_STATS_DEFAULT_RANGE_DAYS,
  DEPT_STATS_TREND_WINDOW_DAYS,
} from "../utils/constants";

interface Props {
  project: ProjectContext;
}

/** PullRequestStatus.Completed */
const PR_STATUS_COMPLETED = 3;

function rangeLabel(days: number): string {
  if (days % 30 === 0 && days >= 60) {
    const months = days / 30;
    return `${months} months`;
  }
  return `${days} days`;
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  series: ChartSeries[];
  ariaLabel: string;
  tableColumns: string[];
  tableRows: (string | number)[][];
  csvName: string;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  series,
  ariaLabel,
  tableColumns,
  tableRows,
  csvName,
}) => {
  const [showTable, setShowTable] = useState(false);

  const downloadCsv = useCallback(() => {
    const lines = [
      tableColumns.map(escapeCsvField).join(","),
      ...tableRows.map((row) => row.map(escapeCsvField).join(",")),
    ].join("\n");
    const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [tableColumns, tableRows, csvName]);

  return (
    <Card
      title={title}
      hint={subtitle}
      actions={
        <>
          <Button size="sm" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Show chart" : "Show table"}
          </Button>
          <Button size="sm" icon={<IconDownload />} onClick={downloadCsv}>
            Export CSV
          </Button>
        </>
      }
    >
      {showTable ? (
        <div className="ax-table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
          <table className="ax-table">
            <thead>
              <tr>
                {tableColumns.map((column, index) => (
                  <th key={column} className={index === 0 ? undefined : "ax-num"}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={String(row[0])}>
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`} className={index === 0 ? undefined : "ax-num"}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TimeSeriesChart series={series} ariaLabel={ariaLabel} />
      )}
    </Card>
  );
};

export const DepartmentStatsPage: React.FC<Props> = ({ project }) => {
  // Series colours come from the active palette (the `--ax-chart-*` tokens), so
  // the charts follow light, dark and high contrast.
  const { chart: palette } = useTheme();
  const primary = palette[0];
  const secondary = palette[1];
  const [rangeDays, setRangeDays] = useState<number>(DEPT_STATS_DEFAULT_RANGE_DAYS);
  const [data, setData] = useState<DepartmentStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - (rangeDays - 1));
        fromDate.setHours(0, 0, 0, 0);

        const service = new DepartmentStatsService();
        const result = await service.getDepartmentStats(project, fromDate, toDate);
        if (cancelled) return;
        setData(result);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load department stats.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project, rangeDays, refreshKey]);

  const derived = useMemo(() => {
    if (!data) return null;
    const { fromDate, toDate } = data.range;

    const prCreated = bucketByDay(data.pullRequests, (pr) => pr.creationDate, fromDate, toDate);
    const prCompleted = bucketByDay(
      data.pullRequests.filter((pr) => pr.status === PR_STATUS_COMPLETED),
      (pr) => pr.closedDate,
      fromDate,
      toDate
    );
    const commits = bucketByDay(data.commits, (commit) => commit.date, fromDate, toDate);

    const prCreatedTrend = movingAverage(prCreated, DEPT_STATS_TREND_WINDOW_DAYS);
    const prCompletedTrend = movingAverage(prCompleted, DEPT_STATS_TREND_WINDOW_DAYS);
    const commitsTrend = movingAverage(commits, DEPT_STATS_TREND_WINDOW_DAYS);
    const trendLabel = `${DEPT_STATS_TREND_WINDOW_DAYS}-day average`;

    // The chart series are built here rather than inline in the JSX so their
    // identity is tied to the data. A fresh array on every render would push a
    // new option into ECharts and snap the reader's zoom window back out.
    const prSeries: ChartSeries[] = [
      {
        key: "pr-created",
        label: "Opened",
        color: primary,
        points: prCreated,
        mark: "bars",
      },
      {
        key: "pr-created-trend",
        label: trendLabel,
        color: secondary,
        points: prCreatedTrend,
        mark: "line",
        isTrend: true,
      },
    ];

    const commitSeries: ChartSeries[] = [
      {
        key: "commits",
        label: "Commits",
        color: primary,
        points: commits,
        mark: "bars",
      },
      {
        key: "commits-trend",
        label: trendLabel,
        color: secondary,
        points: commitsTrend,
        mark: "line",
        isTrend: true,
      },
    ];

    const throughputSeries: ChartSeries[] = [
      {
        key: "throughput-opened",
        label: "Opened",
        color: primary,
        points: prCreatedTrend,
        mark: "line",
        isTrend: true,
      },
      {
        key: "throughput-completed",
        label: "Completed",
        color: secondary,
        points: prCompletedTrend,
        mark: "line",
        isTrend: true,
      },
    ];

    return {
      prCreated,
      prCompleted,
      prCreatedTrend,
      commits,
      commitsTrend,
      prSeries,
      commitSeries,
      throughputSeries,
      prSummary: summarizeSeries(prCreated),
      commitSummary: summarizeSeries(commits),
      uniqueAuthors: new Set(data.commits.map((c) => c.authorEmail).filter(Boolean)).size,
      uniquePrAuthors: new Set(data.pullRequests.map((p) => p.createdByEmail).filter(Boolean)).size,
      completedCount: data.pullRequests.filter((pr) => pr.status === PR_STATUS_COMPLETED).length,
    };
  }, [data, primary, secondary]);

  const buildDailyRows = (
    points: DailyPoint[],
    extra?: { points: DailyPoint[]; index: number }
  ): (string | number)[][] =>
    points.map((point, index) => {
      const row: (string | number)[] = [formatDayLabelLong(point.date), point.value];
      if (extra) row.push(Number(extra.points[index]?.value.toFixed(2) ?? 0));
      return row;
    });

  return (
    <div>
      <p className="ax-help">
        Delivery activity across every repository in the project, bucketed by day. The range control
        scopes every chart and tile below it, so the numbers always agree.
      </p>

      <div className="ax-toolbar">
        <div className="ax-toolbar__group">
          <span className="ax-label" id="dept-range-label">
            Range
          </span>
          <div className="ax-segmented" role="group" aria-labelledby="dept-range-label">
            {DEPT_STATS_RANGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={rangeDays === preset}
                onClick={() => setRangeDays(preset)}
              >
                Last {rangeLabel(preset)}
              </button>
            ))}
          </div>
        </div>
        <Button
          icon={<IconRefresh />}
          busy={loading}
          onClick={() => setRefreshKey((k) => k + 1)}
          title="Refresh data"
        >
          Refresh
        </Button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {loading && !data && <Progress label="Loading department stats..." indeterminate />}

      {data && derived && (
        <div
          style={{
            opacity: loading ? 0.6 : 1,
            transition: "opacity var(--ax-base) var(--ax-ease)",
          }}
        >
          {(data.pullRequestsTruncated ||
            data.truncatedRepositories.length > 0 ||
            data.failedRepositories.length > 0) && (
            <Banner tone="warn">
              {data.pullRequestsTruncated && "Pull request history hit the fetch limit. "}
              {data.truncatedRepositories.length > 0 &&
                `Commit history was capped for: ${data.truncatedRepositories.join(", ")}. `}
              {data.failedRepositories.length > 0 &&
                `Failed to load: ${data.failedRepositories.join(", ")}. `}
              Totals below are a lower bound.
            </Banner>
          )}

          <div className="ax-metrics">
            <Metric
              label="Pull requests opened"
              value={derived.prSummary.total.toLocaleString()}
              hint={`${derived.prSummary.weekdayAverage.toFixed(1)} per weekday`}
            />
            <Metric
              label="Pull requests completed"
              value={derived.completedCount.toLocaleString()}
              hint={`${derived.uniquePrAuthors} contributors`}
            />
            <Metric
              label="Commits"
              value={derived.commitSummary.total.toLocaleString()}
              hint={`${derived.commitSummary.weekdayAverage.toFixed(1)} per weekday`}
            />
            <Metric
              label="Commit authors"
              value={String(derived.uniqueAuthors)}
              hint={`across ${data.repositoryCount} repositories`}
            />
            <Metric
              label="Busiest day"
              value={
                derived.commitSummary.peakDate
                  ? formatDayLabel(derived.commitSummary.peakDate)
                  : "\u2014"
              }
              hint={`${derived.commitSummary.peakValue} commits`}
            />
          </div>

          <ChartCard
            title="Pull requests per day"
            subtitle={`Opened each day over the last ${rangeLabel(rangeDays)}, with a ${DEPT_STATS_TREND_WINDOW_DAYS}-day rolling average.`}
            ariaLabel={`Pull requests opened per day over the last ${rangeLabel(rangeDays)}. ${derived.prSummary.total} total, averaging ${derived.prSummary.weekdayAverage.toFixed(1)} per weekday.`}
            series={derived.prSeries}
            tableColumns={[
              "Day",
              "Pull requests opened",
              `${DEPT_STATS_TREND_WINDOW_DAYS}-day avg`,
            ]}
            tableRows={buildDailyRows(derived.prCreated, {
              points: derived.prCreatedTrend,
              index: 0,
            })}
            csvName={`pull-requests-per-day-${rangeDays}d.csv`}
          />

          <ChartCard
            title="Commits per day"
            subtitle={`Authored each day over the last ${rangeLabel(rangeDays)}, with a ${DEPT_STATS_TREND_WINDOW_DAYS}-day rolling average.`}
            ariaLabel={`Commits per day over the last ${rangeLabel(rangeDays)}. ${derived.commitSummary.total} total, averaging ${derived.commitSummary.weekdayAverage.toFixed(1)} per weekday.`}
            series={derived.commitSeries}
            tableColumns={["Day", "Commits", `${DEPT_STATS_TREND_WINDOW_DAYS}-day avg`]}
            tableRows={buildDailyRows(derived.commits, {
              points: derived.commitsTrend,
              index: 0,
            })}
            csvName={`commits-per-day-${rangeDays}d.csv`}
          />

          <ChartCard
            title="Pull request throughput"
            subtitle={`Opened versus completed each day over the last ${rangeLabel(rangeDays)}. A widening gap means review is falling behind.`}
            ariaLabel={`Pull requests opened compared with completed per day over the last ${rangeLabel(rangeDays)}.`}
            series={derived.throughputSeries}
            tableColumns={["Day", "Opened", "Completed"]}
            tableRows={derived.prCreated.map((point, index) => [
              formatDayLabelLong(point.date),
              point.value,
              derived.prCompleted[index]?.value ?? 0,
            ])}
            csvName={`pr-throughput-${rangeDays}d.csv`}
          />
        </div>
      )}
    </div>
  );
};
