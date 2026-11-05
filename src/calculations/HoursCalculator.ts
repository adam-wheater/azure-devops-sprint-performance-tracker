import { WorkItemData } from "../models/interfaces";
import { WorkItemType } from "../models/enums";

export interface MemberHoursResult {
  memberUniqueName: string;
  totalOriginalEstimate: number;
  totalCompletedWork: number;
  totalRemainingWork: number;
}

export class HoursCalculator {
  /**
   * Calculates hours metrics from Tasks per member.
   *
   * totalOriginalEstimate = SUM(OriginalEstimate) for all tasks
   * totalCompletedWork = SUM(CompletedWork) for all tasks
   * totalRemainingWork = SUM(RemainingWork) for all tasks
   * availableHours = workingDays * capacityHoursPerDay (applied later)
   * estimatedVsActualRatio = totalOriginalEstimate / totalCompletedWork
   * hoursUtilizationPct = (totalCompletedWork / availableHours) * 100
   */
  calculate(
    workItems: WorkItemData[],
    memberUniqueNames: string[]
  ): Map<string, MemberHoursResult> {
    const results = new Map<string, MemberHoursResult>();

    for (const name of memberUniqueNames) {
      results.set(name.toLowerCase(), {
        memberUniqueName: name,
        totalOriginalEstimate: 0,
        totalCompletedWork: 0,
        totalRemainingWork: 0,
      });
    }

    const tasks = workItems.filter((wi) => wi.type === WorkItemType.Task);

    for (const task of tasks) {
      const key = task.assignedToUniqueName.toLowerCase();
      const memberResult = results.get(key);
      if (!memberResult) continue;

      memberResult.totalOriginalEstimate += task.originalEstimate ?? 0;
      memberResult.totalCompletedWork += task.completedWork ?? 0;
      memberResult.totalRemainingWork += task.remainingWork ?? 0;
    }

    return results;
  }
}
