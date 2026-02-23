import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

describe("WorkspaceCreatePage (/w/new)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockAuthenticated() {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: 1, email: "test@example.com", username: "testuser", displayName: null },
            }),
          });
        }
        if (url.includes("/api/workspaces") && opts?.method === "POST") {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({
              workspace: { id: 1, name: "Test Workspace", slug: "test-workspace", icon: "🚀" },
            }),
          });
        }
        if (url.includes("/api/workspaces")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ workspaces: [] }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      })
    );
  }

  it("shows the workspace creation form at /w/new when authenticated", async () => {
    mockAuthenticated();

    render(
      <MemoryRouter initialEntries={["/w/new"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /create.*workspace/i })).toBeInTheDocument();
    });
  });

  it("has a name input and an emoji picker", async () => {
    mockAuthenticated();

    render(
      <MemoryRouter initialEntries={["/w/new"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument();
    });

    // Emoji picker should show clickable emoji buttons
    const emojiButtons = screen.getAllByRole("button", { name: /select emoji/i });
    expect(emojiButtons.length).toBeGreaterThan(0);
  });

  it("submits the form and navigates to /w/:slug on success", async () => {
    mockAuthenticated();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/w/new"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/workspace name/i), "Test Workspace");
    await user.click(screen.getAllByRole("button", { name: /select emoji/i })[0]);
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(() => {
      // After successful creation, login form should not be visible
      // and workspace creation form should be gone (navigated away)
      expect(screen.queryByRole("heading", { name: /create.*workspace/i })).not.toBeInTheDocument();
    });
  });
});
