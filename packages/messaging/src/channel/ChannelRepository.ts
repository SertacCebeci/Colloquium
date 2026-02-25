import { Channel } from "./Channel";
import type { ChannelEvent, ChannelMessagePosted } from "./Channel";

// In-memory event store — the persistence adapter contract for the Channel aggregate.
// A production implementation would swap this for a database-backed store.

export interface ChannelEventStore {
  append(channelId: string, events: ChannelEvent[]): void;
  load(channelId: string): ChannelEvent[];
}

export class InMemoryChannelEventStore implements ChannelEventStore {
  private store = new Map<string, ChannelEvent[]>();

  append(channelId: string, events: ChannelEvent[]): void {
    const existing = this.store.get(channelId) ?? [];
    this.store.set(channelId, [...existing, ...events]);
  }

  load(channelId: string): ChannelEvent[] {
    return this.store.get(channelId) ?? [];
  }
}

export class ChannelRepository {
  constructor(private readonly eventStore: ChannelEventStore) {}

  save(channel: Channel, newEvents: ChannelEvent[]): void {
    if (newEvents.length === 0) return;
    this.eventStore.append(channel.channelId, newEvents);
  }

  findById(channelId: string): Channel | null {
    const events = this.eventStore.load(channelId);
    if (events.length === 0) return null;
    const channel = new Channel(channelId);
    for (const event of events) {
      channel.apply(event);
    }
    return channel;
  }

  /**
   * Returns the highest seq among all ChannelMessagePosted events for a channel,
   * or null if the channel does not exist.
   *
   * - Returns `null`  when the channel has no events (not registered)
   * - Returns `0`     when the channel exists but has no posted messages
   * - Returns `n > 0` when the channel has posted messages; n is the max seq
   */
  findSequenceHead(channelId: string): number | null {
    const events = this.eventStore.load(channelId);
    if (events.length === 0) return null;

    let head = 0;
    for (const e of events) {
      if (e.type === "ChannelMessagePosted" && e.seq > head) {
        head = e.seq;
      }
    }
    return head;
  }

  /**
   * Returns all ChannelMessagePosted events with seq > fromSeq, in ascending
   * seq order. Returns null if the channel does not exist.
   *
   * - Returns `null` when the channel has no events (not registered)
   * - Returns `[]`   when the channel exists but no messages satisfy seq > fromSeq
   */
  findMessagesSinceSeq(channelId: string, fromSeq: number): ChannelMessagePosted[] | null {
    const events = this.eventStore.load(channelId);
    // A registered channel always has at least one event (ChannelRegistered).
    // An empty event list therefore means the channel was never registered — return null.
    if (events.length === 0) return null;

    const messages = events
      .filter(
        (e): e is ChannelMessagePosted => e.type === "ChannelMessagePosted" && e.seq > fromSeq
      )
      .sort((a, b) => a.seq - b.seq);

    return messages;
  }

  /**
   * Returns paginated ChannelMessagePosted events for a channel, or null if
   * the channel does not exist. Results are ordered by seq ascending.
   *
   * - No `before`: the `limit` messages with the highest seq values.
   * - With `before`: the `limit` messages with the highest seq values where seq < before.
   */
  findMessages(channelId: string, limit: number, before?: number): ChannelMessagePosted[] | null {
    const events = this.eventStore.load(channelId);
    if (events.length === 0) return null;

    let messages = events.filter(
      (e): e is ChannelMessagePosted => e.type === "ChannelMessagePosted"
    );

    if (before !== undefined) {
      messages = messages.filter((e) => e.seq < before);
    }

    messages.sort((a, b) => a.seq - b.seq);

    return messages.slice(Math.max(0, messages.length - limit));
  }
}
