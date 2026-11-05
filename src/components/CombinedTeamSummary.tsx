import * as React from "react";
import { TeamSummaryStats } from "../models/interfaces";
import { Card } from "./ui";
import { TeamStatsBar } from "./TeamStatsBar";

interface Props {
  teamCount: number;
  stats: TeamSummaryStats;
  velocityTrend: number[];
  completionTrend: number[];
  utilizationTrend: number[];
}

export const CombinedTeamSummary: React.FC<Props> = ({
  teamCount,
  stats,
  velocityTrend,
  completionTrend,
  utilizationTrend,
}) => (
  <Card
    title="All Teams (Combined)"
    hint={`${teamCount} team${teamCount !== 1 ? "s" : ""} · ~${stats.sprintCount} sprint${
      stats.sprintCount !== 1 ? "s" : ""
    } avg`}
    testId="combined-summary"
  >
    <TeamStatsBar
      combined
      stats={stats}
      trends={{
        velocity: velocityTrend,
        completion: completionTrend,
        utilization: utilizationTrend,
      }}
    />
  </Card>
);
