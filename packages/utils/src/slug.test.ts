import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("removes special characters", () => {
    expect(slugify("My Post: #1!")).toBe("my-post-1");
  });
  it("collapses multiple hyphens into one", () => {
    expect(slugify("foo  --  bar")).toBe("foo-bar");
  });
  it("trims leading and trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });
  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
  it("handles already-valid slug", () => {
    expect(slugify("my-cool-post")).toBe("my-cool-post");
  });
});
