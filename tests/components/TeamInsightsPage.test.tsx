import * as React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TeamInsightsPage } from "@/components/TeamInsightsPage";
import {
  MemberPerformanceSummary,
  SprintMemberEffort,
  TeamPerformanceData,
} from "@/models/interfaces";

function makeSprintData(overrides: Partial<SprintMemberEffort> = {}): SprintMemberEffort {
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
    pbiCountTotal: 2,
    pbiCountCompleted: 1,
    bugCountTotal: 0,
    bugCountCompleted: 0,
    totalOriginalEstimate: 60,
    totalCompletedWork: 50,
    totalRemainingWork: 10,
    estimatedVsActualRatio: 1.2,
    availableHours: 60,
    hoursUtilizationPct: 80,
    sprintProgress: 1.0,
    ...overrides,
  };
}

function makeMember(
  id: string,
  name: string,
  email: string,
  role: string,
  sprints: SprintMemberEffort[]
): MemberPerformanceSummary {
  return {
    memberId: id,
    memberDisplayName: name,
    memberUniqueName: email,
    memberImageUrl: "",
    primaryRole: role,
    sprintData: sprints,
  };
}

function makeTeamData(
  teamId: string,
  teamName: string,
  members: MemberPerformanceSummary[]
): TeamPerformanceData {
  return {
    team: { id: teamId, name: teamName },
    sprints: [],
    members,
    teamTotals: [],
    summaryStats: {
      sprintCount: 0,
      avgVelocity: 0,
      totalPbisAssigned: 0,
      totalPbisCompleted: 0,
      totalBugsAssigned: 0,
      totalBugsCompleted: 0,
      totalTasksAssigned: 0,
      totalTasksCompleted: 0,
      avgEffortPerDay: 0,
      avgHoursUtilization: 0,
      avgEffortCompletionRate: 0,
      avgCycleTimeDays: 0,
      avgWorkDistributionScore: 0,
      avgHealthScore: 0,
    },
    slippageData: [],
    bestPracticeData: [],
    failedSprints: [],
    unmatchedAssignees: [],
  };
}

describe("TeamInsightsPage", () => {
  it("renders a single selected-scope view when multiple teams are selected", () => {
    const platformData = makeTeamData("team-a", "Platform", [
      makeMember("m1", "Alice", "alice@example.com", "Development", [
        makeSprintData({ effortPerformancePct: 95 }),
      ]),
    ]);
    const paymentsData = makeTeamData("team-b", "Payments", [
      makeMember("m2", "Bob", "bob@example.com", "Testing", [
        makeSprintData({
          memberId: "m2",
          memberDisplayName: "Bob",
          memberUniqueName: "bob@example.com",
          primaryRole: "Testing",
          hoursUtilizationPct: 92,
        }),
      ]),
    ]);

    render(
      <TeamInsightsPage
        selectedTeams={[platformData.team, paymentsData.team]}
        performanceData={
          new Map([
            [platformData.team.id, platformData],
            [paymentsData.team.id, paymentsData],
          ])
        }
        performanceLoading={false}
      />
    );

    expect(screen.getByRole("heading", { name: "Selected Teams" })).toBeInTheDocument();
    expect(screen.getByText("Top 10")).toBeInTheDocument();
    expect(screen.getByText("Bottom 10")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Platform" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Payments" })).not.toBeInTheDocument();
  });

  it("shows the selected team as the only section when one team is selected", () => {
    const platformData = makeTeamData("team-a", "Platform", [
      makeMember("m1", "Alice", "alice@example.com", "Development", [makeSprintData()]),
    ]);

    render(
      <TeamInsightsPage
        selectedTeams={[platformData.team]}
        performanceData={new Map([[platformData.team.id, platformData]])}
        performanceLoading={false}
      />
    );

    expect(screen.getByRole("heading", { name: "Platform" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
    expect(screen.getByText("Top 3")).toBeInTheDocument();
    expect(screen.getByText("Bottom 3")).toBeInTheDocument();
  });

  it("shows all team badges for multi-team people and keeps them in matching filters", () => {
    const alicePlatform = makeMember("m1", "Alice", "alice@example.com", "Development", [
      makeSprintData({ effortPerformancePct: 95 }),
    ]);
    const alicePayments = makeMember("m99", "Alice", "alice@example.com", "Development", [
      makeSprintData({
        memberId: "m99",
        sprintId: "s2",
        sprintName: "Sprint 2",
        effortPerformancePct: 88,
      }),
    ]);
    const bob = makeMember("m2", "Bob", "bob@example.com", "Testing", [
      makeSprintData({
        memberId: "m2",
        memberDisplayName: "Bob",
        memberUniqueName: "bob@example.com",
        primaryRole: "Testing",
        hoursUtilizationPct: 92,
      }),
    ]);

    const platformData = makeTeamData("team-a", "Platform", [alicePlatform]);
    const paymentsData = makeTeamData("team-b", "Payments", [alicePayments, bob]);

    render(
      <TeamInsightsPage
        selectedTeams={[platformData.team, paymentsData.team]}
        performanceData={
          new Map([
            [platformData.team.id, platformData],
            [paymentsData.team.id, paymentsData],
          ])
        }
        performanceLoading={false}
      />
    );

    const departmentSection = screen
      .getByRole("heading", { name: "Selected Teams" })
      .closest("section");
    expect(departmentSection).not.toBeNull();

    const departmentQueries = within(departmentSection as HTMLElement);
    const aliceCard = departmentQueries.getByText("Alice").closest("[data-testid=insight-card]");
    expect(aliceCard).not.toBeNull();
    expect(within(aliceCard as HTMLElement).getByText("Platform")).toBeInTheDocument();
    expect(within(aliceCard as HTMLElement).getByText("Payments")).toBeInTheDocument();

    fireEvent.click(departmentQueries.getByRole("button", { name: "Platform" }));

    expect(departmentQueries.getByRole("button", { name: "Platform" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(departmentQueries.getByText("Top 3")).toBeInTheDocument();
    expect(departmentQueries.getByText("Bottom 3")).toBeInTheDocument();
    expect(departmentQueries.getByText("Alice")).toBeInTheDocument();
    expect(departmentQueries.queryByText("Bob")).not.toBeInTheDocument();
  });
});
