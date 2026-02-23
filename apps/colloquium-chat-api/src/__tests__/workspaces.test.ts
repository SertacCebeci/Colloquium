import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../db/index.js";
import { createApp } from "../app.js";
import { workspaceInvites, workspaces, workspaceMembers } from "../db/schema.js";
import { eq } from "drizzle-orm";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.workspace.slug).toBe("my-cool-team");
  });

  it("strips special characters and normalises spaces", async () => {
    const res = await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "  Dev & Ops!  " }),
    });

    expect(res.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.workspace.slug).toBe("dev-ops");
  });
});

describe("GET /api/workspaces/:slug", () => {
  let app: ReturnType<typeof createApp>;
  let cookie: string;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
    cookie = await loginUser(app);
  });

  it("returns workspace with members list including creator as owner", async () => {
    await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Owner Test", icon: "🏆" }),
    });

    const res = await app.request("/api/workspaces/owner-test", { headers: { cookie } });

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.workspace).toBeDefined();
    expect(body.workspace.slug).toBe("owner-test");
    expect(body.members).toBeDefined();
    expect(body.members).toHaveLength(1);
    expect(body.members[0].role).toBe("owner");
    expect(body.members[0].username).toBe("ws");
  });

  it("returns 404 for unknown slug", async () => {
    const res = await app.request("/api/workspaces/does-not-exist", { headers: { cookie } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not a member", async () => {
    // Create workspace as User A
    await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Private Space", icon: "🔒" }),
    });

    // Log in as User B
    const cookieB = await loginUser(app, "other@example.com", "Pass123!");

    const res = await app.request("/api/workspaces/private-space", {
      headers: { cookie: cookieB },
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/workspaces/some-slug");
    expect(res.status).toBe(401);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.workspaces).toHaveLength(1);
    expect(body.workspaces[0].name).toBe("My Space");
  });

  it("returns empty list when user has no workspaces", async () => {
    const res = await app.request("/api/workspaces", { headers: { cookie } });

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.workspaces).toHaveLength(0);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/workspaces/:slug/invite", () => {
  let app: ReturnType<typeof createApp>;
  let db: ReturnType<typeof createDb>;
  let cookie: string;

  beforeEach(async () => {
    db = createDb(":memory:");
    app = createApp(db);
    cookie = await loginUser(app);
    // Create a workspace to invite into
    await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Invite Space", icon: "📨" }),
    });
  });

  it("returns a token string for a workspace member", async () => {
    const res = await app.request("/api/workspaces/invite-space/invite", {
      headers: { cookie },
    });

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });

  it("stores the invite in the database with a 24h expiry", async () => {
    const before = Date.now();

    const res = await app.request("/api/workspaces/invite-space/invite", {
      headers: { cookie },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    const { token } = body;

    const workspace = db.select().from(workspaces).where(eq(workspaces.slug, "invite-space")).get();

    const invite = db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.token, token))
      .get();

    expect(invite).toBeDefined();
    expect(invite!.workspaceId).toBe(workspace!.id);
    // expiresAt must be ~24h in the future (within a 1-second window)
    const expectedExpiry = before + 24 * 60 * 60 * 1000;
    expect(invite!.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
    expect(invite!.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/workspaces/invite-space/invite");
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a workspace member", async () => {
    const cookieB = await loginUser(app, "outsider@example.com", "Pass123!");
    const res = await app.request("/api/workspaces/invite-space/invite", {
      headers: { cookie: cookieB },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/workspaces/join/:token", () => {
  let app: ReturnType<typeof createApp>;
  let db: ReturnType<typeof createDb>;
  let cookieOwner: string;
  let token: string;

  beforeEach(async () => {
    db = createDb(":memory:");
    app = createApp(db);
    cookieOwner = await loginUser(app, "owner@example.com", "Pass123!");

    // Owner creates workspace
    await app.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieOwner },
      body: JSON.stringify({ name: "Join Test Space", icon: "🔗" }),
    });

    // Owner generates invite token
    const inviteRes = await app.request("/api/workspaces/join-test-space/invite", {
      headers: { cookie: cookieOwner },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    token = ((await inviteRes.json()) as any).token;
  });

  it("adds User B to the workspace as 'member' and returns 200", async () => {
    const cookieB = await loginUser(app, "userb@example.com", "Pass123!");

    const res = await app.request(`/api/workspaces/join/${token}`, {
      method: "POST",
      headers: { cookie: cookieB },
    });

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.workspace).toBeDefined();
    expect(body.workspace.slug).toBe("join-test-space");
  });

  it("User B appears in workspace_members with role 'member'", async () => {
    const cookieB = await loginUser(app, "userb2@example.com", "Pass123!");

    await app.request(`/api/workspaces/join/${token}`, {
      method: "POST",
      headers: { cookie: cookieB },
    });

    const workspace = db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, "join-test-space"))
      .get();

    // Get userId for userb2 from DB
    const members = db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspace!.id))
      .all();

    const newMember = members.find((m) => m.role === "member");
    expect(newMember).toBeDefined();
    expect(newMember!.role).toBe("member");
  });

  it("User B's workspace list includes the joined workspace", async () => {
    const cookieB = await loginUser(app, "userb3@example.com", "Pass123!");

    await app.request(`/api/workspaces/join/${token}`, {
      method: "POST",
      headers: { cookie: cookieB },
    });

    const listRes = await app.request("/api/workspaces", {
      headers: { cookie: cookieB },
    });

    expect(listRes.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await listRes.json()) as any;
    const joined = body.workspaces.find((w: { slug: string }) => w.slug === "join-test-space");
    expect(joined).toBeDefined();
  });

  it("returns 404 for a non-existent token", async () => {
    const cookieB = await loginUser(app, "userb4@example.com", "Pass123!");

    const res = await app.request("/api/workspaces/join/invalidtoken123", {
      method: "POST",
      headers: { cookie: cookieB },
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when user is already a member", async () => {
    const cookieB = await loginUser(app, "userb5@example.com", "Pass123!");

    // Join once
    await app.request(`/api/workspaces/join/${token}`, {
      method: "POST",
      headers: { cookie: cookieB },
    });

    // Join again — should conflict
    const res = await app.request(`/api/workspaces/join/${token}`, {
      method: "POST",
      headers: { cookie: cookieB },
    });

    expect(res.status).toBe(409);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.request(`/api/workspaces/join/${token}`, {
      method: "POST",
    });

    expect(res.status).toBe(401);
  });

  it("returns 410 for an expired invite token", async () => {
    // Manually expire the token in the DB
    db.update(workspaceInvites)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(workspaceInvites.token, token))
      .run();

    const cookieB = await loginUser(app, "userb6@example.com", "Pass123!");

    const res = await app.request(`/api/workspaces/join/${token}`, {
      method: "POST",
      headers: { cookie: cookieB },
    });

    expect(res.status).toBe(410);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.error).toBe("Invite link expired");
  });
});
