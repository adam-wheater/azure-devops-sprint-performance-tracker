import * as React from "react";
import { useMemo, useState } from "react";
import { MemberPerformanceSummary, TeamInfo, TeamPerformanceData } from "../models/interfaces";
import {
  computeMemberInsights,
  MemberInsight,
  ScoringOptions,
  mergeDepartmentMembers,
} from "../utils/teamInsights";
import { formatPercentage } from "../utils/formatting";
import { Button, Disclosure, EmptyState, Pill, Progress } from "./ui";
import { Avatar, RolePill } from "./MemberBits";

interface TeamInsightsPageProps {
  selectedTeams: TeamInfo[];
  performanceData: Map<string, TeamPerformanceData>;
  performanceLoading: boolean;
}

interface InsightCardProps {
  member: MemberInsight;
  variant: "mvp" | "support";
  rank: number;
  contextBadges?: string[];
}

interface InsightsSectionProps {
  sectionId: string;
  title: string;
  members: MemberPerformanceSummary[];
  mvpTitle: string;
  supportTitle: string;
  mvpHint: string;
  supportHint: string;
  controls?: React.ReactNode;
  memberContextBadges?: Map<string, string[]>;
  scoringOptions?: ScoringOptions;
}

const InsightCard: React.FC<InsightCardProps> = ({ member, variant, rank, contextBadges }) => {
  const isMvp = variant === "mvp";

  const stat = (label: string, value: string, title?: string) => (
    <div title={title}>
      <div className="ax-fine">{label}</div>
      <div style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );

  return (
    <article
      className="ax-card"
      data-testid="insight-card"
      style={{ marginBottom: 12, padding: 16 }}
    >
      <div className="ax-row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 12 }}>
        <Pill tone={isMvp ? "success" : "accent"}>#{rank + 1}</Pill>
        <Avatar name={member.memberDisplayName} imageUrl={member.memberImageUrl} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ax-row">
            <strong>{member.memberDisplayName}</strong>
            {isMvp && <Pill tone="success">MVP</Pill>}
            <RolePill role={member.primaryRole} />
          </div>
          {contextBadges && contextBadges.length > 0 && (
            <div
              className="ax-row"
              style={{ marginTop: 6 }}
              aria-label={`Teams: ${contextBadges.join(", ")}`}
            >
              {contextBadges.map((teamName) => (
                <Pill key={teamName} tone="info" title={teamName}>
                  {teamName}
                </Pill>
              ))}
            </div>
          )}
          <div className="ax-row" style={{ marginTop: 10, gap: 24 }}>
            {stat("Score", member.compositeScore.toFixed(0))}
            {stat(
              "Pace",
              formatPercentage(member.avgEffortPerformancePct),
              "Effort pace vs the 1-point-per-day target. 100 = on pace."
            )}
            {stat(
              "Effort",
              formatPercentage(member.avgEffortCompletionPct),
              "Average effort completion (completed / assigned)."
            )}
            {stat(
              "Hours",
              formatPercentage(member.avgHoursUtilizationPct),
              "Average hours utilization (logged work / capacity)."
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

const InsightsSection: React.FC<InsightsSectionProps> = ({
  sectionId,
  title,
  members,
  mvpTitle,
  supportTitle,
  mvpHint,
  supportHint,
  controls,
  memberContextBadges,
  scoringOptions,
}) => {
  const insights = useMemo(
    () => computeMemberInsights(members, scoringOptions),
    [members, scoringOptions]
  );
  const hasMembers = insights.members.length > 0;

  return (
    <section className="ax-section" aria-labelledby={sectionId}>
      <h2 id={sectionId}>{title}</h2>
      {controls && <div className="ax-toolbar">{controls}</div>}

      {!hasMembers && <EmptyState title="No member performance data available." />}

      {hasMembers && (
        <div className="ax-grid-2">
          <div>
            <h3>{mvpTitle}</h3>
            <p className="ax-help">{mvpHint}</p>
            {insights.mvps.length === 0 ? (
              <EmptyState title="Not enough data to identify MVPs." />
            ) : (
              insights.mvps.map((member, index) => (
                <InsightCard
                  key={member.memberId}
                  member={member}
                  variant="mvp"
                  rank={index}
                  contextBadges={memberContextBadges?.get(member.memberId)}
                />
              ))
            )}
          </div>

          <div>
            <h3>{supportTitle}</h3>
            <p className="ax-help">{supportHint}</p>
            {insights.needsSupport.length === 0 ? (
              <EmptyState title="No members flagged for support." />
            ) : (
              insights.needsSupport.map((member, index) => (
                <InsightCard
                  key={member.memberId}
                  member={member}
                  variant="support"
                  rank={index}
                  contextBadges={memberContextBadges?.get(member.memberId)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export const TeamInsightsPage: React.FC<TeamInsightsPageProps> = ({
  selectedTeams,
  performanceData,
  performanceLoading,
}) => {
  const [departmentTeamFilter, setDepartmentTeamFilter] = useState<string>("all");

  const teamEntries = useMemo(
    () =>
      selectedTeams.flatMap((team) => {
        const data = performanceData.get(team.id);
        return data ? [{ team, data }] : [];
      }),
    [selectedTeams, performanceData]
  );

  const departmentMembers = useMemo(
    () => mergeDepartmentMembers(teamEntries.map((entry) => entry.data)),
    [teamEntries]
  );

  const departmentContextBadges = useMemo(
    () => new Map(departmentMembers.map((member) => [member.memberId, member.teamNames])),
    [departmentMembers]
  );

  const departmentFilterOptions = useMemo(
    () => [
      { id: "all", label: "All" },
      ...teamEntries.map(({ team }) => ({ id: team.id, label: team.name })),
    ],
    [teamEntries]
  );

  const effectiveDepartmentTeamFilter = departmentFilterOptions.some(
    (option) => option.id === departmentTeamFilter
  )
    ? departmentTeamFilter
    : "all";

  const filteredDepartmentMembers = useMemo(
    () =>
      effectiveDepartmentTeamFilter === "all"
        ? departmentMembers
        : departmentMembers.filter((member) =>
            member.teamIds.includes(effectiveDepartmentTeamFilter)
          ),
    [departmentMembers, effectiveDepartmentTeamFilter]
  );

  const showFilterControls = teamEntries.length > 1;
  const isAllMode = showFilterControls && effectiveDepartmentTeamFilter === "all";
  const visibleMemberCount = isAllMode ? 10 : 3;
  const currentScopeLabel =
    effectiveDepartmentTeamFilter === "all"
      ? teamEntries.length === 1
        ? (teamEntries[0]?.team.name ?? "Selected Teams")
        : "Selected Teams"
      : (departmentFilterOptions.find((option) => option.id === effectiveDepartmentTeamFilter)
          ?.label ?? "Selected Teams");
  const scoringOptions = useMemo(
    () => ({ mvpCount: visibleMemberCount, supportCount: visibleMemberCount }),
    [visibleMemberCount]
  );
  const mvpTitle = isAllMode ? `Top ${visibleMemberCount}` : `Top ${visibleMemberCount}`;
  const supportTitle = isAllMode ? `Bottom ${visibleMemberCount}` : `Bottom ${visibleMemberCount}`;
  const mvpHint = isAllMode
    ? "Strongest performers across the full selected scope."
    : "Strongest performers in the current filtered team scope.";
  const supportHint = isAllMode
    ? "Lowest scores across the full selected scope. Use this as a coaching prompt, not a verdict."
    : "Lowest scores in the current filtered team scope. Use this as a coaching prompt, not a verdict.";

  const [explainerOpen, setExplainerOpen] = useState(false);

  return (
    <div>
      <p className="ax-help">
        Identify team members making outsized contributions and those who might benefit from
        support. Each member is scored on three sprint signals, and whichever is strongest wins, so
        different roles can shine in their own way. The selector at the top controls which teams
        feed this page, and the team buttons here narrow the same ranking without repeating separate
        team sections below.
      </p>

      <Disclosure
        open={explainerOpen}
        onToggle={() => setExplainerOpen((open) => !open)}
        summary={<strong>How are these scores calculated?</strong>}
      >
        <p>
          Each member gets a <strong>composite score (0 to 100)</strong> built from three sprint
          signals (averaged across active sprints and capped at 100):
        </p>
        <ul>
          <li>
            <strong>Pace:</strong> effort completed per working day vs the 1-point-per-day target.
            100 = on pace, &lt;100 = took longer per point. Best signal for developers who close
            stories quickly.
          </li>
          <li>
            <strong>Effort completion:</strong> completed effort &divide; assigned effort. Rewards
            finishing what was committed.
          </li>
          <li>
            <strong>Hours utilization:</strong> logged work hours &divide; available capacity. Best
            signal for QAs and others who don&rsquo;t typically own PBIs, since they still log time
            against tasks.
          </li>
        </ul>
        <p>
          For people with assigned effort, the final score is capped by the{" "}
          <strong>weakest required signal</strong>: pace, effort completion, or hours. That means
          someone who finishes 5 points in 20 working days will still score poorly on pace, and
          someone whose logged hours are well below capacity will be penalised even if their effort
          numbers look strong.
        </p>
        <p>
          For people with <strong>no assigned effort</strong> in the lookback window, the score
          falls back to <strong>hours utilization</strong> so QA and support-style roles are not
          penalised just because they do not own PBIs.
        </p>
        <p>
          <strong>Holidays and time off are fully accounted for.</strong> Each sprint&rsquo;s
          capacity uses working days <em>after</em> subtracting team holidays and personal days off,
          and sprints where the member was fully off are excluded from the average. So a target near{" "}
          <strong>100% hours</strong> already reflects holiday and PTO adjusted capacity rather than
          raw calendar time.
        </p>
        <p>
          <strong>This page rolls everybody from the selected teams into one ranking.</strong> Team
          buttons narrow that same list, and people who sit in multiple teams stay visible in each
          matching team filter.
        </p>
        <p>
          In <strong>All</strong> mode the page shows the <strong>top 10</strong> and{" "}
          <strong>bottom 10</strong>. Filtered team views show a tighter <strong>top 3</strong> and{" "}
          <strong>bottom 3</strong>. The lower list is a prompt for a check-in conversation, not a
          verdict.
        </p>
      </Disclosure>

      {performanceLoading && <Progress label="Loading performance data..." indeterminate />}

      {!performanceLoading && teamEntries.length === 0 && (
        <EmptyState title="No teams selected. Choose teams on the Sprint Performance page first." />
      )}

      {!performanceLoading && teamEntries.length > 0 && (
        <InsightsSection
          sectionId="insights-department"
          title={currentScopeLabel}
          members={filteredDepartmentMembers}
          mvpTitle={mvpTitle}
          supportTitle={supportTitle}
          mvpHint={mvpHint}
          supportHint={supportHint}
          controls={
            showFilterControls ? (
              <div className="ax-row" role="group" aria-label="Filter department by team">
                {departmentFilterOptions.map((option) => {
                  const isActive = option.id === effectiveDepartmentTeamFilter;
                  return (
                    <Button
                      key={option.id}
                      size="sm"
                      variant={isActive ? "primary" : "default"}
                      aria-pressed={isActive}
                      onClick={() => setDepartmentTeamFilter(option.id)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            ) : null
          }
          memberContextBadges={departmentContextBadges}
          scoringOptions={scoringOptions}
        />
      )}
    </div>
  );
};
