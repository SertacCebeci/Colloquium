import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PostForm } from "./PostForm";

describe("PostForm", () => {
  it("renders all form fields", () => {
    render(<PostForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
  });

  it("auto-generates slug from title", async () => {
    render(<PostForm onSubmit={vi.fn()} />);
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: "Hello World" } });
    const slugInput = screen.getByLabelText(/slug/i);
    await waitFor(() => {
      expect((slugInput as HTMLInputElement).value).toBe("hello-world");
    });
  });

  it("pre-fills fields from initialValues", () => {
    render(
      <PostForm
        initialValues={{ title: "My Post", authorName: "Bob", body: "Content", slug: "my-post" }}
        onSubmit={vi.fn()}
      />
    );
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("My Post");
    expect((screen.getByLabelText(/author/i) as HTMLInputElement).value).toBe("Bob");
  });

  it("calls onSubmit when button is clicked with all fields filled", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PostForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Test Title" } });
    fireEvent.change(screen.getByLabelText(/author/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: "Body text" } });

    fireEvent.click(screen.getByRole("button", { name: /publish post/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });
});
