import * as React from "react";
import { TeamPerformanceData, ThresholdSettings } from "../models/interfaces";
import { PerformanceTableRow } from "./PerformanceTableRow";
import { TeamTotalsRow } from "./TeamTotalsRow";
import { EmptyState } from "./ui";
import { formatSprintDates } from "../utils/formatting";

interface Props {
  data: TeamPerformanceData;
  thresholds?: ThresholdSettings;
}

export const PerformanceTable: React.FC<Props> = ({ data, thresholds }) => {
  const { sprints, members, teamTotals } = data;

  if (sprints.length === 0) {
    return <EmptyState title="No sprint data available for this team." />;
  }

  return (
    <div className="ax-table-wrap">
      <table className="ax-table" aria-label={`${data.team.name} sprint performance`}>
        <thead>
          <tr>
            <th>Team Member</th>
            <th>Metric</th>
            {sprints.map((s) => (
              <th key={s.id}>
                {s.name}
                <div
                  className="ax-fine"
                  style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
                >
                  {formatSprintDates(s.startDate, s.finishDate)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <React.Fragment key={member.memberId}>
              <PerformanceTableRow
                member={member}
                sprints={sprints}
                rowType="effort"
                thresholds={thresholds}
              />
              <PerformanceTableRow
                member={member}
                sprints={sprints}
                rowType="hours"
                thresholds={thresholds}
              />
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <TeamTotalsRow
            teamTotals={teamTotals}
            sprints={sprints}
            rowType="effort"
            thresholds={thresholds}
          />
          <TeamTotalsRow
            teamTotals={teamTotals}
            sprints={sprints}
            rowType="hours"
            thresholds={thresholds}
          />
        </tfoot>
      </table>
    </div>
  );
};
