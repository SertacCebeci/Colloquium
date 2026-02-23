import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import type { AppDb } from "../db/index.js";
import { workspaces, workspaceMembers, channels, users, workspaceInvites } from "../db/schema.js";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function workspaceRoutes(db: AppDb) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  router.post("/", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => null);

    if (!body?.name) {
      return c.json({ error: "name is required" }, 400);
    }

    const { name, icon } = body as { name: string; icon?: string };
    const slug = slugify(name);
    const now = Date.now();

    const [workspace] = db
      .insert(workspaces)
      .values({ name, slug, icon: icon ?? null, ownerId: userId, createdAt: now })
      .returning()
      .all();

    db.insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId, role: "owner", joinedAt: now })
      .run();

    db.insert(channels)
      .values({
        workspaceId: workspace.id,
        name: "general",
        createdBy: userId,
        createdAt: now,
      })
      .run();

    return c.json({ workspace }, 201);
  });

  router.get("/", async (c) => {
    const userId = c.get("userId");

    const rows = db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        icon: workspaces.icon,
        ownerId: workspaces.ownerId,
        createdAt: workspaces.createdAt,
      })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .all();

    return c.json({ workspaces: rows });
  });

  router.get("/:slug", async (c) => {
    const userId = c.get("userId");
    const slug = c.req.param("slug");

    const workspace = db.select().from(workspaces).where(eq(workspaces.slug, slug)).get();

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const membership = db
      .select()
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, userId))
      )
      .get();

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const members = db
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspace.id))
      .all();

    return c.json({ workspace, members });
  });

  router.get("/:slug/invite", async (c) => {
    const userId = c.get("userId");
    const slug = c.req.param("slug");

    const workspace = db.select().from(workspaces).where(eq(workspaces.slug, slug)).get();
    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const membership = db
      .select()
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, userId))
      )
      .get();
    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    db.insert(workspaceInvites)
      .values({ workspaceId: workspace.id, token, createdBy: userId, expiresAt })
      .run();

    return c.json({ token });
  });

  router.get("/:slug/channels", async (c) => {
    const userId = c.get("userId");
    const slug = c.req.param("slug");

    const workspace = db.select().from(workspaces).where(eq(workspaces.slug, slug)).get();

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const membership = db
      .select()
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, userId))
      )
      .get();

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const rows = db.select().from(channels).where(eq(channels.workspaceId, workspace.id)).all();

    return c.json({ channels: rows });
  });

  router.post("/join/:token", async (c) => {
    const userId = c.get("userId");
    const token = c.req.param("token");

    const invite = db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.token, token))
      .get();

    if (!invite) {
      return c.json({ error: "Invite not found" }, 404);
    }

    if (invite.expiresAt < Date.now()) {
      return c.json({ error: "Invite has expired" }, 410);
    }

    const existing = db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invite.workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .get();

    if (existing) {
      return c.json({ error: "Already a member" }, 409);
    }

    db.insert(workspaceMembers)
      .values({ workspaceId: invite.workspaceId, userId, role: "member", joinedAt: Date.now() })
      .run();

    const workspace = db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, invite.workspaceId))
      .get();

    return c.json({ workspace });
  });

  return router;
}
