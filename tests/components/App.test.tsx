import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UserRole } from "@/models/enums";
import { DEFAULT_THRESHOLDS } from "@/models/interfaces";
import { __setMockService } from "../__mocks__/azure-devops-extension-sdk";

const mockUseAccessControl = jest.fn();
jest.mock("@/hooks/useAccessControl", () => ({
  useAccessControl: () => mockUseAccessControl(),
}));

const mockGetAllTeams = jest.fn();
const mockGetActiveTeams = jest.fn();
const mockGetTeamPerformance = jest.fn();
jest.mock("@/services/DataOrchestrator", () => ({
  DataOrchestrator: jest.fn().mockImplementation(() => ({
    getAllTeams: mockGetAllTeams,
    getActiveTeams: mockGetActiveTeams,
    getTeamPerformance: mockGetTeamPerformance,
  })),
}));

jest.mock("@/services/UserPreferencesService", () => ({
  UserPreferencesService: jest.fn().mockImplementation(() => ({
    loadPreferences: jest.fn().mockResolvedValue({}),
    savePreferences: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { App } from "@/components/App";

function access(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    authorized: true,
    currentUser: { id: "u1", name: "Alex Smith", email: "alex@example.com" },
    currentUserRole: UserRole.Admin,
    allowedTeamIds: [],
    thresholds: { ...DEFAULT_THRESHOLDS },
    error: null,
    accessControlService: {
      getAccessControlDocument: jest.fn().mockResolvedValue({ id: "d", users: [], version: 1 }),
      getThresholds: jest.fn().mockResolvedValue({ ...DEFAULT_THRESHOLDS }),
    },
    ...overrides,
  };
}

describe("App", () => {
  beforeEach(() => {
    __setMockService("ms.vss-tfs-web.tfs-page-data-service", {
      getProject: async () => ({ id: "p1", name: "Contoso" }),
    });
    mockGetAllTeams.mockReset().mockResolvedValue([]);
    mockGetActiveTeams.mockReset().mockResolvedValue([]);
    mockGetTeamPerformance.mockReset();
    mockUseAccessControl.mockReset().mockReturnValue(access());
  });

  it("holds a busy gate while access is being checked", () => {
    mockUseAccessControl.mockReturnValue(access({ loading: true }));
    const { container } = render(<App />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("explains an access check that failed", () => {
    mockUseAccessControl.mockReturnValue(
      access({ error: "Extension data access was denied (403)." })
    );
    render(<App />);
    expect(screen.getByRole("heading", { name: "Couldn't check access" })).toBeInTheDocument();
    expect(screen.getByText("Extension data access was denied (403).")).toBeInTheDocument();
  });

  it("shows access denied to someone who is not on the list", () => {
    mockUseAccessControl.mockReturnValue(access({ authorized: false, currentUserRole: null }));
    render(<App />);
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
  });

  it("gives an admin the shell, the theme toggle and every page", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Sprint Performance Tracker", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Sprint Performance",
      "Developer Activity",
      "Team Insights",
      "Task Updates",
      "Department Stats",
    ]);
    expect(screen.getByRole("tab", { name: "Sprint Performance" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("shows the project name in the header once it is known", async () => {
    render(<App />);
    expect(await screen.findByText(/Contoso/)).toBeInTheDocument();
  });

  it("switches page from the tab strip", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Team Insights" }));

    expect(screen.getByRole("tab", { name: "Team Insights" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      screen.getByText(/Identify team members making outsized contributions/)
    ).toBeInTheDocument();
  });

  it("shows a viewer only the performance page, with no admin controls", async () => {
    mockUseAccessControl.mockReturnValue(access({ currentUserRole: UserRole.Viewer }));
    render(<App />);

    await screen.findByLabelText("Lookback period");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("opens the settings dialog from the header", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("dialog", { name: /Settings/ })).toBeInTheDocument();
  });

  it("asks for a team when none are selected", async () => {
    render(<App />);
    expect(
      await screen.findByText("No teams selected. Use the team buttons above to select teams.")
    ).toBeInTheDocument();
  });

  it("shows the failure when the project cannot be resolved", async () => {
    __setMockService("ms.vss-tfs-web.tfs-page-data-service", { getProject: async () => null });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Could not determine project context.")).toBeInTheDocument();
    });
  });
});
