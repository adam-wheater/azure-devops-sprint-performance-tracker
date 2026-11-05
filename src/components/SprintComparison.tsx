import * as React from "react";
import { useState, useMemo } from "react";
import { SprintTeamTotals, SprintBestPracticeData, ThresholdSettings } from "../models/interfaces";
import { formatPercentage, formatDecimal } from "../utils/formatting";
import { EmptyState } from "./ui";

interface Props {
  teamTotals: SprintTeamTotals[];
  bestPracticeData: SprintBestPracticeData[];
  thresholds?: ThresholdSettings;
}

interface MetricRow {
  label: string;
  leftValue: string;
  rightValue: string;
  delta: number;
  deltaLabel: string;
  higherIsBetter: boolean;
}

export const SprintComparison: React.FC<Props> = ({
  teamTotals,
  bestPracticeData,
  thresholds: _thresholds,
}) => {
  const leftId = React.useId();
  const rightId = React.useId();
  const [leftIdx, setLeftIdx] = useState(Math.max(0, teamTotals.length - 2));
  const [rightIdx, setRightIdx] = useState(Math.max(0, teamTotals.length - 1));

  // The selected indices are user state, but teamTotals can shrink underneath them
  // (a refresh with fewer sprints, or a smaller lookback). Clamp on every render so
  // the selectors never point past the end of the array.
  const safeLeftIdx = Math.min(leftIdx, teamTotals.length - 1);
  const safeRightIdx = Math.min(rightIdx, teamTotals.length - 1);
  const left = teamTotals[safeLeftIdx];
  const right = teamTotals[safeRightIdx];

  // NOTE: every hook must run before the "not enough sprints" early return below,
  // otherwise the hook count changes when a team drops to a single sprint.
  const { leftBp, rightBp } = useMemo(
    () => ({
      leftBp: bestPracticeData.find((bp) => bp.sprintId === left?.sprintId),
      rightBp: bestPracticeData.find((bp) => bp.sprintId === right?.sprintId),
    }),
    [bestPracticeData, left?.sprintId, right?.sprintId]
  );

  const metrics = useMemo(() => {
    const rows: MetricRow[] = [];
    if (!left || !right) return rows;

    function add(
      label: string,
      lVal: number,
      rVal: number,
      format: (n: number) => string,
      higherIsBetter: boolean
    ) {
      const delta = rVal - lVal;
      const deltaPct = lVal !== 0 ? (delta / Math.abs(lVal)) * 100 : 0;
      rows.push({
        label,
        leftValue: format(lVal),
        rightValue: format(rVal),
        delta,
        deltaLabel: `${delta >= 0 ? "+" : ""}${format(delta)} (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%)`,
        higherIsBetter,
      });
    }

    const fmtD1 = (n: number) => formatDecimal(n, 1);
    const fmtD2 = (n: number) => formatDecimal(n, 2);
    const fmtP = (n: number) => formatPercentage(n);
    const fmtN = (n: number) => String(Math.round(n));

    add("Effort Assigned", left.totalEffortAssigned, right.totalEffortAssigned, fmtN, true);
    add("Effort Completed", left.totalEffortCompleted, right.totalEffortCompleted, fmtN, true);
    add("Completion %", left.effortCompletionPct, right.effortCompletionPct, fmtP, true);
    add("Avg Effort/Day", left.avgEffortPerDay, right.avgEffortPerDay, fmtD2, true);
    add("Hours Utilization", left.hoursUtilizationPct, right.hoursUtilizationPct, fmtP, true);
    add("Est. Accuracy", left.estimatedVsActualRatio, right.estimatedVsActualRatio, fmtD2, false);
    add("Cycle Time (days)", left.avgCycleTimeDays, right.avgCycleTimeDays, fmtD1, false);
    add("Distribution Score", left.workDistributionScore, right.workDistributionScore, fmtN, true);
    add("PBIs Completed", left.pbiCountCompleted, right.pbiCountCompleted, fmtN, true);
    add("Bugs Completed", left.bugCountCompleted, right.bugCountCompleted, fmtN, true);
    add("Tasks Completed", left.taskCountCompleted, right.taskCountCompleted, fmtN, true);

    if (leftBp && rightBp) {
      add("Health Score", leftBp.healthScore, rightBp.healthScore, fmtN, true);
      add("BP Errors", leftBp.summary.errors, rightBp.summary.errors, fmtN, false);
      add("BP Warnings", leftBp.summary.warnings, rightBp.summary.warnings, fmtN, false);
    }

    return rows;
  }, [left, right, leftBp, rightBp]);

  if (teamTotals.length < 2 || !left || !right) {
    return <EmptyState title="Need at least 2 sprints to compare." />;
  }

  function getDelta(metric: MetricRow): { className: string; glyph: string; label: string } {
    if (metric.delta === 0)
      return { className: "ax-delta--flat", glyph: "\u2015", label: "Unchanged" };
    const isPositive = metric.delta > 0;
    const isGood = metric.higherIsBetter ? isPositive : !isPositive;
    return {
      className: isGood ? "ax-delta--up" : "ax-delta--down",
      glyph: isPositive ? "\u25B2" : "\u25BC",
      label: isGood ? "Improved" : "Regressed",
    };
  }

  return (
    <div>
      <div className="ax-toolbar">
        <div className="ax-toolbar__group">
          <label className="ax-label" htmlFor={leftId}>
            Sprint A
          </label>
          <select
            id={leftId}
            className="ax-select"
            value={safeLeftIdx}
            onChange={(e) => setLeftIdx(Number(e.target.value))}
          >
            {teamTotals.map((t, i) => (
              <option key={t.sprintId} value={i}>
                {t.sprintName}
              </option>
            ))}
          </select>
        </div>
        <span className="ax-muted">vs</span>
        <div className="ax-toolbar__group">
          <label className="ax-label" htmlFor={rightId}>
            Sprint B
          </label>
          <select
            id={rightId}
            className="ax-select"
            value={safeRightIdx}
            onChange={(e) => setRightIdx(Number(e.target.value))}
          >
            {teamTotals.map((t, i) => (
              <option key={t.sprintId} value={i}>
                {t.sprintName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ax-table-wrap">
        <table className="ax-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="ax-num">{left.sprintName}</th>
              <th className="ax-num">{right.sprintName}</th>
              <th className="ax-num">Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const delta = getDelta(m);
              return (
                <tr key={m.label}>
                  <td style={{ fontWeight: 600 }}>{m.label}</td>
                  <td className="ax-num">{m.leftValue}</td>
                  <td className="ax-num">{m.rightValue}</td>
                  <td className="ax-num">
                    <span className={`ax-delta ${delta.className}`} title={delta.label}>
                      <span aria-hidden="true">{delta.glyph}</span> {m.deltaLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
