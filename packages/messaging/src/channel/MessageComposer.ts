import type { MessageItem } from "./GetChannelMessagesAcl";

// ── Domain Events ─────────────────────────────────────────────────────────────

export interface EmptyMessageRejected {
  type: "EmptyMessageRejected";
  reason: "empty" | "too-long";
  inputValue: string;
}

export interface PostMessageAPICallMade {
  type: "PostMessageAPICallMade";
  channelId: string;
  content: string;
}

export interface MessageAppendedOptimistically {
  type: "MessageAppendedOptimistically";
  message: MessageItem;
}

export interface MessageInputCleared {
  type: "MessageInputCleared";
}

export interface ComposerAPIErrorOccurred {
  type: "APIErrorOccurred";
  source: "message-post";
  statusCode: number;
  message: string;
}

export type ComposerEvent =
  | EmptyMessageRejected
  | PostMessageAPICallMade
  | MessageAppendedOptimistically
  | MessageInputCleared
  | ComposerAPIErrorOccurred;

// ── Aggregate ─────────────────────────────────────────────────────────────────

type ComposerState = "Idle" | "Typing" | "Submitting" | "Error";

export class MessageComposer {
  readonly channelId: string;

  private _state: ComposerState = "Idle";
  private _inputValue: string = "";
  private _validationError: "empty" | "too-long" | null = null;
  private _isSubmitting: boolean = false;
  private _errorMessage: string | null = null;

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  get state(): ComposerState {
    return this._state;
  }

  get inputValue(): string {
    return this._inputValue;
  }

  get validationError(): "empty" | "too-long" | null {
    return this._validationError;
  }

  get isSubmitting(): boolean {
    return this._isSubmitting;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  // ── Commands ─────────────────────────────────────────────────────────────────

  /** Called on every keystroke — updates inputValue and derives state. */
  typeContent(content: string): void {
    this._inputValue = content;
    this._state = content.length > 0 ? "Typing" : "Idle";
    this._validationError = null;
  }

  /**
   * Client-side guard — sets validationError without mutating aggregate state
   * or isSubmitting. Emits EmptyMessageRejected when content is invalid.
   */
  validateMessage(content: string): EmptyMessageRejected[] {
    if (content.trim().length === 0) {
      this._validationError = "empty";
      return [{ type: "EmptyMessageRejected", reason: "empty", inputValue: content }];
    }
    if (content.length > 4000) {
      this._validationError = "too-long";
      return [{ type: "EmptyMessageRejected", reason: "too-long", inputValue: content }];
    }
    this._validationError = null;
    return [];
  }

  /**
   * Issues the POST request — transitions Typing → Submitting.
   * Rejected silently (returns []) when already Submitting (double-submit guard).
   * Rejected with EmptyMessageRejected when content is empty or too long.
   */
  submitMessage(content: string): (PostMessageAPICallMade | EmptyMessageRejected)[] {
    // Double-submit guard
    if (this._state === "Submitting") {
      return [];
    }

    if (content.trim().length === 0) {
      this._validationError = "empty";
      return [{ type: "EmptyMessageRejected", reason: "empty", inputValue: content }];
    }

    if (content.length > 4000) {
      this._validationError = "too-long";
      return [{ type: "EmptyMessageRejected", reason: "too-long", inputValue: content }];
    }

    this._state = "Submitting";
    this._isSubmitting = true;
    this._validationError = null;
    this._errorMessage = null;

    const event: PostMessageAPICallMade = {
      type: "PostMessageAPICallMade",
      channelId: this.channelId,
      content,
    };
    return [event];
  }

  /**
   * Called by the HTTP adapter when the POST returns 201.
   * Transitions Submitting → Idle; atomically clears inputValue and isSubmitting.
   */
  messagePosted(message: MessageItem): (MessageAppendedOptimistically | MessageInputCleared)[] {
    this._state = "Idle";
    this._inputValue = "";
    this._isSubmitting = false;
    this._validationError = null;
    this._errorMessage = null;

    return [{ type: "MessageAppendedOptimistically", message }, { type: "MessageInputCleared" }];
  }

  /**
   * Called by the HTTP adapter when the POST returns a non-2xx response.
   * Transitions Submitting → Error; input becomes editable again.
   */
  messageFailed(statusCode: number, message: string): ComposerAPIErrorOccurred[] {
    this._state = "Error";
    this._isSubmitting = false;
    this._errorMessage = message;

    return [
      {
        type: "APIErrorOccurred",
        source: "message-post",
        statusCode,
        message,
      },
    ];
  }
}
