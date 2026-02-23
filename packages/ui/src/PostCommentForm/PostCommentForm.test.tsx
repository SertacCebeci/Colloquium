import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PostCommentForm } from "./PostCommentForm";

describe("PostCommentForm", () => {
  it("renders author name and comment inputs", () => {
    render(<PostCommentForm onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/write a comment/i)).toBeInTheDocument();
  });

  it("submit button is disabled when fields are empty", () => {
    render(<PostCommentForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onSubmit with authorName and body", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PostCommentForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText(/write a comment/i), {
      target: { value: "Nice article!" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ authorName: "Alice", body: "Nice article!" });
    });
  });
});
