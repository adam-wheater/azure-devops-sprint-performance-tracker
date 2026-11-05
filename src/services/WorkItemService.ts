import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { getClient } from "azure-devops-extension-api";
import { WorkItemData, ProjectContext, SprintInfo } from "../models/interfaces";
import { WORK_ITEM_FIELDS, BATCH_SIZE } from "../utils/constants";

export class WorkItemService {
  private witClient: WorkItemTrackingRestClient;

  constructor() {
    this.witClient = getClient(WorkItemTrackingRestClient);
  }

  async getWorkItemsForSprint(
    project: ProjectContext,
    sprint: SprintInfo
  ): Promise<WorkItemData[]> {
    // Sanitize sprint path for WIQL string literal:
    // escape backslashes, single quotes, and strip control characters
    const escapedPath = sprint.path
      .replace(/[\x00-\x1f\x7f]/g, "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "''");

    const wiql = {
      query: `SELECT [System.Id]
                    FROM WorkItems
                    WHERE [System.IterationPath] = '${escapedPath}'
                      AND [System.WorkItemType] IN ('Product Backlog Item', 'Bug', 'Task')
                      AND [System.State] <> 'Removed'
                      AND [System.AssignedTo] <> ''`,
    };

    const queryResult = await this.witClient.queryByWiql(wiql, project.name);

    if (!queryResult.workItems || queryResult.workItems.length === 0) {
      return [];
    }

    const allIds = queryResult.workItems.map((wi) => wi.id);
    const workItems: WorkItemData[] = [];

    // Fetch in batches of 200
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batchIds = allIds.slice(i, i + BATCH_SIZE);

      const batchResult = await this.witClient.getWorkItems(
        batchIds,
        project.name,
        WORK_ITEM_FIELDS
      );

      for (const wi of batchResult) {
        const fields = wi.fields;
        const assignedTo = fields["System.AssignedTo"];

        workItems.push({
          id: wi.id,
          type: fields["System.WorkItemType"],
          title: fields["System.Title"],
          state: fields["System.State"],
          assignedToUniqueName: assignedTo
            ? assignedTo.uniqueName || assignedTo.displayName || ""
            : "",
          assignedToDisplayName: assignedTo ? assignedTo.displayName || "" : "",
          iterationPath: fields["System.IterationPath"],
          effort: fields["Microsoft.VSTS.Scheduling.Effort"] ?? null,
          originalEstimate: fields["Microsoft.VSTS.Scheduling.OriginalEstimate"] ?? null,
          completedWork: fields["Microsoft.VSTS.Scheduling.CompletedWork"] ?? null,
          remainingWork: fields["Microsoft.VSTS.Scheduling.RemainingWork"] ?? null,
          activatedDate: fields["Microsoft.VSTS.Common.ActivatedDate"]
            ? new Date(fields["Microsoft.VSTS.Common.ActivatedDate"])
            : null,
          stateChangeDate: fields["Microsoft.VSTS.Common.StateChangeDate"]
            ? new Date(fields["Microsoft.VSTS.Common.StateChangeDate"])
            : null,
          changedDate: fields["System.ChangedDate"] ? new Date(fields["System.ChangedDate"]) : null,
        });
      }
    }

    return workItems;
  }
}
