import { getCellDisplayState } from "@/utils/cellHelpers";
import { SprintMemberEffort } from "@/models/interfaces";

function makeEffort(overrides: Partial<SprintMemberEffort> = {}): SprintMemberEffort {
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
    bugCountTotal: 1,
    bugCountCompleted: 1,
    totalOriginalEstimate: 60,
    totalCompletedWork: 50,
    totalRemainingWork: 10,
    estimatedVsActualRatio: 1.2,
    availableHours: 60,
    hoursUtilizationPct: 83.3,
    sprintProgress: 1.0,
    ...overrides,
  };
}

describe("getCellDisplayState", () => {
  it("returns no holiday and no days-off badge when no days off", () => {
    const state = getCellDisplayState(makeEffort());
    expect(state.isOnHoliday).toBe(false);
    expect(state.totalDaysOff).toBe(0);
    expect(state.showDaysOff).toBe(false);
  });

  it("shows days-off badge when personal days off exist", () => {
    const state = getCellDisplayState(
      makeEffort({
        workingDays: 6,
        personalDaysOffCount: 4,
      })
    );
    expect(state.isOnHoliday).toBe(false);
    expect(state.totalDaysOff).toBe(4);
    expect(state.showDaysOff).toBe(true);
    expect(state.personalDaysOff).toBe(4);
    expect(state.teamDaysOff).toBe(0);
  });

  it("shows days-off badge when team days off exist", () => {
    const state = getCellDisplayState(
      makeEffort({
        workingDays: 8,
        teamDaysOffCount: 2,
      })
    );
    expect(state.isOnHoliday).toBe(false);
    expect(state.totalDaysOff).toBe(2);
    expect(state.showDaysOff).toBe(true);
    expect(state.teamDaysOff).toBe(2);
    expect(state.personalDaysOff).toBe(0);
  });

  it("combines team and personal days off", () => {
    const state = getCellDisplayState(
      makeEffort({
        workingDays: 5,
        teamDaysOffCount: 2,
        personalDaysOffCount: 3,
      })
    );
    expect(state.totalDaysOff).toBe(5);
    expect(state.showDaysOff).toBe(true);
    expect(state.teamDaysOff).toBe(2);
    expect(state.personalDaysOff).toBe(3);
  });

  it("returns isOnHoliday when workingDays is 0", () => {
    const state = getCellDisplayState(
      makeEffort({
        workingDays: 0,
        teamDaysOffCount: 5,
        personalDaysOffCount: 5,
      })
    );
    expect(state.isOnHoliday).toBe(true);
    expect(state.totalDaysOff).toBe(10);
    expect(state.showDaysOff).toBe(false);
  });

  it("returns isOnHoliday when all days are team holidays", () => {
    const state = getCellDisplayState(
      makeEffort({
        workingDays: 0,
        teamDaysOffCount: 10,
        personalDaysOffCount: 0,
      })
    );
    expect(state.isOnHoliday).toBe(true);
    expect(state.totalDaysOff).toBe(10);
  });

  it("returns isOnHoliday when all days are personal leave", () => {
    const state = getCellDisplayState(
      makeEffort({
        workingDays: 0,
        teamDaysOffCount: 0,
        personalDaysOffCount: 10,
      })
    );
    expect(state.isOnHoliday).toBe(true);
    expect(state.totalDaysOff).toBe(10);
  });
});
