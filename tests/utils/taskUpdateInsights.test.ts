import { computeTaskUpdateInsights, CapacityMemberSnapshot } from "@/utils/taskUpdateInsights";
import { TaskUpdateActivity } from "@/services/TaskUpdateService";

function makeUser(
  id: string,
  name: string,
  email: string,
  role: string = "Development"
): CapacityMemberSnapshot {
  return {
    memberId: id,
    memberDisplayName: name,
    memberUniqueName: email,
    memberImageUrl: "",
    primaryRole: role,
    teamNames: ["Alpha"],
  };
}

function makeUpdate(
  userEmail: string,
  changedDate: string,
  completedWork: number
): TaskUpdateActivity {
  return {
    id: 1,
    title: "Task",
    assignedToUniqueName: userEmail,
    assignedToDisplayName: "",
    changedDate: new Date(changedDate),
    completedWork,
    iterationPath: "Project\\Sprint 1",
  };
}

describe("computeTaskUpdateInsights", () => {
  const now = new Date("2026-05-14T14:00:00Z");

  it("flags users with no updates in the last 24 hours", () => {
    const users = [
      makeUser("u1", "Alice", "alice@example.com"),
      makeUser("u2", "Bob", "bob@example.com"),
    ];
    const updates = [makeUpdate("alice@example.com", "2026-05-14T10:00:00Z", 2)];

    const result = computeTaskUpdateInsights(users, updates, now);

    expect(result.notUpdatedInLast24Hours.map((u) => u.memberDisplayName)).toEqual(["Bob"]);
  });

  it("flags users below 6 completed hours in the last 6 hours", () => {
    const users = [
      makeUser("u1", "Alice", "alice@example.com"),
      makeUser("u2", "Bob", "bob@example.com"),
    ];
    const updates = [
      makeUpdate("alice@example.com", "2026-05-14T11:00:00Z", 2.5),
      makeUpdate("alice@example.com", "2026-05-14T12:00:00Z", 2.5),
      makeUpdate("bob@example.com", "2026-05-14T09:00:00Z", 1),
    ];

    const result = computeTaskUpdateInsights(users, updates, now);

    const belowTarget = result.below6HoursInLast6Hours.map((u) => u.memberDisplayName);
    expect(belowTarget).toContain("Alice");
    expect(belowTarget).toContain("Bob");
  });

  it("does not flag users that meet the 6-hour threshold", () => {
    const users = [makeUser("u1", "Alice", "alice@example.com")];
    const updates = [
      makeUpdate("alice@example.com", "2026-05-14T09:30:00Z", 3),
      makeUpdate("alice@example.com", "2026-05-14T12:30:00Z", 3),
    ];

    const result = computeTaskUpdateInsights(users, updates, now);

    expect(result.below6HoursInLast6Hours).toHaveLength(0);
  });

  it("matches using display name fallback when unique name is missing", () => {
    const users = [makeUser("u1", "Alice Jones", "", "Development")];
    const updates: TaskUpdateActivity[] = [
      {
        id: 101,
        title: "Task",
        assignedToUniqueName: "",
        assignedToDisplayName: "Alice Jones",
        changedDate: new Date("2026-05-14T12:00:00Z"),
        completedWork: 6,
        iterationPath: "Project\\Sprint 1",
      },
    ];

    const result = computeTaskUpdateInsights(users, updates, now);
    expect(result.notUpdatedInLast24Hours).toHaveLength(0);
    expect(result.below6HoursInLast6Hours).toHaveLength(0);
  });
});
