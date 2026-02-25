import { InvalidPayloadError, ChannelNotFoundError } from "./errors";
import type { ChannelRepository } from "./ChannelRepository";
import type { ChannelMessagePostedV1 } from "./PostChannelMessageAcl";

// ── Domain events ─────────────────────────────────────────────────────────────

export type WebSocketSessionOpened = {
  type: "WebSocketSessionOpened";
  connectionId: string;
  memberId: string;
  openedAt: number;
};

export type ChannelSubscriptionRegistered = {
  type: "ChannelSubscriptionRegistered";
  connectionId: string;
  channelId: string;
  lastKnownSeq: number;
};

export type MissedMessagesDelivered = {
  type: "MissedMessagesDelivered";
  connectionId: string;
  channelId: string;
  fromSeq: number;
  toSeq: number;
  messageCount: number;
};

export type ChannelSubscriptionRemoved = {
  type: "ChannelSubscriptionRemoved";
  connectionId: string;
  channelId: string;
};

export type WebSocketSessionClosed = {
  type: "WebSocketSessionClosed";
  connectionId: string;
  memberId: string;
  closedAt: number;
};

export type WebSocketSessionEvent =
  | WebSocketSessionOpened
  | ChannelSubscriptionRegistered
  | MissedMessagesDelivered
  | ChannelSubscriptionRemoved
  | WebSocketSessionClosed;

// ── Aggregate ─────────────────────────────────────────────────────────────────

type SessionState = "Open" | "Closed";

export class WebSocketSession {
  private state: SessionState = "Closed";
  private memberId: string = "";
  private subscribedChannels: Set<string> = new Set();

  constructor(private readonly connectionId: string) {}

  registerSession(memberId: string): WebSocketSessionOpened[] {
    if (this.state === "Open") return [];
    this.state = "Open";
    this.memberId = memberId;
    return [
      {
        type: "WebSocketSessionOpened",
        connectionId: this.connectionId,
        memberId,
        openedAt: Date.now(),
      },
    ];
  }

  subscribeToChannel(
    channelId: string,
    lastKnownSeq: number,
    repo: ChannelRepository,
    sendFn: (msg: unknown) => void
  ): (ChannelSubscriptionRegistered | MissedMessagesDelivered)[] {
    if (this.state === "Closed") return [];

    if (!channelId || channelId.trim() === "") {
      throw new InvalidPayloadError("channelId must be a non-empty string");
    }
    if (lastKnownSeq < 0) {
      throw new InvalidPayloadError("lastKnownSeq must be >= 0");
    }

    // Guard channel existence via findById as specified; findSequenceHead follows only when the
    // channel is confirmed to exist, ensuring the null-means-not-found contract is explicit.
    if (repo.findById(channelId) === null) {
      throw new ChannelNotFoundError(channelId);
    }
    // Non-null guaranteed: channel exists and findSequenceHead returns null only for unknown channels.
    const head = repo.findSequenceHead(channelId)!;

    const events: (ChannelSubscriptionRegistered | MissedMessagesDelivered)[] = [];
    events.push({
      type: "ChannelSubscriptionRegistered",
      connectionId: this.connectionId,
      channelId,
      lastKnownSeq,
    });

    if (lastKnownSeq < head) {
      // Non-null guaranteed: channel existence confirmed above; null from findMessagesSinceSeq
      // would indicate a repository inconsistency that should surface as an exception, not be swallowed.
      const missed = repo.findMessagesSinceSeq(channelId, lastKnownSeq)!;
      for (const msg of missed) {
        sendFn(msg);
      }
      events.push({
        type: "MissedMessagesDelivered",
        connectionId: this.connectionId,
        channelId,
        fromSeq: lastKnownSeq,
        toSeq: head,
        messageCount: missed.length,
      });
    }

    // Commit subscription only after all sendFn calls succeed — if sendFn throws during
    // catch-up, this line is never reached and the session remains correctly unsubscribed.
    this.subscribedChannels.add(channelId);

    return events;
  }

  unsubscribeFromChannel(channelId: string): ChannelSubscriptionRemoved[] {
    if (!this.subscribedChannels.has(channelId)) return [];
    this.subscribedChannels.delete(channelId);
    return [{ type: "ChannelSubscriptionRemoved", connectionId: this.connectionId, channelId }];
  }

  terminateSession(): WebSocketSessionClosed[] {
    if (this.state === "Closed") return [];
    this.state = "Closed";
    this.subscribedChannels.clear();
    return [
      {
        type: "WebSocketSessionClosed",
        connectionId: this.connectionId,
        memberId: this.memberId,
        closedAt: Date.now(),
      },
    ];
  }

  deliverMessage(event: ChannelMessagePostedV1, sendFn: (msg: unknown) => void): void {
    if (this.state === "Closed") return;
    if (!this.subscribedChannels.has(event.channelId)) return;
    sendFn(event);
  }
}
