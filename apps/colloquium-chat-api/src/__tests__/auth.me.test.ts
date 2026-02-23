import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../db/index.js";
import { createApp } from "../app.js";

async function seedAndLogin(app: ReturnType<typeof createApp>) {
  await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "me@example.com",
      username: "meuser",
      password: "Pass123!",
    }),
  });

  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "me@example.com", password: "Pass123!" }),
  });

  const setCookieHeaders = loginRes.headers.getSetCookie?.() ?? [];
  const accessCookie = setCookieHeaders.find((h) => h.startsWith("access_token="));
  const accessToken = accessCookie?.split(";")[0]; // "access_token=<value>"
  return accessToken ?? "";
}

describe("GET /api/auth/me", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
  });

  it("returns 200 with user id, email, username, displayName when access_token cookie is valid", async () => {
    const accessCookie = await seedAndLogin(app);

    const res = await app.request("/api/auth/me", {
      method: "GET",
      headers: { Cookie: accessCookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({
      email: "me@example.com",
      username: "meuser",
    });
    expect(body.user).toHaveProperty("id");
    expect(body.user).toHaveProperty("displayName");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 when no cookie is present", async () => {
    const res = await app.request("/api/auth/me", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when access_token cookie is invalid", async () => {
    const res = await app.request("/api/auth/me", {
      method: "GET",
      headers: { Cookie: "access_token=not.a.valid.jwt" },
    });
    expect(res.status).toBe(401);
  });
});
