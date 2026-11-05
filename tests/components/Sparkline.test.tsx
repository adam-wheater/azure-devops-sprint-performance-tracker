import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Sparkline } from "@/components/Sparkline";

describe("Sparkline", () => {
  it("draws nothing for fewer than two points", () => {
    const { container } = render(<Sparkline data={[3]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes the trend to assistive tech", () => {
    render(<Sparkline data={[1, 2, 3]} label="Velocity trend" />);
    expect(screen.getByRole("img", { name: "Velocity trend" })).toBeInTheDocument();
  });

  it("draws in currentColor and takes its colour from a token", () => {
    render(<Sparkline data={[1, 2, 3]} color="var(--ax-success)" />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveStyle({ color: "var(--ax-success)" });
    expect(svg.querySelector("polyline")).toHaveAttribute("stroke", "currentColor");
  });

  it("fills the parent unless a size is given", () => {
    const { rerender } = render(<Sparkline data={[1, 2, 3]} />);
    expect(screen.getByRole("img")).toHaveClass("ax-metric__spark");

    rerender(<Sparkline data={[1, 2, 3]} width={120} height={32} />);
    const svg = screen.getByRole("img");
    expect(svg).not.toHaveClass("ax-metric__spark");
    expect(svg).toHaveAttribute("width", "120");
    expect(svg.querySelector("circle")).not.toBeNull();
  });

  it("copes with a flat series", () => {
    render(<Sparkline data={[5, 5, 5]} />);
    const points = screen.getByRole("img").querySelector("polyline")!.getAttribute("points")!;
    expect(points).not.toMatch(/NaN/);
  });
});
