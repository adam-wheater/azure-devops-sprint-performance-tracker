import { SprintInfo, MemberCapacity, TeamDaysOff } from "../models/interfaces";
import { countWorkingDays } from "../utils/dateUtils";

export interface MemberWorkingDaysResult {
  memberId: string;
  memberDisplayName: string;
  memberImageUrl: string;
  memberUniqueName: string;
  primaryRole: string;
  capacityHoursPerDay: number;
  totalWeekdays: number;
  teamDaysOffCount: number;
  personalDaysOffCount: number;
  workingDays: number;
}

export class WorkingDaysCalculator {
  calculate(
    sprint: SprintInfo,
    memberCapacities: MemberCapacity[],
    teamDaysOff: TeamDaysOff
  ): MemberWorkingDaysResult[] {
    return memberCapacities.map((member) => {
      const result = countWorkingDays(
        sprint.startDate,
        sprint.finishDate,
        teamDaysOff.daysOff,
        member.personalDaysOff
      );

      return {
        memberId: member.memberId,
        memberDisplayName: member.memberDisplayName,
        memberImageUrl: member.memberImageUrl,
        memberUniqueName: member.memberUniqueName,
        primaryRole: member.primaryRole,
        capacityHoursPerDay: member.totalCapacityPerDay,
        totalWeekdays: result.totalWeekdays,
        teamDaysOffCount: result.teamDaysOffCount,
        personalDaysOffCount: result.personalDaysOffCount,
        workingDays: result.workingDays,
      };
    });
  }
}
