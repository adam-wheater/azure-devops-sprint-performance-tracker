import {
  WorkItemData,
  MemberCapacity,
  TeamDaysOff,
  SprintInfo,
  BestPracticeViolation,
  BestPracticeItem,
  SprintBestPracticeData,
  ThresholdSettings,
} from "../models/interfaces";
import { WorkItemType, ACTIVE_STATES } from "../models/enums";
import { countWeekdaysBetween } from "../utils/dateUtils";
import {
  TASK_MAX_HOURS,
  UTILIZATION_UNDERPLANNED_THRESHOLD,
  VELOCITY_TOLERANCE_PCT,
} from "../utils/constants";

export class BestPracticeCalculator {
  calculate(
    workItems: WorkItemData[],
    memberCapacities: MemberCapacity[],
    teamDaysOff: TeamDaysOff,
    sprint: SprintInfo,
    totalEffortAssigned: number,
    avgVelocity: number,
    hoursUtilizationPct: number,
    thresholds?: ThresholdSettings
  ): SprintBestPracticeData {
    const taskMaxHours = thresholds?.taskMaxHours ?? TASK_MAX_HOURS;
    const utilizationThreshold =
      thresholds?.utilizationUnderplannedThreshold ?? UTILIZATION_UNDERPLANNED_THRESHOLD;
    const velocityTolerancePct = thresholds?.velocityTolerancePct ?? VELOCITY_TOLERANCE_PCT;

    const ruleChecks: (BestPracticeViolation | null)[] = [
      this.checkMissingEffort(workItems),
      this.checkTaskBreakdown(workItems, taskMaxHours),
      this.checkMultipleTasksInProgress(workItems),
      this.checkCapacityWithNoHours(memberCapacities, teamDaysOff, sprint),
      this.checkEffortExceedsVelocity(totalEffortAssigned, avgVelocity, velocityTolerancePct),
      this.checkUnderplannedUtilization(hoursUtilizationPct, utilizationThreshold),
    ];

    const totalRules = ruleChecks.length;
    const violations: BestPracticeViolation[] = ruleChecks.filter(
      (v): v is BestPracticeViolation => v !== null
    );

    const errors = violations.filter((v) => v.severity === "error").length;
    const warnings = violations.filter((v) => v.severity === "warning").length;
    const passed = totalRules - violations.length;

    // Health score: 100 minus weighted penalties (errors=20, warnings=10)
    const healthScore = Math.max(0, Math.min(100, 100 - errors * 20 - warnings * 10));

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      violations,
      summary: { errors, warnings, passed },
      healthScore,
    };
  }

  private checkMissingEffort(workItems: WorkItemData[]): BestPracticeViolation | null {
    const missing = workItems.filter(
      (wi) =>
        (wi.type === WorkItemType.PBI || wi.type === WorkItemType.Bug) &&
        (!wi.effort || wi.effort === 0)
    );
    if (missing.length === 0) return null;

    return {
      rule: "missing-effort",
      severity: "error",
      message: `${missing.length} ${missing.length === 1 ? "item has" : "items have"} no effort assigned`,
      items: missing.map((wi) => ({
        id: wi.id,
        title: wi.title,
        type: wi.type,
        detail: "No effort points assigned",
      })),
    };
  }

  private checkTaskBreakdown(
    workItems: WorkItemData[],
    taskMaxHours: number = TASK_MAX_HOURS
  ): BestPracticeViolation | null {
    const oversized = workItems.filter(
      (wi) =>
        wi.type === WorkItemType.Task &&
        wi.originalEstimate !== null &&
        wi.originalEstimate > taskMaxHours
    );
    if (oversized.length === 0) return null;

    return {
      rule: "task-too-large",
      severity: "warning",
      message: `${oversized.length} ${oversized.length === 1 ? "task exceeds" : "tasks exceed"} ${taskMaxHours}h limit`,
      items: oversized.map((wi) => ({
        id: wi.id,
        title: wi.title,
        type: wi.type,
        detail: `Estimated ${wi.originalEstimate}h (max ${taskMaxHours}h)`,
      })),
    };
  }

  private checkMultipleTasksInProgress(workItems: WorkItemData[]): BestPracticeViolation | null {
    // Single-pass: group active tasks by member
    const byMember = new Map<string, WorkItemData[]>();
    for (const wi of workItems) {
      if (wi.type !== WorkItemType.Task || !ACTIVE_STATES.includes(wi.state)) continue;
      const key = wi.assignedToUniqueName.toLowerCase();
      const arr = byMember.get(key);
      if (arr) arr.push(wi);
      else byMember.set(key, [wi]);
    }

    const items: BestPracticeItem[] = [];
    for (const [, tasks] of byMember) {
      if (tasks.length > 1) {
        items.push({
          title: tasks[0].assignedToDisplayName,
          detail: `${tasks.length} tasks in progress: ${tasks.map((t) => `#${t.id}`).join(", ")}`,
        });
      }
    }

    if (items.length === 0) return null;

    return {
      rule: "multiple-active-tasks",
      severity: "warning",
      message: `${items.length} ${items.length === 1 ? "member has" : "members have"} multiple tasks in progress`,
      items,
    };
  }

  private checkCapacityWithNoHours(
    memberCapacities: MemberCapacity[],
    teamDaysOff: TeamDaysOff,
    sprint: SprintInfo
  ): BestPracticeViolation | null {
    const totalSprintWeekdays = countWeekdaysBetween(sprint.startDate, sprint.finishDate);

    const items: BestPracticeItem[] = [];
    for (const member of memberCapacities) {
      if (member.totalCapacityPerDay > 0) continue;

      // Check if personal days off cover the full sprint
      let personalDaysOff = 0;
      for (const range of member.personalDaysOff) {
        personalDaysOff += countWeekdaysBetween(range.start, range.end);
      }

      // Also count team days off
      let teamDaysOffCount = 0;
      for (const range of teamDaysOff.daysOff) {
        teamDaysOffCount += countWeekdaysBetween(range.start, range.end);
      }

      const coveredDays = personalDaysOff + teamDaysOffCount;
      if (coveredDays >= totalSprintWeekdays) continue;

      items.push({
        title: member.memberDisplayName,
        detail: `Added to capacity with 0h/day and only ${coveredDays} of ${totalSprintWeekdays} days covered by leave`,
      });
    }

    if (items.length === 0) return null;

    return {
      rule: "capacity-no-hours",
      severity: "warning",
      message: `${items.length} ${items.length === 1 ? "member" : "members"} in capacity with no hours and not fully on holiday`,
      items,
    };
  }

  private checkEffortExceedsVelocity(
    totalEffortAssigned: number,
    avgVelocity: number,
    velocityTolerancePct: number = VELOCITY_TOLERANCE_PCT
  ): BestPracticeViolation | null {
    if (avgVelocity <= 0) return null;

    const tolerancePct = Math.max(0, velocityTolerancePct);
    const allowedCeiling = avgVelocity * (1 + tolerancePct / 100);
    if (totalEffortAssigned <= allowedCeiling) return null;

    const overBy = totalEffortAssigned - avgVelocity;
    const overPct = Math.round((overBy / avgVelocity) * 100);
    const roundedVelocity = Math.round(avgVelocity);
    const roundedCeiling = Math.round(allowedCeiling);

    return {
      rule: "over-velocity",
      severity: "error",
      message: `Sprint effort (${totalEffortAssigned}) exceeds team velocity (${roundedVelocity}) by ${overPct}% (tolerance ${tolerancePct}% → ceiling ${roundedCeiling})`,
      items: [
        {
          detail: `${totalEffortAssigned} effort assigned vs ${roundedVelocity} avg velocity (+${Math.round(overBy)} over, beyond ${tolerancePct}% tolerance band of ${roundedCeiling})`,
        },
      ],
    };
  }

  private checkUnderplannedUtilization(
    planningUtilizationPct: number,
    utilizationThreshold: number = UTILIZATION_UNDERPLANNED_THRESHOLD
  ): BestPracticeViolation | null {
    if (planningUtilizationPct <= 0 || planningUtilizationPct >= utilizationThreshold) return null;

    return {
      rule: "underplanned-utilization",
      severity: "warning",
      message: `Planning utilization (${Math.round(planningUtilizationPct)}%) is below ${utilizationThreshold}% threshold`,
      items: [
        {
          detail: `Team has planned only ${Math.round(planningUtilizationPct)}% of prorated capacity, so the sprint may be underplanned`,
        },
      ],
    };
  }
}
