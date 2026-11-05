import * as React from "react";
import { SprintInfo, SprintSlippageData } from "../models/interfaces";
import { SlippageTable } from "./SlippageTable";
import { EmptyState } from "./ui";
import { formatSprintDates } from "../utils/formatting";

interface Props {
  sprints: SprintInfo[];
  slippageData: SprintSlippageData[];
}

export const SlippageView: React.FC<Props> = ({ sprints, slippageData }) => {
  if (slippageData.length === 0) {
    return <EmptyState title="No slippage data available." />;
  }

  const sprintMap = new Map(sprints.map((s) => [s.id, s]));

  return (
    <div>
      {slippageData.map((sprintSlippage) => {
        const sprint = sprintMap.get(sprintSlippage.sprintId);
        return (
          <section key={sprintSlippage.sprintId} style={{ marginBottom: 24 }}>
            <h3>
              {sprintSlippage.sprintName}
              {sprint && (
                <span className="ax-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                  {formatSprintDates(sprint.startDate, sprint.finishDate)}
                </span>
              )}
            </h3>
            <SlippageTable data={sprintSlippage} />
          </section>
        );
      })}
    </div>
  );
};
