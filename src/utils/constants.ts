export const WORK_ITEM_FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.State",
  "System.AssignedTo",
  "System.IterationPath",
  "Microsoft.VSTS.Scheduling.Effort",
  "Microsoft.VSTS.Scheduling.OriginalEstimate",
  "Microsoft.VSTS.Scheduling.CompletedWork",
  "Microsoft.VSTS.Scheduling.RemainingWork",
  "Microsoft.VSTS.Common.ActivatedDate",
  "Microsoft.VSTS.Common.StateChangeDate",
  "System.ChangedDate",
];

export const DEFAULT_LOOKBACK = 3;
export const ACTIVE_TEAM_LOOKBACK = 5;
export const MIN_LOOKBACK = 1;
export const MAX_LOOKBACK = 10;
export const BATCH_SIZE = 200;
export const MAX_CONCURRENT_TEAMS = 5;
export const MAX_CONCURRENT_SPRINTS = 3;
export const SPRINT_FETCH_TIMEOUT_MS = 30_000;

// ===== DEPARTMENT STATS =====
// Range presets offered above the department charts, in days.
export const DEPT_STATS_RANGE_PRESETS = [30, 60, 90, 120, 180] as const;
export const DEPT_STATS_DEFAULT_RANGE_DAYS = 120;
/** Rolling window for the trend line drawn over the daily bars. */
export const DEPT_STATS_TREND_WINDOW_DAYS = 7;

export const DEPT_STATS_PR_PAGE_SIZE = 200;
export const DEPT_STATS_PR_MAX_PAGES = 15;
export const DEPT_STATS_COMMIT_PAGE_SIZE = 500;
export const DEPT_STATS_COMMIT_MAX_PAGES = 6;
export const DEPT_STATS_MAX_CONCURRENT_REPOS = 4;

export const PERF_THRESHOLD_EXCELLENT = 100;
export const PERF_THRESHOLD_GOOD = 80;
export const PERF_THRESHOLD_WARNING = 60;

// Colours are design tokens from src/styles/app.css, never literals, so every
// performance colour follows the light, dark and high-contrast palettes.
export const PERF_COLOR_EXCELLENT = "var(--ax-success)";
export const PERF_COLOR_GOOD = "var(--ax-info)";
export const PERF_COLOR_WARNING = "var(--ax-warn)";
export const PERF_COLOR_POOR = "var(--ax-danger)";

export const COMPLETED_STATES: readonly string[] = ["Done", "Closed", "Resolved"];
// Agile and CMMI use Active, Scrum uses Committed (PBIs) and In Progress (Tasks), Basic uses Doing.
export const ACTIVE_STATES: readonly string[] = ["Active", "Committed", "In Progress", "Doing"];
export const NOT_STARTED_STATES: readonly string[] = ["New", "Approved", "To Do", "Proposed"];
export const EFFORT_TARGET_PER_DAY = 1.0;
export const TASK_MAX_HOURS = 6;

export const UTILIZATION_UNDERPLANNED_THRESHOLD = 60;
export const TASK_UPDATE_STALE_WINDOW_HOURS = 24;
export const TASK_UPDATE_HOURS_WINDOW_HOURS = 6;
export const TASK_UPDATE_MIN_COMPLETED_HOURS = 6;

// Tolerance band (%) added to average velocity before flagging over-velocity.
// e.g. 20 means a sprint can be planned up to 120% of avg velocity without warning.
export const VELOCITY_TOLERANCE_PCT = 20;

export const SLIPPAGE_THRESHOLD_AT_RISK = 100;
export const SLIPPAGE_THRESHOLD_OVER = 200;

export const SLIPPAGE_COLOR_ON_TRACK = "var(--ax-success)";
export const SLIPPAGE_COLOR_AT_RISK = "var(--ax-warn)";
export const SLIPPAGE_COLOR_OVER = "var(--ax-danger)";

// Role dots use the categorical chart series (each clears 3:1 on the surface).
export const ROLE_COLORS: Record<string, string> = {
  Development: "var(--ax-chart-1)",
  Testing: "var(--ax-chart-5)",
  Design: "var(--ax-chart-6)",
  Documentation: "var(--ax-chart-2)",
  Default: "var(--ax-text-4)",
};

// ===== ACCESS CONTROL =====
export const ACCESS_CONTROL_COLLECTION = "SprintPerfTrackerSettings";
export const ACCESS_CONTROL_DOC_ID = "access-control";
export const ACCESS_CONTROL_VERSION = 1;
