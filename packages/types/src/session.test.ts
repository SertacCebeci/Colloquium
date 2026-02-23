import { describe, it, expect } from "vitest";
import {
  SessionStatusSchema,
  SessionSchema,
  PlanSchema,
  CommentSchema,
  CreateCommentRequestSchema,
} from "./session";

describe("SessionStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(() => SessionStatusSchema.parse("in_progress")).not.toThrow();
    expect(() => SessionStatusSchema.parse("interrupted")).not.toThrow();
    expect(() => SessionStatusSchema.parse("awaiting_input")).not.toThrow();
    expect(() => SessionStatusSchema.parse("ready_for_review")).not.toThrow();
  });

  it("rejects invalid status", () => {
    expect(() => SessionStatusSchema.parse("unknown")).toThrow();
  });
});

describe("SessionSchema", () => {
  const validSession = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "feat/kintsugi-sonar",
    status: "in_progress",
    workingDirectory: "/home/dev/colloquium",
    startedAt: "2026-02-21T10:00:00.000Z",
    updatedAt: "2026-02-21T10:05:00.000Z",
    planId: null,
  };

  it("parses a valid session", () => {
    const result = SessionSchema.parse(validSession);
    expect(result.name).toBe("feat/kintsugi-sonar");
    expect(result.status).toBe("in_progress");
  });

  it("accepts optional fields as undefined", () => {
    const result = SessionSchema.parse(validSession);
    expect(result.agentVersion).toBeUndefined();
    expect(result.taskDescription).toBeUndefined();
  });

  it("rejects missing required field", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...withoutName } = validSession;
    expect(() => SessionSchema.parse(withoutName)).toThrow();
  });
});

describe("SessionSchema — seed data IDs", () => {
  it("accepts non-UUID string IDs (seed data format s-001)", () => {
    const result = SessionSchema.safeParse({
      id: "s-001",
      name: "Test session",
      status: "in_progress",
      workingDirectory: "/home/user/project",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      planId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("PlanSchema — seed data IDs", () => {
  it("accepts non-UUID string IDs", () => {
    const result = PlanSchema.safeParse({
      id: "p-001",
      sessionId: "s-001",
      content: "## Plan\n- Step 1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe("CommentSchema — seed data IDs", () => {
  it("accepts non-UUID string IDs", () => {
    const result = CommentSchema.safeParse({
      id: "c-001",
      planId: "p-001",
      lineNumber: 1,
      body: "Looks good",
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateCommentRequestSchema", () => {
  it("rejects empty body", () => {
    expect(() => CreateCommentRequestSchema.parse({ lineNumber: 1, body: "" })).toThrow();
  });

  it("accepts valid comment request", () => {
    expect(() => CreateCommentRequestSchema.parse({ lineNumber: 5, body: "LGTM" })).not.toThrow();
  });
});
