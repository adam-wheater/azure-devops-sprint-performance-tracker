import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BestPracticesView } from "@/components/BestPracticesView";
import { SprintInfo, SprintBestPracticeData, BestPracticeViolation } from "@/models/interfaces";

function makeSprint(id: string, name: string): SprintInfo {
  return {
    id,
    name,
    path: `Project\\${name}`,
    startDate: new Date("2026-01-05"),
    finishDate: new Date("2026-01-16"),
  };
}

function makeBpData(
  sprintId: string,
  sprintName: string,
  violations: BestPracticeViolation[] = [],
  healthScore = 100
): SprintBestPracticeData {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warning").length;
  const passed = 6 - violations.length;
  return {
    sprintId,
    sprintName,
    violations,
    summary: { errors, warnings, passed },
    healthScore,
  };
}

const sprints: SprintInfo[] = [makeSprint("s1", "Sprint 1"), makeSprint("s2", "Sprint 2")];

describe("BestPracticesView", () => {
  it("shows no data message when bestPracticeData is empty", () => {
    render(<BestPracticesView sprints={sprints} bestPracticeData={[]} />);
    expect(screen.getByText("No best practice data available.")).toBeInTheDocument();
  });

  it("shows all-clear when no violations exist", () => {
    const bpData = [makeBpData("s1", "Sprint 1")];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("All best practices met")).toBeInTheDocument();
  });

  it("renders sprint title and health score", () => {
    const bpData = [makeBpData("s1", "Sprint 1", [], 85)];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Health: 85/100")).toBeInTheDocument();
  });

  it("renders violations with severity badges", () => {
    const violations: BestPracticeViolation[] = [
      {
        rule: "missing-effort",
        severity: "error",
        message: "2 items have no effort assigned",
        items: [
          { id: 1, title: "PBI One", type: "Product Backlog Item", detail: "No effort" },
          { id: 2, title: "Bug One", type: "Bug", detail: "No effort" },
        ],
      },
    ];
    const bpData = [makeBpData("s1", "Sprint 1", violations, 80)];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("Issue")).toBeInTheDocument();
    expect(screen.getByText("2 items have no effort assigned")).toBeInTheDocument();
  });

  it("renders warning severity correctly", () => {
    const violations: BestPracticeViolation[] = [
      {
        rule: "task-too-large",
        severity: "warning",
        message: "1 task exceeds 6h limit",
        items: [{ id: 10, title: "Big Task", type: "Task", detail: "Estimated 12h" }],
      },
    ];
    const bpData = [makeBpData("s1", "Sprint 1", violations, 90)];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("renders violation items with details", () => {
    const violations: BestPracticeViolation[] = [
      {
        rule: "missing-effort",
        severity: "error",
        message: "1 item has no effort",
        items: [
          { id: 42, title: "Test PBI", type: "Product Backlog Item", detail: "No effort points" },
        ],
      },
    ];
    const bpData = [makeBpData("s1", "Sprint 1", violations, 80)];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("Test PBI")).toBeInTheDocument();
    expect(screen.getByText("No effort points")).toBeInTheDocument();
  });

  it("collapses violation items when header is clicked", () => {
    const violations: BestPracticeViolation[] = [
      {
        rule: "missing-effort",
        severity: "error",
        message: "1 item",
        items: [{ id: 1, title: "Test", detail: "Detail text" }],
      },
    ];
    const bpData = [makeBpData("s1", "Sprint 1", violations, 80)];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("Detail text")).toBeInTheDocument();

    // Click to collapse
    const header = screen.getByText("1 item").closest("button");
    fireEvent.click(header!);
    expect(screen.queryByText("Detail text")).not.toBeInTheDocument();
  });

  it("renders summary counts (errors, warnings, passed)", () => {
    const violations: BestPracticeViolation[] = [
      {
        rule: "missing-effort",
        severity: "error",
        message: "1 item",
        items: [{ detail: "No effort" }],
      },
      {
        rule: "task-too-large",
        severity: "warning",
        message: "2 tasks",
        items: [{ detail: "Big" }],
      },
    ];
    const bpData = [makeBpData("s1", "Sprint 1", violations, 70)];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("1 issue")).toBeInTheDocument();
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("4 passed")).toBeInTheDocument();
  });

  it("renders multiple sprint sections", () => {
    const bpData = [makeBpData("s1", "Sprint 1", [], 100), makeBpData("s2", "Sprint 2", [], 90)];
    render(<BestPracticesView sprints={sprints} bestPracticeData={bpData} />);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Sprint 2")).toBeInTheDocument();
  });
});
