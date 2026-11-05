import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TeamPerformanceSection } from "@/components/TeamPerformanceSection";
import { TeamPerformanceData } from "@/models/interfaces";

const exportTeamDataToCsv = jest.fn();
jest.mock("@/utils/csvExport", () => ({
  exportTeamDataToCsv: (data: unknown) => exportTeamDataToCsv(data),
}));

function makeData(overrides: Partial<TeamPerformanceData> = {}): TeamPerformanceData {
  return {
    team: { id: "t1", name: "Platform" },
    sprints: [],
    members: [],
    teamTotals: [],
    summaryStats: {
      sprintCount: 0,
      avgVelocity: 0,
      totalPbisAssigned: 0,
      totalPbisCompleted: 0,
      totalBugsAssigned: 0,
      totalBugsCompleted: 0,
      totalTasksAssigned: 0,
      totalTasksCompleted: 0,
      avgEffortPerDay: 0,
      avgHoursUtilization: 0,
      avgEffortCompletionRate: 0,
      avgCycleTimeDays: 0,
      avgWorkDistributionScore: 0,
      avgHealthScore: 0,
    },
    slippageData: [],
    bestPracticeData: [],
    failedSprints: [],
    unmatchedAssignees: [],
    ...overrides,
  };
}

describe("TeamPerformanceSection", () => {
  beforeEach(() => exportTeamDataToCsv.mockReset());

  it("titles the card with the team and counts its members and sprints", () => {
    render(<TeamPerformanceSection data={makeData()} />);
    expect(screen.getByRole("heading", { name: "Platform" })).toBeInTheDocument();
    expect(screen.getByText("0 members · 0 sprints")).toBeInTheDocument();
  });

  it("opens on Performance and offers the other four views", () => {
    render(<TeamPerformanceSection data={makeData()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Performance",
      "Slippage",
      "Best Practices",
      "Scorecard",
      "Compare",
    ]);
    expect(screen.getByRole("tab", { name: "Performance" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("No sprint data available for this team.")).toBeInTheDocument();
  });

  it("switches views from the tab strip", () => {
    render(<TeamPerformanceSection data={makeData()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Slippage" }));
    expect(screen.getByText("No slippage data available.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Best Practices" }));
    expect(screen.getByText("No best practice data available.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Scorecard" }));
    expect(screen.getByText("No member data available.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    expect(screen.getByText("Need at least 2 sprints to compare.")).toBeInTheDocument();
  });

  it("warns about sprints that failed and people outside capacity", () => {
    render(
      <TeamPerformanceSection
        data={makeData({ failedSprints: ["Sprint 3", "Sprint 4"] })}
        unmatchedAssignees={["ghost@example.com"]}
      />
    );
    expect(
      screen.getByText("Data incomplete: failed to load Sprint 3, Sprint 4")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Untracked assignees (not in capacity): ghost@example.com")
    ).toBeInTheDocument();
  });

  it("shows no warnings when everything loaded", () => {
    render(<TeamPerformanceSection data={makeData()} unmatchedAssignees={[]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("exports the team's data as CSV", () => {
    const data = makeData();
    render(<TeamPerformanceSection data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Export Platform data to CSV" }));
    expect(exportTeamDataToCsv).toHaveBeenCalledWith(data);
  });
});
