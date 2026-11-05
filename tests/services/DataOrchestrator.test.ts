import { __setMockClient, __resetMockClients } from "../__mocks__/azure-devops-extension-api";
import { DataOrchestrator } from "@/services/DataOrchestrator";

beforeEach(() => {
  __resetMockClients();
});

const project = { id: "proj-1", name: "MyProject" };
const team = { id: "team-1", name: "Alpha" };

// Sprint: Mon Jan 5 to Fri Jan 16, 2026 = 10 weekdays
const sprintStart = new Date("2026-01-05");
const sprintEnd = new Date("2026-01-16");

function setupFullMocks() {
  // CoreRestClient — for getAllTeams
  __setMockClient("CoreRestClient", {
    getTeams: jest.fn().mockResolvedValue([
      { id: "team-1", name: "Alpha" },
      { id: "team-2", name: "Bravo" },
    ]),
  });

  // WorkRestClient — for iterations, capacity, team days off
  __setMockClient("WorkRestClient", {
    getTeamIterations: jest.fn().mockResolvedValue([
      {
        id: "sprint-1",
        name: "Sprint 1",
        path: "Project\\Sprint 1",
        attributes: { startDate: sprintStart, finishDate: sprintEnd },
      },
    ]),
    getCapacitiesWithIdentityRefAndTotals: jest.fn().mockResolvedValue({
      teamMembers: [
        {
          teamMember: {
            id: "alice-id",
            displayName: "Alice Johnson",
            uniqueName: "alice@example.com",
            imageUrl: "https://img/alice.png",
          },
          activities: [{ name: "Development", capacityPerDay: 6 }],
          daysOff: [],
        },
        {
          teamMember: {
            id: "bob-id",
            displayName: "Bob Smith",
            uniqueName: "bob@example.com",
            imageUrl: "https://img/bob.png",
          },
          activities: [{ name: "Testing", capacityPerDay: 6 }],
          daysOff: [{ start: "2026-01-08T00:00:00Z", end: "2026-01-08T00:00:00Z" }],
        },
      ],
    }),
    getTeamDaysOff: jest.fn().mockResolvedValue({
      daysOff: [{ start: "2026-01-12T00:00:00Z", end: "2026-01-12T00:00:00Z" }],
    }),
  });

  // WorkItemTrackingRestClient — for WIQL + getWorkItems
  __setMockClient("WorkItemTrackingRestClient", {
    queryByWiql: jest.fn().mockResolvedValue({
      workItems: [{ id: 101 }, { id: 102 }, { id: 103 }, { id: 104 }, { id: 105 }],
    }),
    getWorkItems: jest.fn().mockResolvedValue([
      {
        id: 101,
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "System.Title": "Login feature",
          "System.State": "Done",
          "System.AssignedTo": { uniqueName: "alice@example.com", displayName: "Alice Johnson" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": 5,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
          "Microsoft.VSTS.Scheduling.CompletedWork": null,
          "Microsoft.VSTS.Scheduling.RemainingWork": null,
        },
      },
      {
        id: 102,
        fields: {
          "System.WorkItemType": "Bug",
          "System.Title": "Fix crash",
          "System.State": "Closed",
          "System.AssignedTo": { uniqueName: "bob@example.com", displayName: "Bob Smith" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": 3,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
          "Microsoft.VSTS.Scheduling.CompletedWork": null,
          "Microsoft.VSTS.Scheduling.RemainingWork": null,
        },
      },
      {
        id: 103,
        fields: {
          "System.WorkItemType": "Task",
          "System.Title": "Implement API",
          "System.State": "Done",
          "System.AssignedTo": { uniqueName: "alice@example.com", displayName: "Alice Johnson" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": null,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": 40,
          "Microsoft.VSTS.Scheduling.CompletedWork": 38,
          "Microsoft.VSTS.Scheduling.RemainingWork": 0,
        },
      },
      {
        id: 104,
        fields: {
          "System.WorkItemType": "Task",
          "System.Title": "Write test cases",
          "System.State": "Done",
          "System.AssignedTo": { uniqueName: "bob@example.com", displayName: "Bob Smith" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": null,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": 30,
          "Microsoft.VSTS.Scheduling.CompletedWork": 28,
          "Microsoft.VSTS.Scheduling.RemainingWork": 2,
        },
      },
      {
        id: 105,
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "System.Title": "Dashboard",
          "System.State": "New",
          "System.AssignedTo": { uniqueName: "alice@example.com", displayName: "Alice Johnson" },
          "System.IterationPath": "Project\\Sprint 1",
          "Microsoft.VSTS.Scheduling.Effort": 8,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": null,
          "Microsoft.VSTS.Scheduling.CompletedWork": null,
          "Microsoft.VSTS.Scheduling.RemainingWork": null,
        },
      },
    ]),
  });
}

describe("DataOrchestrator", () => {
  describe("getAllTeams", () => {
    it("fetches and returns teams", async () => {
      setupFullMocks();
      const orchestrator = new DataOrchestrator();
      const teams = await orchestrator.getAllTeams(project);

      expect(teams).toHaveLength(2);
      expect(teams[0].name).toBe("Alpha");
      expect(teams[1].name).toBe("Bravo");
    });
  });

  describe("getTeamPerformance", () => {
    it("returns empty data when team has no sprints", async () => {
      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockResolvedValue([]),
      });

      const orchestrator = new DataOrchestrator();
      const result = await orchestrator.getTeamPerformance(project, team, 3);

      expect(result.sprints).toEqual([]);
      expect(result.members).toEqual([]);
      expect(result.teamTotals).toEqual([]);
      expect(result.summaryStats.sprintCount).toBe(0);
    });

    it("orchestrates full data pipeline end-to-end", async () => {
      setupFullMocks();
      const orchestrator = new DataOrchestrator();
      const result = await orchestrator.getTeamPerformance(project, team, 3);

      // Should have 1 sprint
      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].name).toBe("Sprint 1");

      // Should have 2 members (sorted alphabetically)
      expect(result.members).toHaveLength(2);
      expect(result.members[0].memberDisplayName).toBe("Alice Johnson");
      expect(result.members[0].primaryRole).toBe("Development");
      expect(result.members[1].memberDisplayName).toBe("Bob Smith");
      expect(result.members[1].primaryRole).toBe("Testing");

      // Alice: Sprint 1 data
      const aliceSprint = result.members[0].sprintData[0];
      // 10 weekdays - 1 team day off (Jan 12) = 9 working days
      expect(aliceSprint.workingDays).toBe(9);
      // Alice has 1 PBI done (effort 5), 1 PBI new (effort 8) → assigned 13, completed 5
      expect(aliceSprint.totalEffortAssigned).toBe(13);
      expect(aliceSprint.totalEffortCompleted).toBe(5);
      expect(aliceSprint.effortPerDay).toBeCloseTo(5 / 9, 5);
      // Alice task: 40h estimated, 38h completed
      expect(aliceSprint.totalOriginalEstimate).toBe(40);
      expect(aliceSprint.totalCompletedWork).toBe(38);
      expect(aliceSprint.availableHours).toBe(54); // 9 days × 6h

      // Bob: Sprint 1 data
      const bobSprint = result.members[1].sprintData[0];
      // 10 weekdays - 1 team day off (Jan 12) - 1 personal (Jan 8) = 8 working days
      expect(bobSprint.workingDays).toBe(8);
      // Bob has 1 Bug closed (effort 3)
      expect(bobSprint.totalEffortCompleted).toBe(3);
      // Bob task: 30h estimated, 28h completed
      expect(bobSprint.totalCompletedWork).toBe(28);
      expect(bobSprint.availableHours).toBe(48); // 8 days × 6h

      // Team totals
      expect(result.teamTotals).toHaveLength(1);
      const totals = result.teamTotals[0];
      expect(totals.totalEffortCompleted).toBe(8); // 5 + 3
      expect(totals.totalWorkingDays).toBe(17); // 9 + 8
      expect(totals.totalCompletedWork).toBe(66); // 38 + 28
      expect(totals.totalAvailableHours).toBe(102); // 54 + 48

      // Work item counts
      expect(totals.pbiCountTotal).toBe(2); // 101, 105
      expect(totals.pbiCountCompleted).toBe(1); // 101 Done
      expect(totals.bugCountTotal).toBe(1); // 102
      expect(totals.bugCountCompleted).toBe(1); // 102 Closed
      expect(totals.taskCountTotal).toBe(2); // 103, 104
      expect(totals.taskCountCompleted).toBe(2); // both Done

      // Summary stats
      const stats = result.summaryStats;
      expect(stats.sprintCount).toBe(1);
      expect(stats.avgVelocity).toBe(8); // 8 effort / 1 sprint
      expect(stats.totalPbisCompleted).toBe(1);
      expect(stats.totalPbisAssigned).toBe(2);
      expect(stats.totalBugsCompleted).toBe(1);
      expect(stats.totalBugsAssigned).toBe(1);
      expect(stats.totalTasksCompleted).toBe(2);
      expect(stats.totalTasksAssigned).toBe(2);
    });

    it("calls capacity and work item APIs for each sprint", async () => {
      // Set up 2 sprints
      const sprint2Start = new Date("2026-01-19");
      const sprint2End = new Date("2026-01-30");

      const mockGetCapacities = jest.fn().mockResolvedValue({
        teamMembers: [
          {
            teamMember: { id: "a", displayName: "A", uniqueName: "a@example.com", imageUrl: "" },
            activities: [{ name: "Development", capacityPerDay: 6 }],
            daysOff: [],
          },
        ],
      });
      const mockGetTeamDaysOff = jest.fn().mockResolvedValue({ daysOff: [] });
      const mockQueryByWiql = jest.fn().mockResolvedValue({ workItems: [] });

      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockResolvedValue([
          {
            id: "s1",
            name: "Sprint 1",
            path: "P\\S1",
            attributes: { startDate: sprintStart, finishDate: sprintEnd },
          },
          {
            id: "s2",
            name: "Sprint 2",
            path: "P\\S2",
            attributes: { startDate: sprint2Start, finishDate: sprint2End },
          },
        ]),
        getCapacitiesWithIdentityRefAndTotals: mockGetCapacities,
        getTeamDaysOff: mockGetTeamDaysOff,
      });

      __setMockClient("WorkItemTrackingRestClient", {
        queryByWiql: mockQueryByWiql,
        getWorkItems: jest.fn().mockResolvedValue([]),
      });

      const orchestrator = new DataOrchestrator();
      await orchestrator.getTeamPerformance(project, team, 3);

      // Should be called once per sprint (2 sprints)
      expect(mockGetCapacities).toHaveBeenCalledTimes(2);
      expect(mockGetTeamDaysOff).toHaveBeenCalledTimes(2);
      expect(mockQueryByWiql).toHaveBeenCalledTimes(2);
    });

    it("throws when all sprints fail to load", async () => {
      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockResolvedValue([
          {
            id: "s1",
            name: "Sprint 1",
            path: "P\\S1",
            attributes: { startDate: sprintStart, finishDate: sprintEnd },
          },
        ]),
        getCapacitiesWithIdentityRefAndTotals: jest
          .fn()
          .mockRejectedValue(new Error("Capacity API failed")),
        getTeamDaysOff: jest.fn().mockResolvedValue({ daysOff: [] }),
      });

      __setMockClient("WorkItemTrackingRestClient", {
        queryByWiql: jest.fn().mockResolvedValue({ workItems: [] }),
        getWorkItems: jest.fn().mockResolvedValue([]),
      });

      const orchestrator = new DataOrchestrator();
      await expect(orchestrator.getTeamPerformance(project, team, 3)).rejects.toThrow(
        "Failed to load data for all sprints"
      );
    });

    it("returns partial data when some sprints fail", async () => {
      const sprint2Start = new Date("2026-01-19");
      const sprint2End = new Date("2026-01-30");

      let callCount = 0;
      const mockGetCapacities = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            teamMembers: [
              {
                teamMember: {
                  id: "a",
                  displayName: "A",
                  uniqueName: "a@example.com",
                  imageUrl: "",
                },
                activities: [{ name: "Development", capacityPerDay: 6 }],
                daysOff: [],
              },
            ],
          });
        }
        return Promise.reject(new Error("Sprint 2 capacity failed"));
      });

      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockResolvedValue([
          {
            id: "s1",
            name: "Sprint 1",
            path: "P\\S1",
            attributes: { startDate: sprintStart, finishDate: sprintEnd },
          },
          {
            id: "s2",
            name: "Sprint 2",
            path: "P\\S2",
            attributes: { startDate: sprint2Start, finishDate: sprint2End },
          },
        ]),
        getCapacitiesWithIdentityRefAndTotals: mockGetCapacities,
        getTeamDaysOff: jest.fn().mockResolvedValue({ daysOff: [] }),
      });

      __setMockClient("WorkItemTrackingRestClient", {
        queryByWiql: jest.fn().mockResolvedValue({ workItems: [] }),
        getWorkItems: jest.fn().mockResolvedValue([]),
      });

      const orchestrator = new DataOrchestrator();
      const result = await orchestrator.getTeamPerformance(project, team, 3);

      // Should have data from sprint 1 only
      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].name).toBe("Sprint 1");
    });

    it("clamps lookback to valid range", async () => {
      const mockGetIterations = jest.fn().mockResolvedValue([]);
      __setMockClient("WorkRestClient", {
        getTeamIterations: mockGetIterations,
      });

      const orchestrator = new DataOrchestrator();

      // NaN should be clamped to MIN_LOOKBACK (1)
      await orchestrator.getTeamPerformance(project, team, NaN);
      expect(mockGetIterations).toHaveBeenCalledTimes(1);

      // Negative should be clamped to MIN_LOOKBACK (1)
      await orchestrator.getTeamPerformance(project, team, -5);
      expect(mockGetIterations).toHaveBeenCalledTimes(2);
    });
  });

  describe("getActiveTeams", () => {
    it("returns only teams with recent sprints", async () => {
      let callCount = 0;
      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // team-1 has sprints
            return Promise.resolve([
              {
                id: "s1",
                name: "Sprint 1",
                path: "P\\S1",
                attributes: { startDate: sprintStart, finishDate: sprintEnd },
              },
            ]);
          }
          // team-2 has no sprints
          return Promise.resolve([]);
        }),
      });

      const orchestrator = new DataOrchestrator();
      const allTeams = [
        { id: "team-1", name: "Alpha" },
        { id: "team-2", name: "Bravo" },
      ];

      const active = await orchestrator.getActiveTeams(project, allTeams);

      expect(active).toHaveLength(1);
      expect(active[0].name).toBe("Alpha");
    });

    it("excludes teams whose API call fails", async () => {
      let callCount = 0;
      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([
              {
                id: "s1",
                name: "Sprint 1",
                path: "P\\S1",
                attributes: { startDate: sprintStart, finishDate: sprintEnd },
              },
            ]);
          }
          return Promise.reject(new Error("API error"));
        }),
      });

      const orchestrator = new DataOrchestrator();
      const allTeams = [
        { id: "team-1", name: "Alpha" },
        { id: "team-2", name: "Bravo" },
      ];

      const active = await orchestrator.getActiveTeams(project, allTeams);
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe("Alpha");
    });

    it("returns empty array for empty teams list", async () => {
      const orchestrator = new DataOrchestrator();
      const active = await orchestrator.getActiveTeams(project, []);
      expect(active).toEqual([]);
    });

    it("returns all teams when all have sprints", async () => {
      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockResolvedValue([
          {
            id: "s1",
            name: "Sprint 1",
            path: "P\\S1",
            attributes: { startDate: sprintStart, finishDate: sprintEnd },
          },
        ]),
      });

      const orchestrator = new DataOrchestrator();
      const allTeams = [
        { id: "team-1", name: "Alpha" },
        { id: "team-2", name: "Bravo" },
      ];

      const active = await orchestrator.getActiveTeams(project, allTeams);
      expect(active).toHaveLength(2);
    });

    it("returns empty array when no teams have sprints", async () => {
      __setMockClient("WorkRestClient", {
        getTeamIterations: jest.fn().mockResolvedValue([]),
      });

      const orchestrator = new DataOrchestrator();
      const allTeams = [
        { id: "team-1", name: "Alpha" },
        { id: "team-2", name: "Bravo" },
      ];

      const active = await orchestrator.getActiveTeams(project, allTeams);
      expect(active).toHaveLength(0);
    });
  });
});
