import { describe, it, expect } from "vitest";
import { truncate } from "./string";

describe("truncate", () => {
  it("returns text unchanged if shorter than maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates at maxLen and appends ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });
  it("truncates exactly at maxLen characters", () => {
    expect(truncate("abcde", 5)).toBe("abcde");
  });
  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });
});
