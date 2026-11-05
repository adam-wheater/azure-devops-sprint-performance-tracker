import * as React from "react";
import { useState, useMemo } from "react";
import { MemberPerformanceSummary, SprintInfo, ThresholdSettings } from "../models/interfaces";
import { formatPercentage, formatDecimal, getPerformanceColor } from "../utils/formatting";
import { Disclosure, EmptyState } from "./ui";
import { Avatar, RolePill } from "./MemberBits";
import { Sparkline } from "./Sparkline";

interface Props {
  members: MemberPerformanceSummary[];
  sprints: SprintInfo[];
  thresholds?: ThresholdSettings;
}

interface MemberAggregation {
  totalSprintsActive: number;
  avgCompletion: number;
  avgUtilization: number;
  avgEstAccuracy: number;
  avgEffortPerDay: number;
  consistency: number;
  completionTrend: number[];
  effortTrend: number[];
  estAccuracyPct: number;
}

function computeMemberAggregation(member: MemberPerformanceSummary): MemberAggregation {
  const sprintData = member.sprintData;
  // Only sprints where the member actually worked count towards the averages —
  // summing over every sprint while dividing by the active count inflates the result
  // for anyone who was fully on holiday for a sprint.
  const activeSprints = sprintData.filter((s) => s.workingDays > 0);
  const totalSprintsActive = activeSprints.length;
  const avgCompletion =
    totalSprintsActive > 0
      ? activeSprints.reduce((sum, s) => sum + s.effortCompletionPct, 0) / totalSprintsActive
      : 0;
  const avgUtilization =
    totalSprintsActive > 0
      ? activeSprints.reduce((sum, s) => sum + s.hoursUtilizationPct, 0) / totalSprintsActive
      : 0;
  const avgEstAccuracy =
    totalSprintsActive > 0
      ? activeSprints.reduce((sum, s) => sum + s.estimatedVsActualRatio, 0) / totalSprintsActive
      : 0;
  const avgEffortPerDay =
    totalSprintsActive > 0
      ? activeSprints.reduce((sum, s) => sum + s.effortPerDay, 0) / totalSprintsActive
      : 0;

  let consistency = 100;
  if (totalSprintsActive > 1) {
    const completions = activeSprints.map((s) => s.effortCompletionPct);
    const mean = completions.reduce((a, b) => a + b, 0) / completions.length;
    const variance = completions.reduce((acc, v) => acc + (v - mean) ** 2, 0) / completions.length;
    const stddev = Math.sqrt(variance);
    consistency = Math.max(0, Math.round(100 - stddev * 2));
  }

  const completionTrend = sprintData.map((s) => s.effortCompletionPct);
  const effortTrend = sprintData.map((s) => s.effortPerDay);
  const estAccuracyPct = Math.max(0, 100 - Math.abs(1 - avgEstAccuracy) * 100);

  return {
    totalSprintsActive,
    avgCompletion,
    avgUtilization,
    avgEstAccuracy,
    avgEffortPerDay,
    consistency,
    completionTrend,
    effortTrend,
    estAccuracyPct,
  };
}

const QuickStat: React.FC<{ label: string; color: string; children: React.ReactNode }> = ({
  label,
  color,
  children,
}) => (
  <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 84 }}>
    <span className="ax-fine">{label}</span>
    <span style={{ color, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{children}</span>
  </span>
);

export const MemberScorecard: React.FC<Props> = ({ members, thresholds }) => {
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Memoize per-member aggregation
  const memberAggregations = useMemo(() => {
    const map = new Map<string, MemberAggregation>();
    for (const member of members) {
      map.set(member.memberId, computeMemberAggregation(member));
    }
    return map;
  }, [members]);

  if (members.length === 0) {
    return <EmptyState title="No member data available." />;
  }

  return (
    <div>
      {members.map((member) => {
        const sprintData = member.sprintData;
        const isExpanded = expandedMember === member.memberId;
        const agg = memberAggregations.get(member.memberId)!;
        const completionColor = getPerformanceColor(agg.avgCompletion, thresholds);

        return (
          <Disclosure
            key={member.memberId}
            open={isExpanded}
            onToggle={() => setExpandedMember(isExpanded ? null : member.memberId)}
            summary={
              <span className="ax-row" style={{ gap: 16 }}>
                <span className="ax-row" style={{ flexWrap: "nowrap", minWidth: 220 }}>
                  <Avatar name={member.memberDisplayName} imageUrl={member.memberImageUrl} />
                  <span>
                    <span style={{ display: "block", fontWeight: 600 }}>
                      {member.memberDisplayName}
                    </span>
                    <RolePill role={member.primaryRole} />
                  </span>
                </span>
                <QuickStat label="Completion" color={completionColor}>
                  {formatPercentage(agg.avgCompletion)}
                </QuickStat>
                <QuickStat
                  label="Utilization"
                  color={getPerformanceColor(agg.avgUtilization, thresholds)}
                >
                  {formatPercentage(agg.avgUtilization)}
                </QuickStat>
                <QuickStat
                  label="Est. Accuracy"
                  color={getPerformanceColor(agg.estAccuracyPct, thresholds)}
                >
                  {formatDecimal(agg.avgEstAccuracy, 2)}x
                </QuickStat>
                <QuickStat
                  label="Consistency"
                  color={getPerformanceColor(agg.consistency, thresholds)}
                >
                  {agg.consistency}%
                </QuickStat>
                <Sparkline
                  data={agg.completionTrend}
                  color={completionColor}
                  width={80}
                  height={28}
                  label={`${member.memberDisplayName} completion trend`}
                />
              </span>
            }
          >
            <div className="ax-table-wrap">
              <table className="ax-table">
                <thead>
                  <tr>
                    <th>Sprint</th>
                    <th className="ax-num">Working Days</th>
                    <th className="ax-num">Effort/Day</th>
                    <th className="ax-num">Completion</th>
                    <th className="ax-num">Utilization</th>
                    <th className="ax-num">Est. Accuracy</th>
                    <th className="ax-num">PBIs</th>
                    <th className="ax-num">Bugs</th>
                  </tr>
                </thead>
                <tbody>
                  {sprintData.map((sd) => (
                    <tr
                      key={sd.sprintId}
                      style={sd.workingDays === 0 ? { opacity: 0.6 } : undefined}
                    >
                      <td style={{ fontWeight: 600 }}>{sd.sprintName}</td>
                      <td className="ax-num">{sd.workingDays}</td>
                      <td
                        className="ax-num"
                        style={{
                          color: getPerformanceColor((sd.effortPerDay / 1.0) * 100, thresholds),
                        }}
                      >
                        {formatDecimal(sd.effortPerDay, 2)}
                      </td>
                      <td
                        className="ax-num"
                        style={{ color: getPerformanceColor(sd.effortCompletionPct, thresholds) }}
                      >
                        {formatPercentage(sd.effortCompletionPct)}
                      </td>
                      <td
                        className="ax-num"
                        style={{ color: getPerformanceColor(sd.hoursUtilizationPct, thresholds) }}
                      >
                        {formatPercentage(sd.hoursUtilizationPct)}
                      </td>
                      <td
                        className="ax-num"
                        style={{
                          color: getPerformanceColor(
                            Math.max(0, 100 - Math.abs(1 - sd.estimatedVsActualRatio) * 100),
                            thresholds
                          ),
                        }}
                      >
                        {formatDecimal(sd.estimatedVsActualRatio, 2)}x
                      </td>
                      <td className="ax-num">
                        {sd.pbiCountCompleted}/{sd.pbiCountTotal}
                      </td>
                      <td className="ax-num">
                        {sd.bugCountCompleted}/{sd.bugCountTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ax-row" style={{ gap: 32, marginTop: 16 }}>
              <div>
                <div className="ax-fine">Completion Trend</div>
                <Sparkline
                  data={agg.completionTrend}
                  width={120}
                  height={32}
                  color={completionColor}
                  label="Completion trend"
                />
              </div>
              <div>
                <div className="ax-fine">Effort/Day Trend</div>
                <Sparkline
                  data={agg.effortTrend}
                  width={120}
                  height={32}
                  color="var(--ax-info)"
                  label="Effort per day trend"
                />
              </div>
            </div>
          </Disclosure>
        );
      })}
    </div>
  );
};
