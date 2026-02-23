import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

describe("RequireAuth guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated users from /w/* to /login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      })
    );

    render(
      <MemoryRouter initialEntries={["/w/some-workspace"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /sign in to colloquium/i })).toBeInTheDocument();
    });
  });

  it("renders the protected route when user is authenticated", async () => {
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
      <MemoryRouter initialEntries={["/w/some-workspace"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      // The protected route content should be visible (not the login page)
      expect(
        screen.queryByRole("heading", { name: /sign in to colloquium/i })
      ).not.toBeInTheDocument();
    });
  });
});
