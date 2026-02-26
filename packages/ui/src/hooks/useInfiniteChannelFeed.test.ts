/**
 * Domain unit tests for feat-006: infinite-channel-feed-read-model
 * Tests the pure shouldFetchNextPage guard function.
 * No React, no TanStack Query, no DOM — pure TypeScript only.
 */
import { describe, it, expect } from "vitest";
import { shouldFetchNextPage } from "./useInfiniteChannelFeed";
import type { ChannelFeedState } from "./useChannelFeed";

// ── shouldFetchNextPage — the only domain decision in feat-006 ─────────────

describe("shouldFetchNextPage", () => {
  // Cases where fetchNextPage MUST be called
  it("returns true when state is Loaded and hasNextPage is true", () => {
    expect(shouldFetchNextPage({ state: "Loaded", hasNextPage: true })).toBe(true);
  });

  // Cases where fetchNextPage must NOT be called — duplicate-fetch guard
  it("returns false when state is LoadingMore (fetch already in flight)", () => {
    expect(shouldFetchNextPage({ state: "LoadingMore", hasNextPage: true })).toBe(false);
  });

  it("returns false when hasNextPage is false even if state is Loaded", () => {
    expect(shouldFetchNextPage({ state: "Loaded", hasNextPage: false })).toBe(false);
  });

  it("returns false when state is Loading (initial fetch in flight)", () => {
    expect(shouldFetchNextPage({ state: "Loading", hasNextPage: true })).toBe(false);
  });

  it("returns false when state is Idle", () => {
    expect(shouldFetchNextPage({ state: "Idle", hasNextPage: false })).toBe(false);
  });

  it("returns false when state is Error", () => {
    expect(shouldFetchNextPage({ state: "Error", hasNextPage: true })).toBe(false);
  });

  // Exhaustive: all states × hasNextPage = false
  const allStates: ChannelFeedState[] = ["Idle", "Loading", "Loaded", "LoadingMore", "Error"];
  allStates.forEach((state) => {
    it(`returns false for state=${state} when hasNextPage is false`, () => {
      expect(shouldFetchNextPage({ state, hasNextPage: false })).toBe(false);
    });
  });
});
