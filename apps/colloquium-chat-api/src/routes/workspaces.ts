import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppDb } from "../db/index.js";
import { workspaces, workspaceMembers, channels, users } from "../db/schema.js";
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

  return router;
}
