import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PresenceBar } from "./PresenceBar";
import type { Peer } from "@colloquium/types";

const peers: Peer[] = [
  {
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "Alice",
    color: "#2D6A4F",
    x: 100,
    y: 200,
    direction: "right",
  },
  {
    userId: "00000000-0000-0000-0000-000000000002",
    displayName: "Bob Chen",
    color: "#7C3AED",
    x: 300,
    y: 400,
    direction: "down",
  },
];

describe("PresenceBar", () => {
  it("renders all peer names", () => {
    render(<PresenceBar peers={peers} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob Chen")).toBeInTheDocument();
  });

  it("shows peer count", () => {
    render(<PresenceBar peers={peers} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("marks current user with 'you'", () => {
    render(<PresenceBar peers={peers} currentUserId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByText("you")).toBeInTheDocument();
  });

  it("shows empty state when no peers", () => {
    render(<PresenceBar peers={[]} />);
    expect(screen.getByText(/No one else/)).toBeInTheDocument();
  });
});
