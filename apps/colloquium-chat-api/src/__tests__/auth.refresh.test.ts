import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../db/index.js";
import { createApp } from "../app.js";

async function seedAndGetCookies(app: ReturnType<typeof createApp>) {
  await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "refresh@example.com",
      username: "refreshuser",
      password: "Pass123!",
    }),
  });

  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "refresh@example.com", password: "Pass123!" }),
  });

  const setCookieHeaders = loginRes.headers.getSetCookie?.() ?? [];
  const refreshCookie = setCookieHeaders.find((h) => h.startsWith("refresh_token="))?.split(";")[0];
  const accessCookie = setCookieHeaders.find((h) => h.startsWith("access_token="))?.split(";")[0];

  return { refreshCookie: refreshCookie ?? "", accessCookie: accessCookie ?? "" };
}

describe("Transparent token refresh via GET /api/auth/me", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
  });

  it("returns 200 and issues a new access_token when access_token is absent but refresh_token is valid", async () => {
    const { refreshCookie } = await seedAndGetCookies(app);

    // Send request with ONLY the refresh_token cookie (simulating expired access_token)
    const res = await app.request("/api/auth/me", {
      method: "GET",
      headers: { Cookie: refreshCookie },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user).toMatchObject({ email: "refresh@example.com" });
    expect(body.user).toHaveProperty("id");

    // Verify a new access_token cookie was issued
    const newCookies = res.headers.getSetCookie?.() ?? [];
    const newAccessCookie = newCookies.find((h) => h.startsWith("access_token="));
    expect(newAccessCookie).toBeDefined();
    expect(newAccessCookie).toMatch(/HttpOnly/i);
  });

  it("returns 401 when both access_token and refresh_token are absent", async () => {
    const res = await app.request("/api/auth/me", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when refresh_token is invalid", async () => {
    const res = await app.request("/api/auth/me", {
      method: "GET",
      headers: { Cookie: "refresh_token=not.a.valid.jwt" },
    });
    expect(res.status).toBe(401);
  });
});
