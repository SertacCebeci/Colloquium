import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-22T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats ISO string to readable date", () => {
    const result = formatDate("2026-02-21T10:00:00.000Z");
    expect(result).toMatch(/February/);
    expect(result).toMatch(/21/);
    expect(result).toMatch(/2026/);
  });

  it("handles a different month", () => {
    const result = formatDate("2026-06-15T00:00:00.000Z");
    expect(result).toMatch(/June/);
    expect(result).toMatch(/15/);
  });
});
