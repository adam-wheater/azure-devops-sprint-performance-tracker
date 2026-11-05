// ===== INPUT / RAW DATA MODELS =====

export interface ProjectContext {
  id: string;
  name: string;
}

export interface TeamInfo {
  id: string;
  name: string;
}

export interface SprintInfo {
  id: string;
  name: string;
  path: string;
  startDate: Date;
  finishDate: Date;
}

export interface ActivityCapacity {
  name: string; // e.g. "Development", "Testing", "Design"
  capacityPerDay: number; // hours per day for this activity
}

export interface MemberCapacity {
  memberId: string;
  memberDisplayName: string;
  memberUniqueName: string;
  memberImageUrl: string;
  activities: ActivityCapacity[];
  totalCapacityPerDay: number; // sum of all activity capacities
  primaryRole: string; // activity with highest capacity (e.g. "Development")
  personalDaysOff: DateRange[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TeamDaysOff {
  daysOff: DateRange[];
}

export interface WorkItemData {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedToUniqueName: string;
  assignedToDisplayName: string;
  iterationPath: string;
  effort: number | null;
  originalEstimate: number | null;
  completedWork: number | null;
  remainingWork: number | null;
  activatedDate: Date | null;
  stateChangeDate: Date | null;
  changedDate: Date | null;
}

// ===== CALCULATED / OUTPUT MODELS =====

export interface SprintMemberEffort {
  memberId: string;
  memberDisplayName: string;
  memberUniqueName: string;
  memberImageUrl: string;
  primaryRole: string;
  sprintId: string;
  sprintName: string;

  // Working days
  totalWeekdays: number;
  teamDaysOffCount: number;
  personalDaysOffCount: number;
  workingDays: number;
  capacityHoursPerDay: number;

  // Effort row data (PBIs + Bugs)
  totalEffortAssigned: number;
  totalEffortCompleted: number;
  effortPerDay: number;
  effortTarget: number;
  effortPerformancePct: number;
  effortCompletionPct: number;
  pbiCountTotal: number;
  pbiCountCompleted: number;
  bugCountTotal: number;
  bugCountCompleted: number;

  // Hours row data (Tasks)
  totalOriginalEstimate: number;
  totalCompletedWork: number;
  totalRemainingWork: number;
  estimatedVsActualRatio: number;
  availableHours: number;
  hoursUtilizationPct: number;

  // Sprint progress (0.0–1.0): fraction of sprint elapsed by working days
  sprintProgress: number;
}

export interface SprintTeamTotals {
  sprintId: string;
  sprintName: string;

  // Aggregated effort
  totalEffortAssigned: number;
  totalEffortCompleted: number;
  totalWorkingDays: number;
  avgEffortPerDay: number;
  avgEffortPerformancePct: number;

  // Aggregated hours
  totalOriginalEstimate: number;
  totalCompletedWork: number;
  totalRemainingWork: number;
  totalAvailableHours: number;
  estimatedVsActualRatio: number;
  hoursUtilizationPct: number;

  effortCompletionPct: number;
  avgCycleTimeDays: number;
  workDistributionScore: number;

  // Work item counts
  pbiCountTotal: number;
  pbiCountCompleted: number;
  bugCountTotal: number;
  bugCountCompleted: number;
  taskCountTotal: number;
  taskCountCompleted: number;
}

export interface TeamSummaryStats {
  sprintCount: number;
  avgVelocity: number; // avg effort completed per sprint
  totalPbisAssigned: number;
  totalPbisCompleted: number;
  totalBugsAssigned: number;
  totalBugsCompleted: number;
  totalTasksAssigned: number;
  totalTasksCompleted: number;
  avgEffortPerDay: number; // average across sprints
  avgHoursUtilization: number; // average across sprints
  avgEffortCompletionRate: number;
  avgCycleTimeDays: number;
  avgWorkDistributionScore: number;
  avgHealthScore: number;
}

export interface TeamPerformanceData {
  team: TeamInfo;
  sprints: SprintInfo[];
  members: MemberPerformanceSummary[];
  teamTotals: SprintTeamTotals[];
  summaryStats: TeamSummaryStats;
  slippageData: SprintSlippageData[];
  bestPracticeData: SprintBestPracticeData[];
  failedSprints: string[];
  unmatchedAssignees: string[];
}

export interface MemberPerformanceSummary {
  memberId: string;
  memberDisplayName: string;
  memberUniqueName: string;
  memberImageUrl: string;
  primaryRole: string;
  sprintData: SprintMemberEffort[];
}

// ===== SLIPPAGE DATA MODELS =====

export type SlippageStatus = "on-track" | "at-risk" | "over" | "not-started" | "no-effort";

export interface WorkItemSlippage {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedToDisplayName: string;
  assignedToUniqueName: string;
  effort: number | null;
  activatedDate: Date | null;
  resolvedDate: Date | null;
  elapsedDays: number | null;
  slippagePct: number | null;
  isOngoing: boolean;
  status: SlippageStatus;
}

export interface SlippageSummary {
  totalItems: number;
  onTrack: number;
  atRisk: number;
  over: number;
  notStarted: number;
  noEffort: number;
}

export interface SprintSlippageData {
  sprintId: string;
  sprintName: string;
  items: WorkItemSlippage[];
  summary: SlippageSummary;
}

// ===== BEST PRACTICE DATA MODELS =====

export type BestPracticeSeverity = "error" | "warning" | "info";

export interface BestPracticeViolation {
  rule: string;
  severity: BestPracticeSeverity;
  message: string;
  items: BestPracticeItem[];
}

export interface BestPracticeItem {
  id?: number;
  title?: string;
  type?: string;
  detail: string;
}

export interface SprintBestPracticeData {
  sprintId: string;
  sprintName: string;
  violations: BestPracticeViolation[];
  summary: { errors: number; warnings: number; passed: number };
  healthScore: number;
}

// ===== CONFIGURABLE THRESHOLDS =====

export interface ThresholdSettings {
  taskMaxHours: number;
  utilizationUnderplannedThreshold: number;
  velocityTolerancePct: number;
  slippageAtRiskThreshold: number;
  slippageOverThreshold: number;
  perfThresholdExcellent: number;
  perfThresholdGood: number;
  perfThresholdWarning: number;
}

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  taskMaxHours: 6,
  utilizationUnderplannedThreshold: 60,
  velocityTolerancePct: 20,
  slippageAtRiskThreshold: 100,
  slippageOverThreshold: 200,
  perfThresholdExcellent: 100,
  perfThresholdGood: 80,
  perfThresholdWarning: 60,
};

// ===== DEVELOPER ACTIVITY MODELS =====

export interface DeveloperSprintActivity {
  sprintId: string;
  sprintName: string;
  commitCount: number;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  pipelinesTriggered: number;
}

export interface DeveloperActivitySummary {
  email: string;
  displayName: string;
  imageUrl?: string;
  sprintActivities: DeveloperSprintActivity[];
}

export interface DeveloperActivityData {
  sprints: SprintInfo[];
  developers: DeveloperActivitySummary[];
  /** True when commit detail fetches were capped at the per-sprint limit. */
  commitDetailsTruncated: boolean;
}

// ===== DEPARTMENT STATS MODELS =====

/** One day of a daily time series. `date` is a local "YYYY-MM-DD" key. */
export interface DailyPoint {
  date: string;
  value: number;
}

/** A pull request reduced to just what the department charts need. */
export interface PullRequestEvent {
  pullRequestId: number;
  repositoryId: string;
  repositoryName: string;
  createdByEmail: string;
  createdByDisplayName: string;
  creationDate: Date | null;
  closedDate: Date | null;
  /** Azure DevOps PullRequestStatus: 1 active, 2 abandoned, 3 completed. */
  status: number;
  isDraft: boolean;
}

/** A commit reduced to just what the department charts need. */
export interface CommitEvent {
  commitId: string;
  repositoryId: string;
  repositoryName: string;
  authorEmail: string;
  authorDisplayName: string;
  date: Date | null;
}

export interface DepartmentStatsRange {
  fromDate: Date;
  toDate: Date;
}

export interface DepartmentStatsData {
  range: DepartmentStatsRange;
  pullRequests: PullRequestEvent[];
  commits: CommitEvent[];
  repositoryCount: number;
  /** Repos whose commit history hit the fetch cap — totals are a lower bound. */
  truncatedRepositories: string[];
  /** True when the pull request pager hit its page cap. */
  pullRequestsTruncated: boolean;
  /** Repos that failed to load at all, so the reader knows the data is partial. */
  failedRepositories: string[];
}

// ===== ACCESS CONTROL MODELS =====

export interface AccessControlUser {
  email: string;
  displayName: string;
  role: import("./enums").UserRole;
  addedBy: string;
  addedAt: string;
  allowedTeamIds?: string[];
}

export interface AccessControlDocument {
  id: string;
  users: AccessControlUser[];
  version: number;
  thresholds?: ThresholdSettings;
}
