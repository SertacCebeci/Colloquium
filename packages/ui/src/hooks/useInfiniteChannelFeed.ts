import { useRef, useEffect } from "react";
import { useChannelFeed } from "./useChannelFeed";
import type { ChannelFeedState, UseChannelFeedResult } from "./useChannelFeed";

// ── Types ─────────────────────────────────────────────────────────────────

export interface UseInfiniteChannelFeedResult extends UseChannelFeedResult {
  sentinelRef: React.RefObject<Element | null>;
}

// ── Pure domain function (exported for unit testing) ──────────────────────

/**
 * Guard: true iff an IntersectionObserver intersection event should trigger fetchNextPage.
 * Returns false when already fetching (LoadingMore), no more pages, or not yet loaded.
 */
export function shouldFetchNextPage(opts: {
  state: ChannelFeedState;
  hasNextPage: boolean;
}): boolean {
  return opts.state === "Loaded" && opts.hasNextPage;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * feat-006: infinite-channel-feed-read-model
 * Extends useChannelFeed with an IntersectionObserver sentinel ref.
 * When the sentinel element enters the viewport and the guard passes,
 * fetchNextPage() is called automatically.
 */
export function useInfiniteChannelFeed(
  channelId: string,
  token: string
): UseInfiniteChannelFeedResult {
  const feed = useChannelFeed(channelId, token);
  const sentinelRef = useRef<Element | null>(null);

  // Stable ref to fetchNextPage — avoids recreating the observer on every render
  const fetchNextPageRef = useRef(feed.fetchNextPage);
  fetchNextPageRef.current = feed.fetchNextPage;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (shouldFetchNextPage({ state: feed.state, hasNextPage: feed.hasNextPage })) {
        fetchNextPageRef.current();
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feed.state, feed.hasNextPage]);

  return { ...feed, sentinelRef };
}
