import { TeamPerformanceData, TeamSummaryStats, SprintTeamTotals } from "../models/interfaces";

export interface CombinedTeamSummary {
  teamCount: number;
  stats: TeamSummaryStats;
  /** Positional sparkline data (index 0 = oldest sprint, last = most recent), averaged across teams. */
  velocityTrend: number[];
  completionTrend: number[];
  utilizationTrend: number[];
}

/**
 * Aggregates summary stats across multiple teams using averages.
 * Works regardless of whether teams share sprint names/dates.
 *
 * Totals (PBIs, Bugs, Tasks) are summed across teams.
 * Rates and averages are averaged across teams.
 * Sparkline data is aligned by position (most recent sprint last) and averaged.
 */
export function aggregateSummaryStats(dataEntries: TeamPerformanceData[]): CombinedTeamSummary {
  const n = dataEntries.length;

  const stats: TeamSummaryStats = {
    sprintCount: Math.round(avg(dataEntries, (d) => d.summaryStats.sprintCount)),

    // Summed totals
    avgVelocity: sum(dataEntries, (d) => d.summaryStats.avgVelocity),
    totalPbisAssigned: sum(dataEntries, (d) => d.summaryStats.totalPbisAssigned),
    totalPbisCompleted: sum(dataEntries, (d) => d.summaryStats.totalPbisCompleted),
    totalBugsAssigned: sum(dataEntries, (d) => d.summaryStats.totalBugsAssigned),
    totalBugsCompleted: sum(dataEntries, (d) => d.summaryStats.totalBugsCompleted),
    totalTasksAssigned: sum(dataEntries, (d) => d.summaryStats.totalTasksAssigned),
    totalTasksCompleted: sum(dataEntries, (d) => d.summaryStats.totalTasksCompleted),

    // Averaged rates
    avgEffortPerDay: avg(dataEntries, (d) => d.summaryStats.avgEffortPerDay),
    avgHoursUtilization: avg(dataEntries, (d) => d.summaryStats.avgHoursUtilization),
    avgEffortCompletionRate: avg(dataEntries, (d) => d.summaryStats.avgEffortCompletionRate),
    avgCycleTimeDays: avg(dataEntries, (d) => d.summaryStats.avgCycleTimeDays),
    avgWorkDistributionScore: avg(dataEntries, (d) => d.summaryStats.avgWorkDistributionScore),
    avgHealthScore: avg(dataEntries, (d) => d.summaryStats.avgHealthScore),
  };

  // Build positional sparkline data by aligning from most-recent sprint backwards
  const maxSprints = Math.max(...dataEntries.map((d) => d.teamTotals.length));
  const velocityTrend = buildPositionalAverage(
    dataEntries,
    maxSprints,
    (t) => t.totalEffortCompleted
  );
  const completionTrend = buildPositionalAverage(
    dataEntries,
    maxSprints,
    (t) => t.effortCompletionPct
  );
  const utilizationTrend = buildPositionalAverage(
    dataEntries,
    maxSprints,
    (t) => t.hoursUtilizationPct
  );

  return {
    teamCount: n,
    stats,
    velocityTrend,
    completionTrend,
    utilizationTrend,
  };
}

/**
 * Builds a positional average across teams' sprint totals.
 * Aligns from the end (most recent sprint) so teams on different cadences line up.
 */
function buildPositionalAverage(
  dataEntries: TeamPerformanceData[],
  maxSprints: number,
  getValue: (t: SprintTeamTotals) => number
): number[] {
  if (maxSprints === 0) return [];

  const result: number[] = [];
  for (let pos = 0; pos < maxSprints; pos++) {
    let total = 0;
    let count = 0;
    for (const entry of dataEntries) {
      const totals = entry.teamTotals;
      // Align from end: position 0 = oldest, maxSprints-1 = most recent
      const idx = totals.length - maxSprints + pos;
      if (idx >= 0 && idx < totals.length) {
        total += getValue(totals[idx]);
        count++;
      }
    }
    if (count > 0) {
      result.push(total / count);
    }
  }
  return result;
}

function sum<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((acc, item) => acc + fn(item), 0);
}

function avg<T>(items: T[], fn: (item: T) => number): number {
  if (items.length === 0) return 0;
  return sum(items, fn) / items.length;
}
