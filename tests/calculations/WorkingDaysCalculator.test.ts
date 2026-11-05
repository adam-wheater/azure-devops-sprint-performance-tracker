import { WorkingDaysCalculator } from "@/calculations/WorkingDaysCalculator";
import { SprintInfo, MemberCapacity, TeamDaysOff } from "@/models/interfaces";

const sprint: SprintInfo = {
  id: "sprint-1",
  name: "Sprint 1",
  path: "Project\\Sprint 1",
  startDate: new Date("2026-01-05"), // Monday
  finishDate: new Date("2026-01-16"), // Friday - 10 weekdays
};

function makeMember(overrides: Partial<MemberCapacity> = {}): MemberCapacity {
  return {
    memberId: "alice-id",
    memberDisplayName: "Alice",
    memberUniqueName: "alice@example.com",
    memberImageUrl: "https://img/alice.png",
    activities: [{ name: "Development", capacityPerDay: 6 }],
    totalCapacityPerDay: 6,
    primaryRole: "Development",
    personalDaysOff: [],
    ...overrides,
  };
}

describe("WorkingDaysCalculator", () => {
  const calc = new WorkingDaysCalculator();

  it("calculates working days for a standard sprint", () => {
    const results = calc.calculate(sprint, [makeMember()], { daysOff: [] });

    expect(results).toHaveLength(1);
    expect(results[0].totalWeekdays).toBe(10);
    expect(results[0].workingDays).toBe(10);
    expect(results[0].teamDaysOffCount).toBe(0);
    expect(results[0].personalDaysOffCount).toBe(0);
  });

  it("subtracts team days off", () => {
    const teamDaysOff: TeamDaysOff = {
      daysOff: [{ start: new Date("2026-01-08"), end: new Date("2026-01-09") }],
    };
    const results = calc.calculate(sprint, [makeMember()], teamDaysOff);

    expect(results[0].teamDaysOffCount).toBe(2);
    expect(results[0].workingDays).toBe(8);
  });

  it("subtracts personal days off", () => {
    const member = makeMember({
      personalDaysOff: [{ start: new Date("2026-01-12"), end: new Date("2026-01-13") }],
    });
    const results = calc.calculate(sprint, [member], { daysOff: [] });

    expect(results[0].personalDaysOffCount).toBe(2);
    expect(results[0].workingDays).toBe(8);
  });

  it("maps member fields correctly", () => {
    const member = makeMember({
      memberId: "bob-id",
      memberDisplayName: "Bob",
      memberUniqueName: "bob@example.com",
      memberImageUrl: "https://img/bob.png",
      primaryRole: "Testing",
      totalCapacityPerDay: 4,
    });
    const results = calc.calculate(sprint, [member], { daysOff: [] });

    expect(results[0].memberId).toBe("bob-id");
    expect(results[0].memberDisplayName).toBe("Bob");
    expect(results[0].memberUniqueName).toBe("bob@example.com");
    expect(results[0].memberImageUrl).toBe("https://img/bob.png");
    expect(results[0].primaryRole).toBe("Testing");
    expect(results[0].capacityHoursPerDay).toBe(4);
  });

  it("handles multiple members independently", () => {
    const alice = makeMember({
      personalDaysOff: [{ start: new Date("2026-01-08"), end: new Date("2026-01-08") }],
    });
    const bob = makeMember({
      memberId: "bob-id",
      memberDisplayName: "Bob",
      memberUniqueName: "bob@example.com",
      personalDaysOff: [{ start: new Date("2026-01-12"), end: new Date("2026-01-14") }],
    });
    const results = calc.calculate(sprint, [alice, bob], { daysOff: [] });

    expect(results).toHaveLength(2);
    expect(results[0].workingDays).toBe(9); // Alice: 10 - 1
    expect(results[1].workingDays).toBe(7); // Bob: 10 - 3 (Jan 12 Mon, 13 Tue, 14 Wed)
  });

  it("handles empty member list", () => {
    const results = calc.calculate(sprint, [], { daysOff: [] });
    expect(results).toEqual([]);
  });
});
