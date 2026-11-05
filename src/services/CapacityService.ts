import { WorkRestClient } from "azure-devops-extension-api/Work";
import { getClient } from "azure-devops-extension-api";
import { TeamContext } from "azure-devops-extension-api/Core";
import {
  MemberCapacity,
  TeamDaysOff,
  ProjectContext,
  TeamInfo,
  SprintInfo,
} from "../models/interfaces";

export class CapacityService {
  private workClient: WorkRestClient;

  constructor() {
    this.workClient = getClient(WorkRestClient);
  }

  private buildTeamContext(project: ProjectContext, team: TeamInfo): TeamContext {
    return {
      projectId: project.id,
      project: project.name,
      teamId: team.id,
      team: team.name,
    };
  }

  async getMemberCapacities(
    project: ProjectContext,
    team: TeamInfo,
    sprint: SprintInfo
  ): Promise<MemberCapacity[]> {
    const ctx = this.buildTeamContext(project, team);

    const capacityData = await this.workClient.getCapacitiesWithIdentityRefAndTotals(
      ctx,
      sprint.id
    );

    return (capacityData.teamMembers || []).map((member) => {
      const activities = (member.activities || []).map((act) => ({
        name: act.name || "Unspecified",
        capacityPerDay: act.capacityPerDay || 0,
      }));

      const totalCapacityPerDay = activities.reduce((sum, act) => sum + act.capacityPerDay, 0);

      // Primary role is the activity with the highest capacity
      const primaryRole =
        activities.length > 0
          ? activities.reduce((max, act) => (act.capacityPerDay > max.capacityPerDay ? act : max))
              .name
          : "Unspecified";

      return {
        memberId: member.teamMember.id,
        memberDisplayName: member.teamMember.displayName,
        memberUniqueName:
          member.teamMember.uniqueName || member.teamMember.displayName || member.teamMember.id,
        memberImageUrl: member.teamMember.imageUrl || "",
        activities,
        totalCapacityPerDay,
        primaryRole,
        personalDaysOff: (member.daysOff || []).map((d) => ({
          start: new Date(d.start),
          end: new Date(d.end),
        })),
      };
    });
  }

  async getTeamDaysOff(
    project: ProjectContext,
    team: TeamInfo,
    sprint: SprintInfo
  ): Promise<TeamDaysOff> {
    const ctx = this.buildTeamContext(project, team);
    const daysOff = await this.workClient.getTeamDaysOff(ctx, sprint.id);

    return {
      daysOff: (daysOff.daysOff || []).map((d) => ({
        start: new Date(d.start),
        end: new Date(d.end),
      })),
    };
  }
}
