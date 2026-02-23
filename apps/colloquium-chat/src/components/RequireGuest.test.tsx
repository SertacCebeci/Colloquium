import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

describe("RequireGuest guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects authenticated users away from /login to /w/new", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 1, email: "test@example.com", username: "testuser", displayName: null },
        }),
      })
    );

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      // After auth check, the login page should no longer be visible
      expect(
        screen.queryByRole("heading", { name: /sign in to colloquium/i })
      ).not.toBeInTheDocument();
    });
  });

  it("shows the login page for unauthenticated users", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      })
    );

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /sign in to colloquium/i })).toBeInTheDocument();
    });
  });
});
