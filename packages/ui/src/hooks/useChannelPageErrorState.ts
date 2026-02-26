import type { ChannelFeedState } from "./useChannelFeed";
import type { UseInfiniteChannelFeedResult } from "./useInfiniteChannelFeed";
import type { MessageComposerState, UseMessageComposerResult } from "./useMessageComposer";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChannelPageErrorState {
  visible: boolean;
  message: string;
  retryable: boolean;
}

// ── Pure domain function (exported for unit testing) ──────────────────────────

/**
 * Derives the channel page error banner state from the current feed and composer states.
 * Feed error has strict precedence over composer error.
 * Invariant: message is always a string; retryable=true implies visible=true.
 */
export function deriveErrorState(opts: {
  feedState: ChannelFeedState;
  feedError: string | null;
  composerState: MessageComposerState;
  composerErrorMessage: string | null;
}): ChannelPageErrorState {
  const { feedState, feedError, composerState, composerErrorMessage } = opts;

  if (feedState === "Error") {
    return {
      visible: true,
      message: feedError ?? "Failed to load messages",
      retryable: true,
    };
  }

  if (composerState === "Error") {
    return {
      visible: true,
      message: composerErrorMessage ?? "Failed to send message",
      retryable: false,
    };
  }

  return { visible: false, message: "", retryable: false };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChannelPageErrorState(
  feed: UseInfiniteChannelFeedResult,
  composer: UseMessageComposerResult
): ChannelPageErrorState {
  return deriveErrorState({
    feedState: feed.state,
    feedError: feed.error,
    composerState: composer.state,
    composerErrorMessage: composer.errorMessage,
  });
}
