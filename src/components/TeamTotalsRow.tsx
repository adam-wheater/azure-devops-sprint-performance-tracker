import * as React from "react";
import { useMemo } from "react";
import { SprintTeamTotals, SprintInfo, ThresholdSettings } from "../models/interfaces";
import { TeamTotalsCell } from "./PerformanceCell";
import { Pill } from "./ui";

interface Props {
  teamTotals: SprintTeamTotals[];
  sprints: SprintInfo[];
  rowType: "effort" | "hours";
  thresholds?: ThresholdSettings;
}

export const TeamTotalsRow: React.FC<Props> = ({ teamTotals, sprints, rowType, thresholds }) => {
  const isEffortRow = rowType === "effort";

  const totalsMap = useMemo(() => {
    const map = new Map<string, SprintTeamTotals>();
    for (const t of teamTotals) {
      map.set(t.sprintId, t);
    }
    return map;
  }, [teamTotals]);

  return (
    <tr style={{ background: "var(--ax-surface-2)" }}>
      {isEffortRow && (
        <td rowSpan={2} style={{ verticalAlign: "top", fontWeight: 650 }}>
          Team Totals
        </td>
      )}
      <td style={{ verticalAlign: "top" }}>
        <Pill tone={isEffortRow ? "accent" : "neutral"}>{isEffortRow ? "Effort" : "Hours"}</Pill>
      </td>
      {sprints.map((sprint) => (
        <TeamTotalsCell
          key={`totals-${sprint.id}-${rowType}`}
          data={totalsMap.get(sprint.id) || null}
          rowType={rowType}
          thresholds={thresholds}
        />
      ))}
    </tr>
  );
};
