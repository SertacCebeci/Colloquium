import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins class names with a space", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", undefined, null, false, "", "bar")).toBe("foo bar");
  });

  it("handles a single class", () => {
    expect(cn("only")).toBe("only");
  });

  it("returns empty string when all falsy", () => {
    expect(cn(undefined, null, false)).toBe("");
  });
});
