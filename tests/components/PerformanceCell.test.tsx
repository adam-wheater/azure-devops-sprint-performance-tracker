import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PerformanceCell, TeamTotalsCell } from "@/components/PerformanceCell";
import {
  SprintMemberEffort,
  SprintTeamTotals,
  ThresholdSettings,
  DEFAULT_THRESHOLDS,
} from "@/models/interfaces";

function makeMemberEffort(overrides: Partial<SprintMemberEffort> = {}): SprintMemberEffort {
  return {
    memberId: "m1",
    memberDisplayName: "Alice",
    memberUniqueName: "alice@example.com",
    memberImageUrl: "",
    primaryRole: "Development",
    sprintId: "s1",
    sprintName: "Sprint 1",
    totalWeekdays: 10,
    teamDaysOffCount: 0,
    personalDaysOffCount: 0,
    workingDays: 10,
    capacityHoursPerDay: 6,
    totalEffortAssigned: 10,
    totalEffortCompleted: 8,
    effortPerDay: 0.8,
    effortTarget: 1.0,
    effortPerformancePct: 80,
    effortCompletionPct: 80,
    pbiCountTotal: 3,
    pbiCountCompleted: 2,
    bugCountTotal: 1,
    bugCountCompleted: 1,
    totalOriginalEstimate: 40,
    totalCompletedWork: 35,
    totalRemainingWork: 5,
    estimatedVsActualRatio: 1.14,
    availableHours: 60,
    hoursUtilizationPct: 58,
    sprintProgress: 1.0,
    ...overrides,
  };
}

function makeTeamTotals(overrides: Partial<SprintTeamTotals> = {}): SprintTeamTotals {
  return {
    sprintId: "s1",
    sprintName: "Sprint 1",
    totalEffortAssigned: 20,
    totalEffortCompleted: 16,
    totalWorkingDays: 20,
    avgEffortPerDay: 0.8,
    avgEffortPerformancePct: 80,
    totalOriginalEstimate: 80,
    totalCompletedWork: 70,
    totalRemainingWork: 10,
    totalAvailableHours: 120,
    estimatedVsActualRatio: 1.14,
    hoursUtilizationPct: 58,
    effortCompletionPct: 80,
    avgCycleTimeDays: 3,
    workDistributionScore: 85,
    pbiCountTotal: 6,
    pbiCountCompleted: 4,
    bugCountTotal: 2,
    bugCountCompleted: 2,
    taskCountTotal: 10,
    taskCountCompleted: 8,
    ...overrides,
  };
}

// Helper to render inside a table for valid HTML
function renderInTable(cell: React.ReactElement) {
  return render(
    <table>
      <tbody>
        <tr>{cell}</tr>
      </tbody>
    </table>
  );
}

describe("PerformanceCell", () => {
  it("renders empty state when data is null", () => {
    renderInTable(<PerformanceCell data={null} rowType="effort" />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("renders holiday cell when workingDays is 0", () => {
    const data = makeMemberEffort({ workingDays: 0, teamDaysOffCount: 5, personalDaysOffCount: 5 });
    renderInTable(<PerformanceCell data={data} rowType="effort" />);
    expect(screen.getByText("On Holiday")).toBeInTheDocument();
    expect(screen.getByText("10 days off")).toBeInTheDocument();
  });

  it("renders effort row with PBI and Bug counts", () => {
    const data = makeMemberEffort();
    renderInTable(<PerformanceCell data={data} rowType="effort" />);
    expect(screen.getByText("2/3")).toBeInTheDocument(); // PBIs
    expect(screen.getByText("1/1")).toBeInTheDocument(); // Bugs
  });

  it("renders hours row with utilization", () => {
    const data = makeMemberEffort();
    renderInTable(<PerformanceCell data={data} rowType="hours" />);
    expect(screen.getByText("58.0%")).toBeInTheDocument();
  });

  it("shows under-planned badge when planned hours are below prorated threshold", () => {
    // Completed sprint (progress=1): 30h planned / 60h available = 50% < 60%
    const data = makeMemberEffort({
      totalOriginalEstimate: 30,
      availableHours: 60,
      sprintProgress: 1.0,
    });
    renderInTable(<PerformanceCell data={data} rowType="hours" />);
    expect(screen.getByText("Under-planned")).toBeInTheDocument();
  });

  it("does not show under-planned badge when planned hours meet threshold", () => {
    // Completed sprint: 48h planned / 60h available = 80% >= 60%
    const data = makeMemberEffort({
      totalOriginalEstimate: 48,
      availableHours: 60,
      sprintProgress: 1.0,
    });
    renderInTable(<PerformanceCell data={data} rowType="hours" />);
    expect(screen.queryByText("Under-planned")).not.toBeInTheDocument();
  });

  it("does not show under-planned badge early in sprint when daily planning is on track", () => {
    // Active sprint at 20% progress: prorated available = 60 * 0.2 = 12h
    // 10h planned / 12h = 83% >= 60% → NOT under-planned
    const data = makeMemberEffort({
      totalOriginalEstimate: 10,
      availableHours: 60,
      sprintProgress: 0.2,
    });
    renderInTable(<PerformanceCell data={data} rowType="hours" />);
    expect(screen.queryByText("Under-planned")).not.toBeInTheDocument();
  });

  it("shows under-planned badge mid-sprint when planning is genuinely low", () => {
    // Active sprint at 50% progress: prorated available = 60 * 0.5 = 30h
    // 10h planned / 30h = 33% < 60% → under-planned
    const data = makeMemberEffort({
      totalOriginalEstimate: 10,
      availableHours: 60,
      sprintProgress: 0.5,
    });
    renderInTable(<PerformanceCell data={data} rowType="hours" />);
    expect(screen.getByText("Under-planned")).toBeInTheDocument();
  });

  it("does not show under-planned badge for future sprint", () => {
    // Future sprint (progress=0): never under-planned
    const data = makeMemberEffort({
      totalOriginalEstimate: 0,
      availableHours: 60,
      sprintProgress: 0,
    });
    renderInTable(<PerformanceCell data={data} rowType="hours" />);
    expect(screen.queryByText("Under-planned")).not.toBeInTheDocument();
  });

  it("respects custom thresholds for under-planned badge", () => {
    // 33h planned / 60h available = 55% — above custom 50% threshold
    const data = makeMemberEffort({
      totalOriginalEstimate: 33,
      availableHours: 60,
      sprintProgress: 1.0,
    });
    const thresholds: ThresholdSettings = {
      ...DEFAULT_THRESHOLDS,
      utilizationUnderplannedThreshold: 50,
    };
    renderInTable(<PerformanceCell data={data} rowType="hours" thresholds={thresholds} />);
    expect(screen.queryByText("Under-planned")).not.toBeInTheDocument();
  });

  it("renders days off info when present", () => {
    const data = makeMemberEffort({ teamDaysOffCount: 1, personalDaysOffCount: 1, workingDays: 8 });
    renderInTable(<PerformanceCell data={data} rowType="effort" />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows trend arrow when previous sprint data is provided", () => {
    const current = makeMemberEffort({ effortPerformancePct: 100 });
    const previous = makeMemberEffort({ effortPerformancePct: 70 });
    renderInTable(
      <PerformanceCell data={current} rowType="effort" previousSprintData={previous} />
    );
    // Up arrow character
    expect(screen.getByText("\u25B2")).toBeInTheDocument();
  });
});

describe("TeamTotalsCell", () => {
  it("renders empty state when data is null", () => {
    renderInTable(<TeamTotalsCell data={null} rowType="effort" />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("renders effort totals with performance percentage", () => {
    const data = makeTeamTotals({ avgEffortPerformancePct: 82, effortCompletionPct: 76 });
    renderInTable(<TeamTotalsCell data={data} rowType="effort" />);
    expect(screen.getByText("82.0%")).toBeInTheDocument();
    expect(screen.getByText("76.0%")).toBeInTheDocument();
  });

  it("renders hours totals with utilization", () => {
    const data = makeTeamTotals();
    renderInTable(<TeamTotalsCell data={data} rowType="hours" />);
    expect(screen.getByText("58.0%")).toBeInTheDocument();
  });

  it("passes thresholds to color calculations", () => {
    const data = makeTeamTotals({ avgEffortPerformancePct: 90 });
    const thresholds: ThresholdSettings = { ...DEFAULT_THRESHOLDS, perfThresholdExcellent: 95 };
    renderInTable(<TeamTotalsCell data={data} rowType="effort" thresholds={thresholds} />);
    // With threshold at 95, 90% should not be "excellent" green
    expect(screen.getByText("90.0%")).toBeInTheDocument();
  });
});
