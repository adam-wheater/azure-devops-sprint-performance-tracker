import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { AccessControlService } from "../services/AccessControlService";
import {
  AccessControlUser,
  TeamInfo,
  ThresholdSettings,
  DEFAULT_THRESHOLDS,
} from "../models/interfaces";
import { UserRole } from "../models/enums";
import { Avatar } from "./MemberBits";
import { Banner, Button, ConfirmDialog, IconUsers, Modal, Pill, Progress, Tabs } from "./ui";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accessControlService: AccessControlService;
  currentUserEmail: string;
  allTeams: TeamInfo[];
}

type AdminTab = "users" | "thresholds";

const THRESHOLD_FIELDS: {
  key: keyof ThresholdSettings;
  label: string;
  unit: string;
  min: number;
  max: number;
}[] = [
  { key: "taskMaxHours", label: "Max Task Hours", unit: "hours", min: 1, max: 24 },
  {
    key: "utilizationUnderplannedThreshold",
    label: "Underplanned Utilization",
    unit: "%",
    min: 0,
    max: 100,
  },
  {
    key: "velocityTolerancePct",
    label: "Velocity Tolerance",
    unit: "%",
    min: 0,
    max: 100,
  },
  { key: "slippageAtRiskThreshold", label: "Slippage At-Risk", unit: "%", min: 50, max: 500 },
  { key: "slippageOverThreshold", label: "Slippage Over", unit: "%", min: 100, max: 1000 },
  { key: "perfThresholdExcellent", label: "Performance Excellent", unit: "%", min: 50, max: 200 },
  { key: "perfThresholdGood", label: "Performance Good", unit: "%", min: 30, max: 150 },
  { key: "perfThresholdWarning", label: "Performance Warning", unit: "%", min: 10, max: 100 },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  accessControlService,
  currentUserEmail,
  allTeams,
}) => {
  const [adminTab, setAdminTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<AccessControlUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>(UserRole.Viewer);
  const [newTeamIds, setNewTeamIds] = useState<Set<string>>(new Set());
  const [editingTeamsFor, setEditingTeamsFor] = useState<string | null>(null);
  const [editTeamIds, setEditTeamIds] = useState<Set<string>>(new Set());

  // Threshold state
  const [thresholds, setThresholds] = useState<ThresholdSettings>({ ...DEFAULT_THRESHOLDS });
  const [thresholdsLoading, setThresholdsLoading] = useState(false);
  const [thresholdsSaving, setThresholdsSaving] = useState(false);
  const [thresholdsSaved, setThresholdsSaved] = useState(false);

  const fieldId = React.useId();
  const savedTimerRef = React.useRef<number | null>(null);

  // A pending "Saved!" reset must not fire after the panel is gone.
  useEffect(
    () => () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    },
    []
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await accessControlService.getAccessControlDocument();
      setUsers(doc.users);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load users.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accessControlService]);

  const loadThresholds = useCallback(async () => {
    setThresholdsLoading(true);
    try {
      const t = await accessControlService.getThresholds();
      setThresholds(t);
    } catch {
      // Fall back to defaults silently
      setThresholds({ ...DEFAULT_THRESHOLDS });
    } finally {
      setThresholdsLoading(false);
    }
  }, [accessControlService]);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadThresholds();
    }
  }, [isOpen, loadUsers, loadThresholds]);

  const handleAddUser = async () => {
    const email = newEmail.trim().toLowerCase();
    const displayName = newDisplayName.trim();
    if (!email) {
      setError("Email is required.");
      return;
    }
    setError(null);
    try {
      const teamIds =
        newRole === UserRole.Viewer && newTeamIds.size > 0 ? Array.from(newTeamIds) : undefined;
      const doc = await accessControlService.addUser(
        email,
        displayName || email,
        newRole,
        currentUserEmail,
        teamIds
      );
      setUsers(doc.users);
      setNewEmail("");
      setNewDisplayName("");
      setNewRole(UserRole.Viewer);
      setNewTeamIds(new Set());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add user.";
      setError(message);
    }
  };

  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "demote";
    email: string;
  } | null>(null);

  const handleRemoveUser = async (email: string) => {
    setError(null);
    try {
      const doc = await accessControlService.removeUser(email);
      setUsers(doc.users);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove user.";
      setError(message);
    }
  };

  const handleToggleRole = async (email: string, currentRole: UserRole) => {
    const newUserRole = currentRole === UserRole.Admin ? UserRole.Viewer : UserRole.Admin;
    setError(null);
    try {
      const doc = await accessControlService.updateUserRole(email, newUserRole);
      setUsers(doc.users);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update role.";
      setError(message);
    }
  };

  const requestRemove = (email: string) => {
    setConfirmAction({ type: "remove", email });
  };

  const requestDemote = (email: string) => {
    setConfirmAction({ type: "demote", email });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === "remove") {
      await handleRemoveUser(confirmAction.email);
    } else {
      await handleToggleRole(confirmAction.email, UserRole.Admin);
    }
    setConfirmAction(null);
  };

  const cancelConfirmAction = () => {
    setConfirmAction(null);
  };

  const handleEditTeams = (user: AccessControlUser) => {
    setEditingTeamsFor(user.email);
    setEditTeamIds(new Set(user.allowedTeamIds || []));
  };

  const handleSaveTeams = async () => {
    if (!editingTeamsFor) return;
    setError(null);
    try {
      const doc = await accessControlService.updateUserTeams(
        editingTeamsFor,
        Array.from(editTeamIds)
      );
      setUsers(doc.users);
      setEditingTeamsFor(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update teams.";
      setError(message);
    }
  };

  const handleSaveThresholds = async () => {
    setThresholdsSaving(true);
    setError(null);
    setThresholdsSaved(false);
    try {
      await accessControlService.updateThresholds(thresholds);
      setThresholdsSaved(true);
      savedTimerRef.current = window.setTimeout(() => setThresholdsSaved(false), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save thresholds.";
      setError(message);
    } finally {
      setThresholdsSaving(false);
    }
  };

  const handleResetThresholds = () => {
    setThresholds({ ...DEFAULT_THRESHOLDS });
  };

  if (!isOpen) return null;

  const toggleIn = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  };

  return (
    <>
      <Modal
        title={
          <span className="ax-row">
            <IconUsers size={17} /> Settings
          </span>
        }
        onClose={onClose}
        wide
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <Tabs
          tabs={[
            { id: "users", label: "Users", count: users.length },
            { id: "thresholds", label: "Thresholds" },
          ]}
          active={adminTab}
          onChange={(id) => setAdminTab(id as AdminTab)}
          aria-label="Settings sections"
        />

        {error && (
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {adminTab === "users" && (
          <>
            {loading ? (
              <Progress label="Loading users..." indeterminate />
            ) : (
              <div className="ax-table-wrap">
                <table className="ax-table" aria-label="Users with access">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Teams</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const isSelf = user.email.toLowerCase() === currentUserEmail.toLowerCase();
                      const isEditing = editingTeamsFor === user.email;
                      const teamCount = user.allowedTeamIds?.length || 0;
                      return (
                        <tr key={user.email}>
                          <td>
                            <span className="ax-row" style={{ flexWrap: "nowrap" }}>
                              <Avatar name={user.displayName || user.email} />
                              <span className="ax-mono">{user.email}</span>
                            </span>
                          </td>
                          <td>{user.displayName}</td>
                          <td>
                            <Pill tone={user.role === UserRole.Admin ? "info" : "neutral"}>
                              {user.role}
                            </Pill>
                          </td>
                          <td>
                            {user.role === UserRole.Admin ? (
                              <span className="ax-muted">All teams</span>
                            ) : isEditing ? (
                              <div>
                                <div className="ax-picker" style={{ maxHeight: 160 }}>
                                  {allTeams.map((team) => (
                                    <label
                                      key={team.id}
                                      className="ax-check"
                                      style={{ display: "flex" }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={editTeamIds.has(team.id)}
                                        onChange={() =>
                                          setEditTeamIds(toggleIn(editTeamIds, team.id))
                                        }
                                      />
                                      {team.name}
                                    </label>
                                  ))}
                                </div>
                                <div className="ax-row" style={{ marginTop: 8 }}>
                                  <Button size="sm" variant="primary" onClick={handleSaveTeams}>
                                    Save
                                  </Button>
                                  <Button size="sm" onClick={() => setEditingTeamsFor(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditTeams(user)}
                                title="Edit team access"
                              >
                                {teamCount === 0
                                  ? "All teams"
                                  : `${teamCount} team${teamCount !== 1 ? "s" : ""}`}
                              </Button>
                            )}
                          </td>
                          <td>
                            <span className="ax-row">
                              <Button
                                size="sm"
                                onClick={() =>
                                  user.role === UserRole.Admin
                                    ? requestDemote(user.email)
                                    : handleToggleRole(user.email, user.role)
                                }
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? "Cannot change your own role"
                                    : `Switch to ${user.role === UserRole.Admin ? "Viewer" : "Admin"}`
                                }
                              >
                                {user.role === UserRole.Admin ? "Demote" : "Promote"}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => requestRemove(user.email)}
                                disabled={isSelf}
                                title={isSelf ? "Cannot remove yourself" : "Remove user"}
                              >
                                Remove
                              </Button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <hr className="ax-divider" />
            <h3>Add a user</h3>
            <div className="ax-form-grid">
              <div className="ax-field">
                <label className="ax-label" htmlFor={`${fieldId}-email`}>
                  Email
                </label>
                <input
                  id={`${fieldId}-email`}
                  className="ax-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor={`${fieldId}-name`}>
                  Display Name
                </label>
                <input
                  id={`${fieldId}-name`}
                  className="ax-input"
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Alex Smith"
                />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor={`${fieldId}-role`}>
                  Role
                </label>
                <select
                  id={`${fieldId}-role`}
                  className="ax-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                  <option value={UserRole.Viewer}>Viewer</option>
                  <option value={UserRole.Admin}>Admin</option>
                </select>
              </div>
            </div>
            {newRole === UserRole.Viewer && allTeams.length > 0 && (
              <div className="ax-field">
                <span className="ax-label">Allowed Teams</span>
                <div className="ax-picker">
                  {allTeams.map((team) => (
                    <label key={team.id} className="ax-check" style={{ display: "flex" }}>
                      <input
                        type="checkbox"
                        checked={newTeamIds.has(team.id)}
                        onChange={() => setNewTeamIds(toggleIn(newTeamIds, team.id))}
                      />
                      {team.name}
                    </label>
                  ))}
                </div>
                <span className="ax-help">Leave empty for access to all teams</span>
              </div>
            )}
            <Button variant="primary" onClick={handleAddUser} disabled={!newEmail.trim()}>
              Add User
            </Button>
          </>
        )}

        {adminTab === "thresholds" &&
          (thresholdsLoading ? (
            <Progress label="Loading thresholds..." indeterminate />
          ) : (
            <>
              <p className="ax-help">
                Configure performance thresholds used across the tracker. Changes apply to all users
                the next time the hub is opened.
              </p>
              <div className="ax-form-grid">
                {THRESHOLD_FIELDS.map((field) => (
                  <div key={field.key} className="ax-field">
                    <label className="ax-label" htmlFor={`${fieldId}-${field.key}`}>
                      {field.label} <span className="ax-muted">({field.unit})</span>
                    </label>
                    <div className="ax-row">
                      <input
                        id={`${fieldId}-${field.key}`}
                        type="number"
                        className="ax-input ax-input--num"
                        value={thresholds[field.key]}
                        min={field.min}
                        max={field.max}
                        onChange={(e) =>
                          setThresholds({
                            ...thresholds,
                            [field.key]: Number(e.target.value),
                          })
                        }
                      />
                      <span className="ax-fine">Default: {DEFAULT_THRESHOLDS[field.key]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="ax-row">
                <Button
                  variant="primary"
                  onClick={handleSaveThresholds}
                  busy={thresholdsSaving}
                  disabled={thresholdsSaving}
                >
                  {thresholdsSaving ? "Saving..." : thresholdsSaved ? "Saved!" : "Save Thresholds"}
                </Button>
                <Button onClick={handleResetThresholds}>Reset to Defaults</Button>
              </div>
            </>
          ))}
      </Modal>

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction?.type === "remove" ? "Remove user" : "Demote admin"}
        message={
          confirmAction?.type === "remove"
            ? `Are you sure you want to remove "${confirmAction.email}"?`
            : `Are you sure you want to demote "${confirmAction?.email}" from Admin to Viewer?`
        }
        confirmLabel={confirmAction?.type === "remove" ? "Remove" : "Demote"}
        danger
        onConfirm={executeConfirmAction}
        onCancel={cancelConfirmAction}
      />
    </>
  );
};
