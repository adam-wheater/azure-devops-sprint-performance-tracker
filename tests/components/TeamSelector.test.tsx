import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TeamSelector } from "@/components/TeamSelector";
import { TeamInfo } from "@/models/interfaces";

const teams: TeamInfo[] = [
  { id: "t1", name: "Platform" },
  { id: "t2", name: "Payments" },
];

describe("TeamSelector", () => {
  it("marks selected teams as pressed", () => {
    render(<TeamSelector teams={teams} selectedTeamIds={new Set(["t1"])} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Platform" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Payments" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a single team", () => {
    const onChange = jest.fn();
    render(<TeamSelector teams={teams} selectedTeamIds={new Set(["t1"])} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Payments" }));
    expect([...onChange.mock.calls[0][0]].sort()).toEqual(["t1", "t2"]);

    fireEvent.click(screen.getByRole("button", { name: "Platform" }));
    expect([...onChange.mock.calls[1][0]]).toEqual([]);
  });

  it("selects everything, then clears when everything is already selected", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <TeamSelector teams={teams} selectedTeamIds={new Set()} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect([...onChange.mock.calls[0][0]].sort()).toEqual(["t1", "t2"]);

    rerender(
      <TeamSelector teams={teams} selectedTeamIds={new Set(["t1", "t2"])} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect([...onChange.mock.calls[1][0]]).toEqual([]);
  });

  it("only offers the filter box once there are more than five teams", () => {
    const many: TeamInfo[] = Array.from({ length: 7 }, (_, i) => ({
      id: `t${i}`,
      name: i === 3 ? "Payments" : `Team ${i}`,
    }));

    const { rerender } = render(
      <TeamSelector teams={teams} selectedTeamIds={new Set()} onChange={() => {}} />
    );
    expect(screen.queryByLabelText("Filter teams")).not.toBeInTheDocument();

    rerender(<TeamSelector teams={many} selectedTeamIds={new Set()} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Filter teams"), { target: { value: "pay" } });

    expect(screen.getByRole("button", { name: "Payments" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team 0" })).not.toBeInTheDocument();
  });
});
