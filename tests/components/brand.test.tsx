import * as fs from "fs";
import * as path from "path";
import * as React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BRAND, BrandGlyph } from "@/brand";

describe("brand", () => {
  it("identifies the product the same way the manifest does", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "..", "vss-extension.json"), "utf8")
    );
    expect(BRAND.id).toBe(manifest.id);
    expect(BRAND.name).toBe(manifest.name);
  });

  it("draws the chart-column-increasing mark that the icon uses", () => {
    const { container } = render(<BrandGlyph />);
    const paths = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d"));
    expect(paths).toEqual(["M13 17V9", "M18 17V5", "M3 3v16a2 2 0 0 0 2 2h16", "M8 17v-3"]);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("scales with the size prop", () => {
    const { container } = render(<BrandGlyph size={32} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "32");
  });
});
