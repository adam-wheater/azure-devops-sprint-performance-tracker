import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemberScorecard } from "@/components/MemberScorecard";
import { MemberPerformanceSummary, SprintInfo, SprintMemberEffort } from "@/models/interfaces";

function makeSprint(id: string, name: string): SprintInfo {
  return {
    id,
    name,
    path: `Project\\${name}`,
    startDate: new Date("2026-01-05"),
    finishDate: new Date("2026-01-16"),
  };
}

function makeSprintData(
  sprintId: string,
  sprintName: string,
  overrides: Partial<SprintMemberEffort> = {}
): SprintMemberEffort {
  return {
    memberId: "m1",
    memberDisplayName: "Alice",
    memberUniqueName: "alice@example.com",
    memberImageUrl: "",
    primaryRole: "Development",
    sprintId,
    sprintName,
    totalWeekdays: 10,
    teamDaysOffCount: 0,
    personalDaysOffCount: 0,
    workingDays: 10,
    capacityHoursPerDay: 6,
    totalEffortAssigned: 10,
    totalEffortCompleted: 8,
    effortPerDay: 0.8,
    effortTarget: 1.0,
    effortPerformancePct: 80,
    effortCompletionPct: 80,
    pbiCountTotal: 3,
    pbiCountCompleted: 2,
    bugCountTotal: 1,
    bugCountCompleted: 1,
    totalOriginalEstimate: 40,
    totalCompletedWork: 35,
    totalRemainingWork: 5,
    estimatedVsActualRatio: 1.14,
    availableHours: 60,
    hoursUtilizationPct: 75,
    sprintProgress: 1.0,
    ...overrides,
  };
}

const sprints: SprintInfo[] = [makeSprint("s1", "Sprint 1"), makeSprint("s2", "Sprint 2")];

const members: MemberPerformanceSummary[] = [
  {
    memberId: "m1",
    memberDisplayName: "Alice",
    memberUniqueName: "alice@example.com",
    memberImageUrl: "https://example.com/alice.jpg",
    primaryRole: "Development",
    sprintData: [
      makeSprintData("s1", "Sprint 1"),
      makeSprintData("s2", "Sprint 2", { effortCompletionPct: 90 }),
    ],
  },
  {
    memberId: "m2",
    memberDisplayName: "Bob",
    memberUniqueName: "bob@example.com",
    memberImageUrl: "",
    primaryRole: "Testing",
    sprintData: [
      makeSprintData("s1", "Sprint 1", {
        memberId: "m2",
        memberDisplayName: "Bob",
        primaryRole: "Testing",
      }),
    ],
  },
];

describe("MemberScorecard", () => {
  it("renders all members", () => {
    render(<MemberScorecard members={members} sprints={sprints} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows no data message when members array is empty", () => {
    render(<MemberScorecard members={[]} sprints={sprints} />);
    expect(screen.getByText("No member data available.")).toBeInTheDocument();
  });

  it("shows quick stats in collapsed state", () => {
    render(<MemberScorecard members={members} sprints={sprints} />);
    // Should show Completion percentage for Alice
    const completionValues = screen.getAllByText(/\d+\.\d+%/);
    expect(completionValues.length).toBeGreaterThan(0);
  });

  it("expands detail when header is clicked", () => {
    render(<MemberScorecard members={members} sprints={sprints} />);
    const aliceHeader = screen.getByText("Alice").closest("button");
    expect(aliceHeader).toBeTruthy();
    fireEvent.click(aliceHeader!);
    // After expanding, sprint table data should be visible
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Sprint 2")).toBeInTheDocument();
  });

  it("collapses detail on second click", () => {
    render(<MemberScorecard members={members} sprints={sprints} />);
    const aliceHeader = screen.getByText("Alice").closest("button");
    fireEvent.click(aliceHeader!);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    fireEvent.click(aliceHeader!);
    // Sprint detail table should no longer show
    expect(screen.queryByText("Working Days")).not.toBeInTheDocument();
  });

  it("renders member avatar when imageUrl is provided and initials otherwise", () => {
    render(<MemberScorecard members={members} sprints={sprints} />);
    const imgs = document.querySelectorAll("img.ax-avatar");
    expect(imgs.length).toBe(1); // Only Alice has an imageUrl
    expect(screen.getByText("Bo")).toBeInTheDocument(); // Bob falls back to his initials
  });

  it("displays role badges", () => {
    render(<MemberScorecard members={members} sprints={sprints} />);
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
  });
  it("excludes fully-off sprints from the averages", () => {
    const memberWithHoliday: MemberPerformanceSummary[] = [
      {
        memberId: "m3",
        memberDisplayName: "Cara",
        memberUniqueName: "cara@example.com",
        memberImageUrl: "",
        primaryRole: "Development",
        sprintData: [
          makeSprintData("s1", "Sprint 1", { effortCompletionPct: 80 }),
          // Fully on holiday: no working days, so this sprint must not be averaged
          // in. Completion is still non-zero because effort assigned to Cara was
          // closed while she was away — the ratio does not depend on working days.
          makeSprintData("s2", "Sprint 2", {
            workingDays: 0,
            personalDaysOffCount: 10,
            effortCompletionPct: 100,
            hoursUtilizationPct: 0,
          }),
        ],
      },
    ];

    render(<MemberScorecard members={memberWithHoliday} sprints={sprints} />);
    // Only the active sprint counts, so completion is 80.0%. Summing both sprints
    // while dividing by the active count alone would report an absurd 180.0%.
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.queryByText("180.0%")).not.toBeInTheDocument();
  });
});
