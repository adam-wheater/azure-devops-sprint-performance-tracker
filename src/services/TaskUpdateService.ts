import { getClient } from "azure-devops-extension-api";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { ProjectContext } from "../models/interfaces";
import { BATCH_SIZE } from "../utils/constants";

export interface TaskUpdateActivity {
  id: number;
  title: string;
  assignedToUniqueName: string;
  assignedToDisplayName: string;
  changedDate: Date | null;
  completedWork: number;
  iterationPath: string;
}

const TASK_ACTIVITY_FIELDS = [
  "System.Id",
  "System.Title",
  "System.AssignedTo",
  "System.IterationPath",
  "System.ChangedDate",
  "Microsoft.VSTS.Scheduling.CompletedWork",
];

function sanitizeWiqlLiteral(value: string): string {
  return value
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''");
}

export class TaskUpdateService {
  private witClient: WorkItemTrackingRestClient;

  constructor() {
    this.witClient = getClient(WorkItemTrackingRestClient);
  }

  async getTaskUpdatesForIterations(
    project: ProjectContext,
    iterationPaths: string[],
    changedSince: Date
  ): Promise<TaskUpdateActivity[]> {
    const uniquePaths = Array.from(
      new Set(iterationPaths.map((path) => path.trim()).filter((path) => path.length > 0))
    );

    if (uniquePaths.length === 0) {
      return [];
    }

    const pathLiteral = uniquePaths.map((path) => `'${sanitizeWiqlLiteral(path)}'`).join(", ");
    const changedSinceLiteral = changedSince.toISOString().slice(0, 10);

    const wiql = {
      query: `SELECT [System.Id]
              FROM WorkItems
              WHERE [System.IterationPath] IN (${pathLiteral})
                AND [System.WorkItemType] = 'Task'
                AND [System.State] <> 'Removed'
                AND [System.AssignedTo] <> ''
                AND [System.ChangedDate] >= '${changedSinceLiteral}'`,
    };

    const queryResult = await this.witClient.queryByWiql(wiql, project.name);
    if (!queryResult.workItems || queryResult.workItems.length === 0) {
      return [];
    }

    const ids = queryResult.workItems.map((wi) => wi.id);
    const updates: TaskUpdateActivity[] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const batchResult = await this.witClient.getWorkItems(
        batchIds,
        project.name,
        TASK_ACTIVITY_FIELDS
      );

      for (const wi of batchResult) {
        const fields = wi.fields;
        const assignedTo = fields["System.AssignedTo"];
        const completedWorkRaw = fields["Microsoft.VSTS.Scheduling.CompletedWork"];

        updates.push({
          id: wi.id,
          title: fields["System.Title"] || "",
          assignedToUniqueName: assignedTo
            ? assignedTo.uniqueName || assignedTo.displayName || ""
            : "",
          assignedToDisplayName: assignedTo ? assignedTo.displayName || "" : "",
          changedDate: fields["System.ChangedDate"] ? new Date(fields["System.ChangedDate"]) : null,
          completedWork: typeof completedWorkRaw === "number" ? completedWorkRaw : 0,
          iterationPath: fields["System.IterationPath"] || "",
        });
      }
    }

    return updates;
  }
}
