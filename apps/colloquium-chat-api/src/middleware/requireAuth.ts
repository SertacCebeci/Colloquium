import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export type AuthEnv = {
  Variables: {
    userId: number;
  };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, "access_token");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string | number };
    c.set("userId", Number(payload.sub));
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});
