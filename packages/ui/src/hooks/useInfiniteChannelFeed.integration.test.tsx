/**
 * Integration tests for feat-006: infinite-channel-feed-read-model
 * Uses render() with a test component that mounts the sentinelRef element,
 * ensuring the IntersectionObserver is correctly attached to a real DOM node.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useInfiniteChannelFeed } from "./useInfiniteChannelFeed";
import type { ChannelFeedPageV1 } from "@colloquium/messaging";

// ── IntersectionObserver mock ──────────────────────────────────────────────

type IOCallback = (entries: IntersectionObserverEntry[]) => void;
let lastObserverCallback: IOCallback | null = null;
let observerInstanceCount = 0;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(callback: IOCallback) {
    lastObserverCallback = callback;
    observerInstanceCount++;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function simulateIntersection(isIntersecting: boolean) {
  lastObserverCallback?.([{ isIntersecting } as unknown as IntersectionObserverEntry]);
}

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

// ── Test component ─────────────────────────────────────────────────────────

function FeedHarness({ channelId, token }: { channelId: string; token: string }) {
  const feed = useInfiniteChannelFeed(channelId, token);
  return (
    <div>
      <span data-testid="state">{feed.state}</span>
      <span data-testid="count">{feed.messages.length}</span>
      <span data-testid="hasNextPage">{String(feed.hasNextPage)}</span>
      <span data-testid="error">{feed.error ?? ""}</span>
      {/* sentinel — the IntersectionObserver target */}
      <div ref={feed.sentinelRef} data-testid="sentinel" />
    </div>
  );
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

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

function renderFeed(channelId: string, token: string) {
  const Wrapper = makeWrapper();
  return render(
    React.createElement(Wrapper, null, React.createElement(FeedHarness, { channelId, token }))
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  lastObserverCallback = null;
  observerInstanceCount = 0;
  // @ts-expect-error — jsdom doesn't include IntersectionObserver
  globalThis.IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
  // @ts-expect-error — removing jsdom mock after each test
  delete globalThis.IntersectionObserver;
});

// ── Observer lifecycle ─────────────────────────────────────────────────────

describe("useInfiniteChannelFeed — observer lifecycle", () => {
  it("creates an IntersectionObserver once the sentinel mounts", async () => {
    mockFetchSequence({ status: 200, body: PAGE_1 });
    renderFeed("ch-1", "tok");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Loaded"));
    expect(observerInstanceCount).toBeGreaterThan(0);
  });

  it("renders the sentinel element in the DOM", async () => {
    mockFetchSequence({ status: 200, body: PAGE_1 });
    renderFeed("ch-1", "tok");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Loaded"));
    expect(screen.getByTestId("sentinel")).toBeDefined();
  });
});

// ── Auto-trigger: sentinel intersection ───────────────────────────────────

describe("useInfiniteChannelFeed — auto-trigger", () => {
  it("calls fetchNextPage when sentinel intersects in Loaded state with hasNextPage=true", async () => {
    const spy = mockFetchSequence({ status: 200, body: PAGE_1 }, { status: 200, body: PAGE_2 });
    renderFeed("ch-1", "tok");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Loaded"));
    expect(screen.getByTestId("hasNextPage").textContent).toBe("true");

    act(() => simulateIntersection(true));

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("3"));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does NOT call fetchNextPage when sentinel intersects but hasNextPage=false", async () => {
    const spy = mockFetchSequence({ status: 200, body: PAGE_2 }); // nextCursor=null
    renderFeed("ch-1", "tok");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Loaded"));
    expect(screen.getByTestId("hasNextPage").textContent).toBe("false");

    act(() => simulateIntersection(true));

    // Only 1 fetch — intersection did not trigger pagination
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does NOT call fetchNextPage when isIntersecting=false", async () => {
    const spy = mockFetchSequence({ status: 200, body: PAGE_1 });
    renderFeed("ch-1", "tok");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Loaded"));

    act(() => simulateIntersection(false));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ── Duplicate-fetch guard during LoadingMore ───────────────────────────────

describe("useInfiniteChannelFeed — duplicate-fetch guard", () => {
  it("ignores a second intersection while already in LoadingMore", async () => {
    // Use a container object so TypeScript control flow doesn't narrow to never
    const deferred: { resolve: ((r: Response) => void) | null } = { resolve: null };
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(PAGE_1), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((res) => {
            deferred.resolve = res;
          })
      );

    renderFeed("ch-1", "tok");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Loaded"));

    // First intersection triggers LoadingMore
    act(() => simulateIntersection(true));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

    // Second intersection while fetching — must be ignored
    act(() => simulateIntersection(true));
    expect(spy).toHaveBeenCalledTimes(2); // still 2, not 3

    // Resolve to clean up
    deferred.resolve?.(
      new Response(JSON.stringify(PAGE_2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});

// ── Superset invariant ─────────────────────────────────────────────────────

describe("useInfiniteChannelFeed — UseChannelFeedResult superset", () => {
  it("renders state, messages, hasNextPage, error and sentinel from a single hook call", async () => {
    mockFetchSequence({ status: 200, body: PAGE_1 });
    renderFeed("ch-1", "tok");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Loaded"));

    expect(screen.getByTestId("state").textContent).toBe("Loaded");
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("hasNextPage").textContent).toBe("true");
    expect(screen.getByTestId("error").textContent).toBe("");
    expect(screen.getByTestId("sentinel")).toBeDefined();
  });
});
