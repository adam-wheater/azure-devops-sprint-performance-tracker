import { TeamService } from "./TeamService";
import { IterationService } from "./IterationService";
import { CapacityService } from "./CapacityService";
import { WorkItemService } from "./WorkItemService";
import { PerformanceAggregator, SprintDataSet } from "../calculations/PerformanceAggregator";
import {
  ProjectContext,
  TeamInfo,
  TeamPerformanceData,
  ThresholdSettings,
} from "../models/interfaces";
import { promiseAllSettledWithLimit } from "../utils/concurrency";
import {
  MAX_CONCURRENT_SPRINTS,
  MAX_CONCURRENT_TEAMS,
  MIN_LOOKBACK,
  MAX_LOOKBACK,
  SPRINT_FETCH_TIMEOUT_MS,
  ACTIVE_TEAM_LOOKBACK,
} from "../utils/constants";

export class DataOrchestrator {
  private teamService: TeamService;
  private iterationService: IterationService;
  private capacityService: CapacityService;
  private workItemService: WorkItemService;
  private aggregator: PerformanceAggregator;

  constructor() {
    this.teamService = new TeamService();
    this.iterationService = new IterationService();
    this.capacityService = new CapacityService();
    this.workItemService = new WorkItemService();
    this.aggregator = new PerformanceAggregator();
  }

  async getAllTeams(project: ProjectContext): Promise<TeamInfo[]> {
    return this.teamService.getTeams(project);
  }

  async getActiveTeams(project: ProjectContext, allTeams: TeamInfo[]): Promise<TeamInfo[]> {
    const results = await promiseAllSettledWithLimit(
      allTeams,
      MAX_CONCURRENT_TEAMS,
      async (team) => {
        const sprints = await this.iterationService.getRecentSprints(
          project,
          team,
          ACTIVE_TEAM_LOOKBACK
        );
        return { team, hasSprints: sprints.length > 0 };
      }
    );

    return results
      .filter(
        (r) =>
          r.status === "fulfilled" &&
          (r as PromiseFulfilledResult<{ team: TeamInfo; hasSprints: boolean }>).value.hasSprints
      )
      .map(
        (r) => (r as PromiseFulfilledResult<{ team: TeamInfo; hasSprints: boolean }>).value.team
      );
  }

  async getTeamPerformance(
    project: ProjectContext,
    team: TeamInfo,
    lookbackCount: number,
    thresholds?: ThresholdSettings
  ): Promise<TeamPerformanceData> {
    const clampedLookback = Math.max(
      MIN_LOOKBACK,
      Math.min(MAX_LOOKBACK, Math.floor(lookbackCount) || MIN_LOOKBACK)
    );

    const sprints = await this.iterationService.getRecentSprints(project, team, clampedLookback);

    if (sprints.length === 0) {
      return {
        team,
        sprints: [],
        members: [],
        teamTotals: [],
        summaryStats: {
          sprintCount: 0,
          avgVelocity: 0,
          totalPbisAssigned: 0,
          totalPbisCompleted: 0,
          totalBugsAssigned: 0,
          totalBugsCompleted: 0,
          totalTasksAssigned: 0,
          totalTasksCompleted: 0,
          avgEffortPerDay: 0,
          avgHoursUtilization: 0,
          avgEffortCompletionRate: 0,
          avgCycleTimeDays: 0,
          avgWorkDistributionScore: 0,
          avgHealthScore: 0,
        },
        slippageData: [],
        bestPracticeData: [],
        failedSprints: [],
        unmatchedAssignees: [],
      };
    }

    // Fetch data for each sprint with concurrency limiting, timeout, and partial failure tolerance
    const settledResults = await promiseAllSettledWithLimit(
      sprints,
      MAX_CONCURRENT_SPRINTS,
      async (sprint): Promise<SprintDataSet> => {
        const fetchData = Promise.all([
          this.capacityService.getMemberCapacities(project, team, sprint),
          this.capacityService.getTeamDaysOff(project, team, sprint),
          this.workItemService.getWorkItemsForSprint(project, sprint),
        ]);

        const timeout = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Timeout loading sprint "${sprint.name}" after ${SPRINT_FETCH_TIMEOUT_MS / 1000}s`
                )
              ),
            SPRINT_FETCH_TIMEOUT_MS
          )
        );

        const [memberCapacities, teamDaysOff, workItems] = await Promise.race([fetchData, timeout]);
        return { sprint, memberCapacities, teamDaysOff, workItems };
      }
    );

    const sprintDataSets: SprintDataSet[] = [];
    const failedSprints: string[] = [];

    for (let i = 0; i < settledResults.length; i++) {
      const result = settledResults[i];
      if (result.status === "fulfilled") {
        sprintDataSets.push(result.value as SprintDataSet);
      } else {
        failedSprints.push(sprints[i].name);
        console.warn(`Failed to load data for sprint "${sprints[i].name}":`, result.reason);
      }
    }

    if (sprintDataSets.length === 0 && failedSprints.length > 0) {
      throw new Error(`Failed to load data for all sprints: ${failedSprints.join(", ")}`);
    }

    const loadedSprints = sprintDataSets.map((ds) => ds.sprint);
    const result = this.aggregator.aggregate(team, loadedSprints, sprintDataSets, thresholds);
    result.failedSprints = failedSprints;
    return result;
  }
}
