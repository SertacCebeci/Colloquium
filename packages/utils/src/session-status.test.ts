import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStatusLabel,
  getStatusBadgeVariant,
  formatRelativeTime,
  formatDuration,
  sortSessionsByRecency,
} from "./session-status";

describe("getStatusLabel", () => {
  it("returns human-readable labels", () => {
    expect(getStatusLabel("in_progress")).toBe("In Progress");
    expect(getStatusLabel("interrupted")).toBe("Interrupted");
    expect(getStatusLabel("awaiting_input")).toBe("Awaiting Input");
    expect(getStatusLabel("ready_for_review")).toBe("Ready for Review");
  });

  it("returns unknown status as-is", () => {
    expect(getStatusLabel("unknown_status")).toBe("unknown_status");
  });
});

describe("getStatusBadgeVariant", () => {
  it("maps statuses to badge variants", () => {
    expect(getStatusBadgeVariant("in_progress")).toBe("default");
    expect(getStatusBadgeVariant("interrupted")).toBe("destructive");
    expect(getStatusBadgeVariant("awaiting_input")).toBe("secondary");
    expect(getStatusBadgeVariant("ready_for_review")).toBe("outline");
  });

  it("returns default for unknown status", () => {
    expect(getStatusBadgeVariant("unknown")).toBe("default");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-21T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for < 1 minute", () => {
    const iso = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const iso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("5 minutes ago");
  });

  it("uses singular for 1 minute", () => {
    const iso = new Date(Date.now() - 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("1 minute ago");
  });

  it("returns hours ago", () => {
    const iso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("2 hours ago");
  });
});

describe("formatDuration", () => {
  it("returns minutes for short durations", () => {
    const start = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    expect(formatDuration(start)).toBe("45m");
  });

  it("returns hours and minutes for long durations", () => {
    const start = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    expect(formatDuration(start)).toBe("1h 30m");
  });

  it("omits minutes when 0", () => {
    const start = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    expect(formatDuration(start)).toBe("2h");
  });
});

describe("sortSessionsByRecency", () => {
  it("sorts by updatedAt descending", () => {
    const sessions = [
      { id: "a", updatedAt: "2026-02-21T10:00:00.000Z" },
      { id: "b", updatedAt: "2026-02-21T12:00:00.000Z" },
      { id: "c", updatedAt: "2026-02-21T11:00:00.000Z" },
    ];
    const sorted = sortSessionsByRecency(sessions);
    expect(sorted.map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the original array", () => {
    const sessions = [
      { id: "a", updatedAt: "2026-02-21T10:00:00.000Z" },
      { id: "b", updatedAt: "2026-02-21T12:00:00.000Z" },
    ];
    sortSessionsByRecency(sessions);
    expect(sessions[0].id).toBe("a");
  });
});
