import * as React from "react";
import { SprintSlippageData, SlippageStatus, WorkItemSlippage } from "../models/interfaces";
import { getSlippageColor, formatSlippagePct } from "../utils/formatting";
import { EmptyState, Pill, Tone } from "./ui";

interface Props {
  data: SprintSlippageData;
}

const STATUS: Record<SlippageStatus, { label: string; tone: Tone }> = {
  "on-track": { label: "On Track", tone: "success" },
  "at-risk": { label: "At Risk", tone: "warn" },
  over: { label: "Over", tone: "danger" },
  "not-started": { label: "Not Started", tone: "neutral" },
  "no-effort": { label: "No Effort", tone: "neutral" },
};

export const SlippageTable: React.FC<Props> = ({ data }) => {
  if (data.items.length === 0) {
    return <EmptyState title="No PBIs or Bugs in this sprint." />;
  }

  return (
    <div>
      <div className="ax-row" style={{ marginBottom: 12 }}>
        <Pill tone="success">On Track: {data.summary.onTrack}</Pill>
        <Pill tone="warn">At Risk: {data.summary.atRisk}</Pill>
        <Pill tone="danger">Over: {data.summary.over}</Pill>
        <Pill>Not Started: {data.summary.notStarted}</Pill>
        {data.summary.noEffort > 0 && <Pill>No Effort Set: {data.summary.noEffort}</Pill>}
      </div>
      <div className="ax-table-wrap">
        <table className="ax-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Assigned To</th>
              <th>State</th>
              <th className="ax-num">Effort (days)</th>
              <th className="ax-num">Elapsed (days)</th>
              <th className="ax-num">Slippage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <SlippageRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SlippageRow: React.FC<{ item: WorkItemSlippage }> = ({ item }) => {
  const slippageColor = item.slippagePct !== null ? getSlippageColor(item.slippagePct) : undefined;
  const status = STATUS[item.status] ?? { label: item.status, tone: "neutral" as Tone };

  return (
    <tr>
      <td className="ax-mono">{item.id}</td>
      <td>
        <div className="ax-row" style={{ flexWrap: "nowrap" }}>
          <span className="ax-truncate" title={item.title}>
            {item.title}
          </span>
          {item.isOngoing && <Pill tone="info">In Progress</Pill>}
        </div>
      </td>
      <td>{item.type === "Product Backlog Item" ? "PBI" : "Bug"}</td>
      <td>{item.assignedToDisplayName}</td>
      <td>{item.state}</td>
      <td className="ax-num">{item.effort !== null ? item.effort : "--"}</td>
      <td className="ax-num">{item.elapsedDays !== null ? item.elapsedDays : "--"}</td>
      <td className="ax-num" style={{ color: slippageColor, fontWeight: 700 }}>
        {item.slippagePct !== null ? formatSlippagePct(item.slippagePct) : "--"}
      </td>
      <td>
        <Pill tone={status.tone}>{status.label}</Pill>
      </td>
    </tr>
  );
};
