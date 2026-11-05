import * as React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DeveloperActivityPage } from "@/components/DeveloperActivityPage";
import { ProjectContext } from "@/models/interfaces";

const mockGetActivity = jest.fn();

jest.mock("@/services/DeveloperActivityService", () => ({
  DeveloperActivityService: jest.fn().mockImplementation(() => ({
    getDeveloperActivityForRange: mockGetActivity,
  })),
}));

const project: ProjectContext = { id: "proj-1", name: "Contoso" };

function developer(
  email: string,
  displayName: string,
  totals: Partial<Record<string, number>> = {}
) {
  return {
    email,
    displayName,
    totals: {
      sprintId: "range",
      sprintName: "Total",
      commitCount: 0,
      filesAdded: 0,
      filesModified: 0,
      filesDeleted: 0,
      pipelinesTriggered: 0,
      ...totals,
    },
  };
}

const developers = [
  developer("bea@example.com", "Bea Jones", {
    commitCount: 4,
    filesAdded: 2,
    pipelinesTriggered: 1,
  }),
  developer("al@example.com", "Al Smith", {
    commitCount: 9,
    filesAdded: 1,
    filesModified: 5,
    filesDeleted: 3,
  }),
  developer("cy@example.com", "Cy Brown", { commitCount: 1 }),
];

function renderPage(onLookbackChange = jest.fn()) {
  render(
    <DeveloperActivityPage project={project} lookback={3} onLookbackChange={onLookbackChange} />
  );
  return onLookbackChange;
}

const NAMES = ["Bea Jones", "Al Smith", "Cy Brown"];

function dataRowNames(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => {
      const text = within(row).getAllByRole("cell")[0].textContent ?? "";
      return NAMES.find((name) => text.includes(name)) ?? text;
    });
}

describe("DeveloperActivityPage", () => {
  beforeEach(() => {
    mockGetActivity.mockReset().mockResolvedValue({ developers });
  });

  it("asks the service for the lookback window, two weeks per sprint", async () => {
    renderPage();
    await screen.findByText("Al Smith");

    const [, from, to] = mockGetActivity.mock.calls[0];
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(42);
  });

  it("keeps the service order until a header is clicked", async () => {
    renderPage();
    await screen.findByText("Al Smith");
    expect(dataRowNames()).toEqual(["Bea Jones", "Al Smith", "Cy Brown"]);
  });

  it("sorts by commits, busiest first, then flips on a second click", async () => {
    renderPage();
    await screen.findByText("Al Smith");

    fireEvent.click(screen.getByRole("columnheader", { name: /Commits/ }));
    expect(screen.getByRole("columnheader", { name: /Commits/ })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
    expect(dataRowNames()[0]).toBe("Al Smith");

    fireEvent.click(screen.getByRole("columnheader", { name: /Commits/ }));
    expect(dataRowNames()[0]).toBe("Cy Brown");
  });

  it("sorts developers by name, A to Z first", async () => {
    renderPage();
    await screen.findByText("Al Smith");

    fireEvent.click(screen.getByRole("columnheader", { name: /Developer/ }));
    expect(dataRowNames()).toEqual(["Al Smith", "Bea Jones", "Cy Brown"]);
  });

  it("breaks file changes into added, modified and deleted", async () => {
    renderPage();
    await screen.findByText("Al Smith");
    expect(screen.getAllByTitle("Files added")).toHaveLength(2);
    expect(screen.getByTitle("Files modified")).toBeInTheDocument();
    expect(screen.getByText("~5")).toBeInTheDocument();
    expect(screen.getByText("-3")).toBeInTheDocument();
  });

  it("says so when nobody was active in the range", async () => {
    mockGetActivity.mockResolvedValue({ developers: [] });
    renderPage();
    expect(
      await screen.findByText("No commit or pipeline activity found for the selected range.")
    ).toBeInTheDocument();
  });

  it("shows the failure message when the fetch fails", async () => {
    mockGetActivity.mockRejectedValue(new Error("Git access denied"));
    renderPage();
    expect(await screen.findByText("Git access denied")).toBeInTheDocument();
  });

  it("reports a lookback change and refetches on Refresh", async () => {
    const onLookbackChange = renderPage();
    await screen.findByText("Al Smith");

    fireEvent.change(screen.getByLabelText("Lookback period"), { target: { value: "5" } });
    expect(onLookbackChange).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(mockGetActivity).toHaveBeenCalledTimes(2));
  });
});
