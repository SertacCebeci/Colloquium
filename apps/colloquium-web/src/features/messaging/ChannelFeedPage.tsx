import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  useInfiniteChannelFeed,
  useMessageComposer,
  useChannelPageErrorState,
} from "@colloquium/ui";

export function ChannelFeedPage() {
  const { channelId = "" } = useParams<{ channelId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const feed = useInfiniteChannelFeed(channelId, token);
  const composer = useMessageComposer(channelId, token);
  const errorState = useChannelPageErrorState(feed, composer);

  return (
    <div data-testid="channel-feed-page">
      {errorState.visible && (
        <div data-testid="error-banner">
          <span data-testid="error-message">{errorState.message}</span>
          {errorState.retryable && (
            <button data-testid="retry-button" onClick={() => void feed.refetch()}>
              Retry
            </button>
          )}
        </div>
      )}

      <div data-testid="sentinel" ref={feed.sentinelRef} />

      <div data-testid="messages">
        {[...feed.messages].reverse().map((msg) => (
          <div key={msg.messageId} data-testid={`message-${msg.messageId}`}>
            <span data-testid="message-content">{msg.content}</span>
          </div>
        ))}
      </div>

      <textarea
        data-testid="composer-input"
        value={composer.inputValue}
        onChange={(e) => composer.onChange(e.target.value)}
        disabled={composer.state === "Submitting"}
        placeholder="Write a message…"
      />
      <button data-testid="composer-send" onClick={composer.onSubmit}>
        Send
      </button>
    </div>
  );
}
