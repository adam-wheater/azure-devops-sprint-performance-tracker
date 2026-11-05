import * as React from "react";
import { TeamSummaryStats, SprintTeamTotals, ThresholdSettings } from "../models/interfaces";
import {
  formatPercentage,
  formatDecimal,
  getPerformanceColor,
  getPerformanceTone,
  getEffortPerDayTone,
} from "../utils/formatting";
import { Metric } from "./ui";
import { Sparkline } from "./Sparkline";

export interface StatTrends {
  velocity: number[];
  completion: number[];
  utilization: number[];
}

interface Props {
  stats: TeamSummaryStats;
  /** Per-sprint totals (oldest first); the trend lines are drawn from these. */
  teamTotals?: SprintTeamTotals[];
  /** Pre-computed trend series, used instead of `teamTotals` when given. */
  trends?: StatTrends;
  thresholds?: ThresholdSettings;
  /** Combined view across teams: the labels say "Avg" and "Combined". */
  combined?: boolean;
}

export const TeamStatsBar: React.FC<Props> = ({
  stats,
  teamTotals,
  trends,
  thresholds,
  combined,
}) => {
  const velocityTrend = trends?.velocity ?? teamTotals?.map((t) => t.totalEffortCompleted) ?? [];
  const completionTrend = trends?.completion ?? teamTotals?.map((t) => t.effortCompletionPct) ?? [];
  const utilTrend = trends?.utilization ?? teamTotals?.map((t) => t.hoursUtilizationPct) ?? [];

  const completionColor = getPerformanceColor(stats.avgEffortCompletionRate, thresholds);
  const utilColor = getPerformanceColor(stats.avgHoursUtilization, thresholds);

  return (
    <div
      className="ax-metrics"
      data-testid="team-stats"
      style={combined ? { marginBottom: 0 } : undefined}
    >
      <Metric
        label={combined ? "Avg Health Score" : "Health Score"}
        tone={getPerformanceTone(stats.avgHealthScore, thresholds)}
        value={
          <>
            {Math.round(stats.avgHealthScore)}
            <span className="ax-metric__unit">/100</span>
          </>
        }
      />
      <Metric
        label={combined ? "Combined Velocity" : "Velocity"}
        value={
          <>
            {formatDecimal(stats.avgVelocity, 1)}
            <span className="ax-metric__unit">pts/sprint</span>
          </>
        }
        hint={<Sparkline data={velocityTrend} label="Velocity trend" />}
      />
      <Metric
        label="PBIs Completed"
        value={`${stats.totalPbisCompleted} / ${stats.totalPbisAssigned}`}
      />
      <Metric
        label="Bugs Completed"
        value={`${stats.totalBugsCompleted} / ${stats.totalBugsAssigned}`}
      />
      <Metric
        label="Tasks Completed"
        value={`${stats.totalTasksCompleted} / ${stats.totalTasksAssigned}`}
      />
      <Metric
        label="Avg Effort/Day"
        tone={getEffortPerDayTone(stats.avgEffortPerDay, thresholds)}
        value={formatDecimal(stats.avgEffortPerDay, 2)}
        hint="target 1.00 per working day"
      />
      <Metric
        label="Avg Completion"
        tone={getPerformanceTone(stats.avgEffortCompletionRate, thresholds)}
        value={formatPercentage(stats.avgEffortCompletionRate)}
        hint={<Sparkline data={completionTrend} color={completionColor} label="Completion trend" />}
      />
      <Metric
        label="Avg Utilization"
        tone={getPerformanceTone(stats.avgHoursUtilization, thresholds)}
        value={formatPercentage(stats.avgHoursUtilization)}
        hint={<Sparkline data={utilTrend} color={utilColor} label="Utilization trend" />}
      />
      <Metric
        label="Avg Cycle Time"
        value={
          <>
            {formatDecimal(stats.avgCycleTimeDays, 1)}
            <span className="ax-metric__unit">days</span>
          </>
        }
      />
      <Metric
        label={combined ? "Avg Distribution" : "Distribution"}
        tone={getPerformanceTone(stats.avgWorkDistributionScore, thresholds)}
        value={`${Math.round(stats.avgWorkDistributionScore)}%`}
        hint="even spread of work across the team"
      />
    </div>
  );
};
