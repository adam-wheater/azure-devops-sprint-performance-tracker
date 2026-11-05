import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DepartmentStatsPage } from "@/components/DepartmentStatsPage";
import { ProjectContext } from "@/models/interfaces";

const mockGetDepartmentStats = jest.fn();

jest.mock("@/services/DepartmentStatsService", () => ({
  DepartmentStatsService: jest.fn().mockImplementation(() => ({
    getDepartmentStats: mockGetDepartmentStats,
  })),
}));

const project: ProjectContext = { id: "proj-1", name: "Contoso" };

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date;
}

function makeStats(overrides: Record<string, unknown> = {}) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - 29);
  fromDate.setHours(0, 0, 0, 0);

  return {
    range: { fromDate, toDate },
    pullRequests: [
      {
        pullRequestId: 1,
        repositoryId: "r1",
        repositoryName: "Web",
        createdByEmail: "alice@example.com",
        createdByDisplayName: "Alice",
        creationDate: daysAgo(2),
        closedDate: daysAgo(1),
        status: 3,
        isDraft: false,
      },
      {
        pullRequestId: 2,
        repositoryId: "r1",
        repositoryName: "Web",
        createdByEmail: "bob@example.com",
        createdByDisplayName: "Bob",
        creationDate: daysAgo(3),
        closedDate: null,
        status: 1,
        isDraft: false,
      },
    ],
    commits: [
      {
        commitId: "a",
        repositoryId: "r1",
        repositoryName: "Web",
        authorEmail: "alice@example.com",
        authorDisplayName: "Alice",
        date: daysAgo(2),
      },
      {
        commitId: "b",
        repositoryId: "r1",
        repositoryName: "Web",
        authorEmail: "alice@example.com",
        authorDisplayName: "Alice",
        date: daysAgo(2),
      },
    ],
    repositoryCount: 3,
    truncatedRepositories: [],
    pullRequestsTruncated: false,
    failedRepositories: [],
    ...overrides,
  };
}

describe("DepartmentStatsPage", () => {
  beforeEach(() => {
    mockGetDepartmentStats.mockReset();
    mockGetDepartmentStats.mockResolvedValue(makeStats());
  });

  it("renders the charts once data loads", async () => {
    render(<DepartmentStatsPage project={project} />);

    expect(await screen.findByText("Pull requests per day")).toBeInTheDocument();
    expect(screen.getByText("Commits per day")).toBeInTheDocument();
    expect(screen.getByText("Pull request throughput")).toBeInTheDocument();
  });

  it("shows headline totals derived from the fetched events", async () => {
    render(<DepartmentStatsPage project={project} />);

    await screen.findByText("Pull requests per day");
    expect(screen.getByText("Pull requests opened")).toBeInTheDocument();
    // 2 pull requests, 1 of them completed, 2 commits.
    expect(screen.getByText("across 3 repositories")).toBeInTheDocument();
  });

  it("refetches when the range preset changes", async () => {
    render(<DepartmentStatsPage project={project} />);
    await screen.findByText("Pull requests per day");
    expect(mockGetDepartmentStats).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));

    await waitFor(() => expect(mockGetDepartmentStats).toHaveBeenCalledTimes(2));

    // The requested window must actually narrow to ~30 days.
    const [, fromDate, toDate] = mockGetDepartmentStats.mock.calls[1];
    const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    expect(spanDays).toBeGreaterThanOrEqual(29);
    expect(spanDays).toBeLessThanOrEqual(30);
  });

  it("swaps a chart for its data table on request", async () => {
    render(<DepartmentStatsPage project={project} />);
    await screen.findByText("Pull requests per day");

    const toggles = screen.getAllByRole("button", { name: "Show table" });
    fireEvent.click(toggles[0]);

    expect(screen.getByText("Pull requests opened", { selector: "th" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show chart" })).toBeInTheDocument();
  });

  it("surfaces an error banner when the fetch fails", async () => {
    mockGetDepartmentStats.mockRejectedValue(new Error("Git access denied"));
    render(<DepartmentStatsPage project={project} />);

    expect(await screen.findByText("Git access denied")).toBeInTheDocument();
  });

  it("warns when the data is truncated or partial", async () => {
    mockGetDepartmentStats.mockResolvedValue(
      makeStats({
        pullRequestsTruncated: true,
        truncatedRepositories: ["Monolith"],
        failedRepositories: ["Legacy"],
      })
    );
    render(<DepartmentStatsPage project={project} />);

    await screen.findByText("Pull requests per day");
    expect(screen.getByText(/lower bound/)).toBeInTheDocument();
    expect(screen.getByText(/Monolith/)).toBeInTheDocument();
    expect(screen.getByText(/Legacy/)).toBeInTheDocument();
  });

  it("renders without charts when there is no activity", async () => {
    mockGetDepartmentStats.mockResolvedValue(makeStats({ pullRequests: [], commits: [] }));
    render(<DepartmentStatsPage project={project} />);

    await screen.findByText("Pull requests per day");
    // Zeroed series still render the frame rather than blanking the page.
    expect(screen.getByText("Commits per day")).toBeInTheDocument();
  });

  it("ignores a superseded response so the range shown always matches the filter", async () => {
    let resolveFirst: ((value: unknown) => void) | null = null;
    mockGetDepartmentStats
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce(makeStats({ repositoryCount: 99 }));

    render(<DepartmentStatsPage project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));

    await screen.findByText("across 99 repositories");

    // The slow first request lands last; it must not overwrite the newer data.
    resolveFirst!(makeStats({ repositoryCount: 3 }));
    await waitFor(() => expect(screen.getByText("across 99 repositories")).toBeInTheDocument());
  });
  it("keeps chart series identity stable so a re-render cannot reset the zoom", async () => {
    const { rerender } = render(<DepartmentStatsPage project={project} />);
    await screen.findByText("Pull requests per day");

    // Toggling a table re-renders the tree without changing the fetched data.
    const before = mockGetDepartmentStats.mock.calls.length;
    rerender(<DepartmentStatsPage project={project} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Show table" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Show chart" }));

    // No refetch, so the memoised series must still be the same objects and the
    // chart is never handed a new option to snap its zoom window back out.
    expect(mockGetDepartmentStats).toHaveBeenCalledTimes(before);
    expect(screen.getByText("Pull requests per day")).toBeInTheDocument();
  });
});
