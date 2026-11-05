import {
  TASK_UPDATE_HOURS_WINDOW_HOURS,
  TASK_UPDATE_MIN_COMPLETED_HOURS,
  TASK_UPDATE_STALE_WINDOW_HOURS,
} from "./constants";
import { TaskUpdateActivity } from "../services/TaskUpdateService";

export interface CapacityMemberSnapshot {
  memberId: string;
  memberDisplayName: string;
  memberUniqueName: string;
  memberImageUrl: string;
  primaryRole: string;
  teamNames: string[];
}

export interface TaskUpdateUserInsight extends CapacityMemberSnapshot {
  lastTaskUpdate: Date | null;
  updatesInLast24Hours: number;
  updatesInLast6Hours: number;
  completedHoursInLast6Hours: number;
}

export interface TaskUpdateInsightsResult {
  allUsers: TaskUpdateUserInsight[];
  notUpdatedInLast24Hours: TaskUpdateUserInsight[];
  below6HoursInLast6Hours: TaskUpdateUserInsight[];
}

function normalizeIdentity(uniqueName: string, displayName: string): string {
  const unique = uniqueName.trim().toLowerCase();
  if (unique) return unique;
  return displayName.trim().toLowerCase();
}

export function computeTaskUpdateInsights(
  capacityUsers: CapacityMemberSnapshot[],
  taskUpdates: TaskUpdateActivity[],
  now: Date = new Date()
): TaskUpdateInsightsResult {
  const staleCutoff = new Date(now.getTime() - TASK_UPDATE_STALE_WINDOW_HOURS * 60 * 60 * 1000);
  const hoursCutoff = new Date(now.getTime() - TASK_UPDATE_HOURS_WINDOW_HOURS * 60 * 60 * 1000);

  const updatesByAssignee = new Map<string, TaskUpdateActivity[]>();
  for (const update of taskUpdates) {
    const key = normalizeIdentity(update.assignedToUniqueName, update.assignedToDisplayName);
    if (!key) continue;
    const entries = updatesByAssignee.get(key);
    if (entries) {
      entries.push(update);
    } else {
      updatesByAssignee.set(key, [update]);
    }
  }

  const allUsers: TaskUpdateUserInsight[] = capacityUsers.map((member) => {
    const key = normalizeIdentity(member.memberUniqueName, member.memberDisplayName);
    const memberUpdates = updatesByAssignee.get(key) || [];

    let lastTaskUpdate: Date | null = null;
    let updatesInLast24Hours = 0;
    let updatesInLast6Hours = 0;
    let completedHoursInLast6Hours = 0;

    for (const update of memberUpdates) {
      if (!update.changedDate) continue;

      if (!lastTaskUpdate || update.changedDate > lastTaskUpdate) {
        lastTaskUpdate = update.changedDate;
      }

      if (update.changedDate >= staleCutoff) {
        updatesInLast24Hours += 1;
      }

      if (update.changedDate >= hoursCutoff) {
        updatesInLast6Hours += 1;
        completedHoursInLast6Hours += update.completedWork || 0;
      }
    }

    return {
      ...member,
      lastTaskUpdate,
      updatesInLast24Hours,
      updatesInLast6Hours,
      completedHoursInLast6Hours,
    };
  });

  const notUpdatedInLast24Hours = allUsers
    .filter((user) => user.updatesInLast24Hours === 0)
    .sort((a, b) => a.memberDisplayName.localeCompare(b.memberDisplayName));

  const below6HoursInLast6Hours = allUsers
    .filter((user) => user.completedHoursInLast6Hours < TASK_UPDATE_MIN_COMPLETED_HOURS)
    .sort(
      (a, b) =>
        a.completedHoursInLast6Hours - b.completedHoursInLast6Hours ||
        a.memberDisplayName.localeCompare(b.memberDisplayName)
    );

  return {
    allUsers,
    notUpdatedInLast24Hours,
    below6HoursInLast6Hours,
  };
}
