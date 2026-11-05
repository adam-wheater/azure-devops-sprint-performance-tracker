import {
  WorkItemData,
  WorkItemSlippage,
  SprintSlippageData,
  SlippageSummary,
  SlippageStatus,
  ThresholdSettings,
} from "../models/interfaces";
import { WorkItemType, COMPLETED_STATES, ACTIVE_STATES, NOT_STARTED_STATES } from "../models/enums";
import { countWeekdaysBetween } from "../utils/dateUtils";
import { SLIPPAGE_THRESHOLD_AT_RISK, SLIPPAGE_THRESHOLD_OVER } from "../utils/constants";

export class SlippageCalculator {
  calculate(
    workItems: WorkItemData[],
    sprintId: string,
    sprintName: string,
    thresholds?: ThresholdSettings
  ): SprintSlippageData {
    const effortItems = workItems.filter(
      (wi) => wi.type === WorkItemType.PBI || wi.type === WorkItemType.Bug
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: WorkItemSlippage[] = effortItems.map((wi) =>
      this.calculateItemSlippage(wi, today, thresholds)
    );

    const summary = this.computeSummary(items);

    return { sprintId, sprintName, items, summary };
  }

  private calculateItemSlippage(
    wi: WorkItemData,
    today: Date,
    thresholds?: ThresholdSettings
  ): WorkItemSlippage {
    const isCompleted = COMPLETED_STATES.includes(wi.state);
    const isActive = ACTIVE_STATES.includes(wi.state);
    const isNotStarted = NOT_STARTED_STATES.includes(wi.state);

    const activatedDate = wi.activatedDate || null;
    const resolvedDate = isCompleted ? wi.stateChangeDate || wi.changedDate || null : null;

    let elapsedDays: number | null = null;
    let slippagePct: number | null = null;
    let isOngoing = false;
    let status: SlippageStatus;

    if (!wi.effort || wi.effort === 0) {
      status = "no-effort";
    } else if (isNotStarted || !activatedDate) {
      status = "not-started";
    } else if (isCompleted && resolvedDate) {
      elapsedDays = countWeekdaysBetween(activatedDate, resolvedDate);
      slippagePct = (elapsedDays / wi.effort) * 100;
      status = this.getStatus(slippagePct, thresholds);
    } else if (isActive) {
      elapsedDays = countWeekdaysBetween(activatedDate, today);
      slippagePct = (elapsedDays / wi.effort) * 100;
      isOngoing = true;
      status = this.getStatus(slippagePct, thresholds);
    } else {
      status = "not-started";
    }

    return {
      id: wi.id,
      title: wi.title,
      type: wi.type,
      state: wi.state,
      assignedToDisplayName: wi.assignedToDisplayName,
      assignedToUniqueName: wi.assignedToUniqueName,
      effort: wi.effort,
      activatedDate,
      resolvedDate,
      elapsedDays,
      slippagePct,
      isOngoing,
      status,
    };
  }

  private getStatus(slippagePct: number, thresholds?: ThresholdSettings): SlippageStatus {
    const overThreshold = thresholds?.slippageOverThreshold ?? SLIPPAGE_THRESHOLD_OVER;
    const atRiskThreshold = thresholds?.slippageAtRiskThreshold ?? SLIPPAGE_THRESHOLD_AT_RISK;

    if (slippagePct > overThreshold) return "over";
    if (slippagePct > atRiskThreshold) return "at-risk";
    return "on-track";
  }

  private computeSummary(items: WorkItemSlippage[]): SlippageSummary {
    let onTrack = 0,
      atRisk = 0,
      over = 0,
      notStarted = 0,
      noEffort = 0;
    for (const item of items) {
      switch (item.status) {
        case "on-track":
          onTrack++;
          break;
        case "at-risk":
          atRisk++;
          break;
        case "over":
          over++;
          break;
        case "not-started":
          notStarted++;
          break;
        case "no-effort":
          noEffort++;
          break;
      }
    }
    return { totalItems: items.length, onTrack, atRisk, over, notStarted, noEffort };
  }
}
