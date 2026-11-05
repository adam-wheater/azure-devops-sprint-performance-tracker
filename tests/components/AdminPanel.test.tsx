import * as React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AdminPanel } from "@/components/AdminPanel";
import { AccessControlService } from "@/services/AccessControlService";
import { AccessControlDocument, AccessControlUser, DEFAULT_THRESHOLDS } from "@/models/interfaces";
import { UserRole } from "@/models/enums";

function createMockService(users: AccessControlUser[]): AccessControlService {
  const doc: AccessControlDocument = {
    id: "access-control",
    users: [...users],
    version: 1,
  };
  const service = new AccessControlService();

  // Override methods with jest mocks
  (service as any).getAccessControlDocument = jest.fn().mockResolvedValue(doc);
  (service as any).removeUser = jest.fn().mockImplementation(async (email: string) => {
    doc.users = doc.users.filter((u) => u.email !== email);
    return doc;
  });
  (service as any).addUser = jest
    .fn()
    .mockImplementation(async (email: string, displayName: string, role: UserRole) => {
      doc.users.push({
        email,
        displayName,
        role,
        addedBy: "test",
        addedAt: new Date().toISOString(),
      });
      return doc;
    });
  (service as any).updateUserRole = jest
    .fn()
    .mockImplementation(async (email: string, newRole: UserRole) => {
      const user = doc.users.find((u) => u.email === email);
      if (user) user.role = newRole;
      return doc;
    });
  (service as any).updateUserTeams = jest.fn().mockResolvedValue(doc);
  (service as any).getThresholds = jest.fn().mockResolvedValue({ ...DEFAULT_THRESHOLDS });
  (service as any).updateThresholds = jest.fn().mockResolvedValue({ ...DEFAULT_THRESHOLDS });

  return service;
}

const defaultUsers: AccessControlUser[] = [
  {
    email: "admin@example.com",
    displayName: "Admin User",
    role: UserRole.Admin,
    addedBy: "system",
    addedAt: "2026-01-01",
  },
  {
    email: "viewer@example.com",
    displayName: "Viewer User",
    role: UserRole.Viewer,
    addedBy: "admin@example.com",
    addedAt: "2026-01-02",
  },
];

describe("AdminPanel", () => {
  it("renders nothing when not open", () => {
    const service = createMockService(defaultUsers);
    const { container } = render(
      <AdminPanel
        isOpen={false}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders user list when open", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    });
  });

  it("shows confirmation dialog when Remove is clicked", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    });

    // Find the Remove button for viewer (not the disabled one for self)
    const removeButtons = screen.getAllByText("Remove");
    const enabledRemove = removeButtons.find((btn) => !(btn as HTMLButtonElement).disabled);
    expect(enabledRemove).toBeTruthy();
    fireEvent.click(enabledRemove!);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to remove/)).toBeInTheDocument();
    });
  });

  it("cancels confirmation dialog", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByText("Remove");
    const enabledRemove = removeButtons.find((btn) => !(btn as HTMLButtonElement).disabled);
    fireEvent.click(enabledRemove!);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
    });
  });

  it("disables remove and role toggle for self", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    });

    // The admin user's row should have disabled buttons
    const rows = screen.getAllByRole("row");
    // Find the row containing admin@example.com
    const adminRow = rows.find((row) => row.textContent?.includes("admin@example.com"));
    expect(adminRow).toBeTruthy();

    const buttons = adminRow!.querySelectorAll("button:disabled");
    expect(buttons.length).toBe(2); // Both Demote and Remove are disabled
  });

  it("switches to thresholds tab", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );

    fireEvent.click(screen.getByText("Thresholds"));
    await waitFor(() => {
      expect(
        screen.getByText(/Configure performance thresholds used across the tracker/)
      ).toBeInTheDocument();
    });
  });

  it("calls onClose when the backdrop is clicked", () => {
    const service = createMockService(defaultUsers);
    const onClose = jest.fn();
    render(
      <AdminPanel
        isOpen={true}
        onClose={onClose}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );

    // The dialog sits inside the backdrop; a press on the backdrop itself closes it.
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the press lands inside the dialog", () => {
    const service = createMockService(defaultUsers);
    const onClose = jest.fn();
    render(
      <AdminPanel
        isOpen={true}
        onClose={onClose}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );

    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const service = createMockService(defaultUsers);
    const onClose = jest.fn();
    render(
      <AdminPanel
        isOpen={true}
        onClose={onClose}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("names the dialog for assistive tech", () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );

    expect(screen.getByRole("dialog", { name: /Settings/ })).toBeInTheDocument();
  });

  it("removes the user once the confirmation is accepted", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByText("Remove");
    fireEvent.click(removeButtons.find((btn) => !(btn as HTMLButtonElement).disabled)!);

    const confirm = within(
      screen.getByText(/Are you sure/).closest("[role=dialog]") as HTMLElement
    );
    fireEvent.click(confirm.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect((service as any).removeUser).toHaveBeenCalledWith("viewer@example.com");
    });
    await waitFor(() => {
      expect(screen.queryByText("viewer@example.com")).not.toBeInTheDocument();
    });
  });

  it("adds a user with the chosen role", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Add User" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "New.Person@Example.com" },
    });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: UserRole.Admin } });
    fireEvent.click(screen.getByRole("button", { name: "Add User" }));

    await waitFor(() => {
      expect((service as any).addUser).toHaveBeenCalledWith(
        "new.person@example.com",
        "new.person@example.com",
        UserRole.Admin,
        "admin@example.com",
        undefined
      );
    });
  });

  it("saves edited thresholds", async () => {
    const service = createMockService(defaultUsers);
    render(
      <AdminPanel
        isOpen={true}
        onClose={() => {}}
        accessControlService={service}
        currentUserEmail="admin@example.com"
        allTeams={[]}
      />
    );

    fireEvent.click(screen.getByText("Thresholds"));
    const input = await screen.findByLabelText(/Max Task Hours/);
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Thresholds" }));

    await waitFor(() => {
      expect((service as any).updateThresholds).toHaveBeenCalledWith(
        expect.objectContaining({ taskMaxHours: 8 })
      );
    });
  });
});
