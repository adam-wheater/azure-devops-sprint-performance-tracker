import { TeamPerformanceData } from "../models/interfaces";

export function escapeCsvField(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvRows(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ];
  return lines.join("\n");
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTeamDataToCsv(data: TeamPerformanceData): void {
  const teamName = data.team.name.replace(/[^a-zA-Z0-9]/g, "_");
  const timestamp = new Date().toISOString().slice(0, 10);

  // Sheet 1: Member performance per sprint
  const memberHeaders = [
    "Member",
    "Role",
    "Sprint",
    "Working Days",
    "Capacity h/day",
    "Effort Assigned",
    "Effort Completed",
    "Effort/Day",
    "Completion %",
    "Original Estimate (h)",
    "Completed Work (h)",
    "Remaining (h)",
    "Utilization %",
    "Est. Accuracy",
    "PBIs Done",
    "PBIs Total",
    "Bugs Done",
    "Bugs Total",
  ];

  const memberRows: (string | number | null)[][] = [];
  for (const member of data.members) {
    for (const sd of member.sprintData) {
      memberRows.push([
        member.memberDisplayName,
        member.primaryRole,
        sd.sprintName,
        sd.workingDays,
        sd.capacityHoursPerDay,
        sd.totalEffortAssigned,
        sd.totalEffortCompleted,
        Number(sd.effortPerDay.toFixed(2)),
        Number(sd.effortCompletionPct.toFixed(1)),
        sd.totalOriginalEstimate,
        sd.totalCompletedWork,
        sd.totalRemainingWork,
        Number(sd.hoursUtilizationPct.toFixed(1)),
        Number(sd.estimatedVsActualRatio.toFixed(2)),
        sd.pbiCountCompleted,
        sd.pbiCountTotal,
        sd.bugCountCompleted,
        sd.bugCountTotal,
      ]);
    }
  }

  // Sheet 2: Team totals per sprint
  const totalsHeaders = [
    "Sprint",
    "Effort Assigned",
    "Effort Completed",
    "Working Days",
    "Avg Effort/Day",
    "Completion %",
    "Original Estimate (h)",
    "Completed Work (h)",
    "Remaining (h)",
    "Utilization %",
    "Est. Accuracy",
    "Cycle Time (days)",
    "Distribution Score",
    "PBIs Done",
    "PBIs Total",
    "Bugs Done",
    "Bugs Total",
    "Tasks Done",
    "Tasks Total",
  ];

  const totalsRows: (string | number | null)[][] = [];
  for (const t of data.teamTotals) {
    totalsRows.push([
      t.sprintName,
      t.totalEffortAssigned,
      t.totalEffortCompleted,
      t.totalWorkingDays,
      Number(t.avgEffortPerDay.toFixed(2)),
      Number(t.effortCompletionPct.toFixed(1)),
      t.totalOriginalEstimate,
      t.totalCompletedWork,
      t.totalRemainingWork,
      Number(t.hoursUtilizationPct.toFixed(1)),
      Number(t.estimatedVsActualRatio.toFixed(2)),
      Number(t.avgCycleTimeDays.toFixed(1)),
      t.workDistributionScore,
      t.pbiCountCompleted,
      t.pbiCountTotal,
      t.bugCountCompleted,
      t.bugCountTotal,
      t.taskCountCompleted,
      t.taskCountTotal,
    ]);
  }

  // Combine both tables with section markers for reliable parsing
  const memberCsv = buildCsvRows(memberHeaders, memberRows);
  const totalsCsv = buildCsvRows(totalsHeaders, totalsRows);

  const combined = [
    "# SECTION:MEMBER_PERFORMANCE",
    "MEMBER PERFORMANCE",
    memberCsv,
    "",
    "",
    "# SECTION:TEAM_TOTALS",
    "TEAM TOTALS PER SPRINT",
    totalsCsv,
    "",
    "# END",
  ].join("\n");

  downloadCsv(combined, `${teamName}_performance_${timestamp}.csv`);
}
