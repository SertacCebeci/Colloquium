import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostCommentThread } from "./PostCommentThread";
import type { PostComment } from "@colloquium/types";

const comments: PostComment[] = [
  {
    id: "c-001",
    postId: "p-001",
    authorName: "Eve",
    body: "Great post!",
    createdAt: new Date().toISOString(),
  },
];

describe("PostCommentThread", () => {
  it("renders comments", () => {
    render(<PostCommentThread comments={comments} />);
    expect(screen.getByText("Great post!")).toBeInTheDocument();
    expect(screen.getByText("Eve")).toBeInTheDocument();
  });
  it("shows empty state when no comments", () => {
    render(<PostCommentThread comments={[]} />);
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });
});
