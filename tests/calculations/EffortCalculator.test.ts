import { EffortCalculator } from "@/calculations/EffortCalculator";
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

describe("EffortCalculator", () => {
  const calc = new EffortCalculator();

  it("calculates effort for PBIs assigned to known members", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({ effort: 3, state: "Done", assignedToUniqueName: "alice@example.com" }),
      makeWorkItem({ effort: 5, state: "New", assignedToUniqueName: "alice@example.com" }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    const alice = results.get("alice@example.com");

    expect(alice).toBeDefined();
    expect(alice!.totalEffortAssigned).toBe(8);
    expect(alice!.totalEffortCompleted).toBe(3);
  });

  it("counts Bugs as well as PBIs", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({
        type: "Bug",
        effort: 2,
        state: "Closed",
        assignedToUniqueName: "bob@example.com",
      }),
      makeWorkItem({
        type: "Product Backlog Item",
        effort: 4,
        state: "Done",
        assignedToUniqueName: "bob@example.com",
      }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["bob@example.com"]);
    const bob = results.get("bob@example.com");

    expect(bob!.totalEffortAssigned).toBe(6);
    expect(bob!.totalEffortCompleted).toBe(6);
  });

  it("ignores Tasks", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({
        type: "Task",
        effort: 10,
        state: "Done",
        assignedToUniqueName: "alice@example.com",
      }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalEffortAssigned).toBe(0);
  });

  it("handles null effort as 0", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({ effort: null, state: "Done", assignedToUniqueName: "alice@example.com" }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalEffortCompleted).toBe(0);
  });

  it("is case-insensitive on member unique names", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({ effort: 3, state: "Done", assignedToUniqueName: "Alice@Example.com" }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalEffortCompleted).toBe(3);
  });

  it("ignores work items assigned to unknown members", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({ effort: 5, state: "Done", assignedToUniqueName: "unknown@example.com" }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalEffortAssigned).toBe(0);
  });

  it("treats Resolved as completed", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({ effort: 2, state: "Resolved", assignedToUniqueName: "alice@example.com" }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalEffortCompleted).toBe(2);
  });

  it("returns empty results for empty work items", () => {
    const { memberResults: results } = calc.calculate([], ["alice@example.com"]);
    expect(results.get("alice@example.com")!.totalEffortAssigned).toBe(0);
    expect(results.get("alice@example.com")!.totalEffortCompleted).toBe(0);
  });

  it("tracks PBI counts per member", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({
        type: "Product Backlog Item",
        effort: 3,
        state: "Done",
        assignedToUniqueName: "alice@example.com",
      }),
      makeWorkItem({
        type: "Product Backlog Item",
        effort: 5,
        state: "New",
        assignedToUniqueName: "alice@example.com",
      }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    const alice = results.get("alice@example.com")!;
    expect(alice.pbiCountTotal).toBe(2);
    expect(alice.pbiCountCompleted).toBe(1);
    expect(alice.bugCountTotal).toBe(0);
    expect(alice.bugCountCompleted).toBe(0);
  });

  it("tracks Bug counts per member", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({
        type: "Bug",
        effort: 2,
        state: "Closed",
        assignedToUniqueName: "alice@example.com",
      }),
      makeWorkItem({
        type: "Bug",
        effort: 1,
        state: "Active",
        assignedToUniqueName: "alice@example.com",
      }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    const alice = results.get("alice@example.com")!;
    expect(alice.bugCountTotal).toBe(2);
    expect(alice.bugCountCompleted).toBe(1);
    expect(alice.pbiCountTotal).toBe(0);
  });

  it("tracks mixed PBI and Bug counts", () => {
    const workItems: WorkItemData[] = [
      makeWorkItem({
        type: "Product Backlog Item",
        effort: 3,
        state: "Done",
        assignedToUniqueName: "alice@example.com",
      }),
      makeWorkItem({
        type: "Bug",
        effort: 2,
        state: "Closed",
        assignedToUniqueName: "alice@example.com",
      }),
      makeWorkItem({
        type: "Product Backlog Item",
        effort: 5,
        state: "New",
        assignedToUniqueName: "alice@example.com",
      }),
      makeWorkItem({
        type: "Task",
        effort: 10,
        state: "Done",
        assignedToUniqueName: "alice@example.com",
      }),
    ];
    const { memberResults: results } = calc.calculate(workItems, ["alice@example.com"]);
    const alice = results.get("alice@example.com")!;
    expect(alice.pbiCountTotal).toBe(2);
    expect(alice.pbiCountCompleted).toBe(1);
    expect(alice.bugCountTotal).toBe(1);
    expect(alice.bugCountCompleted).toBe(1);
  });

  it("returns zero counts for empty work items", () => {
    const { memberResults: results } = calc.calculate([], ["alice@example.com"]);
    const alice = results.get("alice@example.com")!;
    expect(alice.pbiCountTotal).toBe(0);
    expect(alice.pbiCountCompleted).toBe(0);
    expect(alice.bugCountTotal).toBe(0);
    expect(alice.bugCountCompleted).toBe(0);
  });
});
