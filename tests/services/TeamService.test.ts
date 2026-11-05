import { __setMockClient, __resetMockClients } from "../__mocks__/azure-devops-extension-api";
import { TeamService } from "@/services/TeamService";

beforeEach(() => {
  __resetMockClients();
});

describe("TeamService", () => {
  it("fetches and sorts teams alphabetically", async () => {
    __setMockClient("CoreRestClient", {
      getTeams: jest.fn().mockResolvedValue([
        { id: "t2", name: "Zebra Team" },
        { id: "t1", name: "Alpha Team" },
        { id: "t3", name: "Middle Team" },
      ]),
    });

    const service = new TeamService();
    const project = { id: "proj-1", name: "MyProject" };
    const teams = await service.getTeams(project);

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe("Alpha Team");
    expect(teams[1].name).toBe("Middle Team");
    expect(teams[2].name).toBe("Zebra Team");
  });

  it("returns empty array when no teams exist", async () => {
    __setMockClient("CoreRestClient", {
      getTeams: jest.fn().mockResolvedValue([]),
    });

    const service = new TeamService();
    const teams = await service.getTeams({ id: "proj-1", name: "MyProject" });
    expect(teams).toEqual([]);
  });

  it("maps team id and name correctly", async () => {
    __setMockClient("CoreRestClient", {
      getTeams: jest
        .fn()
        .mockResolvedValue([{ id: "abc-123", name: "Dev Team", description: "ignored field" }]),
    });

    const service = new TeamService();
    const teams = await service.getTeams({ id: "proj-1", name: "MyProject" });

    expect(teams[0]).toEqual({ id: "abc-123", name: "Dev Team" });
  });

  it("passes project.id to getTeams API", async () => {
    const mockGetTeams = jest.fn().mockResolvedValue([]);
    __setMockClient("CoreRestClient", {
      getTeams: mockGetTeams,
    });

    const service = new TeamService();
    await service.getTeams({ id: "proj-42", name: "TestProject" });

    expect(mockGetTeams).toHaveBeenCalledWith("proj-42");
  });

  it("propagates API errors", async () => {
    __setMockClient("CoreRestClient", {
      getTeams: jest.fn().mockRejectedValue(new Error("Network error")),
    });

    const service = new TeamService();
    await expect(service.getTeams({ id: "proj-1", name: "MyProject" })).rejects.toThrow(
      "Network error"
    );
  });
});
