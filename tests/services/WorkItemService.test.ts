import { __setMockClient, __resetMockClients } from "../__mocks__/azure-devops-extension-api";
import { WorkItemService } from "@/services/WorkItemService";

beforeEach(() => {
  __resetMockClients();
});

const project = { id: "proj-1", name: "MyProject" };
const sprint = {
  id: "sprint-1",
  name: "Sprint 1",
  path: "Project\\Sprint 1",
  startDate: new Date("2026-01-05"),
  finishDate: new Date("2026-01-16"),
};

function makeWiResponse(id: number, fields: Record<string, any>) {
  return { id, fields };
}

describe("WorkItemService", () => {
  it("fetches work items via WIQL and maps fields correctly", async () => {
    const mockQueryByWiql = jest.fn().mockResolvedValue({
      workItems: [{ id: 101 }, { id: 102 }],
    });

    const mockGetWorkItems = jest.fn().mockResolvedValue([
      makeWiResponse(101, {
        "System.WorkItemType": "Product Backlog Item",
        "System.Title": "Implement login",
        "System.State": "Done",
        "System.AssignedTo": { uniqueName: "alice@example.com", displayName: "Alice" },
        "System.IterationPath": "Project\\Sprint 1",
        "Microsoft.VSTS.Scheduling.Effort": 5,
        "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
        "Microsoft.VSTS.Scheduling.CompletedWork": null,
        "Microsoft.VSTS.Scheduling.RemainingWork": null,
      }),
      makeWiResponse(102, {
        "System.WorkItemType": "Task",
        "System.Title": "Write tests",
        "System.State": "Active",
        "System.AssignedTo": { uniqueName: "bob@example.com", displayName: "Bob" },
        "System.IterationPath": "Project\\Sprint 1",
        "Microsoft.VSTS.Scheduling.Effort": null,
        "Microsoft.VSTS.Scheduling.OriginalEstimate": 8,
        "Microsoft.VSTS.Scheduling.CompletedWork": 3,
        "Microsoft.VSTS.Scheduling.RemainingWork": 5,
      }),
    ]);

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: mockQueryByWiql,
      getWorkItems: mockGetWorkItems,
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);

    expect(result).toHaveLength(2);

    // PBI mapping
    expect(result[0].id).toBe(101);
    expect(result[0].type).toBe("Product Backlog Item");
    expect(result[0].state).toBe("Done");
    expect(result[0].assignedToUniqueName).toBe("alice@example.com");
    expect(result[0].effort).toBe(5);
    expect(result[0].originalEstimate).toBeNull();

    // Task mapping
    expect(result[1].id).toBe(102);
    expect(result[1].type).toBe("Task");
    expect(result[1].originalEstimate).toBe(8);
    expect(result[1].completedWork).toBe(3);
    expect(result[1].remainingWork).toBe(5);
  });

  it("returns empty array when WIQL finds no work items", async () => {
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: [] }),
      getWorkItems: jest.fn(),
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);

    expect(result).toEqual([]);
  });

  it("returns empty array when workItems is null", async () => {
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: null }),
      getWorkItems: jest.fn(),
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);
    expect(result).toEqual([]);
  });

  it("batches work item fetches in groups of 200", async () => {
    // Create 450 IDs to test batching
    const ids = Array.from({ length: 450 }, (_, i) => ({ id: i + 1 }));
    const mockGetWorkItems = jest.fn().mockImplementation((batchIds: number[]) => {
      return batchIds.map((id) =>
        makeWiResponse(id, {
          "System.WorkItemType": "Task",
          "System.Title": `Task ${id}`,
          "System.State": "Active",
          "System.AssignedTo": { uniqueName: "user@example.com", displayName: "User" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": null,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": 1,
          "Microsoft.VSTS.Scheduling.CompletedWork": 0,
          "Microsoft.VSTS.Scheduling.RemainingWork": 1,
        })
      );
    });

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: ids }),
      getWorkItems: mockGetWorkItems,
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);

    // Should have called getWorkItems 3 times: 200 + 200 + 50
    expect(mockGetWorkItems).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(450);
  });

  it("handles assignedTo without uniqueName", async () => {
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      getWorkItems: jest.fn().mockResolvedValue([
        makeWiResponse(1, {
          "System.WorkItemType": "Task",
          "System.Title": "Task",
          "System.State": "Active",
          "System.AssignedTo": { displayName: "SomeUser", uniqueName: undefined },
          "System.IterationPath": "P\\S",
          "Microsoft.VSTS.Scheduling.Effort": null,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
          "Microsoft.VSTS.Scheduling.CompletedWork": null,
          "Microsoft.VSTS.Scheduling.RemainingWork": null,
        }),
      ]),
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);
    expect(result[0].assignedToUniqueName).toBe("SomeUser");
  });

  it("handles null assignedTo", async () => {
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      getWorkItems: jest.fn().mockResolvedValue([
        makeWiResponse(1, {
          "System.WorkItemType": "Bug",
          "System.Title": "Bug",
          "System.State": "New",
          "System.AssignedTo": null,
          "System.IterationPath": "P\\S",
          "Microsoft.VSTS.Scheduling.Effort": 3,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
          "Microsoft.VSTS.Scheduling.CompletedWork": null,
          "Microsoft.VSTS.Scheduling.RemainingWork": null,
        }),
      ]),
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);
    expect(result[0].assignedToUniqueName).toBe("");
    expect(result[0].assignedToDisplayName).toBe("");
  });

  it("excludes Removed work items in WIQL query", async () => {
    const mockQueryByWiql = jest.fn().mockResolvedValue({ workItems: [] });

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: mockQueryByWiql,
      getWorkItems: jest.fn(),
    });

    const service = new WorkItemService();
    await service.getWorkItemsForSprint(project, sprint);

    const calledQuery = mockQueryByWiql.mock.calls[0][0].query;
    expect(calledQuery).toContain("[System.State] <> 'Removed'");
  });

  it("escapes backslashes in sprint path for WIQL", async () => {
    const sprintWithBackslash = {
      ...sprint,
      path: "Project\\Team\\Sprint 1",
    };

    const mockQueryByWiql = jest.fn().mockResolvedValue({ workItems: [] });

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: mockQueryByWiql,
      getWorkItems: jest.fn(),
    });

    const service = new WorkItemService();
    await service.getWorkItemsForSprint(project, sprintWithBackslash);

    const calledQuery = mockQueryByWiql.mock.calls[0][0].query;
    expect(calledQuery).toContain("Project\\\\Team\\\\Sprint 1");
  });

  it("strips control characters from sprint path", async () => {
    const sprintWithControl = {
      ...sprint,
      path: "Project\x00\\Sprint\x1f 1",
    };

    const mockQueryByWiql = jest.fn().mockResolvedValue({ workItems: [] });

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: mockQueryByWiql,
      getWorkItems: jest.fn(),
    });

    const service = new WorkItemService();
    await service.getWorkItemsForSprint(project, sprintWithControl);

    const calledQuery = mockQueryByWiql.mock.calls[0][0].query;
    // Should not contain control chars other than whitespace (\n, \t, spaces)
    expect(calledQuery).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/);
  });

  it("passes correct project name and fields to getWorkItems", async () => {
    const mockGetWorkItems = jest.fn().mockResolvedValue([
      makeWiResponse(101, {
        "System.WorkItemType": "Task",
        "System.Title": "Test",
        "System.State": "Active",
        "System.AssignedTo": { uniqueName: "u@example.com", displayName: "U" },
        "System.IterationPath": "P\\S",
        "Microsoft.VSTS.Scheduling.Effort": null,
        "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
        "Microsoft.VSTS.Scheduling.CompletedWork": null,
        "Microsoft.VSTS.Scheduling.RemainingWork": null,
      }),
    ]);

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: [{ id: 101 }] }),
      getWorkItems: mockGetWorkItems,
    });

    const service = new WorkItemService();
    await service.getWorkItemsForSprint(project, sprint);

    expect(mockGetWorkItems).toHaveBeenCalledWith(
      [101],
      "MyProject",
      expect.arrayContaining(["System.Id", "System.WorkItemType"])
    );
  });

  it("propagates API errors from queryByWiql", async () => {
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockRejectedValue(new Error("WIQL syntax error")),
      getWorkItems: jest.fn(),
    });

    const service = new WorkItemService();
    await expect(service.getWorkItemsForSprint(project, sprint)).rejects.toThrow(
      "WIQL syntax error"
    );
  });

  it("maps date fields for slippage tracking", async () => {
    const activatedDateStr = "2026-01-06T00:00:00Z";
    const stateChangeDateStr = "2026-01-09T00:00:00Z";
    const changedDateStr = "2026-01-10T00:00:00Z";

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: [{ id: 201 }] }),
      getWorkItems: jest.fn().mockResolvedValue([
        makeWiResponse(201, {
          "System.WorkItemType": "Product Backlog Item",
          "System.Title": "PBI with dates",
          "System.State": "Done",
          "System.AssignedTo": { uniqueName: "alice@example.com", displayName: "Alice" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": 3,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
          "Microsoft.VSTS.Scheduling.CompletedWork": null,
          "Microsoft.VSTS.Scheduling.RemainingWork": null,
          "Microsoft.VSTS.Common.ActivatedDate": activatedDateStr,
          "Microsoft.VSTS.Common.StateChangeDate": stateChangeDateStr,
          "System.ChangedDate": changedDateStr,
        }),
      ]),
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);

    expect(result[0].activatedDate).toEqual(new Date(activatedDateStr));
    expect(result[0].stateChangeDate).toEqual(new Date(stateChangeDateStr));
    expect(result[0].changedDate).toEqual(new Date(changedDateStr));
  });

  it("maps null date fields when not present", async () => {
    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: jest.fn().mockResolvedValue({ workItems: [{ id: 202 }] }),
      getWorkItems: jest.fn().mockResolvedValue([
        makeWiResponse(202, {
          "System.WorkItemType": "Bug",
          "System.Title": "Bug no dates",
          "System.State": "New",
          "System.AssignedTo": { uniqueName: "bob@example.com", displayName: "Bob" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": 2,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
          "Microsoft.VSTS.Scheduling.CompletedWork": null,
          "Microsoft.VSTS.Scheduling.RemainingWork": null,
        }),
      ]),
    });

    const service = new WorkItemService();
    const result = await service.getWorkItemsForSprint(project, sprint);

    expect(result[0].activatedDate).toBeNull();
    expect(result[0].stateChangeDate).toBeNull();
    expect(result[0].changedDate).toBeNull();
  });

  it("escapes single quotes in sprint path for WIQL", async () => {
    const sprintWithQuote = {
      ...sprint,
      path: "Project\\Team's Sprint 1",
    };

    const mockQueryByWiql = jest.fn().mockResolvedValue({ workItems: [] });

    __setMockClient("WorkItemTrackingRestClient", {
      queryByWiql: mockQueryByWiql,
      getWorkItems: jest.fn(),
    });

    const service = new WorkItemService();
    await service.getWorkItemsForSprint(project, sprintWithQuote);

    const calledQuery = mockQueryByWiql.mock.calls[0][0].query;
    expect(calledQuery).toContain("Team''s Sprint 1");
  });
});
