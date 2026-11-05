import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  MemberPerformanceSummary,
  ProjectContext,
  TeamInfo,
  TeamPerformanceData,
} from "../models/interfaces";
import { Banner, Button, Card, EmptyState, IconRefresh, Metric, Progress } from "./ui";
import { MemberName } from "./MemberBits";
import {
  CapacityMemberSnapshot,
  computeTaskUpdateInsights,
  TaskUpdateUserInsight,
} from "../utils/taskUpdateInsights";
import { TaskUpdateService } from "../services/TaskUpdateService";
import {
  TASK_UPDATE_HOURS_WINDOW_HOURS,
  TASK_UPDATE_MIN_COMPLETED_HOURS,
  TASK_UPDATE_STALE_WINDOW_HOURS,
} from "../utils/constants";

interface TaskUpdatePageProps {
  project: ProjectContext;
  selectedTeams: TeamInfo[];
  performanceData: Map<string, TeamPerformanceData>;
  performanceLoading: boolean;
}

function formatRelativeDate(date: Date | null): string {
  if (!date) return "No update in last 24h";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMemberIdentityKey(
  member: Pick<MemberPerformanceSummary, "memberUniqueName" | "memberId">
): string {
  return (member.memberUniqueName || "").trim().toLowerCase() || member.memberId;
}

const TaskUpdateTable: React.FC<{
  users: TaskUpdateUserInsight[];
  mode: "stale" | "hours";
}> = ({ users, mode }) => {
  if (users.length === 0) {
    return (
      <EmptyState
        title={
          mode === "stale"
            ? "Everyone has updated at least one assigned task in the last 24 hours."
            : "Everyone meets the 6-hour target in the last 6 hours."
        }
      />
    );
  }

  return (
    <div className="ax-table-wrap">
      <table className="ax-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Teams</th>
            <th>Last Task Update</th>
            {mode === "stale" ? (
              <th className="ax-num">Updates (24h)</th>
            ) : (
              <th className="ax-num">Completed Hours (6h)</th>
            )}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.memberId}>
              <td>
                <MemberName
                  name={user.memberDisplayName}
                  imageUrl={user.memberImageUrl}
                  detail={user.memberUniqueName}
                />
              </td>
              <td>{user.primaryRole}</td>
              <td>{user.teamNames.join(", ")}</td>
              <td>{formatRelativeDate(user.lastTaskUpdate)}</td>
              {mode === "stale" ? (
                <td className="ax-num">{user.updatesInLast24Hours}</td>
              ) : (
                <td className="ax-num">{user.completedHoursInLast6Hours.toFixed(1)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const TaskUpdatePage: React.FC<TaskUpdatePageProps> = ({
  project,
  selectedTeams,
  performanceData,
  performanceLoading,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [staleUsers, setStaleUsers] = useState<TaskUpdateUserInsight[]>([]);
  const [lowHoursUsers, setLowHoursUsers] = useState<TaskUpdateUserInsight[]>([]);

  const teamEntries = useMemo(
    () =>
      selectedTeams.flatMap((team) => {
        const data = performanceData.get(team.id);
        return data ? [{ team, data }] : [];
      }),
    [selectedTeams, performanceData]
  );

  const capacityUsers = useMemo<CapacityMemberSnapshot[]>(() => {
    const members = new Map<string, CapacityMemberSnapshot>();

    for (const entry of teamEntries) {
      for (const member of entry.data.members) {
        const key = getMemberIdentityKey(member);
        const existing = members.get(key);
        if (!existing) {
          members.set(key, {
            memberId: key,
            memberDisplayName: member.memberDisplayName,
            memberUniqueName: member.memberUniqueName,
            memberImageUrl: member.memberImageUrl,
            primaryRole: member.primaryRole,
            teamNames: [entry.team.name],
          });
          continue;
        }

        if (!existing.teamNames.includes(entry.team.name)) {
          existing.teamNames.push(entry.team.name);
        }
      }
    }

    return Array.from(members.values()).sort((a, b) =>
      a.memberDisplayName.localeCompare(b.memberDisplayName)
    );
  }, [teamEntries]);

  const iterationPaths = useMemo(
    () =>
      Array.from(
        new Set(
          teamEntries
            .flatMap((entry) => entry.data.sprints.map((sprint) => sprint.path))
            .filter(Boolean)
        )
      ),
    [teamEntries]
  );

  useEffect(() => {
    if (!project || performanceLoading) return;

    if (capacityUsers.length === 0 || iterationPaths.length === 0) {
      setStaleUsers([]);
      setLowHoursUsers([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const service = new TaskUpdateService();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const changedSince = new Date(
          now.getTime() - TASK_UPDATE_STALE_WINDOW_HOURS * 60 * 60 * 1000
        );
        const updates = await service.getTaskUpdatesForIterations(
          project,
          iterationPaths,
          changedSince
        );
        if (cancelled) return;

        const insights = computeTaskUpdateInsights(capacityUsers, updates, now);
        setStaleUsers(insights.notUpdatedInLast24Hours);
        setLowHoursUsers(insights.below6HoursInLast6Hours);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load task update insights.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project, performanceLoading, capacityUsers, iterationPaths, refreshKey]);

  return (
    <div>
      <div className="ax-toolbar">
        <Button
          icon={<IconRefresh />}
          busy={loading}
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading || performanceLoading}
          title="Refresh task update data"
        >
          Refresh
        </Button>
      </div>

      <div className="ax-metrics">
        <Metric
          label={`No task update in ${TASK_UPDATE_STALE_WINDOW_HOURS}h`}
          tone={staleUsers.length > 0 ? "warn" : "success"}
          value={staleUsers.length}
          hint={`users with no task update in the last ${TASK_UPDATE_STALE_WINDOW_HOURS}h`}
        />
        <Metric
          label={`Under ${TASK_UPDATE_MIN_COMPLETED_HOURS}h completed`}
          tone={lowHoursUsers.length > 0 ? "warn" : "success"}
          value={lowHoursUsers.length}
          hint={`users below ${TASK_UPDATE_MIN_COMPLETED_HOURS}h in the last ${TASK_UPDATE_HOURS_WINDOW_HOURS}h`}
        />
      </div>

      <p className="ax-help">
        Capacity users are taken from the selected teams. Hours are a proxy based on the current
        Completed Work values on tasks changed in the last {TASK_UPDATE_HOURS_WINDOW_HOURS} hours.
      </p>

      {error && <Banner tone="error">{error}</Banner>}
      {(loading || performanceLoading) && (
        <Progress label="Loading task updates..." indeterminate />
      )}

      {!loading && !performanceLoading && teamEntries.length === 0 && (
        <EmptyState title="No teams selected. Choose teams on the Sprint Performance page first." />
      )}

      {!loading && !performanceLoading && teamEntries.length > 0 && (
        <>
          <Card
            title={`Users with no task updates in last ${TASK_UPDATE_STALE_WINDOW_HOURS} hours`}
          >
            <TaskUpdateTable users={staleUsers} mode="stale" />
          </Card>

          <Card
            title={`Users below ${TASK_UPDATE_MIN_COMPLETED_HOURS} completed hours in last ${TASK_UPDATE_HOURS_WINDOW_HOURS} hours`}
          >
            <TaskUpdateTable users={lowHoursUsers} mode="hours" />
          </Card>
        </>
      )}
    </div>
  );
};
