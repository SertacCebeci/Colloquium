/**
 * Domain unit tests for feat-008: channel-page-error-state
 * Tests the pure function: deriveErrorState.
 * No React, no HTTP — pure TypeScript only.
 */
import { describe, it, expect } from "vitest";
import { deriveErrorState } from "./useChannelPageErrorState";
import type { ChannelFeedState } from "./useChannelFeed";
// Note: feedError is string | null (useChannelFeed normalizes Error → message string)
import type { MessageComposerState } from "./useMessageComposer";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NON_ERROR_FEED_STATES: ChannelFeedState[] = ["Idle", "Loading", "Loaded", "LoadingMore"];
const NON_ERROR_COMPOSER_STATES: MessageComposerState[] = ["Idle", "Typing", "Submitting"];

// ── Feed Error (highest priority) ─────────────────────────────────────────────

describe("deriveErrorState — feed is Error", () => {
  it("returns visible=true, retryable=true when feedState is Error", () => {
    const result = deriveErrorState({
      feedState: "Error",
      feedError: "Feed failed",
      composerState: "Idle",
      composerErrorMessage: null,
    });
    expect(result.visible).toBe(true);
    expect(result.retryable).toBe(true);
  });

  it("uses feedError.message as the error message", () => {
    const result = deriveErrorState({
      feedState: "Error",
      feedError: "Failed to load channel messages",
      composerState: "Idle",
      composerErrorMessage: null,
    });
    expect(result.message).toBe("Failed to load channel messages");
  });

  it("falls back to 'Failed to load messages' when feedError is null", () => {
    const result = deriveErrorState({
      feedState: "Error",
      feedError: null,
      composerState: "Idle",
      composerErrorMessage: null,
    });
    expect(result.message).toBe("Failed to load messages");
    expect(result.visible).toBe(true);
    expect(result.retryable).toBe(true);
  });

  it("feed error wins when composerState is also Error (retryable=true, not false)", () => {
    const result = deriveErrorState({
      feedState: "Error",
      feedError: "Feed 503",
      composerState: "Error",
      composerErrorMessage: "Unauthorized",
    });
    expect(result.visible).toBe(true);
    expect(result.retryable).toBe(true);
    expect(result.message).toBe("Feed 503");
  });

  it("feed error wins regardless of composerState value", () => {
    for (const composerState of [...NON_ERROR_COMPOSER_STATES, "Error"] as MessageComposerState[]) {
      const result = deriveErrorState({
        feedState: "Error",
        feedError: "Feed error",
        composerState,
        composerErrorMessage: "Composer error",
      });
      expect(result.retryable).toBe(true);
      expect(result.visible).toBe(true);
    }
  });
});

// ── Composer Error only (feed not in Error) ──────────────────────────────────

describe("deriveErrorState — composer is Error, feed is not", () => {
  it("returns visible=true, retryable=false when composerState is Error and feed is non-Error", () => {
    for (const feedState of NON_ERROR_FEED_STATES) {
      const result = deriveErrorState({
        feedState,
        feedError: null,
        composerState: "Error",
        composerErrorMessage: "Unauthorized",
      });
      expect(result.visible).toBe(true);
      expect(result.retryable).toBe(false);
    }
  });

  it("uses composerErrorMessage as the error message", () => {
    const result = deriveErrorState({
      feedState: "Loaded",
      feedError: null,
      composerState: "Error",
      composerErrorMessage: "You are not a member of this channel",
    });
    expect(result.message).toBe("You are not a member of this channel");
  });

  it("falls back to 'Failed to send message' when composerErrorMessage is null", () => {
    const result = deriveErrorState({
      feedState: "Loaded",
      feedError: null,
      composerState: "Error",
      composerErrorMessage: null,
    });
    expect(result.message).toBe("Failed to send message");
    expect(result.visible).toBe(true);
    expect(result.retryable).toBe(false);
  });
});

// ── No error ──────────────────────────────────────────────────────────────────

describe("deriveErrorState — no errors", () => {
  it("returns visible=false when neither feed nor composer is in Error", () => {
    for (const feedState of NON_ERROR_FEED_STATES) {
      for (const composerState of NON_ERROR_COMPOSER_STATES) {
        const result = deriveErrorState({
          feedState,
          feedError: null,
          composerState,
          composerErrorMessage: null,
        });
        expect(result.visible).toBe(false);
        expect(result.retryable).toBe(false);
        expect(result.message).toBe("");
      }
    }
  });

  it("returns message='' (empty string) when not visible — never null", () => {
    const result = deriveErrorState({
      feedState: "Idle",
      feedError: null,
      composerState: "Idle",
      composerErrorMessage: null,
    });
    expect(result.message).toBe("");
    expect(result.message).not.toBeNull();
    expect(result.message).not.toBeUndefined();
  });
});

// ── Invariant: retryable=true implies visible=true ────────────────────────────

describe("deriveErrorState — invariants", () => {
  it("retryable=true always implies visible=true", () => {
    // Only feed Error produces retryable=true
    const result = deriveErrorState({
      feedState: "Error",
      feedError: null,
      composerState: "Idle",
      composerErrorMessage: null,
    });
    if (result.retryable) {
      expect(result.visible).toBe(true);
    }
  });

  it("message is always a string (never null or undefined), regardless of inputs", () => {
    const cases = [
      {
        feedState: "Error" as ChannelFeedState,
        feedError: null,
        composerState: "Idle" as MessageComposerState,
        composerErrorMessage: null,
      },
      {
        feedState: "Loaded" as ChannelFeedState,
        feedError: null,
        composerState: "Error" as MessageComposerState,
        composerErrorMessage: null,
      },
      {
        feedState: "Idle" as ChannelFeedState,
        feedError: null,
        composerState: "Idle" as MessageComposerState,
        composerErrorMessage: null,
      },
    ];
    for (const c of cases) {
      const result = deriveErrorState(c);
      expect(typeof result.message).toBe("string");
    }
  });
});
