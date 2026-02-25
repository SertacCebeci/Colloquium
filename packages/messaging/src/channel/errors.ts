export class InvalidPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPayloadError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ChannelNotFoundError extends Error {
  constructor(channelId: string) {
    super(`Channel not found: ${channelId}`);
    this.name = "ChannelNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ChannelAccessDeniedError extends Error {
  constructor(
    public readonly channelId: string,
    public readonly authorId: string
  ) {
    super(`Access denied: ${authorId} is not an allowed poster in channel ${channelId}`);
    this.name = "ChannelAccessDeniedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DuplicateConnectionError extends Error {
  constructor(connectionId: string) {
    super(`Connection already registered: ${connectionId}`);
    this.name = "DuplicateConnectionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SessionNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`Session not found: ${connectionId}`);
    this.name = "SessionNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MessageValidationFailedError extends Error {
  constructor(
    public readonly channelId: string,
    public readonly reason: "EMPTY_CONTENT" | "CONTENT_TOO_LONG"
  ) {
    super(`Message validation failed in channel ${channelId}: ${reason}`);
    this.name = "MessageValidationFailedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
