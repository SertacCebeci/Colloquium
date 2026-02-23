import { describe, it, expect } from "vitest";
import {
  PostStatusSchema,
  PostSchema,
  PostCommentSchema,
  CreatePostRequestSchema,
  UpdatePostRequestSchema,
  CreatePostCommentRequestSchema,
} from "./post";

describe("PostStatusSchema", () => {
  it("accepts draft", () => {
    expect(() => PostStatusSchema.parse("draft")).not.toThrow();
  });
  it("accepts published", () => {
    expect(() => PostStatusSchema.parse("published")).not.toThrow();
  });
  it("rejects unknown status", () => {
    expect(() => PostStatusSchema.parse("archived")).toThrow();
  });
});

describe("PostSchema", () => {
  const valid = {
    id: "p-001",
    title: "Hello World",
    slug: "hello-world",
    body: "First post body.",
    authorName: "Alice",
    status: "published" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  };
  it("accepts valid post", () => {
    expect(() => PostSchema.parse(valid)).not.toThrow();
  });
  it("accepts null publishedAt", () => {
    expect(() => PostSchema.parse({ ...valid, publishedAt: null })).not.toThrow();
  });
  it("rejects missing title", () => {
    const noTitle = { ...valid, title: undefined };
    expect(() => PostSchema.parse(noTitle)).toThrow();
  });
});

describe("CreatePostRequestSchema", () => {
  it("accepts valid create request", () => {
    expect(() =>
      CreatePostRequestSchema.parse({
        title: "Hello",
        slug: "hello",
        body: "Content here",
        authorName: "Bob",
      })
    ).not.toThrow();
  });
  it("rejects empty title", () => {
    expect(() =>
      CreatePostRequestSchema.parse({ title: "", slug: "x", body: "y", authorName: "z" })
    ).toThrow();
  });
});

describe("UpdatePostRequestSchema", () => {
  it("accepts partial update", () => {
    expect(() => UpdatePostRequestSchema.parse({ title: "New Title" })).not.toThrow();
  });
  it("accepts empty object", () => {
    expect(() => UpdatePostRequestSchema.parse({})).not.toThrow();
  });
});

describe("CreatePostCommentRequestSchema", () => {
  it("accepts valid comment", () => {
    expect(() =>
      CreatePostCommentRequestSchema.parse({ authorName: "Eve", body: "Great post!" })
    ).not.toThrow();
  });
  it("rejects empty authorName", () => {
    expect(() => CreatePostCommentRequestSchema.parse({ authorName: "", body: "x" })).toThrow();
  });
  it("rejects empty body", () => {
    expect(() => CreatePostCommentRequestSchema.parse({ authorName: "Eve", body: "" })).toThrow();
  });
});

describe("PostCommentSchema", () => {
  it("accepts valid comment", () => {
    expect(() =>
      PostCommentSchema.parse({
        id: "c-001",
        postId: "p-001",
        authorName: "Alice",
        body: "Nice post",
        createdAt: new Date().toISOString(),
      })
    ).not.toThrow();
  });
});
