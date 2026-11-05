import { HoursCalculator } from "@/calculations/HoursCalculator";
import { WorkItemData } from "@/models/interfaces";

function makeTask(overrides: Partial<WorkItemData>): WorkItemData {
  return {
    id: 1,
    type: "Task",
    title: "Test Task",
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

describe("HoursCalculator", () => {
  const calc = new HoursCalculator();

  it("sums hours across tasks for a member", () => {
    const workItems: WorkItemData[] = [
      makeTask({ originalEstimate: 8, completedWork: 6, remainingWork: 2 }),
      makeTask({ originalEstimate: 4, completedWork: 4, remainingWork: 0 }),
    ];
    const results = calc.calculate(workItems, ["alice@example.com"]);
    const alice = results.get("alice@example.com");

    expect(alice!.totalOriginalEstimate).toBe(12);
    expect(alice!.totalCompletedWork).toBe(10);
    expect(alice!.totalRemainingWork).toBe(2);
  });

  it("ignores PBIs and Bugs", () => {
    const workItems: WorkItemData[] = [
      makeTask({ type: "Product Backlog Item", originalEstimate: 10, completedWork: 10 }),
      makeTask({ type: "Bug", originalEstimate: 5, completedWork: 5 }),
    ];
    const results = calc.calculate(workItems, ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalOriginalEstimate).toBe(0);
  });

  it("handles null fields as 0", () => {
    const workItems: WorkItemData[] = [
      makeTask({ originalEstimate: null, completedWork: null, remainingWork: null }),
    ];
    const results = calc.calculate(workItems, ["alice@example.com"]);
    const alice = results.get("alice@example.com")!;
    expect(alice.totalOriginalEstimate).toBe(0);
    expect(alice.totalCompletedWork).toBe(0);
    expect(alice.totalRemainingWork).toBe(0);
  });

  it("is case-insensitive on member unique names", () => {
    const workItems: WorkItemData[] = [
      makeTask({ completedWork: 8, assignedToUniqueName: "Alice@Example.com" }),
    ];
    const results = calc.calculate(workItems, ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalCompletedWork).toBe(8);
  });

  it("separates hours by member", () => {
    const workItems: WorkItemData[] = [
      makeTask({ completedWork: 5, assignedToUniqueName: "alice@example.com" }),
      makeTask({ completedWork: 3, assignedToUniqueName: "bob@example.com" }),
    ];
    const results = calc.calculate(workItems, ["alice@example.com", "bob@example.com"]);
    expect(results.get("alice@example.com")!.totalCompletedWork).toBe(5);
    expect(results.get("bob@example.com")!.totalCompletedWork).toBe(3);
  });
});
