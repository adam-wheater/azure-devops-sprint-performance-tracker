import * as React from "react";
import { useState } from "react";
import { SprintInfo, SprintBestPracticeData, BestPracticeViolation } from "../models/interfaces";
import { formatSprintDates } from "../utils/formatting";
import { Banner, Disclosure, EmptyState, Pill } from "./ui";

interface Props {
  sprints: SprintInfo[];
  bestPracticeData: SprintBestPracticeData[];
}

const SEVERITY_LABELS: Record<string, string> = {
  "missing-effort": "Bugs / PBIs Missing Effort",
  "task-too-large": "Tasks Not Broken Down",
  "multiple-active-tasks": "Multiple Tasks In Progress",
  "capacity-no-hours": "Capacity Members With No Hours",
  "over-velocity": "Sprint Effort Exceeds Velocity",
  "underplanned-utilization": "Hours Utilization Below Threshold",
};

export const BestPracticesView: React.FC<Props> = ({ sprints, bestPracticeData }) => {
  if (bestPracticeData.length === 0) {
    return <EmptyState title="No best practice data available." />;
  }

  const sprintMap = new Map(sprints.map((s) => [s.id, s]));

  return (
    <div>
      {bestPracticeData.map((sprintBp) => {
        const sprint = sprintMap.get(sprintBp.sprintId);
        const healthTone =
          sprintBp.healthScore >= 80 ? "success" : sprintBp.healthScore >= 60 ? "warn" : "danger";
        return (
          <section key={sprintBp.sprintId} style={{ marginBottom: 24 }}>
            <h3>
              {sprintBp.sprintName}
              {sprint && (
                <span className="ax-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                  {formatSprintDates(sprint.startDate, sprint.finishDate)}
                </span>
              )}
            </h3>

            <div className="ax-row" style={{ marginBottom: 12 }}>
              <Pill tone={healthTone}>Health: {sprintBp.healthScore}/100</Pill>
              {sprintBp.summary.errors > 0 && (
                <Pill tone="danger">
                  {sprintBp.summary.errors} {sprintBp.summary.errors === 1 ? "issue" : "issues"}
                </Pill>
              )}
              {sprintBp.summary.warnings > 0 && (
                <Pill tone="warn">
                  {sprintBp.summary.warnings}{" "}
                  {sprintBp.summary.warnings === 1 ? "warning" : "warnings"}
                </Pill>
              )}
              {sprintBp.summary.passed > 0 && (
                <Pill tone="success">{sprintBp.summary.passed} passed</Pill>
              )}
            </div>

            {sprintBp.violations.length === 0 ? (
              <Banner tone="success">All best practices met</Banner>
            ) : (
              sprintBp.violations.map((violation) => (
                <ViolationCard key={violation.rule} violation={violation} />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
};

const ViolationCard: React.FC<{ violation: BestPracticeViolation }> = ({ violation }) => {
  const [expanded, setExpanded] = useState(true);
  const label = SEVERITY_LABELS[violation.rule] || violation.rule;

  return (
    <Disclosure
      open={expanded}
      onToggle={() => setExpanded(!expanded)}
      summary={
        <span className="ax-row">
          <Pill tone={violation.severity === "error" ? "danger" : "warn"}>
            {violation.severity === "error" ? "Issue" : "Warning"}
          </Pill>
          <strong>{label}</strong>
          <span className="ax-muted">{violation.message}</span>
        </span>
      }
    >
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {violation.items.map((item, idx) => (
          <li key={idx} className="ax-row" style={{ padding: "4px 0" }}>
            {item.id && <span className="ax-mono">#{item.id}</span>}
            {item.title && <span style={{ fontWeight: 600 }}>{item.title}</span>}
            {item.type && <Pill>{item.type}</Pill>}
            <span className="ax-muted">{item.detail}</span>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
};
