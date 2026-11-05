import * as fs from "fs";
import * as path from "path";
import { THEME_STORAGE_KEY, darkTheme, lightTheme } from "@/utils/theme";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

describe("theme wiring", () => {
  it("stores the theme choice under this extension's own key", () => {
    expect(THEME_STORAGE_KEY).toBe("sprint-performance-tracker.theme");
  });

  it("reads the same key in the pre-paint script of the page", () => {
    // The page stamps the saved theme before the bundle loads so a dark host
    // never flashes light. A key that drifted from theme.ts would silently
    // disable that.
    const html = read("src/SprintPerformanceTracker/SprintPerformanceTracker.html");
    expect(html).toContain(`getItem("${THEME_STORAGE_KEY}")`);
  });

  it("links the stylesheet and mounts on an ax-root element", () => {
    const html = read("src/SprintPerformanceTracker/SprintPerformanceTracker.html");
    expect(html).toContain('<link rel="stylesheet" href="SprintPerformanceTracker.css" />');
    expect(html).toContain('<div id="root" class="ax-root"></div>');
    expect(html).toContain('<script src="SprintPerformanceTracker.js"></script>');
  });

  it("keeps the chart palette in step with the --ax-chart-* tokens", () => {
    const css = read("src/styles/app.css");
    const tokens = (block: string) =>
      [1, 2, 3, 4, 5, 6].map((n) => {
        const match = block.match(new RegExp(`--ax-chart-${n}:\\s*(#[0-9a-f]{6})`, "i"));
        return match ? match[1].toLowerCase() : null;
      });

    const light = css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme"));
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));

    expect(tokens(light)).toEqual(lightTheme.chart.map((c) => c.toLowerCase()));
    expect(tokens(dark)).toEqual(darkTheme.chart.map((c) => c.toLowerCase()));
  });
});
