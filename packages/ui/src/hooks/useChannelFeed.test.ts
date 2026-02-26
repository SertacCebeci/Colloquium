/**
 * Domain unit tests for feat-005: channel-feed-page-read-model
 * Tests pure logic functions extracted from useChannelFeed hook.
 * No React, no TanStack Query — pure TypeScript only.
 */
import { describe, it, expect } from "vitest";
import { getNextPageParam, flattenPages, mapQueryStateToChannelFeedState } from "./useChannelFeed";
import type { MessageItem, ChannelFeedPageV1 } from "@colloquium/messaging";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMessage(seq: number): MessageItem {
  return {
    messageId: `msg-${seq}`,
    authorId: "user-1",
    content: `Message ${seq}`,
    sequenceNumber: seq,
    postedAt: new Date().toISOString(),
  };
}

/** Builds a page where messages are newest-first (descending seq). */
function makePage(seqs: number[], nextCursor: string | null): ChannelFeedPageV1 {
  return {
    messages: seqs.map(makeMessage),
    nextCursor,
  };
}

// ── getNextPageParam ───────────────────────────────────────────────────────

describe("getNextPageParam", () => {
  it("returns the cursor string when nextCursor is non-null", () => {
    const page = makePage([50, 49, 48], "48");
    expect(getNextPageParam(page)).toBe("48");
  });

  it("returns undefined when nextCursor is null — signals no more pages", () => {
    const page = makePage([5, 4, 3], null);
    expect(getNextPageParam(page)).toBeUndefined();
  });

  it("returns the cursor exactly as-is (string, not parsed)", () => {
    const page = makePage([100], "100");
    expect(getNextPageParam(page)).toBe("100");
    expect(typeof getNextPageParam(page)).toBe("string");
  });
});

// ── flattenPages ───────────────────────────────────────────────────────────

describe("flattenPages", () => {
  it("returns an empty array when given no pages", () => {
    expect(flattenPages([])).toEqual([]);
  });

  it("returns the messages of a single page unchanged", () => {
    const page = makePage([10, 9, 8], null);
    expect(flattenPages([page])).toEqual(page.messages);
  });

  it("flattens two pages — 50 + 25 messages = 75 messages total", () => {
    // Page 1: seq 100 down to 51 (50 messages), cursor = "51"
    const page1Seqs = Array.from({ length: 50 }, (_, i) => 100 - i); // [100, 99, ..., 51]
    // Page 2: seq 50 down to 26 (25 messages), cursor = null
    const page2Seqs = Array.from({ length: 25 }, (_, i) => 50 - i); // [50, 49, ..., 26]

    const page1 = makePage(page1Seqs, "51");
    const page2 = makePage(page2Seqs, null);

    const result = flattenPages([page1, page2]);
    expect(result).toHaveLength(75);
  });

  it("messages appear in newest-first order globally (page1 before page2)", () => {
    // Page 1 contains newer messages; page 2 contains older messages.
    const page1 = makePage([10, 9, 8], "8");
    const page2 = makePage([7, 6, 5], null);

    const result = flattenPages([page1, page2]);
    const seqs = result.map((m) => m.sequenceNumber);
    expect(seqs).toEqual([10, 9, 8, 7, 6, 5]);
  });

  it("no gap at page boundary — consecutive sequence numbers across pages", () => {
    // Page 1: seqs 100..51 (50 items), page 2: seqs 50..26 (25 items)
    const page1Seqs = Array.from({ length: 50 }, (_, i) => 100 - i);
    const page2Seqs = Array.from({ length: 25 }, (_, i) => 50 - i);

    const result = flattenPages([makePage(page1Seqs, "51"), makePage(page2Seqs, null)]);

    const lastOfPage1 = result[49].sequenceNumber; // seq 51
    const firstOfPage2 = result[50].sequenceNumber; // seq 50
    expect(lastOfPage1 - 1).toBe(firstOfPage2);
  });

  it("messages within each page stay in their original newest-first order", () => {
    const page1 = makePage([30, 29, 28], "28");
    const page2 = makePage([27, 26, 25], null);
    const result = flattenPages([page1, page2]);
    // Ensure descending across the full array
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].sequenceNumber).toBeGreaterThan(result[i + 1].sequenceNumber);
    }
  });
});

// ── mapQueryStateToChannelFeedState ────────────────────────────────────────

describe("mapQueryStateToChannelFeedState", () => {
  const base = {
    isLoading: false,
    isSuccess: false,
    isFetchingNextPage: false,
    isError: false,
  };

  it("maps to Idle when channelId is an empty string", () => {
    expect(mapQueryStateToChannelFeedState({ ...base, isLoading: true }, "")).toBe("Idle");
  });

  it("maps to Idle when channelId is whitespace-only", () => {
    expect(mapQueryStateToChannelFeedState({ ...base, isLoading: true }, "   ")).toBe("Idle");
  });

  it("maps to Loading when isLoading is true and channelId is present", () => {
    expect(mapQueryStateToChannelFeedState({ ...base, isLoading: true }, "ch-1")).toBe("Loading");
  });

  it("maps to Loaded when isSuccess and not isFetchingNextPage", () => {
    expect(mapQueryStateToChannelFeedState({ ...base, isSuccess: true }, "ch-1")).toBe("Loaded");
  });

  it("maps to LoadingMore when isSuccess and isFetchingNextPage are both true", () => {
    expect(
      mapQueryStateToChannelFeedState(
        { ...base, isSuccess: true, isFetchingNextPage: true },
        "ch-1"
      )
    ).toBe("LoadingMore");
  });

  it("maps to Error when isError is true", () => {
    expect(mapQueryStateToChannelFeedState({ ...base, isError: true }, "ch-1")).toBe("Error");
  });

  it("Idle takes precedence over isLoading when channelId is absent", () => {
    // Even if TanStack Query is loading, empty channelId means Idle
    expect(mapQueryStateToChannelFeedState({ ...base, isLoading: true, isError: true }, "")).toBe(
      "Idle"
    );
  });
});
