import { CoreRestClient } from "azure-devops-extension-api/Core";
import { getClient } from "azure-devops-extension-api";
import { TeamInfo, ProjectContext } from "../models/interfaces";

export class TeamService {
  private coreClient: CoreRestClient;

  constructor() {
    this.coreClient = getClient(CoreRestClient);
  }

  async getTeams(project: ProjectContext): Promise<TeamInfo[]> {
    const teams = await this.coreClient.getTeams(project.id);
    return teams
      .map((t) => ({
        id: t.id,
        name: t.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
