// ── Domain Events ─────────────────────────────────────────────────────────────

export interface ChannelRegistered {
  type: "ChannelRegistered";
  channelId: string;
  workspaceId: string;
  registeredAt: number;
}

export interface ChannelMembershipGranted {
  type: "ChannelMembershipGranted";
  channelId: string;
  memberId: string;
  grantedAt: number;
}

export interface ChannelMessagePosted {
  type: "ChannelMessagePosted";
  channelId: string;
  messageId: string;
  authorId: string;
  content: string;
  seq: number;
  postedAt: number;
  mentionedIds: string[];
}

export interface MessageValidationFailed {
  type: "MessageValidationFailed";
  channelId: string;
  authorId: string;
  reason: "EMPTY_CONTENT" | "CONTENT_TOO_LONG";
}

export interface ChannelAccessDenied {
  type: "ChannelAccessDenied";
  channelId: string;
  authorId: string;
}

// ChannelArchived has no command in SL-001 but exists as a future-slice event
// and is needed for aggregate reconstitution testing of the Archived state.
export interface ChannelArchived {
  type: "ChannelArchived";
  channelId: string;
  archivedAt: number;
}

export type ChannelEvent =
  | ChannelRegistered
  | ChannelMembershipGranted
  | ChannelMessagePosted
  | MessageValidationFailed
  | ChannelAccessDenied
  | ChannelArchived;

// ── Aggregate ─────────────────────────────────────────────────────────────────

type ChannelState = "Unregistered" | "Active" | "Archived";

export class Channel {
  readonly channelId: string;

  private _state: ChannelState = "Unregistered";
  private _workspaceId: string | null = null;
  private _allowedPosters: Set<string> = new Set();
  private _nextSeq = 1;

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  get state(): ChannelState {
    return this._state;
  }

  // ── Commands ────────────────────────────────────────────────────────────────

  registerChannel(workspaceId: string): ChannelRegistered[] {
    if (this._state === "Archived") {
      throw new Error(`Channel ${this.channelId} is Archived — RegisterChannel rejected`);
    }
    if (this._state === "Active") {
      if (this._workspaceId !== workspaceId) {
        throw new Error(
          `Channel ${this.channelId} is already registered to workspace ${this._workspaceId} — cannot re-register to ${workspaceId}`
        );
      }
      return []; // idempotent — same workspaceId, no event
    }
    const event: ChannelRegistered = {
      type: "ChannelRegistered",
      channelId: this.channelId,
      workspaceId,
      registeredAt: Date.now(),
    };
    this.apply(event);
    return [event];
  }

  grantChannelMembership(memberId: string): ChannelMembershipGranted[] {
    if (this._state !== "Active") {
      throw new Error(`Channel ${this.channelId} is not Active (state: ${this._state}) — GrantChannelMembership rejected`);
    }
    if (this._allowedPosters.has(memberId)) {
      return []; // idempotent — already a member
    }
    const event: ChannelMembershipGranted = {
      type: "ChannelMembershipGranted",
      channelId: this.channelId,
      memberId,
      grantedAt: Date.now(),
    };
    this.apply(event);
    return [event];
  }

  postChannelMessage(authorId: string, content: string): (ChannelMessagePosted | ChannelAccessDenied | MessageValidationFailed)[] {
    if (this._state !== "Active") {
      throw new Error(`Channel ${this.channelId} is not Active (state: ${this._state}) — PostChannelMessage rejected`);
    }
    if (!this._allowedPosters.has(authorId)) {
      const event: ChannelAccessDenied = { type: "ChannelAccessDenied", channelId: this.channelId, authorId };
      return [event];
    }
    if (content.trim().length === 0) {
      const event: MessageValidationFailed = { type: "MessageValidationFailed", channelId: this.channelId, authorId, reason: "EMPTY_CONTENT" };
      return [event];
    }
    if (content.length > 4000) {
      const event: MessageValidationFailed = { type: "MessageValidationFailed", channelId: this.channelId, authorId, reason: "CONTENT_TOO_LONG" };
      return [event];
    }
    const event: ChannelMessagePosted = {
      type: "ChannelMessagePosted",
      channelId: this.channelId,
      messageId: crypto.randomUUID(),
      authorId,
      content,
      seq: this._nextSeq,
      postedAt: Date.now(),
      mentionedIds: [],
    };
    this.apply(event);
    return [event];
  }

  // ── Reconstitution ──────────────────────────────────────────────────────────

  apply(event: ChannelEvent): void {
    switch (event.type) {
      case "ChannelRegistered":
        this._state = "Active";
        this._workspaceId = event.workspaceId;
        break;
      case "ChannelMembershipGranted":
        this._allowedPosters.add(event.memberId);
        break;
      case "ChannelMessagePosted":
        this._nextSeq = event.seq + 1;
        break;
      case "ChannelArchived":
        this._state = "Archived";
        break;
      // Rejection events do not mutate state — they are audit events only
      case "ChannelAccessDenied":
      case "MessageValidationFailed":
        break;
    }
  }
}
