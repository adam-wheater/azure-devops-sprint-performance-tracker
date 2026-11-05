import { __setMockClient, __resetMockClients } from "../__mocks__/azure-devops-extension-api";
import { CapacityService } from "@/services/CapacityService";

beforeEach(() => {
  __resetMockClients();
});

const project = { id: "proj-1", name: "MyProject" };
const team = { id: "team-1", name: "Alpha" };
const sprint = {
  id: "sprint-1",
  name: "Sprint 1",
  path: "P\\Sprint 1",
  startDate: new Date("2026-01-05"),
  finishDate: new Date("2026-01-16"),
};

describe("CapacityService", () => {
  describe("getMemberCapacities", () => {
    it("maps API response to MemberCapacity with activities and role", async () => {
      __setMockClient("WorkRestClient", {
        getCapacitiesWithIdentityRefAndTotals: jest.fn().mockResolvedValue({
          teamMembers: [
            {
              teamMember: {
                id: "alice-id",
                displayName: "Alice Johnson",
                uniqueName: "alice@example.com",
                imageUrl: "https://img/alice.png",
              },
              activities: [
                { name: "Development", capacityPerDay: 6 },
                { name: "Testing", capacityPerDay: 2 },
              ],
              daysOff: [{ start: "2026-01-08T00:00:00Z", end: "2026-01-09T00:00:00Z" }],
            },
          ],
        }),
      });

      const service = new CapacityService();
      const capacities = await service.getMemberCapacities(project, team, sprint);

      expect(capacities).toHaveLength(1);
      const alice = capacities[0];
      expect(alice.memberId).toBe("alice-id");
      expect(alice.memberDisplayName).toBe("Alice Johnson");
      expect(alice.memberUniqueName).toBe("alice@example.com");
      expect(alice.memberImageUrl).toBe("https://img/alice.png");
      expect(alice.totalCapacityPerDay).toBe(8);
      expect(alice.primaryRole).toBe("Development"); // highest capacity
      expect(alice.activities).toHaveLength(2);
      expect(alice.personalDaysOff).toHaveLength(1);
    });

    it("handles member with no activities", async () => {
      __setMockClient("WorkRestClient", {
        getCapacitiesWithIdentityRefAndTotals: jest.fn().mockResolvedValue({
          teamMembers: [
            {
              teamMember: {
                id: "bob-id",
                displayName: "Bob",
                uniqueName: "bob@example.com",
                imageUrl: "",
              },
              activities: [],
              daysOff: [],
            },
          ],
        }),
      });

      const service = new CapacityService();
      const capacities = await service.getMemberCapacities(project, team, sprint);

      expect(capacities[0].totalCapacityPerDay).toBe(0);
      expect(capacities[0].primaryRole).toBe("Unspecified");
    });

    it("handles null teamMembers gracefully", async () => {
      __setMockClient("WorkRestClient", {
        getCapacitiesWithIdentityRefAndTotals: jest.fn().mockResolvedValue({
          teamMembers: null,
        }),
      });

      const service = new CapacityService();
      const capacities = await service.getMemberCapacities(project, team, sprint);
      expect(capacities).toEqual([]);
    });

    it("falls back to displayName when uniqueName is missing", async () => {
      __setMockClient("WorkRestClient", {
        getCapacitiesWithIdentityRefAndTotals: jest.fn().mockResolvedValue({
          teamMembers: [
            {
              teamMember: {
                id: "charlie-id",
                displayName: "Charlie",
                uniqueName: undefined,
                imageUrl: null,
              },
              activities: [{ name: "Development", capacityPerDay: 6 }],
              daysOff: null,
            },
          ],
        }),
      });

      const service = new CapacityService();
      const capacities = await service.getMemberCapacities(project, team, sprint);
      expect(capacities[0].memberUniqueName).toBe("Charlie");
      expect(capacities[0].memberImageUrl).toBe("");
      expect(capacities[0].personalDaysOff).toEqual([]);
    });

    it("picks primary role from highest capacity activity", async () => {
      __setMockClient("WorkRestClient", {
        getCapacitiesWithIdentityRefAndTotals: jest.fn().mockResolvedValue({
          teamMembers: [
            {
              teamMember: { id: "d", displayName: "D", uniqueName: "d@example.com", imageUrl: "" },
              activities: [
                { name: "Testing", capacityPerDay: 2 },
                { name: "Design", capacityPerDay: 5 },
                { name: "Development", capacityPerDay: 1 },
              ],
              daysOff: [],
            },
          ],
        }),
      });

      const service = new CapacityService();
      const capacities = await service.getMemberCapacities(project, team, sprint);
      expect(capacities[0].primaryRole).toBe("Design");
    });
  });

  describe("getTeamDaysOff", () => {
    it("maps API response to TeamDaysOff", async () => {
      __setMockClient("WorkRestClient", {
        getTeamDaysOff: jest.fn().mockResolvedValue({
          daysOff: [
            { start: "2026-01-12T00:00:00Z", end: "2026-01-12T00:00:00Z" },
            { start: "2026-01-15T00:00:00Z", end: "2026-01-16T00:00:00Z" },
          ],
        }),
      });

      const service = new CapacityService();
      const result = await service.getTeamDaysOff(project, team, sprint);

      expect(result.daysOff).toHaveLength(2);
      expect(result.daysOff[0].start).toBeInstanceOf(Date);
      expect(result.daysOff[0].end).toBeInstanceOf(Date);
    });

    it("handles null daysOff", async () => {
      __setMockClient("WorkRestClient", {
        getTeamDaysOff: jest.fn().mockResolvedValue({
          daysOff: null,
        }),
      });

      const service = new CapacityService();
      const result = await service.getTeamDaysOff(project, team, sprint);
      expect(result.daysOff).toEqual([]);
    });
  });
});
