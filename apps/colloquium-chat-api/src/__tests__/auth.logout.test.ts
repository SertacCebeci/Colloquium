import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../db/index.js";
import { createApp } from "../app.js";

async function seedAndLogin(app: ReturnType<typeof createApp>) {
  await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "logout@example.com",
      username: "logoutuser",
      password: "Pass123!",
    }),
  });

  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "logout@example.com", password: "Pass123!" }),
  });

  const setCookieHeaders = loginRes.headers.getSetCookie?.() ?? [];
  const refreshCookie = setCookieHeaders.find((h) => h.startsWith("refresh_token="))?.split(";")[0];
  const accessCookie = setCookieHeaders.find((h) => h.startsWith("access_token="))?.split(";")[0];

  return {
    refreshCookie: refreshCookie ?? "",
    accessCookie: accessCookie ?? "",
    bothCookies: [accessCookie, refreshCookie].filter(Boolean).join("; "),
  };
}

describe("POST /api/auth/logout", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
  });

  it("returns 200 and clears both access_token and refresh_token cookies", async () => {
    const { bothCookies } = await seedAndLogin(app);

    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: bothCookies },
    });

    expect(res.status).toBe(200);

    const cleared = res.headers.getSetCookie?.() ?? [];
    const allCleared = cleared.join("; ");
    // Cookies should be cleared: Max-Age=0 or expires in the past
    expect(allCleared).toMatch(/access_token=/);
    expect(allCleared).toMatch(/refresh_token=/);
    expect(allCleared).toMatch(/Max-Age=0/i);
  });

  it("invalidates the refresh token so GET /api/auth/me returns 401 after logout", async () => {
    const { bothCookies, refreshCookie } = await seedAndLogin(app);

    // Step 2: logout
    await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: bothCookies },
    });

    // Step 4: try using the old refresh token — must return 401
    const meRes = await app.request("/api/auth/me", {
      method: "GET",
      headers: { Cookie: refreshCookie },
    });

    expect(meRes.status).toBe(401);
  });

  it("returns 200 even when called without cookies (already logged out)", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
  });
});
