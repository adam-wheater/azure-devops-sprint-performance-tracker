import * as React from "react";
import { useMemo } from "react";
import { MemberPerformanceSummary, SprintInfo, ThresholdSettings } from "../models/interfaces";
import { PerformanceCell } from "./PerformanceCell";
import { MemberName, RolePill } from "./MemberBits";
import { Pill } from "./ui";

interface Props {
  member: MemberPerformanceSummary;
  sprints: SprintInfo[];
  rowType: "effort" | "hours";
  thresholds?: ThresholdSettings;
}

export const PerformanceTableRow: React.FC<Props> = ({ member, sprints, rowType, thresholds }) => {
  const isEffortRow = rowType === "effort";

  const sprintDataMap = useMemo(() => {
    const map = new Map<string, (typeof member.sprintData)[0]>();
    for (const sd of member.sprintData) {
      map.set(sd.sprintId, sd);
    }
    return map;
  }, [member.sprintData]);

  return (
    <tr>
      {isEffortRow && (
        <td rowSpan={2} style={{ verticalAlign: "top", minWidth: 200 }}>
          <MemberName
            name={member.memberDisplayName}
            imageUrl={member.memberImageUrl}
            detail={<RolePill role={member.primaryRole} />}
          />
        </td>
      )}
      <td style={{ verticalAlign: "top" }}>
        <Pill tone={isEffortRow ? "accent" : "neutral"}>{isEffortRow ? "Effort" : "Hours"}</Pill>
      </td>
      {sprints.map((sprint, index) => {
        const sprintData = sprintDataMap.get(sprint.id);
        const prevSprint = index > 0 ? sprints[index - 1] : null;
        const previousSprintData = prevSprint ? sprintDataMap.get(prevSprint.id) || null : null;
        return (
          <PerformanceCell
            key={`${member.memberId}-${sprint.id}-${rowType}`}
            data={sprintData || null}
            rowType={rowType}
            previousSprintData={previousSprintData}
            thresholds={thresholds}
          />
        );
      })}
    </tr>
  );
};
