import { PerformanceAggregator, SprintDataSet } from "@/calculations/PerformanceAggregator";
import { TeamInfo, SprintInfo, MemberCapacity, WorkItemData } from "@/models/interfaces";

// Helper to create a work item
function wi(overrides: Partial<WorkItemData>): WorkItemData {
  return {
    id: 1,
    type: "Product Backlog Item",
    title: "Test",
    state: "New",
    assignedToUniqueName: "alice@example.com",
    assignedToDisplayName: "Alice",
    iterationPath: "Project\\Sprint 1",
    effort: null,
    originalEstimate: null,
    completedWork: null,
    remainingWork: null,
    activatedDate: null,
    stateChangeDate: null,
    changedDate: null,
    ...overrides,
  };
}

const team: TeamInfo = { id: "team-1", name: "Alpha" };

// Mon Jan 5 to Fri Jan 16, 2026 = 10 weekdays
const sprint1: SprintInfo = {
  id: "sprint-1",
  name: "Sprint 1",
  path: "Project\\Sprint 1",
  startDate: new Date("2026-01-05"),
  finishDate: new Date("2026-01-16"),
};

// Mon Jan 19 to Fri Jan 30, 2026 = 10 weekdays
const sprint2: SprintInfo = {
  id: "sprint-2",
  name: "Sprint 2",
  path: "Project\\Sprint 2",
  startDate: new Date("2026-01-19"),
  finishDate: new Date("2026-01-30"),
};

const alice: MemberCapacity = {
  memberId: "alice-id",
  memberDisplayName: "Alice Johnson",
  memberUniqueName: "alice@example.com",
  memberImageUrl: "",
  activities: [{ name: "Development", capacityPerDay: 6 }],
  totalCapacityPerDay: 6,
  primaryRole: "Development",
  personalDaysOff: [],
};

const bob: MemberCapacity = {
  memberId: "bob-id",
  memberDisplayName: "Bob Smith",
  memberUniqueName: "bob@example.com",
  memberImageUrl: "",
  activities: [{ name: "Testing", capacityPerDay: 6 }],
  totalCapacityPerDay: 6,
  primaryRole: "Testing",
  personalDaysOff: [],
};

const charlie: MemberCapacity = {
  memberId: "charlie-id",
  memberDisplayName: "Charlie Davis",
  memberUniqueName: "charlie@example.com",
  memberImageUrl: "",
  activities: [{ name: "Development", capacityPerDay: 6 }],
  totalCapacityPerDay: 6,
  primaryRole: "Development",
  personalDaysOff: [],
};

describe("PerformanceAggregator", () => {
  const aggregator = new PerformanceAggregator();

  it("computes member-level effort and hours for a single sprint", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Product Backlog Item",
          effort: 3,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({ type: "Bug", effort: 2, state: "Closed", assignedToUniqueName: "alice@example.com" }),
        wi({
          type: "Task",
          originalEstimate: 40,
          completedWork: 35,
          remainingWork: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Task",
          originalEstimate: 20,
          completedWork: 20,
          remainingWork: 0,
          state: "Closed",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);

    expect(result.members).toHaveLength(1);
    const member = result.members[0];
    expect(member.memberDisplayName).toBe("Alice Johnson");
    expect(member.primaryRole).toBe("Development");

    const sd = member.sprintData[0];
    // 10 weekdays, no days off
    expect(sd.workingDays).toBe(10);
    // Effort: 5 (Done) + 2 (Closed) = 7 completed out of 10 assigned
    expect(sd.totalEffortAssigned).toBe(10);
    expect(sd.totalEffortCompleted).toBe(7);
    expect(sd.effortPerDay).toBeCloseTo(0.7, 5);
    expect(sd.effortPerformancePct).toBeCloseTo(70.0, 5);
    // Hours: 60h estimated, 55h completed, 5h remaining
    expect(sd.totalOriginalEstimate).toBe(60);
    expect(sd.totalCompletedWork).toBe(55);
    expect(sd.totalRemainingWork).toBe(5);
    // Available: 10 days × 6 h/day = 60h
    expect(sd.availableHours).toBe(60);
    expect(sd.hoursUtilizationPct).toBeCloseTo((55 / 60) * 100, 5);
    expect(sd.estimatedVsActualRatio).toBeCloseTo(60 / 55, 5);
  });

  it("computes team totals correctly", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice, bob],
      teamDaysOff: { daysOff: [] },
      workItems: [
        // Alice: 5 effort completed
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Task",
          originalEstimate: 40,
          completedWork: 40,
          remainingWork: 0,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        // Bob: 3 effort completed
        wi({ type: "Bug", effort: 3, state: "Closed", assignedToUniqueName: "bob@example.com" }),
        wi({
          type: "Task",
          originalEstimate: 30,
          completedWork: 25,
          remainingWork: 5,
          state: "Done",
          assignedToUniqueName: "bob@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);

    expect(result.teamTotals).toHaveLength(1);
    const totals = result.teamTotals[0];
    // Team effort: 5 + 3 = 8
    expect(totals.totalEffortCompleted).toBe(8);
    // Team working days: 10 + 10 = 20
    expect(totals.totalWorkingDays).toBe(20);
    expect(totals.avgEffortPerDay).toBeCloseTo(8 / 20, 5);
    // Team hours: est 70, completed 65, remaining 5
    expect(totals.totalOriginalEstimate).toBe(70);
    expect(totals.totalCompletedWork).toBe(65);
    expect(totals.totalRemainingWork).toBe(5);
    // Available: (10×6) + (10×6) = 120
    expect(totals.totalAvailableHours).toBe(120);
    expect(totals.hoursUtilizationPct).toBeCloseTo((65 / 120) * 100, 5);
  });

  it("counts work items by type in team totals", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({ type: "Product Backlog Item", state: "Done" }),
        wi({ type: "Product Backlog Item", state: "New" }),
        wi({ type: "Product Backlog Item", state: "Closed" }),
        wi({ type: "Bug", state: "Done" }),
        wi({ type: "Bug", state: "Active" }),
        wi({ type: "Task", state: "Done" }),
        wi({ type: "Task", state: "Done" }),
        wi({ type: "Task", state: "New" }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    const totals = result.teamTotals[0];

    expect(totals.pbiCountTotal).toBe(3);
    expect(totals.pbiCountCompleted).toBe(2); // Done + Closed
    expect(totals.bugCountTotal).toBe(2);
    expect(totals.bugCountCompleted).toBe(1); // Done
    expect(totals.taskCountTotal).toBe(3);
    expect(totals.taskCountCompleted).toBe(2); // 2 Done
  });

  it("computes summary stats across multiple sprints", () => {
    const ds1: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 8,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({ type: "Bug", effort: 2, state: "Closed", assignedToUniqueName: "alice@example.com" }),
        wi({
          type: "Task",
          originalEstimate: 50,
          completedWork: 48,
          remainingWork: 2,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const ds2: SprintDataSet = {
      sprint: sprint2,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 12,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({ type: "Bug", effort: 0, state: "New", assignedToUniqueName: "alice@example.com" }),
        wi({
          type: "Task",
          originalEstimate: 55,
          completedWork: 55,
          remainingWork: 0,
          state: "Closed",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1, sprint2], [ds1, ds2]);
    const stats = result.summaryStats;

    expect(stats.sprintCount).toBe(2);
    // Velocity: (10 + 12) / 2 = 11
    expect(stats.avgVelocity).toBeCloseTo(11, 5);
    // PBI counts: sprint1 has 1 PBI (done), sprint2 has 1 PBI (done)
    expect(stats.totalPbisCompleted).toBe(2);
    expect(stats.totalPbisAssigned).toBe(2);
    // Bug counts: sprint1 has 1 Bug (closed), sprint2 has 1 Bug (new)
    expect(stats.totalBugsCompleted).toBe(1);
    expect(stats.totalBugsAssigned).toBe(2);
    // Task counts: sprint1 has 1 (done), sprint2 has 1 (closed)
    expect(stats.totalTasksCompleted).toBe(2);
    expect(stats.totalTasksAssigned).toBe(2);
    // Avg effort per day: sprint1 = 10/10 = 1.0, sprint2 = 12/10 = 1.2, avg = 1.1
    expect(stats.avgEffortPerDay).toBeCloseTo(1.1, 5);
    // Avg utilization (completedWork/available): sprint1 = (48/60)*100 = 80%, sprint2 = (55/60)*100 = 91.67%, avg
    expect(stats.avgHoursUtilization).toBeCloseTo(((48 / 60) * 100 + (55 / 60) * 100) / 2, 1);
    // avgEffortCompletionRate should be computed across sprints
    expect(stats.avgEffortCompletionRate).toBeDefined();
  });

  it("computes effort completion percentage per member", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Product Backlog Item",
          effort: 3,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({ type: "Bug", effort: 2, state: "Closed", assignedToUniqueName: "alice@example.com" }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    const sd = result.members[0].sprintData[0];

    // 7 completed out of 10 assigned = 70%
    expect(sd.effortCompletionPct).toBeCloseTo(70.0, 5);
  });

  it("computes per-member PBI and Bug counts", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Product Backlog Item",
          effort: 3,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({ type: "Bug", effort: 2, state: "Closed", assignedToUniqueName: "alice@example.com" }),
        wi({ type: "Bug", effort: 1, state: "Active", assignedToUniqueName: "alice@example.com" }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    const sd = result.members[0].sprintData[0];

    expect(sd.pbiCountTotal).toBe(2);
    expect(sd.pbiCountCompleted).toBe(1);
    expect(sd.bugCountTotal).toBe(2);
    expect(sd.bugCountCompleted).toBe(1);
  });

  it("computes effort completion percentage in team totals", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice, bob],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({ type: "Bug", effort: 3, state: "Closed", assignedToUniqueName: "bob@example.com" }),
        wi({ type: "Bug", effort: 7, state: "New", assignedToUniqueName: "bob@example.com" }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    // Team: 8 completed out of 20 assigned = 40%
    expect(result.teamTotals[0].effortCompletionPct).toBeCloseTo(40.0, 5);
  });

  it("computes slippage data for each sprint", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 3,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
          activatedDate: new Date("2026-01-05"),
          stateChangeDate: new Date("2026-01-07"),
        }),
        wi({
          type: "Bug",
          effort: 1,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Task",
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    expect(result.slippageData).toHaveLength(1);
    // Only PBIs and Bugs, not Tasks
    expect(result.slippageData[0].items).toHaveLength(2);
    expect(result.slippageData[0].summary.totalItems).toBe(2);
  });

  it("handles empty sprint data sets", () => {
    const result = aggregator.aggregate(team, [], []);
    expect(result.members).toHaveLength(0);
    expect(result.teamTotals).toHaveLength(0);
    expect(result.summaryStats.sprintCount).toBe(0);
    expect(result.summaryStats.avgVelocity).toBe(0);
    expect(result.slippageData).toHaveLength(0);
  });

  it("handles team days off reducing working days", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: {
        daysOff: [
          // Team holiday: Jan 5-6 (Mon-Tue) = 2 days off
          { start: new Date("2026-01-05"), end: new Date("2026-01-06") },
        ],
      },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 8,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    const sd = result.members[0].sprintData[0];

    expect(sd.workingDays).toBe(8); // 10 - 2 team holidays
    expect(sd.effortPerDay).toBeCloseTo(8 / 8, 5);
    expect(sd.availableHours).toBe(48); // 8 days × 6 h
  });

  it("sorts members alphabetically by display name", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [bob, alice], // Bob before Alice in input
      teamDaysOff: { daysOff: [] },
      workItems: [],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    expect(result.members[0].memberDisplayName).toBe("Alice Johnson");
    expect(result.members[1].memberDisplayName).toBe("Bob Smith");
  });

  it("handles member with personal days off", () => {
    const aliceWithDaysOff: MemberCapacity = {
      ...alice,
      personalDaysOff: [
        { start: new Date("2026-01-07"), end: new Date("2026-01-09") }, // Wed-Fri = 3 personal days
      ],
    };

    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [aliceWithDaysOff],
      teamDaysOff: { daysOff: [] },
      workItems: [],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    expect(result.members[0].sprintData[0].workingDays).toBe(7); // 10 - 3
    expect(result.members[0].sprintData[0].personalDaysOffCount).toBe(3);
  });

  it("computes cycle time for completed PBIs/Bugs", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
          activatedDate: new Date("2026-01-05"), // Monday
          stateChangeDate: new Date("2026-01-09"), // Friday = 5 weekdays
        }),
        wi({
          type: "Bug",
          effort: 2,
          state: "Closed",
          assignedToUniqueName: "alice@example.com",
          activatedDate: new Date("2026-01-05"),
          stateChangeDate: new Date("2026-01-07"), // Wednesday = 3 weekdays
        }),
        // New PBI — no cycle time (not completed)
        wi({
          type: "Product Backlog Item",
          effort: 3,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    // Average cycle time: (5 + 3) / 2 = 4 days
    expect(result.teamTotals[0].avgCycleTimeDays).toBeCloseTo(4.0, 5);
    expect(result.summaryStats.avgCycleTimeDays).toBeCloseTo(4.0, 5);
  });

  it("returns 0 cycle time when no items have activation dates", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    expect(result.teamTotals[0].avgCycleTimeDays).toBe(0);
  });

  it("computes work distribution score for evenly-loaded team", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice, charlie],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "New",
          assignedToUniqueName: "charlie@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    // Equal effort → score = 100
    expect(result.teamTotals[0].workDistributionScore).toBe(100);
  });

  it("computes low distribution score for imbalanced team", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice, charlie],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 15,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Product Backlog Item",
          effort: 1,
          state: "New",
          assignedToUniqueName: "charlie@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    // Very uneven: alice=15, charlie=1 → low score
    expect(result.teamTotals[0].workDistributionScore).toBeLessThan(50);
  });

  it("excludes testers from work distribution calculation", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice, bob, charlie],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "New",
          assignedToUniqueName: "charlie@example.com",
        }),
        // bob (Testing) has no PBI effort — should not skew distribution
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    // bob excluded → alice=5, charlie=5 → even → score = 100
    expect(result.teamTotals[0].workDistributionScore).toBe(100);
  });

  it("returns distribution score 100 for single member team", () => {
    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [alice],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 10,
          state: "New",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    expect(result.teamTotals[0].workDistributionScore).toBe(100);
  });

  it("computes zero division safely", () => {
    // Member with 0 capacity, 0 working days
    const zeroCapacity: MemberCapacity = {
      ...alice,
      totalCapacityPerDay: 0,
      personalDaysOff: [
        { start: new Date("2026-01-05"), end: new Date("2026-01-16") }, // All days off
      ],
    };

    const dataSet: SprintDataSet = {
      sprint: sprint1,
      memberCapacities: [zeroCapacity],
      teamDaysOff: { daysOff: [] },
      workItems: [
        wi({
          type: "Product Backlog Item",
          effort: 5,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
        wi({
          type: "Task",
          completedWork: 10,
          originalEstimate: 10,
          remainingWork: 0,
          state: "Done",
          assignedToUniqueName: "alice@example.com",
        }),
      ],
    };

    const result = aggregator.aggregate(team, [sprint1], [dataSet]);
    const sd = result.members[0].sprintData[0];

    // 0 working days → effortPerDay should be 0, not Infinity
    expect(sd.effortPerDay).toBe(0);
    expect(sd.availableHours).toBe(0);
    // 0 available hours → utilization should be 0
    expect(sd.hoursUtilizationPct).toBe(0);
    // completedWork > 0 so ratio should still compute
    expect(sd.estimatedVsActualRatio).toBeCloseTo(1.0, 5);
  });
});
