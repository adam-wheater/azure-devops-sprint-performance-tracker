import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SprintComparison } from "@/components/SprintComparison";
import { SprintTeamTotals, SprintBestPracticeData } from "@/models/interfaces";

function makeTeamTotals(
  id: string,
  name: string,
  overrides: Partial<SprintTeamTotals> = {}
): SprintTeamTotals {
  return {
    sprintId: id,
    sprintName: name,
    totalEffortAssigned: 20,
    totalEffortCompleted: 16,
    totalWorkingDays: 20,
    avgEffortPerDay: 0.8,
    avgEffortPerformancePct: 80,
    totalOriginalEstimate: 80,
    totalCompletedWork: 70,
    totalRemainingWork: 10,
    totalAvailableHours: 120,
    estimatedVsActualRatio: 1.14,
    hoursUtilizationPct: 58,
    effortCompletionPct: 80,
    avgCycleTimeDays: 3,
    workDistributionScore: 85,
    pbiCountTotal: 6,
    pbiCountCompleted: 4,
    bugCountTotal: 2,
    bugCountCompleted: 2,
    taskCountTotal: 10,
    taskCountCompleted: 8,
    ...overrides,
  };
}

function makeBestPractice(sprintId: string): SprintBestPracticeData {
  return {
    sprintId,
    sprintName: `Sprint`,
    violations: [],
    summary: { errors: 0, warnings: 1, passed: 5 },
    healthScore: 90,
  };
}

describe("SprintComparison", () => {
  it("shows no-data message when fewer than 2 sprints", () => {
    const totals = [makeTeamTotals("s1", "Sprint 1")];
    render(<SprintComparison teamTotals={totals} bestPracticeData={[]} />);
    expect(screen.getByText("Need at least 2 sprints to compare.")).toBeInTheDocument();
  });

  it("renders comparison table with metrics", () => {
    const totals = [
      makeTeamTotals("s1", "Sprint 1", { totalEffortCompleted: 10 }),
      makeTeamTotals("s2", "Sprint 2", { totalEffortCompleted: 16 }),
    ];
    render(<SprintComparison teamTotals={totals} bestPracticeData={[]} />);
    expect(screen.getByText("Effort Completed")).toBeInTheDocument();
    expect(screen.getByText("Completion %")).toBeInTheDocument();
    // Sprint names appear in both dropdowns and table headers
    expect(screen.getAllByText("Sprint 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sprint 2").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all core metric rows", () => {
    const totals = [makeTeamTotals("s1", "Sprint 1"), makeTeamTotals("s2", "Sprint 2")];
    render(<SprintComparison teamTotals={totals} bestPracticeData={[]} />);
    expect(screen.getByText("Effort Assigned")).toBeInTheDocument();
    expect(screen.getByText("Hours Utilization")).toBeInTheDocument();
    expect(screen.getByText("Cycle Time (days)")).toBeInTheDocument();
    expect(screen.getByText("Distribution Score")).toBeInTheDocument();
    expect(screen.getByText("PBIs Completed")).toBeInTheDocument();
  });

  it("includes best practice metrics when data is available", () => {
    const totals = [makeTeamTotals("s1", "Sprint 1"), makeTeamTotals("s2", "Sprint 2")];
    const bpData = [makeBestPractice("s1"), makeBestPractice("s2")];
    render(<SprintComparison teamTotals={totals} bestPracticeData={bpData} />);
    expect(screen.getByText("Health Score")).toBeInTheDocument();
    expect(screen.getByText("BP Errors")).toBeInTheDocument();
    expect(screen.getByText("BP Warnings")).toBeInTheDocument();
  });

  it("allows changing sprint selection via dropdowns", () => {
    const totals = [
      makeTeamTotals("s1", "Sprint 1", { totalEffortCompleted: 10 }),
      makeTeamTotals("s2", "Sprint 2", { totalEffortCompleted: 16 }),
      makeTeamTotals("s3", "Sprint 3", { totalEffortCompleted: 20 }),
    ];
    render(<SprintComparison teamTotals={totals} bestPracticeData={[]} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(2);

    // Change left sprint to Sprint 3
    fireEvent.change(selects[0], { target: { value: "2" } });
    // Sprint 3 should now be in the header row
    const headers = screen.getAllByText("Sprint 3");
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });
  it("keeps rendering when the sprint list shrinks below the current selection", () => {
    const totals = [
      makeTeamTotals("s1", "Sprint 1"),
      makeTeamTotals("s2", "Sprint 2"),
      makeTeamTotals("s3", "Sprint 3"),
    ];
    const { rerender } = render(<SprintComparison teamTotals={totals} bestPracticeData={[]} />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "2" } });
    expect(screen.getAllByText("Sprint 3").length).toBeGreaterThanOrEqual(1);

    // A refresh with a shorter lookback leaves the stored index out of range.
    rerender(<SprintComparison teamTotals={totals.slice(0, 2)} bestPracticeData={[]} />);
    expect(screen.getByText("Effort Completed")).toBeInTheDocument();
    expect(screen.queryAllByText("Sprint 3").length).toBe(0);
  });

  it("falls back to the no-data message when sprints drop below two after mount", () => {
    const totals = [makeTeamTotals("s1", "Sprint 1"), makeTeamTotals("s2", "Sprint 2")];
    const { rerender } = render(<SprintComparison teamTotals={totals} bestPracticeData={[]} />);
    expect(screen.getByText("Effort Completed")).toBeInTheDocument();

    // Hooks must still run in the same order on this render, or React throws.
    rerender(<SprintComparison teamTotals={totals.slice(0, 1)} bestPracticeData={[]} />);
    expect(screen.getByText("Need at least 2 sprints to compare.")).toBeInTheDocument();
  });
});
