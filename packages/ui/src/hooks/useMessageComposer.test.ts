/**
 * Domain unit tests for feat-007: channel-message-form-state
 * Tests the pure functions: validateInput, mapMutationStateToComposerState.
 * No React, no TanStack Query, no DOM — pure TypeScript only.
 */
import { describe, it, expect } from "vitest";
import { validateInput, mapMutationStateToComposerState } from "./useMessageComposer";

// ── validateInput ───────────────────────────────────────────────────────────

describe("validateInput", () => {
  // Valid content — must return null
  it("returns null for a valid non-empty string", () => {
    expect(validateInput("hello")).toBeNull();
  });

  it("returns null for content exactly at the 4000-char limit", () => {
    expect(validateInput("x".repeat(4000))).toBeNull();
  });

  it("returns null for a multi-word string", () => {
    expect(validateInput("hello world")).toBeNull();
  });

  // Empty / whitespace — must return "empty"
  it("returns 'empty' for an empty string", () => {
    expect(validateInput("")).toBe("empty");
  });

  it("returns 'empty' for a whitespace-only string", () => {
    expect(validateInput("   ")).toBe("empty");
  });

  it("returns 'empty' for a newline-only string", () => {
    expect(validateInput("\n\t\r")).toBe("empty");
  });

  // Too long — must return "too-long"
  it("returns 'too-long' for content of 4001 characters", () => {
    expect(validateInput("x".repeat(4001))).toBe("too-long");
  });

  it("returns 'too-long' for content well beyond 4000 characters", () => {
    expect(validateInput("x".repeat(5000))).toBe("too-long");
  });

  // Priority: empty check beats length check (whitespace is "empty", not "too-long")
  it("returns 'empty' for empty string — not 'too-long'", () => {
    const result = validateInput("");
    expect(result).toBe("empty");
    expect(result).not.toBe("too-long");
  });
});

// ── mapMutationStateToComposerState ─────────────────────────────────────────

describe("mapMutationStateToComposerState", () => {
  // isPending = true → always "Submitting"
  it("returns 'Submitting' when isPending is true with non-empty input", () => {
    expect(mapMutationStateToComposerState(true, false, "hello")).toBe("Submitting");
  });

  it("returns 'Submitting' when isPending is true even if isError is true", () => {
    expect(mapMutationStateToComposerState(true, true, "hello")).toBe("Submitting");
  });

  it("returns 'Submitting' when isPending is true with empty inputValue", () => {
    expect(mapMutationStateToComposerState(true, false, "")).toBe("Submitting");
  });

  // isError = true (isPending = false) → "Error"
  it("returns 'Error' when isError is true and isPending is false", () => {
    expect(mapMutationStateToComposerState(false, true, "hello")).toBe("Error");
  });

  it("returns 'Error' when isError is true even if inputValue is empty", () => {
    expect(mapMutationStateToComposerState(false, true, "")).toBe("Error");
  });

  // isPending = false, isError = false, non-empty inputValue → "Typing"
  it("returns 'Typing' when not pending, not error, inputValue is non-empty", () => {
    expect(mapMutationStateToComposerState(false, false, "hello")).toBe("Typing");
  });

  it("returns 'Typing' when not pending, not error, inputValue has leading spaces but is non-empty", () => {
    expect(mapMutationStateToComposerState(false, false, "  hi")).toBe("Typing");
  });

  // isPending = false, isError = false, empty/whitespace inputValue → "Idle"
  it("returns 'Idle' when not pending, not error, inputValue is empty string", () => {
    expect(mapMutationStateToComposerState(false, false, "")).toBe("Idle");
  });

  it("returns 'Idle' when not pending, not error, inputValue is whitespace only", () => {
    expect(mapMutationStateToComposerState(false, false, "   ")).toBe("Idle");
  });
});
