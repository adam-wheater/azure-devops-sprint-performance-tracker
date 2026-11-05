import * as React from "react";
import { SprintMemberEffort, SprintTeamTotals, ThresholdSettings } from "../models/interfaces";
import {
  formatPercentage,
  formatDecimal,
  formatHours,
  getPerformanceColor,
  getTrendDirection,
  getTrendArrow,
} from "../utils/formatting";
import { getCellDisplayState } from "../utils/cellHelpers";
import { UTILIZATION_UNDERPLANNED_THRESHOLD } from "../utils/constants";
import { Pill } from "./ui";

const CELL_STYLE: React.CSSProperties = { verticalAlign: "top", minWidth: 150 };
const KV_STYLE: React.CSSProperties = { margin: 0, fontSize: 12.5 };

/** One label and value pair inside a cell; `color` is a design token for the value. */
const Row: React.FC<{
  label: string;
  color?: string;
  strong?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ label, color, strong, title, children }) => (
  <>
    <dt>{label}</dt>
    <dd style={{ color, fontWeight: strong ? 700 : undefined }} title={title}>
      {children}
    </dd>
  </>
);

interface MemberCellProps {
  data: SprintMemberEffort | null;
  rowType: "effort" | "hours";
  previousSprintData?: SprintMemberEffort | null;
  thresholds?: ThresholdSettings;
}

export const PerformanceCell: React.FC<MemberCellProps> = ({
  data,
  rowType,
  previousSprintData,
  thresholds,
}) => {
  if (!data) {
    return (
      <td className="ax-muted" style={CELL_STYLE}>
        --
      </td>
    );
  }

  const displayState = getCellDisplayState(data);
  const daysOffTitle = `Team days off: ${displayState.teamDaysOff} | Personal days off: ${displayState.personalDaysOff}`;

  if (displayState.isOnHoliday) {
    return (
      <td style={CELL_STYLE}>
        <Pill tone="info">On Holiday</Pill>
        <div className="ax-fine" title={daysOffTitle}>
          {displayState.totalDaysOff} days off
        </div>
      </td>
    );
  }

  if (rowType === "effort") {
    const showTrend = !!previousSprintData && previousSprintData.workingDays > 0;
    const trendDir = showTrend
      ? getTrendDirection(data.effortPerformancePct, previousSprintData!.effortPerformancePct)
      : null;
    return (
      <td
        style={CELL_STYLE}
        title={`Working days: ${data.workingDays} | Assigned: ${data.totalEffortAssigned} pts | Target: ${data.effortTarget}/day`}
      >
        <dl className="ax-kv" style={KV_STYLE}>
          {displayState.showDaysOff && (
            <Row label="Days off" title={daysOffTitle}>
              {displayState.totalDaysOff}
            </Row>
          )}
          <Row label="PBIs">
            {data.pbiCountCompleted}/{data.pbiCountTotal}
          </Row>
          <Row label="Bugs">
            {data.bugCountCompleted}/{data.bugCountTotal}
          </Row>
          <Row label="Completed">{formatDecimal(data.totalEffortCompleted)} pts</Row>
          <Row label="Per day">{formatDecimal(data.effortPerDay, 2)}</Row>
          <Row
            label="Perf"
            strong
            color={getPerformanceColor(data.effortPerformancePct, thresholds)}
          >
            {formatPercentage(data.effortPerformancePct)}{" "}
            {showTrend && (
              <span
                className={`ax-delta ax-delta--${trendDir}`}
                title={`${trendDir === "flat" ? "Level with" : trendDir === "up" ? "Up on" : "Down on"} the previous sprint`}
              >
                {getTrendArrow(data.effortPerformancePct, previousSprintData!.effortPerformancePct)}
              </span>
            )}
          </Row>
          <Row
            label="Done"
            strong
            color={getPerformanceColor(data.effortCompletionPct, thresholds)}
          >
            {formatPercentage(data.effortCompletionPct)}
          </Row>
        </dl>
      </td>
    );
  }

  const underplannedThreshold =
    thresholds?.utilizationUnderplannedThreshold ?? UTILIZATION_UNDERPLANNED_THRESHOLD;

  // Prorate available hours by sprint progress so members aren't flagged
  // as under-planned early in a sprint when tasks are still being assigned.
  let isUnderplanned = false;
  if (data.availableHours > 0 && data.sprintProgress > 0) {
    const proratedAvailable = data.availableHours * data.sprintProgress;
    const planningPct =
      proratedAvailable > 0 ? (data.totalOriginalEstimate / proratedAvailable) * 100 : 0;
    isUnderplanned = planningPct < underplannedThreshold;
  }
  return (
    <td
      style={CELL_STYLE}
      title={`Available: ${formatHours(data.availableHours)} | Capacity: ${formatHours(data.capacityHoursPerDay)}/day | Working days: ${data.workingDays}`}
    >
      {isUnderplanned && (
        <div style={{ marginBottom: 4 }}>
          <Pill tone="warn">Under-planned</Pill>
        </div>
      )}
      <dl className="ax-kv" style={KV_STYLE}>
        <Row label="Planned">
          {formatHours(data.totalOriginalEstimate)} / {formatHours(data.availableHours)}
        </Row>
        <Row label="Done">{formatHours(data.totalCompletedWork)}</Row>
        <Row label="Remaining">{formatHours(data.totalRemainingWork)}</Row>
        <Row label="Est/Act">{formatDecimal(data.estimatedVsActualRatio, 2)}</Row>
        <Row label="Util" strong color={getPerformanceColor(data.hoursUtilizationPct, thresholds)}>
          {formatPercentage(data.hoursUtilizationPct)}
        </Row>
      </dl>
    </td>
  );
};

interface TotalsCellProps {
  data: SprintTeamTotals | null;
  rowType: "effort" | "hours";
  thresholds?: ThresholdSettings;
}

export const TeamTotalsCell: React.FC<TotalsCellProps> = ({ data, rowType, thresholds }) => {
  if (!data) {
    return (
      <td className="ax-muted" style={CELL_STYLE}>
        --
      </td>
    );
  }

  if (rowType === "effort") {
    return (
      <td style={CELL_STYLE}>
        <dl className="ax-kv" style={KV_STYLE}>
          <Row label="Completed">{formatDecimal(data.totalEffortCompleted)} pts</Row>
          <Row label="Avg/day">{formatDecimal(data.avgEffortPerDay, 2)}</Row>
          <Row
            label="Perf"
            strong
            color={getPerformanceColor(data.avgEffortPerformancePct, thresholds)}
          >
            {formatPercentage(data.avgEffortPerformancePct)}
          </Row>
          <Row
            label="Done"
            strong
            color={getPerformanceColor(data.effortCompletionPct, thresholds)}
          >
            {formatPercentage(data.effortCompletionPct)}
          </Row>
        </dl>
      </td>
    );
  }

  return (
    <td style={CELL_STYLE}>
      <dl className="ax-kv" style={KV_STYLE}>
        <Row label="Est">{formatHours(data.totalOriginalEstimate)}</Row>
        <Row label="Done">{formatHours(data.totalCompletedWork)}</Row>
        <Row label="Remaining">{formatHours(data.totalRemainingWork)}</Row>
        <Row label="Est/Act">{formatDecimal(data.estimatedVsActualRatio, 2)}</Row>
        <Row label="Util" strong color={getPerformanceColor(data.hoursUtilizationPct, thresholds)}>
          {formatPercentage(data.hoursUtilizationPct)}
        </Row>
      </dl>
    </td>
  );
};
