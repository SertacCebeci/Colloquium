import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../db/index.js";
import { createApp } from "../app.js";

// Helper: register + login, return cookie header string
async function loginUser(
  app: ReturnType<typeof createApp>,
  email = "ws@example.com",
  password = "Pass123!"
): Promise<string> {
  await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username: email.split("@")[0], password }),
  });

  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

describe("POST /api/workspaces", () => {
  let app: ReturnType<typeof createApp>;
  let cookie: string;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
    cookie = await loginUser(app);
  });

  it("creates a workspace and returns 201 with slug", async () => {
    const res = await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Test Workspace", icon: "🚀" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workspace.name).toBe("Test Workspace");
    expect(body.workspace.slug).toBe("test-workspace");
    expect(body.workspace.icon).toBe("🚀");
  });

  it("auto-creates a #general channel", async () => {
    await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Test Workspace", icon: "🚀" }),
    });

    const res = await app.request("/api/workspaces/test-workspace/channels", {
      headers: { cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const general = body.channels.find((ch: { name: string }) => ch.name === "general");
    expect(general).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Workspace", icon: "🚀" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const res = await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ icon: "🚀" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("Workspace slug generation", () => {
  let app: ReturnType<typeof createApp>;
  let cookie: string;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
    cookie = await loginUser(app);
  });

  it("converts 'My Cool Team' to slug 'my-cool-team'", async () => {
    const res = await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "My Cool Team", icon: "🎯" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workspace.slug).toBe("my-cool-team");
  });

  it("strips special characters and normalises spaces", async () => {
    const res = await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "  Dev & Ops!  " }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workspace.slug).toBe("dev-ops");
  });
});

describe("GET /api/workspaces", () => {
  let app: ReturnType<typeof createApp>;
  let cookie: string;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
    cookie = await loginUser(app);
  });

  it("lists workspaces the user belongs to", async () => {
    await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "My Space", icon: "🌍" }),
    });

    const res = await app.request("/api/workspaces", { headers: { cookie } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaces).toHaveLength(1);
    expect(body.workspaces[0].name).toBe("My Space");
  });

  it("returns empty list when user has no workspaces", async () => {
    const res = await app.request("/api/workspaces", { headers: { cookie } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaces).toHaveLength(0);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/workspaces");
    expect(res.status).toBe(401);
  });
});
