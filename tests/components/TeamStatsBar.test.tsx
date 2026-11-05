import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TeamStatsBar } from "@/components/TeamStatsBar";
import { CombinedTeamSummary } from "@/components/CombinedTeamSummary";
import { SprintTeamTotals, TeamSummaryStats } from "@/models/interfaces";

const stats: TeamSummaryStats = {
  sprintCount: 3,
  avgVelocity: 12.5,
  totalPbisAssigned: 20,
  totalPbisCompleted: 18,
  totalBugsAssigned: 5,
  totalBugsCompleted: 4,
  totalTasksAssigned: 60,
  totalTasksCompleted: 50,
  avgEffortPerDay: 0.85,
  avgHoursUtilization: 72.4,
  avgEffortCompletionRate: 91.2,
  avgCycleTimeDays: 3.4,
  avgWorkDistributionScore: 88,
  avgHealthScore: 83,
};

function totals(id: string, completed: number): SprintTeamTotals {
  return {
    sprintId: id,
    sprintName: id,
    totalEffortAssigned: 10,
    totalEffortCompleted: completed,
    totalWorkingDays: 10,
    avgEffortPerDay: 1,
    avgEffortPerformancePct: 100,
    totalOriginalEstimate: 0,
    totalCompletedWork: 0,
    totalRemainingWork: 0,
    totalAvailableHours: 0,
    estimatedVsActualRatio: 0,
    hoursUtilizationPct: 70,
    effortCompletionPct: 90,
    avgCycleTimeDays: 3,
    workDistributionScore: 90,
    pbiCountTotal: 0,
    pbiCountCompleted: 0,
    bugCountTotal: 0,
    bugCountCompleted: 0,
    taskCountTotal: 0,
    taskCountCompleted: 0,
  };
}

describe("TeamStatsBar", () => {
  it("shows the ten summary tiles with their figures", () => {
    render(<TeamStatsBar stats={stats} />);
    const labels = [
      "Health Score",
      "Velocity",
      "PBIs Completed",
      "Bugs Completed",
      "Tasks Completed",
      "Avg Effort/Day",
      "Avg Completion",
      "Avg Utilization",
      "Avg Cycle Time",
      "Distribution",
    ];
    for (const label of labels) expect(screen.getByText(label)).toBeInTheDocument();

    expect(screen.getByText("18 / 20")).toBeInTheDocument();
    expect(screen.getByText("4 / 5")).toBeInTheDocument();
    expect(screen.getByText("50 / 60")).toBeInTheDocument();
    expect(screen.getByText("91.2%")).toBeInTheDocument();
    expect(screen.getByText("72.4%")).toBeInTheDocument();
    expect(screen.getByText("0.85")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("tones tiles by performance band, not by a literal colour", () => {
    render(<TeamStatsBar stats={stats} />);
    // 91.2 is in the 80-99 band (info), 72.4 in the 60-79 band (warn), 83 health is info.
    expect(screen.getByText("Avg Completion").closest(".ax-metric")).toHaveClass("ax-metric--info");
    expect(screen.getByText("Avg Utilization").closest(".ax-metric")).toHaveClass(
      "ax-metric--warn"
    );
    expect(screen.getByText("Health Score").closest(".ax-metric")).toHaveClass("ax-metric--info");
  });

  it("follows custom thresholds", () => {
    render(
      <TeamStatsBar
        stats={stats}
        thresholds={{
          taskMaxHours: 6,
          utilizationUnderplannedThreshold: 60,
          velocityTolerancePct: 20,
          slippageAtRiskThreshold: 100,
          slippageOverThreshold: 200,
          perfThresholdExcellent: 90,
          perfThresholdGood: 70,
          perfThresholdWarning: 50,
        }}
      />
    );
    expect(screen.getByText("Avg Completion").closest(".ax-metric")).toHaveClass(
      "ax-metric--success"
    );
  });

  it("draws trend lines only when a series has at least two sprints", () => {
    const { rerender } = render(<TeamStatsBar stats={stats} teamTotals={[totals("s1", 8)]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    rerender(<TeamStatsBar stats={stats} teamTotals={[totals("s1", 8), totals("s2", 10)]} />);
    expect(screen.getByRole("img", { name: "Velocity trend" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Completion trend" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Utilization trend" })).toBeInTheDocument();
  });

  it("prefers explicit trend series over team totals", () => {
    render(
      <TeamStatsBar
        stats={stats}
        teamTotals={[totals("s1", 8)]}
        trends={{ velocity: [1, 2, 3], completion: [], utilization: [] }}
      />
    );
    expect(screen.getByRole("img", { name: "Velocity trend" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Completion trend" })).not.toBeInTheDocument();
  });
});

describe("CombinedTeamSummary", () => {
  it("labels the tiles as combined and counts the teams", () => {
    render(
      <CombinedTeamSummary
        teamCount={2}
        stats={stats}
        velocityTrend={[1, 2]}
        completionTrend={[80, 90]}
        utilizationTrend={[60, 70]}
      />
    );
    expect(screen.getByRole("heading", { name: "All Teams (Combined)" })).toBeInTheDocument();
    expect(screen.getByText("2 teams · ~3 sprints avg")).toBeInTheDocument();
    expect(screen.getByText("Avg Health Score")).toBeInTheDocument();
    expect(screen.getByText("Combined Velocity")).toBeInTheDocument();
    expect(screen.getByText("Avg Distribution")).toBeInTheDocument();
  });

  it("uses the singular for a single sprint", () => {
    render(
      <CombinedTeamSummary
        teamCount={2}
        stats={{ ...stats, sprintCount: 1 }}
        velocityTrend={[]}
        completionTrend={[]}
        utilizationTrend={[]}
      />
    );
    expect(screen.getByText("2 teams · ~1 sprint avg")).toBeInTheDocument();
  });
});
