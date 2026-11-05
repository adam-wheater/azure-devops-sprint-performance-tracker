import { DateRange } from "../models/interfaces";

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isInDateRanges(date: Date, ranges: DateRange[]): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dateMs = d.getTime();

  return ranges.some((r) => {
    const startMs = new Date(r.start).setHours(0, 0, 0, 0);
    const endMs = new Date(r.end).setHours(0, 0, 0, 0);
    return dateMs >= startMs && dateMs <= endMs;
  });
}

export function countWeekdaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function countWorkingDays(
  startDate: Date,
  finishDate: Date,
  teamDaysOff: DateRange[],
  personalDaysOff: DateRange[]
): {
  totalWeekdays: number;
  teamDaysOffCount: number;
  personalDaysOffCount: number;
  workingDays: number;
} {
  let totalWeekdays = 0;
  let teamDaysOffCount = 0;
  let personalDaysOffCount = 0;

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(finishDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (!isWeekend(current)) {
      totalWeekdays++;

      if (isInDateRanges(current, teamDaysOff)) {
        teamDaysOffCount++;
      } else if (isInDateRanges(current, personalDaysOff)) {
        personalDaysOffCount++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const workingDays = totalWeekdays - teamDaysOffCount - personalDaysOffCount;

  return {
    totalWeekdays,
    teamDaysOffCount,
    personalDaysOffCount,
    workingDays: Math.max(workingDays, 0),
  };
}

/**
 * Returns the fraction of sprint elapsed (0.0–1.0) based on working days.
 * - Before sprint start: 0
 * - After sprint end: 1
 * - During sprint: elapsedWeekdays / totalWeekdays
 */
export function calculateSprintProgress(
  sprintStart: Date,
  sprintFinish: Date,
  today?: Date
): number {
  const now = new Date(today ?? new Date());
  now.setHours(0, 0, 0, 0);

  const start = new Date(sprintStart);
  start.setHours(0, 0, 0, 0);

  const finish = new Date(sprintFinish);
  finish.setHours(0, 0, 0, 0);

  if (now >= finish) return 1.0;
  if (now < start) return 0.0;

  const totalWeekdays = countWeekdaysBetween(start, finish);
  if (totalWeekdays <= 0) return 1.0;

  const elapsedWeekdays = countWeekdaysBetween(start, now);
  return elapsedWeekdays / totalWeekdays;
}
