import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { ProjectContext } from "../models/interfaces";
import { DeveloperActivityService } from "../services/DeveloperActivityService";
import { SprintLookbackControl } from "./SprintLookbackControl";
import { Banner, Button, Card, EmptyState, IconRefresh, Progress, SortHeader } from "./ui";
import { MemberName } from "./MemberBits";

interface DeveloperActivityPageProps {
  project: ProjectContext;
  lookback: number;
  onLookbackChange: (value: number) => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface DeveloperTotals {
  commitCount: number;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  pipelinesTriggered: number;
}

interface DeveloperRow {
  email: string;
  displayName: string;
  imageUrl?: string;
  totals: DeveloperTotals;
}

type SortKey = "developer" | "commits" | "files" | "pipelines";

const sortValue = (row: DeveloperRow, key: SortKey): string | number => {
  switch (key) {
    case "developer":
      return row.displayName.toLowerCase();
    case "commits":
      return row.totals.commitCount;
    case "files":
      return row.totals.filesAdded + row.totals.filesModified + row.totals.filesDeleted;
    default:
      return row.totals.pipelinesTriggered;
  }
};

const ActivityTotalsTable: React.FC<{
  developers: DeveloperRow[];
  dateRange?: string;
}> = ({ developers, dateRange }) => {
  // No sort is active until a header is clicked: rows keep the order the service returned.
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return developers;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...developers].sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      if (left === right) return 0;
      return (left < right ? -1 : 1) * factor;
    });
  }, [developers, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "developer" ? "asc" : "desc" }
    );

  if (developers.length === 0) {
    return <EmptyState title="No commit or pipeline activity found for the selected range." />;
  }

  const header = (key: SortKey, label: string, numeric = true) => (
    <SortHeader
      label={label}
      active={sort?.key === key}
      direction={sort?.direction ?? "desc"}
      onClick={() => toggle(key)}
      numeric={numeric}
    />
  );

  return (
    <>
      <p className="ax-help">
        File counts show files added (+), modified (~), or deleted (-) for the selected time range.
        Pipelines shows runs triggered by each developer.
      </p>
      <div className="ax-table-wrap">
        <table
          className="ax-table"
          aria-label={`Developer activity${dateRange ? ` ${dateRange}` : ""}`}
        >
          <thead>
            <tr>
              {header("developer", "Developer", false)}
              {header("commits", "Commits")}
              {header("files", "Files changed")}
              {header("pipelines", "Pipelines")}
            </tr>
          </thead>
          <tbody>
            {rows.map((dev) => {
              const totalFiles =
                dev.totals.filesAdded + dev.totals.filesModified + dev.totals.filesDeleted;
              return (
                <tr key={dev.email}>
                  <td>
                    <MemberName name={dev.displayName} imageUrl={dev.imageUrl} detail={dev.email} />
                  </td>
                  <td className="ax-num">{dev.totals.commitCount}</td>
                  <td className="ax-num">
                    {totalFiles === 0 ? (
                      <span className="ax-muted">{"—"}</span>
                    ) : (
                      <>
                        {dev.totals.filesAdded > 0 && (
                          <span style={{ color: "var(--ax-success)" }} title="Files added">
                            +{dev.totals.filesAdded}{" "}
                          </span>
                        )}
                        {dev.totals.filesModified > 0 && (
                          <span style={{ color: "var(--ax-info)" }} title="Files modified">
                            ~{dev.totals.filesModified}{" "}
                          </span>
                        )}
                        {dev.totals.filesDeleted > 0 && (
                          <span style={{ color: "var(--ax-danger)" }} title="Files deleted">
                            -{dev.totals.filesDeleted}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="ax-num">{dev.totals.pipelinesTriggered}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export const DeveloperActivityPage: React.FC<DeveloperActivityPageProps> = ({
  project,
  lookback,
  onLookbackChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [developers, setDevelopers] = useState<DeveloperRow[]>([]);
  const [dateRange, setDateRange] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchTotals() {
      if (!project) return;
      setLoading(true);
      setError(null);
      try {
        const service = new DeveloperActivityService();
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - lookback * 14);
        const result = await service.getDeveloperActivityForRange(project, startDate, endDate);
        // Discard results from a superseded request so a slow earlier fetch
        // can't overwrite the data for the range currently selected.
        if (cancelled) return;
        setDateRange(`${formatDate(startDate)} to ${formatDate(endDate)}`);
        setDevelopers(result.developers);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load developer activity totals.";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTotals();

    return () => {
      cancelled = true;
    };
  }, [project, lookback, refreshKey]);

  return (
    <div>
      <div className="ax-toolbar">
        <SprintLookbackControl value={lookback} onChange={onLookbackChange} />
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
      {loading && <Progress label="Loading developer activity..." indeterminate />}

      {!loading && !error && developers && (
        <Card
          title="Developer activity"
          hint={
            dateRange ? `Totals for ${dateRange}` : "Commits, files and pipeline runs per developer"
          }
        >
          <ActivityTotalsTable developers={developers} dateRange={dateRange} />
        </Card>
      )}
    </div>
  );
};
