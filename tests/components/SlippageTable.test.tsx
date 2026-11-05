import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SlippageTable } from "@/components/SlippageTable";
import { SprintSlippageData, WorkItemSlippage } from "@/models/interfaces";

function makeItem(overrides: Partial<WorkItemSlippage> = {}): WorkItemSlippage {
  return {
    id: 101,
    title: "Add export",
    type: "Product Backlog Item",
    state: "Done",
    assignedToDisplayName: "Alex Smith",
    assignedToUniqueName: "alex@example.com",
    effort: 3,
    activatedDate: new Date("2026-01-05"),
    resolvedDate: new Date("2026-01-12"),
    elapsedDays: 5,
    slippagePct: 167,
    isOngoing: false,
    status: "at-risk",
    ...overrides,
  };
}

function makeData(items: WorkItemSlippage[]): SprintSlippageData {
  return {
    sprintId: "s1",
    sprintName: "Sprint 1",
    items,
    summary: {
      totalItems: items.length,
      onTrack: 1,
      atRisk: 2,
      over: 3,
      notStarted: 4,
      noEffort: 0,
    },
  };
}

describe("SlippageTable", () => {
  it("says so when the sprint has no PBIs or bugs", () => {
    render(<SlippageTable data={makeData([])} />);
    expect(screen.getByText("No PBIs or Bugs in this sprint.")).toBeInTheDocument();
  });

  it("summarises the status counts and hides the no-effort pill at zero", () => {
    render(<SlippageTable data={makeData([makeItem()])} />);
    expect(screen.getByText("On Track: 1")).toBeInTheDocument();
    expect(screen.getByText("At Risk: 2")).toBeInTheDocument();
    expect(screen.getByText("Over: 3")).toBeInTheDocument();
    expect(screen.getByText("Not Started: 4")).toBeInTheDocument();
    expect(screen.queryByText(/No Effort Set/)).not.toBeInTheDocument();
  });

  it("renders a row per item with a text status, not colour alone", () => {
    render(<SlippageTable data={makeData([makeItem()])} />);
    const row = screen.getByRole("row", { name: /Add export/ });
    const cells = within(row);
    expect(cells.getByText("PBI")).toBeInTheDocument();
    expect(cells.getByText("167%")).toBeInTheDocument();
    expect(cells.getByText("At Risk")).toBeInTheDocument();
  });

  it("shows placeholders for items with no effort or elapsed time", () => {
    const item = makeItem({
      id: 7,
      type: "Bug",
      effort: null,
      elapsedDays: null,
      slippagePct: null,
      status: "no-effort",
      isOngoing: true,
    });
    render(<SlippageTable data={makeData([item])} />);
    const row = screen.getByRole("row", { name: /Add export/ });
    expect(within(row).getAllByText("--")).toHaveLength(3);
    expect(within(row).getByText("In Progress")).toBeInTheDocument();
    expect(within(row).getByText("No Effort")).toBeInTheDocument();
    expect(within(row).getByText("Bug")).toBeInTheDocument();
  });
});
