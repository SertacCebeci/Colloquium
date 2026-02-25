import { DuplicateConnectionError, SessionNotFoundError } from "./errors";
import { WebSocketSession } from "./WebSocketSession";
import type {
  WebSocketSessionOpened,
  ChannelSubscriptionRegistered,
  MissedMessagesDelivered,
  ChannelSubscriptionRemoved,
  WebSocketSessionClosed,
} from "./WebSocketSession";
import type { ChannelRepository } from "./ChannelRepository";
import type { ChannelMessagePostedV1 } from "./PostChannelMessageAcl";

// ── Domain events owned by this feature ───────────────────────────────────────

export type MessageFanoutCompleted = {
  type: "MessageFanoutCompleted";
  channelId: string;
  messageId: string;
  sessionCount: number;
};

export type SessionDeliveryFailed = {
  type: "SessionDeliveryFailed";
  connectionId: string;
  messageId: string;
  reason: string;
};

// ── Infrastructure coordinator ─────────────────────────────────────────────────

type SessionEntry = { session: WebSocketSession; sendFn: (msg: unknown) => void };

export class FanoutCoordinator {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly channelSessions = new Map<string, Set<string>>();

  openSession(
    connectionId: string,
    memberId: string,
    sendFn: (msg: unknown) => void
  ): WebSocketSessionOpened[] {
    if (this.sessions.has(connectionId)) {
      throw new DuplicateConnectionError(connectionId);
    }
    const session = new WebSocketSession(connectionId);
    const events = session.registerSession(memberId);
    this.sessions.set(connectionId, { session, sendFn });
    return events;
  }

  subscribeToChannel(
    connectionId: string,
    channelId: string,
    lastKnownSeq: number,
    repo: ChannelRepository
  ): (ChannelSubscriptionRegistered | MissedMessagesDelivered)[] {
    const entry = this.sessions.get(connectionId);
    if (!entry) throw new SessionNotFoundError(connectionId);

    const events = entry.session.subscribeToChannel(channelId, lastKnownSeq, repo, entry.sendFn);

    // Add to channel index only if the session's subscribeToChannel succeeded (no throw).
    let set = this.channelSessions.get(channelId);
    if (!set) {
      set = new Set();
      this.channelSessions.set(channelId, set);
    }
    set.add(connectionId);

    return events;
  }

  unsubscribeFromChannel(connectionId: string, channelId: string): ChannelSubscriptionRemoved[] {
    const entry = this.sessions.get(connectionId);
    if (!entry) throw new SessionNotFoundError(connectionId);

    const events = entry.session.unsubscribeFromChannel(channelId);
    this.channelSessions.get(channelId)?.delete(connectionId);
    return events;
  }

  closeSession(connectionId: string): WebSocketSessionClosed[] {
    const entry = this.sessions.get(connectionId);
    if (!entry) throw new SessionNotFoundError(connectionId);

    const events = entry.session.terminateSession();

    // Remove from every channel set atomically before returning.
    this.channelSessions.forEach((set) => set.delete(connectionId));
    this.sessions.delete(connectionId);

    return events;
  }

  fanout(event: ChannelMessagePostedV1): (MessageFanoutCompleted | SessionDeliveryFailed)[] {
    const connectionIds = Array.from(this.channelSessions.get(event.channelId) ?? []);
    const results: (MessageFanoutCompleted | SessionDeliveryFailed)[] = [];
    let sessionCount = 0;

    for (const connectionId of connectionIds) {
      const entry = this.sessions.get(connectionId);
      if (!entry) continue; // race: session closed between index lookup and delivery

      try {
        entry.session.deliverMessage(event, entry.sendFn);
        sessionCount++;
      } catch (err) {
        results.push({
          type: "SessionDeliveryFailed",
          connectionId,
          messageId: event.messageId,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    results.push({
      type: "MessageFanoutCompleted",
      channelId: event.channelId,
      messageId: event.messageId,
      sessionCount,
    });

    return results;
  }

  getSessionsForChannel(channelId: string): string[] {
    return Array.from(this.channelSessions.get(channelId) ?? []);
  }
}
