# API Testing + Swagger Design

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Replace Playwright-only UAT with method-branched UAT; add @hono/zod-openapi to colloquium-api; update three SDLC skills

---

## Problem

`feature-verify` runs all UAT through Playwright MCP regardless of feature type. For
API-only features (type: aggregate, contract) this required spinning up a browser,
injecting `fetch()` calls via `browser_evaluate`, and working around CORS — costly,
fragile, and wrong-tool-for-the-job. Browser automation should be reserved for features
that actually have a browser surface.

Additionally, `colloquium-api` has no OpenAPI/Swagger coverage. Routes are defined with
plain `app.get()`, making the HTTP contract implicit rather than machine-readable.

---

## Design

### 1. One-time Swagger infra (`apps/colloquium-api`)

**Install:**

```
@hono/zod-openapi
@hono/swagger-ui
```

**Migrate `app.ts`:**

- Replace `new Hono()` with `new OpenAPIHono()`
- Migrate the existing `GET /channels/:channelId/messages` route to `createRoute()`
- Define Zod schemas for:
  - Path params: `{ channelId: z.string() }`
  - Query params: `{ before: z.string().optional(), limit: z.string().optional() }`
  - Response 200: `ChannelFeedPageSchema` (derived from existing `ChannelFeedPageV1`)
  - Responses 400/401/403/404: `{ error: z.string() }`
- Add endpoints:
  - `GET /api/openapi.json` — machine-readable OpenAPI 3.1 spec
  - `GET /api/docs` — Swagger UI (via `@hono/swagger-ui`)

`OpenAPIHono` is a drop-in replacement for `Hono` — existing tests, middleware, and
`createApp()` signature are unchanged.

---

### 2. UAT-method tag convention (spec files)

The "Test Strategy" section of every feature spec must include a `UAT-method` tag on the
UAT bullet. Three valid values:

| Tag                      | When to use                                                    |
| ------------------------ | -------------------------------------------------------------- |
| `UAT-method: api-curl`   | Feature has an HTTP endpoint; no browser surface at this stage |
| `UAT-method: playwright` | Feature has a browser-rendered UI surface                      |
| `UAT-method: test-suite` | Pure in-process feature (no HTTP, no UI)                       |

**Template:**

```markdown
- [ ] **E2E / UAT:** `UAT-method: api-curl`
      Start colloquium-api, send GET /channels/:channelId/messages with a valid Bearer JWT.
      Verify: 200 + correct ChannelFeedPage shape; messages descending; nextCursor non-null
      when >50 messages exist.
```

**Enforcement:** `feature-spec.md` rule — "The UAT bullet must include a `UAT-method:`
tag. If omitted, `feature-verify` will stop with an error."

**Backfill:** Existing specs for features with a written `uat.md` (all SL-001 features,
SL-002/feat-001) do not require backfilling — `feature-verify` only reads the tag for
features currently at C7.

---

### 3. `feature-verify.md` — UAT branching (Step 2)

After loading the spec, read the `UAT-method` tag. Hard-stop if missing.

#### Branch: `api-curl`

1. Check if `colloquium-api` is already running on port 5002 (or `$PORT`).
   - If not: start with `pnpm --filter @colloquium/colloquium-api dev` in background.
   - If a `uat-seed-server.ts` exists for the feature, use that instead (provides seeded
     test data; starts on port 5099 by convention).
2. Generate a test JWT: `node -e "console.log(require('jsonwebtoken').sign({sub:'uat-user'}, process.env.JWT_SECRET ?? 'dev-secret'))"`
3. Execute each UAT step from the spec as a `curl` command. Pipe output through `jq`.
4. Assert expected values by parsing JSON output with `node -e` or `python3 -c`.
5. Save each curl response to a file named `feat-<id>-step-<n>.json` as evidence.
6. Shut down any server started by this skill.
7. Log check: scan server stderr for `ERROR` / `FATAL` lines (no browser console).

#### Branch: `playwright`

Identical to the current Step 2 — Playwright MCP, screenshots, browser console log check.
No change.

#### Branch: `test-suite`

1. Run `pnpm --filter <derived-package> test --reporter=verbose`.
2. Assert exit code 0.
3. Save terminal output as evidence.
4. Log check: skipped (no server, no browser).

**Regression step (Step 4):**

- For previously completed features with `UAT-method: api-curl`: re-run their first curl
  step against the running server.
- For previously completed features with `UAT-method: playwright`: re-run their first
  Playwright step.
- For previously completed features with `UAT-method: test-suite`: re-run `vitest run`
  and confirm exit 0.

---

### 4. `feature-implement.md` — C5→C6 OpenAPI requirement

Add to the C5→C6 sub-step ("Adapter / HTTP wiring layer"), after the existing instruction
to write the Hono route handler:

> **OpenAPI requirement:** Every new HTTP route must be defined with `createRoute()` from
> `@hono/zod-openapi`. The definition must include Zod schemas for all path params, query
> params, request body (if applicable), and all response shapes (2xx and expected errors).
> If the app is not yet on `OpenAPIHono`, migrate it first — it is a drop-in replacement
> for `Hono`.

No other changes to `feature-implement`.

---

### 5. Continuation prompt safety

The current continuation prompt has `v1/SL-002/feat-001` at `F4`, next skill is
`/colloquium:feature-integrate`. That skill does not run UAT, does not read the
UAT-method tag, and does not touch `colloquium-api` source. It is unaffected.

The Swagger one-time infra work is the first task in the implementation plan. All
remaining features in SL-002 (feat-002 through feat-009) are at C0 — none are
mid-implementation. The continuation prompt is safe to run before or after this work.

---

## Files Changed

| File                                               | Change                                      |
| -------------------------------------------------- | ------------------------------------------- |
| `apps/colloquium-api/package.json`                 | Add `@hono/zod-openapi`, `@hono/swagger-ui` |
| `apps/colloquium-api/src/app.ts`                   | Migrate to `OpenAPIHono` + `createRoute()`  |
| `.claude/commands/colloquium/feature-verify.md`    | Step 2: three-way UAT branch                |
| `.claude/commands/colloquium/feature-spec.md`      | Add UAT-method tag rule to template         |
| `.claude/commands/colloquium/feature-implement.md` | Add OpenAPI requirement to C5→C6            |
