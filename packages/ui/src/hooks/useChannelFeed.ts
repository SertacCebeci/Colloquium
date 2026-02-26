import { useInfiniteQuery } from "@tanstack/react-query";
import type { ChannelFeedPageV1, MessageItem } from "@colloquium/messaging";

// ── CT-004 consumer adapter ────────────────────────────────────────────────

/**
 * Fetches one page from the CT-004 endpoint.
 * Throws an Error with the server's error message on non-2xx responses.
 */
export async function fetchChannelPage(
  channelId: string,
  token: string,
  cursor?: string
): Promise<ChannelFeedPageV1> {
  const url = new URL(`/channels/${channelId}/messages`, "http://localhost");
  if (cursor !== undefined) url.searchParams.set("before", cursor);

  const res = await fetch(url.pathname + (url.search || ""), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<ChannelFeedPageV1>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ChannelFeedState = "Idle" | "Loading" | "Loaded" | "LoadingMore" | "Error";

export interface UseChannelFeedResult {
  state: ChannelFeedState;
  messages: MessageItem[];
  hasNextPage: boolean;
  nextCursor: string | null;
  error: string | null;
  fetchNextPage: () => void;
  refetch: () => void;
}

// ── Pure logic (exported for unit testing) ─────────────────────────────────

/** CT-004 pagination parameter: undefined signals "no more pages" to TanStack Query. */
export function getNextPageParam(page: ChannelFeedPageV1): string | undefined {
  return page.nextCursor ?? undefined;
}

/** Flatten all pages into a single newest-first message array. */
export function flattenPages(pages: ChannelFeedPageV1[]): MessageItem[] {
  return pages.flatMap((page) => page.messages);
}

export interface QueryState {
  isLoading: boolean;
  isSuccess: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
}

/**
 * Map TanStack Query internal states to the ChannelFeed state machine.
 * Idle takes precedence when channelId is absent/empty.
 */
export function mapQueryStateToChannelFeedState(
  query: QueryState,
  channelId: string
): ChannelFeedState {
  if (!channelId.trim()) return "Idle";
  if (query.isError) return "Error";
  if (query.isSuccess && query.isFetchingNextPage) return "LoadingMore";
  if (query.isSuccess) return "Loaded";
  if (query.isLoading) return "Loading";
  return "Idle";
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * feat-005: channel-feed-page-read-model
 * Wraps useInfiniteQuery to expose the ChannelFeed state machine.
 * Consumes CT-004 (GET /channels/:channelId/messages).
 */
export function useChannelFeed(channelId: string, token: string): UseChannelFeedResult {
  const query = useInfiniteQuery({
    queryKey: ["channelFeed", channelId],
    queryFn: ({ pageParam }) => fetchChannelPage(channelId, token, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam,
    enabled: !!channelId.trim(),
  });

  const pages = query.data?.pages ?? [];
  const messages = flattenPages(pages);
  const lastPage = pages[pages.length - 1] ?? null;
  const nextCursor = lastPage?.nextCursor ?? null;

  const state = mapQueryStateToChannelFeedState(
    {
      isLoading: query.isLoading,
      isSuccess: query.isSuccess,
      isFetchingNextPage: query.isFetchingNextPage,
      isError: query.isError,
    },
    channelId
  );

  return {
    state,
    messages: state === "Idle" || state === "Loading" ? [] : messages,
    hasNextPage: query.hasNextPage,
    nextCursor: query.hasNextPage ? nextCursor : null,
    error: query.isError ? (query.error as Error).message : null,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  };
}
