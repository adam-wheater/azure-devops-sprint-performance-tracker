import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AccessDenied } from "@/components/AccessDenied";

describe("AccessDenied", () => {
  it("names the signed-in account so an admin can be asked to add it", () => {
    render(<AccessDenied userEmail="alex@example.com" />);

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText(/contact an administrator/i)).toBeInTheDocument();
  });

  it("names the product in the explanation", () => {
    render(<AccessDenied userEmail="alex@example.com" />);
    expect(screen.getByText(/permission to access Sprint Performance Tracker/)).toBeInTheDocument();
  });
});
