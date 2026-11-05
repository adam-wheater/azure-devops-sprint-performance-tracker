import { WorkRestClient } from "azure-devops-extension-api/Work";
import { getClient } from "azure-devops-extension-api";
import { TeamContext } from "azure-devops-extension-api/Core";
import { SprintInfo, ProjectContext, TeamInfo } from "../models/interfaces";

export class IterationService {
  private workClient: WorkRestClient;

  constructor() {
    this.workClient = getClient(WorkRestClient);
  }

  async getRecentSprints(
    project: ProjectContext,
    team: TeamInfo,
    lookbackCount: number
  ): Promise<SprintInfo[]> {
    const teamContext: TeamContext = {
      projectId: project.id,
      project: project.name,
      teamId: team.id,
      team: team.name,
    };

    const allIterations = await this.workClient.getTeamIterations(teamContext);

    const now = new Date();

    const sprintsWithDates = allIterations
      .filter((iter) => iter.attributes && iter.attributes.startDate && iter.attributes.finishDate)
      .map((iter) => ({
        id: iter.id,
        name: iter.name,
        path: iter.path,
        startDate: new Date(iter.attributes.startDate!),
        finishDate: new Date(iter.attributes.finishDate!),
      }));

    // Include past and current sprints (where startDate <= now)
    const pastAndCurrent = sprintsWithDates
      .filter((s) => s.startDate <= now)
      .sort((a, b) => b.finishDate.getTime() - a.finishDate.getTime());

    // Take the most recent N sprints, then reverse to chronological order
    return pastAndCurrent.slice(0, lookbackCount).reverse();
  }
}
