import * as React from "react";

/**
 * Product identity. The glyph is drawn from the same paths as static/icon.png so the
 * header mark and the Marketplace icon are one logo.
 */
export const BRAND = {
  id: "sprint-performance-tracker",
  name: "Sprint Performance Tracker",
  tagline: "Effort, hours and delivery health for every team, sprint by sprint",
};

export const BrandGlyph: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable={false}
  >
    <path d="M13 17V9" />
    <path d="M18 17V5" />
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M8 17v-3" />
  </svg>
);
