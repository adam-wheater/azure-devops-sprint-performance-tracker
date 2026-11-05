import {
  ROLE_COLORS,
  PERF_THRESHOLD_EXCELLENT,
  PERF_THRESHOLD_GOOD,
  PERF_THRESHOLD_WARNING,
  PERF_COLOR_EXCELLENT,
  PERF_COLOR_GOOD,
  PERF_COLOR_WARNING,
  PERF_COLOR_POOR,
  EFFORT_TARGET_PER_DAY,
  SLIPPAGE_THRESHOLD_AT_RISK,
  SLIPPAGE_THRESHOLD_OVER,
  SLIPPAGE_COLOR_ON_TRACK,
  SLIPPAGE_COLOR_AT_RISK,
  SLIPPAGE_COLOR_OVER,
} from "./constants";
import { ThresholdSettings } from "../models/interfaces";

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDecimal(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

export function formatHours(value: number): string {
  return `${value.toFixed(1)}h`;
}

/** Semantic band for a performance percentage; matches the Metric and Pill tones in ui.tsx. */
export type PerformanceTone = "success" | "info" | "warn" | "danger";

const TONE_COLOR: Record<PerformanceTone, string> = {
  success: PERF_COLOR_EXCELLENT,
  info: PERF_COLOR_GOOD,
  warn: PERF_COLOR_WARNING,
  danger: PERF_COLOR_POOR,
};

export function getPerformanceTone(pct: number, thresholds?: ThresholdSettings): PerformanceTone {
  const excellent = thresholds?.perfThresholdExcellent ?? PERF_THRESHOLD_EXCELLENT;
  const good = thresholds?.perfThresholdGood ?? PERF_THRESHOLD_GOOD;
  const warning = thresholds?.perfThresholdWarning ?? PERF_THRESHOLD_WARNING;

  if (pct >= excellent) return "success";
  if (pct >= good) return "info";
  if (pct >= warning) return "warn";
  return "danger";
}

/** CSS colour (a design token) for a performance percentage. */
export function getPerformanceColor(pct: number, thresholds?: ThresholdSettings): string {
  return TONE_COLOR[getPerformanceTone(pct, thresholds)];
}

export function getEffortPerDayTone(
  effortPerDay: number,
  thresholds?: ThresholdSettings
): PerformanceTone {
  return getPerformanceTone((effortPerDay / EFFORT_TARGET_PER_DAY) * 100, thresholds);
}

export function getEffortPerDayColor(effortPerDay: number, thresholds?: ThresholdSettings): string {
  return TONE_COLOR[getEffortPerDayTone(effortPerDay, thresholds)];
}

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || ROLE_COLORS.Default;
}

export function formatSprintDates(startDate: Date, finishDate: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = startDate.toLocaleDateString("en-US", opts);
  const end = finishDate.toLocaleDateString("en-US", opts);
  return `${start} - ${end}`;
}

export type TrendDirection = "up" | "down" | "flat";

export function getTrendDirection(current: number, previous: number): TrendDirection {
  const diff = current - previous;
  if (diff > 5) return "up";
  if (diff < -5) return "down";
  return "flat";
}

export function getTrendArrow(current: number, previous: number): string {
  const direction = getTrendDirection(current, previous);
  if (direction === "up") return "\u25B2";
  if (direction === "down") return "\u25BC";
  return "\u2015";
}

export function getSlippageColor(slippagePct: number, thresholds?: ThresholdSettings): string {
  const overThreshold = thresholds?.slippageOverThreshold ?? SLIPPAGE_THRESHOLD_OVER;
  const atRiskThreshold = thresholds?.slippageAtRiskThreshold ?? SLIPPAGE_THRESHOLD_AT_RISK;

  if (slippagePct > overThreshold) return SLIPPAGE_COLOR_OVER;
  if (slippagePct > atRiskThreshold) return SLIPPAGE_COLOR_AT_RISK;
  return SLIPPAGE_COLOR_ON_TRACK;
}

export function formatSlippagePct(value: number): string {
  return `${value.toFixed(0)}%`;
}
