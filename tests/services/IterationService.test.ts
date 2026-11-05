import { __setMockClient, __resetMockClients } from "../__mocks__/azure-devops-extension-api";
import { IterationService } from "@/services/IterationService";

beforeEach(() => {
  __resetMockClients();
  jest.useRealTimers();
});

const project = { id: "proj-1", name: "MyProject" };
const team = { id: "team-1", name: "Alpha" };

describe("IterationService", () => {
  it("returns the N most recent past/current sprints in chronological order", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));

    __setMockClient("WorkRestClient", {
      getTeamIterations: jest.fn().mockResolvedValue([
        {
          id: "s1",
          name: "Sprint 1",
          path: "P\\Sprint 1",
          attributes: { startDate: new Date("2025-12-30"), finishDate: new Date("2026-01-10") },
        },
        {
          id: "s2",
          name: "Sprint 2",
          path: "P\\Sprint 2",
          attributes: { startDate: new Date("2026-01-13"), finishDate: new Date("2026-01-24") },
        },
        {
          id: "s3",
          name: "Sprint 3",
          path: "P\\Sprint 3",
          attributes: { startDate: new Date("2026-01-27"), finishDate: new Date("2026-02-07") },
        },
        {
          id: "s4",
          name: "Sprint 4 (future)",
          path: "P\\Sprint 4",
          attributes: { startDate: new Date("2026-03-10"), finishDate: new Date("2026-03-21") },
        },
      ]),
    });

    const service = new IterationService();
    const sprints = await service.getRecentSprints(project, team, 2);

    // Should get 2 most recent past sprints, in chronological order
    expect(sprints).toHaveLength(2);
    expect(sprints[0].name).toBe("Sprint 2");
    expect(sprints[1].name).toBe("Sprint 3");
  });

  it("filters out iterations without dates", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));

    __setMockClient("WorkRestClient", {
      getTeamIterations: jest.fn().mockResolvedValue([
        {
          id: "s1",
          name: "Sprint 1",
          path: "P\\Sprint 1",
          attributes: { startDate: new Date("2026-01-05"), finishDate: new Date("2026-01-16") },
        },
        {
          id: "s-no-dates",
          name: "Backlog",
          path: "P\\Backlog",
          attributes: {},
        },
        {
          id: "s-null",
          name: "Null Sprint",
          path: "P\\Null",
          attributes: null as any,
        },
      ]),
    });

    const service = new IterationService();
    const sprints = await service.getRecentSprints(project, team, 10);

    expect(sprints).toHaveLength(1);
    expect(sprints[0].name).toBe("Sprint 1");
  });

  it("returns empty array when no sprints exist", async () => {
    __setMockClient("WorkRestClient", {
      getTeamIterations: jest.fn().mockResolvedValue([]),
    });

    const service = new IterationService();
    const sprints = await service.getRecentSprints(project, team, 3);
    expect(sprints).toEqual([]);
  });

  it("returns all sprints when lookback exceeds available count", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));

    __setMockClient("WorkRestClient", {
      getTeamIterations: jest.fn().mockResolvedValue([
        {
          id: "s1",
          name: "Sprint 1",
          path: "P\\Sprint 1",
          attributes: { startDate: new Date("2026-01-05"), finishDate: new Date("2026-01-16") },
        },
      ]),
    });

    const service = new IterationService();
    const sprints = await service.getRecentSprints(project, team, 10);
    expect(sprints).toHaveLength(1);
  });

  it("includes a sprint that started today (in-progress)", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-01T12:00:00Z"));

    __setMockClient("WorkRestClient", {
      getTeamIterations: jest.fn().mockResolvedValue([
        {
          id: "s1",
          name: "Current Sprint",
          path: "P\\Current",
          attributes: { startDate: new Date("2026-02-01"), finishDate: new Date("2026-02-14") },
        },
      ]),
    });

    const service = new IterationService();
    const sprints = await service.getRecentSprints(project, team, 5);
    expect(sprints).toHaveLength(1);
    expect(sprints[0].name).toBe("Current Sprint");
  });

  it("passes correct team context to API", async () => {
    const mockGetIterations = jest.fn().mockResolvedValue([]);
    __setMockClient("WorkRestClient", {
      getTeamIterations: mockGetIterations,
    });

    const service = new IterationService();
    await service.getRecentSprints(project, team, 3);

    expect(mockGetIterations).toHaveBeenCalledWith({
      projectId: "proj-1",
      project: "MyProject",
      teamId: "team-1",
      team: "Alpha",
    });
  });

  it("propagates API errors", async () => {
    __setMockClient("WorkRestClient", {
      getTeamIterations: jest.fn().mockRejectedValue(new Error("403 Forbidden")),
    });

    const service = new IterationService();
    await expect(service.getRecentSprints(project, team, 3)).rejects.toThrow("403 Forbidden");
  });
});
