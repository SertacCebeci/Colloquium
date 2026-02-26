/**
 * E2E tests for feat-009: e2e-channel-feed-playwright
 * Critical path: messages load, send message, infinite scroll, feed error banner.
 * Requires uat-seed-server (port 5099) + Vite web app (port 5174) — started by playwright.config.ts webServer.
 */
import { test, expect } from "@playwright/test";
import { CHANNEL_URL, UAT_CHANNEL_ID } from "./fixtures";
import jwt from "jsonwebtoken";

// ── Critical path node 1: Messages load on page open ─────────────────────────

test("messages load on page open", async ({ page }) => {
  await page.goto(CHANNEL_URL);

  // Wait for at least one message to appear
  await expect(page.locator('[data-testid^="message-"]').first()).toBeVisible({
    timeout: 10_000,
  });

  // Error banner should NOT be visible
  await expect(page.getByTestId("error-banner")).not.toBeVisible();

  // At least 1 message rendered (uat-seed-server has 75, first page = 50)
  const messageCount = await page.locator('[data-testid^="message-"]').count();
  expect(messageCount).toBeGreaterThanOrEqual(1);
});

// ── Critical path node 2: Send a message ─────────────────────────────────────

test("send a message — message appears in feed", async ({ page }) => {
  await page.goto(CHANNEL_URL);

  // Wait for feed to load
  await expect(page.locator('[data-testid^="message-"]').first()).toBeVisible({
    timeout: 10_000,
  });

  const countBefore = await page.locator('[data-testid^="message-"]').count();

  // Type and submit
  await page.getByTestId("composer-input").fill("Hello E2E");
  await page.getByTestId("composer-send").click();

  // New message appears in list
  await expect(
    page.locator('[data-testid="message-content"]', { hasText: "Hello E2E" }).first()
  ).toBeVisible({ timeout: 5_000 });

  // Message count increased
  const countAfter = await page.locator('[data-testid^="message-"]').count();
  expect(countAfter).toBeGreaterThan(countBefore);

  // Textarea cleared after send
  await expect(page.getByTestId("composer-input")).toHaveValue("");
});

// ── Critical path node 3: Infinite scroll loads older messages ────────────────

test("infinite scroll loads older messages", async ({ page }) => {
  await page.goto(CHANNEL_URL);

  // Wait for initial 50 messages (first page from uat-seed-server)
  await expect(page.locator('[data-testid^="message-"]').first()).toBeVisible({
    timeout: 10_000,
  });

  // Count initial messages — should be 50 (uat-seed-server page size)
  await expect
    .poll(async () => page.locator('[data-testid^="message-"]').count(), {
      timeout: 5_000,
    })
    .toBeGreaterThanOrEqual(50);

  const countBefore = await page.locator('[data-testid^="message-"]').count();

  // Scroll sentinel into view to trigger LoadingMore
  await page.getByTestId("sentinel").scrollIntoViewIfNeeded();

  // Wait for total count to increase (25 more messages from page 2)
  await expect
    .poll(async () => page.locator('[data-testid^="message-"]').count(), {
      timeout: 10_000,
    })
    .toBeGreaterThan(countBefore);

  const countAfter = await page.locator('[data-testid^="message-"]').count();
  expect(countAfter).toBeGreaterThanOrEqual(75);
});

// ── Critical path node 4: Feed error banner on bad token ─────────────────────

test("feed error banner shows on bad token", async ({ page }) => {
  const badToken = jwt.sign({ sub: "unknown" }, "wrong-secret");
  await page.goto(`/channels/${UAT_CHANNEL_ID}?token=${badToken}`);

  // Error banner should appear
  await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });

  // Retry button present (feed error is retryable)
  await expect(page.getByTestId("retry-button")).toBeVisible();

  // Error message mentions Unauthorized
  await expect(page.getByTestId("error-message")).toHaveText(/Unauthorized/i);
});
