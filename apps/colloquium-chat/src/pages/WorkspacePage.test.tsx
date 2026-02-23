import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

const WORKSPACES = [
  { id: 1, name: "Alpha", slug: "alpha", icon: "🅰" },
  { id: 2, name: "Beta", slug: "beta", icon: "🅱" },
  { id: 3, name: "Gamma", slug: "gamma", icon: "🇬" },
];

const CHANNELS_BY_SLUG: Record<string, { id: number; name: string }[]> = {
  alpha: [
    { id: 10, name: "general" },
    { id: 11, name: "random" },
  ],
  beta: [
    { id: 20, name: "announcements" },
    { id: 21, name: "beta-feedback" },
  ],
  gamma: [{ id: 30, name: "main" }],
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user: { id: 1, email: "test@example.com", username: "testuser", displayName: null },
          }),
        });
      }
      // GET /api/workspaces/:slug/channels — must be checked before bare /api/workspaces
      const channelsMatch = url.match(/\/api\/workspaces\/([^/]+)\/channels/);
      if (channelsMatch) {
        const slug = channelsMatch[1];
        const channels = CHANNELS_BY_SLUG[slug] ?? [];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ channels }),
        });
      }
      // GET /api/workspaces (list)
      if (url.includes("/api/workspaces")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ workspaces: WORKSPACES }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    })
  );
}

describe("Workspace switcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows all 3 workspace icons in the rail when user belongs to 3 workspaces", async () => {
    mockFetch();
    render(
      <MemoryRouter initialEntries={["/w/alpha"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Gamma" })).toBeInTheDocument();
    });
  });

  it("clicking a workspace icon updates the channel sidebar to show that workspace's channels", async () => {
    mockFetch();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/w/alpha"]}>
        <App />
      </MemoryRouter>
    );

    // Wait for alpha's channels to appear
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "# general" })).toBeInTheDocument();
    });

    // Click on Beta workspace
    await user.click(screen.getByRole("link", { name: "Beta" }));

    // Channel sidebar should now show beta's channels
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "# announcements" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "# beta-feedback" })).toBeInTheDocument();
    });

    // Alpha's channels should no longer be visible
    expect(screen.queryByRole("link", { name: "# general" })).not.toBeInTheDocument();
  });
});
