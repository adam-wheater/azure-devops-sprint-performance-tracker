import { WorkingDaysCalculator } from "./WorkingDaysCalculator";
import { EffortCalculator } from "./EffortCalculator";
import { HoursCalculator } from "./HoursCalculator";
import { SlippageCalculator } from "./SlippageCalculator";
import { BestPracticeCalculator } from "./BestPracticeCalculator";
import { EFFORT_TARGET_PER_DAY, WorkItemType, COMPLETED_STATES } from "../models/enums";
import { countWeekdaysBetween, calculateSprintProgress } from "../utils/dateUtils";
import {
  TeamInfo,
  SprintInfo,
  MemberCapacity,
  TeamDaysOff,
  WorkItemData,
  SprintMemberEffort,
  SprintTeamTotals,
  SprintSlippageData,
  SprintBestPracticeData,
  TeamPerformanceData,
  TeamSummaryStats,
  MemberPerformanceSummary,
  ThresholdSettings,
} from "../models/interfaces";

export interface SprintDataSet {
  sprint: SprintInfo;
  memberCapacities: MemberCapacity[];
  teamDaysOff: TeamDaysOff;
  workItems: WorkItemData[];
}

export class PerformanceAggregator {
  private workingDaysCalc = new WorkingDaysCalculator();
  private effortCalc = new EffortCalculator();
  private hoursCalc = new HoursCalculator();
  private slippageCalc = new SlippageCalculator();
  private bestPracticeCalc = new BestPracticeCalculator();

  aggregate(
    team: TeamInfo,
    sprints: SprintInfo[],
    sprintDataSets: SprintDataSet[],
    thresholds?: ThresholdSettings
  ): TeamPerformanceData {
    const allSprintMemberEfforts: SprintMemberEffort[] = [];
    const teamTotals: SprintTeamTotals[] = [];
    const allSlippageData: SprintSlippageData[] = [];
    const allUnmatchedAssignees = new Set<string>();

    for (const ds of sprintDataSets) {
      const { sprint, memberCapacities, teamDaysOff, workItems } = ds;
      const memberUniqueNames = memberCapacities.map((m) => m.memberUniqueName);
      const sprintProgress = calculateSprintProgress(sprint.startDate, sprint.finishDate);

      const workingDaysResults = this.workingDaysCalc.calculate(
        sprint,
        memberCapacities,
        teamDaysOff
      );

      const effortOutput = this.effortCalc.calculate(workItems, memberUniqueNames);
      const effortResults = effortOutput.memberResults;
      for (const name of effortOutput.unmatchedAssignees) {
        allUnmatchedAssignees.add(name);
      }

      const hoursResults = this.hoursCalc.calculate(workItems, memberUniqueNames);

      let totalTeamEffortAssigned = 0;
      let totalTeamEffortCompleted = 0;
      let totalTeamWorkingDays = 0;
      let totalTeamOriginalEstimate = 0;
      let totalTeamCompletedWork = 0;
      let totalTeamRemainingWork = 0;
      let totalTeamAvailableHours = 0;

      for (const wdResult of workingDaysResults) {
        const memberKey = wdResult.memberUniqueName.toLowerCase();
        const effort = effortResults.get(memberKey);
        const hours = hoursResults.get(memberKey);

        const workingDays = wdResult.workingDays;
        const capacityHoursPerDay = wdResult.capacityHoursPerDay;
        const availableHours = workingDays * capacityHoursPerDay;

        const totalEffortCompleted = effort?.totalEffortCompleted ?? 0;
        const effortPerDay = workingDays > 0 ? totalEffortCompleted / workingDays : 0;

        const totalCompletedWork = hours?.totalCompletedWork ?? 0;
        const totalOriginalEstimate = hours?.totalOriginalEstimate ?? 0;

        const totalEffortAssigned = effort?.totalEffortAssigned ?? 0;

        const sme: SprintMemberEffort = {
          memberId: wdResult.memberId,
          memberDisplayName: wdResult.memberDisplayName,
          memberUniqueName: wdResult.memberUniqueName,
          memberImageUrl: wdResult.memberImageUrl,
          primaryRole: wdResult.primaryRole,
          sprintId: sprint.id,
          sprintName: sprint.name,

          totalWeekdays: wdResult.totalWeekdays,
          teamDaysOffCount: wdResult.teamDaysOffCount,
          personalDaysOffCount: wdResult.personalDaysOffCount,
          workingDays,
          capacityHoursPerDay,

          totalEffortAssigned,
          totalEffortCompleted,
          effortPerDay,
          effortTarget: EFFORT_TARGET_PER_DAY,
          effortPerformancePct: (effortPerDay / EFFORT_TARGET_PER_DAY) * 100,
          effortCompletionPct:
            totalEffortAssigned > 0 ? (totalEffortCompleted / totalEffortAssigned) * 100 : 0,
          pbiCountTotal: effort?.pbiCountTotal ?? 0,
          pbiCountCompleted: effort?.pbiCountCompleted ?? 0,
          bugCountTotal: effort?.bugCountTotal ?? 0,
          bugCountCompleted: effort?.bugCountCompleted ?? 0,

          totalOriginalEstimate,
          totalCompletedWork,
          totalRemainingWork: hours?.totalRemainingWork ?? 0,
          estimatedVsActualRatio:
            totalCompletedWork > 0 ? totalOriginalEstimate / totalCompletedWork : 0,
          availableHours,
          hoursUtilizationPct: availableHours > 0 ? (totalCompletedWork / availableHours) * 100 : 0,
          sprintProgress,
        };

        allSprintMemberEfforts.push(sme);

        totalTeamEffortAssigned += sme.totalEffortAssigned;
        totalTeamEffortCompleted += sme.totalEffortCompleted;
        totalTeamWorkingDays += sme.workingDays;
        totalTeamOriginalEstimate += sme.totalOriginalEstimate;
        totalTeamCompletedWork += sme.totalCompletedWork;
        totalTeamRemainingWork += sme.totalRemainingWork;
        totalTeamAvailableHours += sme.availableHours;
      }

      const avgEffortPerDay =
        totalTeamWorkingDays > 0 ? totalTeamEffortCompleted / totalTeamWorkingDays : 0;

      // Count work items by type and compute cycle time
      let pbiCountTotal = 0,
        pbiCountCompleted = 0;
      let bugCountTotal = 0,
        bugCountCompleted = 0;
      let taskCountTotal = 0,
        taskCountCompleted = 0;
      const cycleTimes: number[] = [];

      for (const wi of workItems) {
        const isCompleted = COMPLETED_STATES.includes(wi.state);
        if (wi.type === WorkItemType.PBI) {
          pbiCountTotal++;
          if (isCompleted) pbiCountCompleted++;
        } else if (wi.type === WorkItemType.Bug) {
          bugCountTotal++;
          if (isCompleted) bugCountCompleted++;
        } else if (wi.type === WorkItemType.Task) {
          taskCountTotal++;
          if (isCompleted) taskCountCompleted++;
        }

        // Cycle time: completed PBIs/Bugs with activation date
        if (
          isCompleted &&
          (wi.type === WorkItemType.PBI || wi.type === WorkItemType.Bug) &&
          wi.activatedDate
        ) {
          const resolvedDate = wi.stateChangeDate || wi.changedDate;
          if (resolvedDate) {
            cycleTimes.push(countWeekdaysBetween(wi.activatedDate, resolvedDate));
          }
        }
      }

      const avgCycleTimeDays =
        cycleTimes.length > 0 ? cycleTimes.reduce((sum, d) => sum + d, 0) / cycleTimes.length : 0;

      // Work distribution score (coefficient of variation)
      // Exclude testers — they work at the task level, not PBI/Bug assignment
      const memberEfforts = allSprintMemberEfforts
        .filter((sme) => sme.sprintId === sprint.id && sme.primaryRole !== "Testing")
        .map((sme) => sme.totalEffortAssigned);

      let workDistributionScore = 100;
      if (memberEfforts.length > 1) {
        const sum = memberEfforts.reduce((a, b) => a + b, 0);
        const mean = sum / memberEfforts.length;
        if (mean > 0) {
          const variance =
            memberEfforts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / memberEfforts.length;
          const cv = Math.sqrt(variance) / mean;
          workDistributionScore = Math.max(0, Math.round((1 - cv) * 100));
        }
      }

      teamTotals.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        totalEffortAssigned: totalTeamEffortAssigned,
        totalEffortCompleted: totalTeamEffortCompleted,
        totalWorkingDays: totalTeamWorkingDays,
        avgEffortPerDay,
        avgEffortPerformancePct: (avgEffortPerDay / EFFORT_TARGET_PER_DAY) * 100,
        totalOriginalEstimate: totalTeamOriginalEstimate,
        totalCompletedWork: totalTeamCompletedWork,
        totalRemainingWork: totalTeamRemainingWork,
        totalAvailableHours: totalTeamAvailableHours,
        estimatedVsActualRatio:
          totalTeamCompletedWork > 0 ? totalTeamOriginalEstimate / totalTeamCompletedWork : 0,
        hoursUtilizationPct:
          totalTeamAvailableHours > 0
            ? (totalTeamCompletedWork / totalTeamAvailableHours) * 100
            : 0,
        effortCompletionPct:
          totalTeamEffortAssigned > 0
            ? (totalTeamEffortCompleted / totalTeamEffortAssigned) * 100
            : 0,
        avgCycleTimeDays,
        workDistributionScore,
        pbiCountTotal,
        pbiCountCompleted,
        bugCountTotal,
        bugCountCompleted,
        taskCountTotal,
        taskCountCompleted,
      });

      allSlippageData.push(
        this.slippageCalc.calculate(workItems, sprint.id, sprint.name, thresholds)
      );
    }

    // Group by member
    const memberMap = new Map<string, SprintMemberEffort[]>();
    for (const sme of allSprintMemberEfforts) {
      const key = sme.memberId;
      if (!memberMap.has(key)) {
        memberMap.set(key, []);
      }
      memberMap.get(key)!.push(sme);
    }

    const members: MemberPerformanceSummary[] = [];
    for (const [memberId, sprintData] of memberMap.entries()) {
      members.push({
        memberId,
        memberDisplayName: sprintData[0].memberDisplayName,
        memberUniqueName: sprintData[0].memberUniqueName,
        memberImageUrl: sprintData[0].memberImageUrl,
        primaryRole: sprintData[0].primaryRole,
        sprintData,
      });
    }

    members.sort((a, b) => a.memberDisplayName.localeCompare(b.memberDisplayName));

    // Compute summary stats across all sprints
    const sprintCount = teamTotals.length;
    const summaryStats: TeamSummaryStats = {
      sprintCount,
      avgVelocity:
        sprintCount > 0
          ? teamTotals.reduce((sum, t) => sum + t.totalEffortCompleted, 0) / sprintCount
          : 0,
      totalPbisAssigned: teamTotals.reduce((sum, t) => sum + t.pbiCountTotal, 0),
      totalPbisCompleted: teamTotals.reduce((sum, t) => sum + t.pbiCountCompleted, 0),
      totalBugsAssigned: teamTotals.reduce((sum, t) => sum + t.bugCountTotal, 0),
      totalBugsCompleted: teamTotals.reduce((sum, t) => sum + t.bugCountCompleted, 0),
      totalTasksAssigned: teamTotals.reduce((sum, t) => sum + t.taskCountTotal, 0),
      totalTasksCompleted: teamTotals.reduce((sum, t) => sum + t.taskCountCompleted, 0),
      avgEffortPerDay:
        sprintCount > 0
          ? teamTotals.reduce((sum, t) => sum + t.avgEffortPerDay, 0) / sprintCount
          : 0,
      avgHoursUtilization:
        sprintCount > 0
          ? teamTotals.reduce((sum, t) => sum + t.hoursUtilizationPct, 0) / sprintCount
          : 0,
      avgEffortCompletionRate:
        sprintCount > 0
          ? teamTotals.reduce((sum, t) => sum + t.effortCompletionPct, 0) / sprintCount
          : 0,
      avgCycleTimeDays:
        sprintCount > 0
          ? teamTotals.reduce((sum, t) => sum + t.avgCycleTimeDays, 0) / sprintCount
          : 0,
      avgWorkDistributionScore:
        sprintCount > 0
          ? teamTotals.reduce((sum, t) => sum + t.workDistributionScore, 0) / sprintCount
          : 0,
      avgHealthScore: 0, // computed after best practice pass
    };

    // Best practice checks (second pass — needs avgVelocity from summaryStats)
    const allBestPracticeData: SprintBestPracticeData[] = [];
    for (let i = 0; i < sprintDataSets.length; i++) {
      const ds = sprintDataSets[i];
      const totals = teamTotals[i];
      if (!totals) continue;

      // Compute prorated planning utilization for under-planned check.
      // For active sprints, prorate available hours by elapsed working days
      // so members aren't flagged early when tasks are still being assigned.
      let plannedUtilizationPct: number;
      const bpSprintProgress = calculateSprintProgress(ds.sprint.startDate, ds.sprint.finishDate);
      if (bpSprintProgress <= 0) {
        plannedUtilizationPct = 0;
      } else {
        const proratedAvailable = totals.totalAvailableHours * bpSprintProgress;
        plannedUtilizationPct =
          proratedAvailable > 0 ? (totals.totalOriginalEstimate / proratedAvailable) * 100 : 0;
      }

      allBestPracticeData.push(
        this.bestPracticeCalc.calculate(
          ds.workItems,
          ds.memberCapacities,
          ds.teamDaysOff,
          ds.sprint,
          totals.totalEffortAssigned,
          summaryStats.avgVelocity,
          plannedUtilizationPct,
          thresholds
        )
      );
    }

    // Compute avg health score from best practice data
    if (allBestPracticeData.length > 0) {
      summaryStats.avgHealthScore = Math.round(
        allBestPracticeData.reduce((sum, bp) => sum + bp.healthScore, 0) /
          allBestPracticeData.length
      );
    }

    return {
      team,
      sprints,
      members,
      teamTotals,
      summaryStats,
      slippageData: allSlippageData,
      bestPracticeData: allBestPracticeData,
      failedSprints: [],
      unmatchedAssignees: Array.from(allUnmatchedAssignees),
    };
  }
}
