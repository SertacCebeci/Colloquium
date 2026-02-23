import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PostCard } from "./PostCard";
import type { Post } from "@colloquium/types";

const mockPost: Post = {
  id: "p-001",
  title: "Test Post",
  slug: "test-post",
  body: "This is the post body with enough content to test truncation.",
  authorName: "Alice",
  status: "published",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
};

describe("PostCard", () => {
  it("renders post title", () => {
    render(<PostCard post={mockPost} onClick={vi.fn()} />);
    expect(screen.getByText("Test Post")).toBeInTheDocument();
  });
  it("renders author name", () => {
    render(<PostCard post={mockPost} onClick={vi.fn()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<PostCard post={mockPost} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("renders index number when provided", () => {
    render(<PostCard post={mockPost} index={1} onClick={vi.fn()} />);
    expect(screen.getByText("01")).toBeInTheDocument();
  });
});
