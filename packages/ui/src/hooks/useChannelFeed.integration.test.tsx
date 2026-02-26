/**
 * Integration tests for feat-005: channel-feed-page-read-model
 * Renders useChannelFeed inside a QueryClientProvider with mocked fetch.
 * Asserts the full state-machine sequence: Loading → Loaded, LoadingMore → Loaded, Error.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChannelFeed } from "./useChannelFeed";
import type { ChannelFeedPageV1 } from "@colloquium/messaging";

// ── Fixtures ───────────────────────────────────────────────────────────────

const PAGE_1: ChannelFeedPageV1 = {
  messages: [
    {
      messageId: "m-50",
      authorId: "u-1",
      content: "Hi",
      sequenceNumber: 50,
      postedAt: "2026-02-26T10:00:00Z",
    },
    {
      messageId: "m-49",
      authorId: "u-2",
      content: "Ho",
      sequenceNumber: 49,
      postedAt: "2026-02-26T09:59:00Z",
    },
  ],
  nextCursor: "49",
};

const PAGE_2: ChannelFeedPageV1 = {
  messages: [
    {
      messageId: "m-48",
      authorId: "u-1",
      content: "Hey",
      sequenceNumber: 48,
      postedAt: "2026-02-26T09:58:00Z",
    },
  ],
  nextCursor: null,
};

// ── Setup ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetchSequence(...pages: Array<{ status: number; body: unknown }>) {
  const spy = vi.spyOn(globalThis, "fetch");
  pages.forEach(({ status, body }) => {
    spy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
  return spy;
}

// ── State machine: Idle ────────────────────────────────────────────────────

describe("useChannelFeed — Idle", () => {
  it("is Idle with empty messages when channelId is empty", () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("", "tok"), { wrapper });
    expect(result.current.state).toBe("Idle");
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("makes no fetch call when channelId is empty", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const wrapper = makeWrapper();
    renderHook(() => useChannelFeed("", "tok"), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── State machine: Loading → Loaded ───────────────────────────────────────

describe("useChannelFeed — Loading → Loaded", () => {
  it("transitions from Loading to Loaded with messages", async () => {
    mockFetchSequence({ status: 200, body: PAGE_1 });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "tok"), { wrapper });

    // Initial state is Loading (query is in flight)
    expect(result.current.state).toBe("Loading");
    expect(result.current.messages).toEqual([]);

    await waitFor(() => expect(result.current.state).toBe("Loaded"));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].sequenceNumber).toBe(50);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.nextCursor).toBe("49");
    expect(result.current.error).toBeNull();
  });

  it("Loaded state with empty channel (messages = [], nextCursor = null)", async () => {
    mockFetchSequence({ status: 200, body: { messages: [], nextCursor: null } });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "tok"), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("Loaded"));
    expect(result.current.messages).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.nextCursor).toBeNull();
  });
});

// ── State machine: LoadingMore → Loaded ───────────────────────────────────

describe("useChannelFeed — LoadingMore → Loaded", () => {
  it("accumulates messages across pages after fetchNextPage", async () => {
    mockFetchSequence({ status: 200, body: PAGE_1 }, { status: 200, body: PAGE_2 });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "tok"), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("Loaded"));
    expect(result.current.messages).toHaveLength(2);

    // Trigger pagination
    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.state).toBe("Loaded"));
    expect(result.current.messages).toHaveLength(3);
    // Global newest-first order
    expect(result.current.messages.map((m) => m.sequenceNumber)).toEqual([50, 49, 48]);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.nextCursor).toBeNull();
  });

  it("second page fetch includes ?before=<cursor>", async () => {
    const spy = mockFetchSequence({ status: 200, body: PAGE_1 }, { status: 200, body: PAGE_2 });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "tok"), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("Loaded"));
    result.current.fetchNextPage();

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    const [secondUrl] = spy.mock.calls[1];
    expect(secondUrl as string).toContain("before=49");
  });
});

// ── State machine: Error ───────────────────────────────────────────────────

describe("useChannelFeed — Error", () => {
  it("transitions to Error with 'Unauthorized' on 401", async () => {
    mockFetchSequence({ status: 401, body: { error: "Unauthorized" } });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "bad-tok"), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("Error"));
    expect(result.current.error).toBe("Unauthorized");
    expect(result.current.messages).toEqual([]);
  });

  it("transitions to Error with 'Channel not found' on 404", async () => {
    mockFetchSequence({ status: 404, body: { error: "Channel not found" } });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "tok"), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("Error"));
    expect(result.current.error).toBe("Channel not found");
  });

  it("error field is non-null and non-empty in Error state", async () => {
    mockFetchSequence({ status: 500, body: { error: "Internal Server Error" } });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "tok"), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("Error"));
    expect(result.current.error).toBeTruthy();
    expect(result.current.messages).toEqual([]);
  });
});

// ── Authorization header ───────────────────────────────────────────────────

describe("useChannelFeed — Authorization", () => {
  it("includes Bearer token on the initial CT-004 request", async () => {
    const spy = mockFetchSequence({ status: 200, body: PAGE_1 });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChannelFeed("ch-1", "secret-token"), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("Loaded"));
    const [, init] = spy.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer secret-token",
    });
  });
});
