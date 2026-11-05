import { SprintMemberEffort } from "../models/interfaces";

export interface CellDisplayState {
  isOnHoliday: boolean;
  totalDaysOff: number;
  showDaysOff: boolean;
  teamDaysOff: number;
  personalDaysOff: number;
}

export function getCellDisplayState(data: SprintMemberEffort): CellDisplayState {
  const totalDaysOff = data.teamDaysOffCount + data.personalDaysOffCount;
  return {
    isOnHoliday: data.workingDays === 0,
    totalDaysOff,
    showDaysOff: totalDaysOff > 0 && data.workingDays > 0,
    teamDaysOff: data.teamDaysOffCount,
    personalDaysOff: data.personalDaysOffCount,
  };
}
