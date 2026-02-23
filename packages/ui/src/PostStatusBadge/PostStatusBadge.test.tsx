import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostStatusBadge } from "./PostStatusBadge";

describe("PostStatusBadge", () => {
  it("renders Published for published status", () => {
    render(<PostStatusBadge status="published" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
  it("renders Draft for draft status", () => {
    render(<PostStatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});
