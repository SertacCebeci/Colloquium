import type { ChannelRepository } from "./ChannelRepository";
import type { ChannelMessagePostedV1 } from "./PostChannelMessageAcl";
import { queryMessagesSinceSeq } from "./ChannelMessagesSinceSeq";

// ── Domain Events ─────────────────────────────────────────────────────────────

export interface WebSocketSessionOpened {
  type: "WebSocketSessionOpened";
  connectionId: string;
  memberId: string;
  openedAt: number;
}

export interface ChannelSubscriptionRegistered {
  type: "ChannelSubscriptionRegistered";
  connectionId: string;
  channelId: string;
}

export interface MissedMessagesDelivered {
  type: "MissedMessagesDelivered";
  connectionId: string;
  channelId: string;
  fromSeq: number;
  toSeq: number;
  messageCount: number;
}

export interface ChannelSubscriptionRemoved {
  type: "ChannelSubscriptionRemoved";
  connectionId: string;
  channelId: string;
}

export interface WebSocketSessionClosed {
  type: "WebSocketSessionClosed";
  connectionId: string;
  memberId: string;
  closedAt: number;
}

export type WebSocketSessionEvent =
  | WebSocketSessionOpened
  | ChannelSubscriptionRegistered
  | MissedMessagesDelivered
  | ChannelSubscriptionRemoved
  | WebSocketSessionClosed;

// ── Aggregate ─────────────────────────────────────────────────────────────────

type SessionState = "Pending" | "Open" | "Closed";

export class WebSocketSession {
  readonly connectionId: string;

  private _state: SessionState = "Pending";
  private _memberId: string | null = null;
  private readonly _subscribedChannels = new Set<string>();

  constructor(connectionId: string) {
    this.connectionId = connectionId;
  }

  // ── Commands ─────────────────────────────────────────────────────────────────

  registerSession(memberId: string): WebSocketSessionOpened[] {
    if (this._state === "Open") {
      return []; // idempotent — already registered
    }
    this._memberId = memberId;
    this._state = "Open";
    return [
      {
        type: "WebSocketSessionOpened",
        connectionId: this.connectionId,
        memberId,
        openedAt: Date.now(),
      },
    ];
  }

  /**
   * Subscribes to a channel and delivers any missed messages via sendFn.
   * Validates channelId and lastKnownSeq via queryMessagesSinceSeq (throws
   * InvalidPayloadError or ChannelNotFoundError on bad input).
   * Returns empty array when session is Closed (silent drop).
   */
  subscribeToChannel(
    channelId: string,
    lastKnownSeq: number,
    repo: ChannelRepository,
    sendFn: (msg: unknown) => void
  ): (ChannelSubscriptionRegistered | MissedMessagesDelivered)[] {
    if (this._state === "Closed") {
      return [];
    }

    // Validation and catch-up query — InvalidPayloadError / ChannelNotFoundError propagate to caller
    const missed = queryMessagesSinceSeq({ channelId, fromSeq: lastKnownSeq }, repo);

    this._subscribedChannels.add(channelId);

    const events: (ChannelSubscriptionRegistered | MissedMessagesDelivered)[] = [];

    events.push({
      type: "ChannelSubscriptionRegistered",
      connectionId: this.connectionId,
      channelId,
    });

    if (missed.length > 0) {
      for (const msg of missed) {
        sendFn(msg);
      }
      events.push({
        type: "MissedMessagesDelivered",
        connectionId: this.connectionId,
        channelId,
        fromSeq: lastKnownSeq,
        toSeq: missed[missed.length - 1].seq,
        messageCount: missed.length,
      });
    }

    return events;
  }

  unsubscribeFromChannel(channelId: string): ChannelSubscriptionRemoved[] {
    if (!this._subscribedChannels.has(channelId)) {
      return [];
    }
    this._subscribedChannels.delete(channelId);
    return [
      {
        type: "ChannelSubscriptionRemoved",
        connectionId: this.connectionId,
        channelId,
      },
    ];
  }

  /**
   * Delivers a live message to this session if it is Open and subscribed to
   * the event's channel. Silent no-op otherwise.
   */
  deliverMessage(event: ChannelMessagePostedV1, sendFn: (msg: unknown) => void): void {
    if (this._state !== "Open") return;
    if (!this._subscribedChannels.has(event.channelId)) return;
    sendFn(event);
  }

  terminateSession(): WebSocketSessionClosed[] {
    if (this._state === "Closed") {
      return []; // idempotent
    }
    this._state = "Closed";
    this._subscribedChannels.clear();
    return [
      {
        type: "WebSocketSessionClosed",
        connectionId: this.connectionId,
        memberId: this._memberId ?? "",
        closedAt: Date.now(),
      },
    ];
  }
}
