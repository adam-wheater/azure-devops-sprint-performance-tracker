import { __resetMockClients, __setMockClient } from "../__mocks__/azure-devops-extension-api";
import { TaskUpdateService } from "@/services/TaskUpdateService";

beforeEach(() => {
  __resetMockClients();
});

const project = { id: "proj-1", name: "MyProject" };

describe("TaskUpdateService", () => {
  it("returns empty when no iteration paths are provided", async () => {
    const mockQueryByWiql = jest.fn();
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: mockQueryByWiql,
      getWorkItems: jest.fn(),
    });

    const service = new TaskUpdateService();
    const result = await service.getTaskUpdatesForIterations(project, [], new Date());

    expect(result).toEqual([]);
    expect(mockQueryByWiql).not.toHaveBeenCalled();
  });

  it("builds WIQL with iteration IN clause and changed date cutoff", async () => {
    const changedSince = new Date("2026-05-13T14:00:00Z");
    const mockQueryByWiql = jest.fn().mockResolvedValue({ workItems: [] });

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: mockQueryByWiql,
      getWorkItems: jest.fn(),
    });

    const service = new TaskUpdateService();
    await service.getTaskUpdatesForIterations(
      project,
      ["Project\\Sprint 1", "Project\\Team's Sprint 2"],
      changedSince
    );

    const calledQuery = mockQueryByWiql.mock.calls[0][0].query;
    expect(calledQuery).toContain(
      "[System.IterationPath] IN ('Project\\\\Sprint 1', 'Project\\\\Team''s Sprint 2')"
    );
    expect(calledQuery).toContain("[System.ChangedDate] >= '2026-05-13'");
    expect(calledQuery).toContain("[System.WorkItemType] = 'Task'");
  });

  it("maps task updates and defaults completed work to zero", async () => {
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: [{ id: 101 }, { id: 102 }] }),
      getWorkItems: jest.fn().mockResolvedValue([
        {
          id: 101,
          fields: {
            "System.Title": "Task A",
            "System.AssignedTo": { uniqueName: "alice@example.com", displayName: "Alice" },
            "System.IterationPath": "Project\\Sprint 1",
            "System.ChangedDate": "2026-05-14T12:00:00Z",
            "Microsoft.VSTS.Scheduling.CompletedWork": 4,
          },
        },
        {
          id: 102,
          fields: {
            "System.Title": "Task B",
            "System.AssignedTo": { displayName: "Bob" },
            "System.IterationPath": "Project\\Sprint 1",
            "System.ChangedDate": "2026-05-14T12:10:00Z",
            "Microsoft.VSTS.Scheduling.CompletedWork": null,
          },
        },
      ]),
    });

    const service = new TaskUpdateService();
    const result = await service.getTaskUpdatesForIterations(
      project,
      ["Project\\Sprint 1"],
      new Date("2026-05-13T14:00:00Z")
    );

    expect(result).toHaveLength(2);
    expect(result[0].assignedToUniqueName).toBe("alice@example.com");
    expect(result[0].completedWork).toBe(4);
    expect(result[1].assignedToUniqueName).toBe("Bob");
    expect(result[1].completedWork).toBe(0);
  });
});
