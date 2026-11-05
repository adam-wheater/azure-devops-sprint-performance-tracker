import { WorkItemData } from "../models/interfaces";
import { WorkItemType, COMPLETED_STATES } from "../models/enums";

export interface MemberEffortResult {
  memberUniqueName: string;
  totalEffortAssigned: number;
  totalEffortCompleted: number;
  pbiCountTotal: number;
  pbiCountCompleted: number;
  bugCountTotal: number;
  bugCountCompleted: number;
}

export interface EffortCalculationOutput {
  memberResults: Map<string, MemberEffortResult>;
  unmatchedAssignees: string[];
}

export class EffortCalculator {
  /**
   * Calculates effort metrics from PBIs and Bugs per member.
   *
   * totalEffortAssigned = SUM(Effort) for all PBIs/Bugs assigned to member
   * totalEffortCompleted = SUM(Effort) where state IN (Done, Closed, Resolved)
   * effortPerDay = totalEffortCompleted / workingDays (applied later)
   * effortTarget = 1.0 per day
   * effortPerformancePct = (effortPerDay / 1.0) * 100
   */
  calculate(workItems: WorkItemData[], memberUniqueNames: string[]): EffortCalculationOutput {
    const memberResults = new Map<string, MemberEffortResult>();

    for (const name of memberUniqueNames) {
      memberResults.set(name.toLowerCase(), {
        memberUniqueName: name,
        totalEffortAssigned: 0,
        totalEffortCompleted: 0,
        pbiCountTotal: 0,
        pbiCountCompleted: 0,
        bugCountTotal: 0,
        bugCountCompleted: 0,
      });
    }

    const effortItems = workItems.filter(
      (wi) => wi.type === WorkItemType.PBI || wi.type === WorkItemType.Bug
    );

    const unmatchedSet = new Set<string>();
    for (const item of effortItems) {
      const key = item.assignedToUniqueName.toLowerCase();
      const memberResult = memberResults.get(key);
      if (!memberResult) {
        if (key && !unmatchedSet.has(key)) {
          unmatchedSet.add(key);
          console.warn(
            `EffortCalculator: Work item #${item.id} assigned to "${item.assignedToDisplayName}" (${item.assignedToUniqueName}) who is not in the capacity list — their effort will not be tracked.`
          );
        }
        continue;
      }

      const effort = item.effort ?? 0;
      memberResult.totalEffortAssigned += effort;

      const isCompleted = COMPLETED_STATES.includes(item.state);
      if (isCompleted) {
        memberResult.totalEffortCompleted += effort;
      }

      if (item.type === WorkItemType.PBI) {
        memberResult.pbiCountTotal++;
        if (isCompleted) memberResult.pbiCountCompleted++;
      } else if (item.type === WorkItemType.Bug) {
        memberResult.bugCountTotal++;
        if (isCompleted) memberResult.bugCountCompleted++;
      }
    }

    return { memberResults, unmatchedAssignees: Array.from(unmatchedSet) };
  }
}
