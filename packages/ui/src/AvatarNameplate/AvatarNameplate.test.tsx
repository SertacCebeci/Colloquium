import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvatarNameplate } from "./AvatarNameplate";

const peer = { displayName: "Alice Nguyen", color: "#2D6A4F" };

describe("AvatarNameplate", () => {
  it("renders initials correctly", () => {
    render(<AvatarNameplate peer={peer} />);
    expect(screen.getByText("AN")).toBeInTheDocument();
  });

  it("renders display name", () => {
    render(<AvatarNameplate peer={peer} />);
    expect(screen.getByText("Alice Nguyen")).toBeInTheDocument();
  });

  it("appends (you) for local avatar", () => {
    render(<AvatarNameplate peer={peer} isLocal />);
    expect(screen.getByText("Alice Nguyen (you)")).toBeInTheDocument();
  });

  it("does NOT append (you) by default", () => {
    render(<AvatarNameplate peer={peer} />);
    expect(screen.queryByText(/\(you\)/)).not.toBeInTheDocument();
  });

  it("applies avatar color as background", () => {
    const { container } = render(<AvatarNameplate peer={peer} />);
    const circle = container.querySelector("div[style*='background-color']");
    // jsdom converts hex to rgb — assert the rgb equivalent of #2D6A4F
    expect(circle?.getAttribute("style")).toContain("rgb(45, 106, 79)");
  });
});
