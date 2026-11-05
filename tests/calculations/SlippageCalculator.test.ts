import { SlippageCalculator } from "@/calculations/SlippageCalculator";
import { WorkItemData } from "@/models/interfaces";

function makeWorkItem(overrides: Partial<WorkItemData>): WorkItemData {
  return {
    id: 1,
    type: "Product Backlog Item",
    title: "Test PBI",
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

describe("SlippageCalculator", () => {
  const calc = new SlippageCalculator();

  it("calculates slippage for a completed PBI", () => {
    const items = [
      makeWorkItem({
        id: 101,
        effort: 3,
        state: "Done",
        activatedDate: new Date("2026-01-05"), // Monday
        stateChangeDate: new Date("2026-01-07"), // Wednesday
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.elapsedDays).toBe(3); // Mon, Tue, Wed = 3 weekdays
    expect(item.slippagePct).toBeCloseTo(100, 5); // 3/3 * 100
    expect(item.isOngoing).toBe(false);
    expect(item.status).toBe("on-track"); // exactly 100% = on-track (completed within estimate)
  });

  it("marks items with no effort as no-effort", () => {
    const items = [
      makeWorkItem({ id: 102, effort: null, state: "Active" }),
      makeWorkItem({ id: 103, effort: 0, state: "Active" }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].status).toBe("no-effort");
    expect(result.items[1].status).toBe("no-effort");
    expect(result.items[0].elapsedDays).toBeNull();
  });

  it("marks New items as not-started", () => {
    const items = [makeWorkItem({ id: 104, effort: 3, state: "New" })];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].status).toBe("not-started");
    expect(result.items[0].elapsedDays).toBeNull();
  });

  it("marks Approved items as not-started", () => {
    const items = [makeWorkItem({ id: 105, effort: 3, state: "Approved" })];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].status).toBe("not-started");
  });

  it("calculates ongoing slippage for Active items", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Set activated to 10 weekdays ago for predictable test
    const activated = new Date("2026-01-05"); // Monday

    const items = [
      makeWorkItem({
        id: 106,
        effort: 2,
        state: "Active",
        activatedDate: activated,
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    const item = result.items[0];
    expect(item.isOngoing).toBe(true);
    expect(item.elapsedDays).toBeGreaterThan(0);
    expect(item.slippagePct).toBeGreaterThan(0);
  });

  it("calculates ongoing slippage for Committed items", () => {
    const items = [
      makeWorkItem({
        id: 107,
        effort: 5,
        state: "Committed",
        activatedDate: new Date("2026-01-05"),
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].isOngoing).toBe(true);
    expect(result.items[0].status).not.toBe("not-started");
  });

  it("flags items at >= 200% as over", () => {
    const items = [
      makeWorkItem({
        id: 108,
        effort: 2,
        state: "Done",
        activatedDate: new Date("2026-01-05"), // Monday
        stateChangeDate: new Date("2026-01-09"), // Friday = 5 weekdays
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    const item = result.items[0];
    expect(item.elapsedDays).toBe(5);
    expect(item.slippagePct).toBeCloseTo(250, 5); // 5/2 * 100
    expect(item.status).toBe("over");
  });

  it("flags items at 100-199% as at-risk", () => {
    const items = [
      makeWorkItem({
        id: 109,
        effort: 3,
        state: "Done",
        activatedDate: new Date("2026-01-05"), // Monday
        stateChangeDate: new Date("2026-01-08"), // Thursday = 4 weekdays
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    const item = result.items[0];
    expect(item.slippagePct).toBeCloseTo((4 / 3) * 100, 5); // ~133%
    expect(item.status).toBe("at-risk");
  });

  it("flags items at < 100% as on-track", () => {
    const items = [
      makeWorkItem({
        id: 110,
        effort: 5,
        state: "Done",
        activatedDate: new Date("2026-01-05"), // Monday
        stateChangeDate: new Date("2026-01-07"), // Wednesday = 3 weekdays
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    const item = result.items[0];
    expect(item.slippagePct).toBeCloseTo(60, 5); // 3/5 * 100
    expect(item.status).toBe("on-track");
  });

  it("excludes Tasks from slippage calculation", () => {
    const items = [
      makeWorkItem({ id: 111, type: "Task", effort: 3, state: "Done" }),
      makeWorkItem({ id: 112, type: "Product Backlog Item", effort: 3, state: "New" }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(112);
  });

  it("includes Bugs in slippage calculation", () => {
    const items = [
      makeWorkItem({
        id: 113,
        type: "Bug",
        effort: 2,
        state: "Done",
        activatedDate: new Date("2026-01-05"),
        stateChangeDate: new Date("2026-01-06"),
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe("Bug");
  });

  it("computes summary counts correctly", () => {
    const items = [
      makeWorkItem({
        id: 1,
        effort: 5,
        state: "Done",
        activatedDate: new Date("2026-01-05"),
        stateChangeDate: new Date("2026-01-07"),
      }), // 60% = on-track
      makeWorkItem({
        id: 2,
        effort: 3,
        state: "Done",
        activatedDate: new Date("2026-01-05"),
        stateChangeDate: new Date("2026-01-09"),
      }), // 167% = at-risk
      makeWorkItem({
        id: 3,
        effort: 2,
        state: "Done",
        activatedDate: new Date("2026-01-05"),
        stateChangeDate: new Date("2026-01-09"),
      }), // 250% = over
      makeWorkItem({ id: 4, effort: 3, state: "New" }), // not-started
      makeWorkItem({ id: 5, effort: null, state: "Active" }), // no-effort
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.summary.totalItems).toBe(5);
    expect(result.summary.onTrack).toBe(1);
    expect(result.summary.atRisk).toBe(1);
    expect(result.summary.over).toBe(1);
    expect(result.summary.notStarted).toBe(1);
    expect(result.summary.noEffort).toBe(1);
  });

  it("falls back to changedDate when stateChangeDate is null for completed items", () => {
    const items = [
      makeWorkItem({
        id: 114,
        effort: 3,
        state: "Done",
        activatedDate: new Date("2026-01-05"),
        stateChangeDate: null,
        changedDate: new Date("2026-01-07"),
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].elapsedDays).toBe(3);
    expect(result.items[0].status).not.toBe("not-started");
  });

  it("treats exactly 100% as on-track (boundary)", () => {
    const items = [
      makeWorkItem({
        id: 120,
        effort: 3,
        state: "Done",
        activatedDate: new Date("2026-01-05"), // Monday
        stateChangeDate: new Date("2026-01-07"), // Wednesday = 3 weekdays
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].slippagePct).toBeCloseTo(100, 5);
    expect(result.items[0].status).toBe("on-track");
  });

  it("treats exactly 200% as at-risk not over (boundary)", () => {
    const items = [
      makeWorkItem({
        id: 121,
        effort: 2,
        state: "Done",
        activatedDate: new Date("2026-01-05"), // Monday
        stateChangeDate: new Date("2026-01-08"), // Thursday = 4 weekdays
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].slippagePct).toBeCloseTo(200, 5); // 4/2 * 100
    expect(result.items[0].status).toBe("at-risk");
  });

  it("treats Active item with no activatedDate as not-started", () => {
    const items = [
      makeWorkItem({
        id: 115,
        effort: 3,
        state: "Active",
        activatedDate: null,
      }),
    ];

    const result = calc.calculate(items, "s1", "Sprint 1");
    expect(result.items[0].status).toBe("not-started");
  });
});
