import { computeMemberInsights, mergeDepartmentMembers } from "@/utils/teamInsights";
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

describe("computeMemberInsights", () => {
  it("ranks higher-performing members as MVPs", () => {
    const members = [
      makeMember("m1", "Alice", "alice@example.com", "Development", [
        makeSprintData({
          effortPerformancePct: 95,
          effortCompletionPct: 95,
          hoursUtilizationPct: 90,
        }),
      ]),
      makeMember("m2", "Bob", "bob@example.com", "Development", [
        makeSprintData({
          effortPerformancePct: 50,
          effortCompletionPct: 50,
          hoursUtilizationPct: 40,
        }),
      ]),
    ];

    const result = computeMemberInsights(members, { mvpCount: 1, supportCount: 1 });
    expect(result.mvps[0].memberDisplayName).toBe("Alice");
    expect(result.needsSupport[0].memberDisplayName).toBe("Bob");
  });

  it("does not penalise QAs whose effort numbers are low when hours utilization is high", () => {
    const members = [
      makeMember("m1", "QA Casey", "casey@example.com", "Testing", [
        makeSprintData({
          effortPerformancePct: 0, // QAs get no PBIs
          effortCompletionPct: 0,
          hoursUtilizationPct: 92,
          totalEffortAssigned: 0,
          totalEffortCompleted: 0,
        }),
      ]),
      makeMember("m2", "Dev Dan", "dan@example.com", "Development", [
        makeSprintData({
          effortPerformancePct: 65,
          effortCompletionPct: 60,
          hoursUtilizationPct: 65,
        }),
      ]),
    ];

    const result = computeMemberInsights(members, { mvpCount: 1, supportCount: 1 });
    // QA's score should be 92 (hours-only fallback), beating Dan's 60.
    expect(result.mvps[0].memberDisplayName).toBe("QA Casey");
    expect(result.mvps[0].compositeScore).toBe(92);
  });

  it("penalises developers whose hours are low even when effort numbers are strong", () => {
    const members = [
      makeMember("m1", "Dev Don", "don@example.com", "Development", [
        makeSprintData({
          effortPerformancePct: 110, // faster than 1pt/day
          effortCompletionPct: 95,
          hoursUtilizationPct: 0, // no hours logged
        }),
      ]),
    ];

    const result = computeMemberInsights(members);
    expect(result.members[0].compositeScore).toBe(0);
  });

  it("penalises slow pace even when effort is completed and hours are fully utilized", () => {
    const members = [
      makeMember("m1", "Slow Sid", "sid@example.com", "Development", [
        makeSprintData({
          totalEffortAssigned: 5,
          totalEffortCompleted: 5,
          workingDays: 20,
          effortPerDay: 0.25,
          effortPerformancePct: 25,
          effortCompletionPct: 100,
          hoursUtilizationPct: 100,
        }),
      ]),
    ];

    const result = computeMemberInsights(members);
    expect(result.members[0].compositeScore).toBe(25);
  });

  it("excludes members with no active sprints from MVP and support lists", () => {
    const members = [
      makeMember("m1", "Alice", "alice@example.com", "Development", [
        makeSprintData({
          effortPerformancePct: 80,
          effortCompletionPct: 80,
          hoursUtilizationPct: 80,
        }),
      ]),
      makeMember("m2", "Inactive Ivan", "ivan@example.com", "Development", [
        makeSprintData({
          workingDays: 0,
          effortPerformancePct: 0,
          effortCompletionPct: 0,
          hoursUtilizationPct: 0,
        }),
      ]),
    ];
    const result = computeMemberInsights(members, { mvpCount: 5, supportCount: 5 });
    const allListed = [...result.mvps, ...result.needsSupport].map((m) => m.memberDisplayName);
    expect(allListed).not.toContain("Inactive Ivan");
  });

  it("does not list the same person as both MVP and needs-support", () => {
    const members = [
      makeMember("m1", "Solo Sam", "sam@example.com", "Development", [
        makeSprintData({
          effortPerformancePct: 70,
          effortCompletionPct: 70,
          hoursUtilizationPct: 70,
        }),
      ]),
    ];
    const result = computeMemberInsights(members, { mvpCount: 3, supportCount: 3 });
    expect(result.mvps).toHaveLength(1);
    expect(result.needsSupport).toHaveLength(0);
  });

  it("averages signals across active sprints", () => {
    const members = [
      makeMember("m1", "Alice", "alice@example.com", "Development", [
        makeSprintData({ effortPerformancePct: 100, hoursUtilizationPct: 80 }),
        makeSprintData({ effortPerformancePct: 60, hoursUtilizationPct: 60 }),
      ]),
    ];
    const result = computeMemberInsights(members);
    expect(result.members[0].avgEffortPerformancePct).toBe(80);
    expect(result.members[0].avgHoursUtilizationPct).toBe(70);
  });

  it("merges the same person across teams for department-level comparisons", () => {
    const aliceTeamA = makeMember("m1", "Alice", "alice@example.com", "Development", [
      makeSprintData({ sprintId: "s1", sprintName: "Sprint 1" }),
    ]);
    const aliceTeamB = makeMember("m99", "Alice", "alice@example.com", "Development", [
      makeSprintData({ sprintId: "s2", sprintName: "Sprint 2", effortPerformancePct: 95 }),
    ]);
    const bob = makeMember("m2", "Bob", "bob@example.com", "Testing", [makeSprintData()]);

    const merged = mergeDepartmentMembers([
      makeTeamData("team-a", "Platform", [aliceTeamA]),
      makeTeamData("team-b", "Payments", [aliceTeamB, bob]),
    ]);

    expect(merged).toHaveLength(2);

    const alice = merged.find((member) => member.memberUniqueName === "alice@example.com");
    expect(alice).toBeDefined();
    expect(alice?.sprintData).toHaveLength(2);
    expect(alice?.teamIds).toEqual(["team-a", "team-b"]);
    expect(alice?.teamNames).toEqual(["Platform", "Payments"]);

    const result = computeMemberInsights(merged);
    expect(
      result.members.find((member) => member.memberDisplayName === "Alice")?.activeSprintCount
    ).toBe(2);
  });
});
