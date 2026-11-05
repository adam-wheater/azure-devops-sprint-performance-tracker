import * as React from "react";
import { useState } from "react";
import { TeamPerformanceData, ThresholdSettings } from "../models/interfaces";
import { TeamStatsBar } from "./TeamStatsBar";
import { PerformanceTable } from "./PerformanceTable";
import { SlippageView } from "./SlippageView";
import { BestPracticesView } from "./BestPracticesView";
import { MemberScorecard } from "./MemberScorecard";
import { SprintComparison } from "./SprintComparison";
import { Banner, Button, Card, IconDownload, Tabs } from "./ui";
import { exportTeamDataToCsv } from "../utils/csvExport";

interface Props {
  data: TeamPerformanceData;
  thresholds?: ThresholdSettings;
  unmatchedAssignees?: string[];
}

type ViewTab = "performance" | "slippage" | "best-practices" | "scorecard" | "comparison";

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "slippage", label: "Slippage" },
  { id: "best-practices", label: "Best Practices" },
  { id: "scorecard", label: "Scorecard" },
  { id: "comparison", label: "Compare" },
];

export const TeamPerformanceSection: React.FC<Props> = ({
  data,
  thresholds,
  unmatchedAssignees,
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>("performance");

  return (
    <Card
      title={data.team.name}
      hint={`${data.members.length} member${data.members.length !== 1 ? "s" : ""} · ${
        data.sprints.length
      } sprint${data.sprints.length !== 1 ? "s" : ""}`}
      testId={`team-${data.team.id}`}
      actions={
        <Button
          size="sm"
          icon={<IconDownload />}
          onClick={() => exportTeamDataToCsv(data)}
          title="Export to CSV"
          aria-label={`Export ${data.team.name} data to CSV`}
        >
          Export CSV
        </Button>
      }
    >
      {data.failedSprints.length > 0 && (
        <Banner tone="warn">Data incomplete: failed to load {data.failedSprints.join(", ")}</Banner>
      )}

      {unmatchedAssignees && unmatchedAssignees.length > 0 && (
        <Banner tone="warn">
          Untracked assignees (not in capacity): {unmatchedAssignees.join(", ")}
        </Banner>
      )}

      <Tabs
        tabs={VIEW_TABS}
        active={activeTab}
        onChange={(id) => setActiveTab(id as ViewTab)}
        aria-label="Team performance views"
      />

      {activeTab === "performance" && (
        <div role="tabpanel">
          <TeamStatsBar
            stats={data.summaryStats}
            teamTotals={data.teamTotals}
            thresholds={thresholds}
          />
          <PerformanceTable data={data} thresholds={thresholds} />
        </div>
      )}

      {activeTab === "slippage" && (
        <div role="tabpanel">
          <SlippageView sprints={data.sprints} slippageData={data.slippageData} />
        </div>
      )}

      {activeTab === "best-practices" && (
        <div role="tabpanel">
          <BestPracticesView sprints={data.sprints} bestPracticeData={data.bestPracticeData} />
        </div>
      )}

      {activeTab === "scorecard" && (
        <div role="tabpanel">
          <MemberScorecard members={data.members} sprints={data.sprints} thresholds={thresholds} />
        </div>
      )}

      {activeTab === "comparison" && (
        <div role="tabpanel">
          <SprintComparison
            teamTotals={data.teamTotals}
            bestPracticeData={data.bestPracticeData}
            thresholds={thresholds}
          />
        </div>
      )}
    </Card>
  );
};
