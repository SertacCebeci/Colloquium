import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders In Progress label for in_progress status", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders Ready for Review for ready_for_review", () => {
    render(<StatusBadge status="ready_for_review" />);
    expect(screen.getByText("Ready for Review")).toBeInTheDocument();
  });

  it("renders Awaiting Input for awaiting_input", () => {
    render(<StatusBadge status="awaiting_input" />);
    expect(screen.getByText("Awaiting Input")).toBeInTheDocument();
  });

  it("renders Interrupted for interrupted status", () => {
    render(<StatusBadge status="interrupted" />);
    expect(screen.getByText("Interrupted")).toBeInTheDocument();
  });
});
