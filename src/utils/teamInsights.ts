import { MemberPerformanceSummary, TeamPerformanceData } from "../models/interfaces";

export interface DepartmentMemberSummary extends MemberPerformanceSummary {
  teamIds: string[];
  teamNames: string[];
}

export interface MemberInsight {
  memberId: string;
  memberDisplayName: string;
  memberUniqueName: string;
  memberImageUrl: string;
  primaryRole: string;

  /** Number of sprints in the lookback window where the member had >0 working days. */
  activeSprintCount: number;

  /**
   * Average effort pace as a % of the 1-point-per-day target across active sprints
   * where the member actually had assigned/completed effort.
   * 100 = exactly on pace, &lt;100 = took longer per point, &gt;100 = faster.
   */
  avgEffortPerformancePct: number;
  /** Average effort completion % (completed / assigned) across active sprints with effort. */
  avgEffortCompletionPct: number;
  /** Average hours utilization % across active sprints. */
  avgHoursUtilizationPct: number;

  /**
   * Composite score (0-100). For people with assigned effort, the score is capped
   * by the weakest required signal: pace, completion, or hours. For people with
   * no assigned effort in the lookback window, the score falls back to hours so
   * QA / support-style roles are not penalised for not owning PBIs.
   */
  compositeScore: number;
}

export interface TeamInsights {
  members: MemberInsight[];
  mvps: MemberInsight[];
  needsSupport: MemberInsight[];
}

export interface ScoringOptions {
  /** Number of MVPs to surface. Defaults to 3. */
  mvpCount?: number;
  /** Number of "needs support" entries to surface. Defaults to 3. */
  supportCount?: number;
  /** Minimum active sprints required to be considered. Defaults to 1. */
  minActiveSprints?: number;
}

const DEFAULTS: Required<ScoringOptions> = {
  mvpCount: 3,
  supportCount: 3,
  minActiveSprints: 1,
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getMemberIdentityKey(
  member: Pick<MemberPerformanceSummary, "memberId" | "memberUniqueName">
): string {
  const uniqueName = member.memberUniqueName?.trim().toLowerCase();
  return uniqueName || member.memberId;
}

export function mergeDepartmentMembers(teamData: TeamPerformanceData[]): DepartmentMemberSummary[] {
  const membersByKey = new Map<string, DepartmentMemberSummary>();

  for (const team of teamData) {
    for (const member of team.members) {
      const key = getMemberIdentityKey(member);
      const existing = membersByKey.get(key);

      if (!existing) {
        membersByKey.set(key, {
          ...member,
          sprintData: [...member.sprintData],
          teamIds: [team.team.id],
          teamNames: [team.team.name],
        });
        continue;
      }

      existing.sprintData = [...existing.sprintData, ...member.sprintData];

      if (!existing.teamIds.includes(team.team.id)) {
        existing.teamIds.push(team.team.id);
      }

      if (!existing.teamNames.includes(team.team.name)) {
        existing.teamNames.push(team.team.name);
      }

      if (!existing.memberImageUrl && member.memberImageUrl) {
        existing.memberImageUrl = member.memberImageUrl;
      }

      if (!existing.primaryRole && member.primaryRole) {
        existing.primaryRole = member.primaryRole;
      }
    }
  }

  return Array.from(membersByKey.values());
}

export function computeMemberInsights(
  members: MemberPerformanceSummary[],
  options: ScoringOptions = {}
): TeamInsights {
  const opts = { ...DEFAULTS, ...options };

  const insights: MemberInsight[] = members.map((member) => {
    const activeSprints = member.sprintData.filter((s) => s.workingDays > 0);
    const effortSprints = activeSprints.filter(
      (s) => s.totalEffortAssigned > 0 || s.totalEffortCompleted > 0
    );
    const activeSprintCount = activeSprints.length;
    const effortSprintCount = effortSprints.length;

    const avgEffortPerformancePct =
      effortSprintCount > 0
        ? effortSprints.reduce((sum, s) => sum + s.effortPerformancePct, 0) / effortSprintCount
        : 0;
    const avgEffortCompletionPct =
      effortSprintCount > 0
        ? effortSprints.reduce((sum, s) => sum + s.effortCompletionPct, 0) / effortSprintCount
        : 0;
    const avgHoursUtilizationPct =
      activeSprintCount > 0
        ? activeSprints.reduce((sum, s) => sum + s.hoursUtilizationPct, 0) / activeSprintCount
        : 0;

    // Cap each signal at 100 so an exceptional sprint can't dominate.
    const cappedEffortPerf = clamp(avgEffortPerformancePct, 0, 100);
    const cappedEffortDone = clamp(avgEffortCompletionPct, 0, 100);
    const cappedHours = clamp(avgHoursUtilizationPct, 0, 100);

    const compositeScore =
      effortSprintCount > 0
        ? Math.min(cappedEffortPerf, cappedEffortDone, cappedHours)
        : cappedHours;

    return {
      memberId: member.memberId,
      memberDisplayName: member.memberDisplayName,
      memberUniqueName: member.memberUniqueName,
      memberImageUrl: member.memberImageUrl,
      primaryRole: member.primaryRole,
      activeSprintCount,
      avgEffortPerformancePct,
      avgEffortCompletionPct,
      avgHoursUtilizationPct,
      compositeScore,
    };
  });

  const eligible = insights.filter((m) => m.activeSprintCount >= opts.minActiveSprints);

  const sortedDesc = [...eligible].sort((a, b) => b.compositeScore - a.compositeScore);
  const sortedAsc = [...eligible].sort((a, b) => a.compositeScore - b.compositeScore);

  const mvps = sortedDesc.slice(0, opts.mvpCount);
  const mvpIds = new Set(mvps.map((m) => m.memberId));
  const needsSupport = sortedAsc.filter((m) => !mvpIds.has(m.memberId)).slice(0, opts.supportCount);

  return {
    members: insights,
    mvps,
    needsSupport,
  };
}
