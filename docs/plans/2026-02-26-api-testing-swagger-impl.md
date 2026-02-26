# API Testing + Swagger Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Playwright-only UAT with a method-branched approach (api-curl / playwright / test-suite), add @hono/zod-openapi to colloquium-api, and update three SDLC skills.

**Architecture:** Five sequential tasks — infra first (Swagger), then skills. The Swagger migration is a drop-in (OpenAPIHono extends Hono); existing tests require zero changes. Skill edits are surgical text updates to three markdown files.

**Tech Stack:** @hono/zod-openapi, @hono/swagger-ui, Hono 4.x, pnpm workspaces, markdown skill files at `.claude/commands/colloquium/`

---

### Task 1: Install @hono/zod-openapi and @hono/swagger-ui

**Files:**

- Modify: `apps/colloquium-api/package.json`

**Step 1: Add packages**

```bash
pnpm --filter @colloquium/colloquium-api add @hono/zod-openapi @hono/swagger-ui
```

**Step 2: Verify existing tests still pass**

```bash
pnpm --filter @colloquium/colloquium-api test
```

Expected: `Tests 11 passed (11)`

**Step 3: Verify typecheck passes**

```bash
pnpm --filter @colloquium/colloquium-api typecheck
```

Expected: exit 0, no errors

**Step 4: Commit**

```bash
git add apps/colloquium-api/package.json pnpm-lock.yaml
git commit -m "feat(colloquium-api): install @hono/zod-openapi and @hono/swagger-ui"
```

---

### Task 2: Migrate app.ts to OpenAPIHono with typed route

**Files:**

- Modify: `apps/colloquium-api/src/app.ts`

**Step 1: Read the current file**

Read `apps/colloquium-api/src/app.ts` in full before touching it.

**Step 2: Replace the file contents**

The complete new `app.ts`:

```typescript
import "dotenv/config";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import jwt from "jsonwebtoken";
import {
  ChannelRepository,
  InMemoryChannelEventStore,
  handleGetChannelMessages,
  InvalidPayloadError,
  ChannelNotFoundError,
  ChannelAccessDeniedError,
} from "@colloquium/messaging";
import type { AppDb } from "./db/index.js";

// ── Zod schemas (kept in sync with @colloquium/messaging types) ───────────────

const MessageItemSchema = z.object({
  messageId: z.string(),
  authorId: z.string(),
  content: z.string(),
  sequenceNumber: z.number().int(),
  postedAt: z.string(),
});

const ChannelFeedPageSchema = z.object({
  messages: z.array(MessageItemSchema),
  nextCursor: z.string().nullable(),
});

const ErrorSchema = z.object({ error: z.string() });

// ── Route definition ──────────────────────────────────────────────────────────

const GetChannelMessagesRoute = createRoute({
  method: "get",
  path: "/channels/{channelId}/messages",
  request: {
    params: z.object({ channelId: z.string() }),
    query: z.object({
      before: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: ChannelFeedPageSchema } },
      description: "Paginated channel message feed",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Bad request (invalid limit or before param)",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Missing or invalid Bearer JWT",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Authenticated user is not a channel member",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Channel not found",
    },
  },
});

// ── App factory ───────────────────────────────────────────────────────────────

export function createApp(_db: AppDb, channelRepo?: ChannelRepository) {
  const app = new OpenAPIHono();
  const repo = channelRepo ?? new ChannelRepository(new InMemoryChannelEventStore());
  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
  if (!process.env.JWT_SECRET) {
    console.warn("[security] JWT_SECRET not set — using insecure dev-secret fallback");
  }

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5174",
      credentials: true,
    })
  );

  // Health check (plain route — no OpenAPI schema needed)
  app.get("/api/health", (c) => {
    return c.json({ status: "ok", service: "colloquium-api" });
  });

  // OpenAPI spec + Swagger UI
  app.doc("/api/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Colloquium API", version: "1.0.0" },
  });
  app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

  // GET /channels/:channelId/messages
  app.openapi(GetChannelMessagesRoute, (c) => {
    // JWT verification — returns 401 for missing or malformed tokens
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    let requesterId: string;
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, jwtSecret) as { sub?: string };
      if (!decoded.sub) throw new Error("Missing sub claim");
      requesterId = decoded.sub;
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { channelId } = c.req.valid("param");
    const { limit: limitStr, before: beforeStr } = c.req.valid("query");
    const limit = limitStr !== undefined ? Number(limitStr) : undefined;
    const before = beforeStr !== undefined ? Number(beforeStr) : undefined;

    try {
      const result = handleGetChannelMessages({ channelId, requesterId, limit, before }, repo);
      return c.json(result, 200);
    } catch (e) {
      if (e instanceof ChannelNotFoundError) return c.json({ error: "Channel not found" }, 404);
      if (e instanceof ChannelAccessDeniedError)
        return c.json({ error: "Channel not accessible" }, 403);
      if (e instanceof InvalidPayloadError) return c.json({ error: e.message }, 400);
      throw e;
    }
  });

  return app;
}

export default createApp;
```

**Step 3: Run existing integration tests — must still pass**

```bash
pnpm --filter @colloquium/colloquium-api test
```

Expected: `Tests 11 passed (11)` — exact same results as before the migration

**Step 4: Run typecheck**

```bash
pnpm --filter @colloquium/colloquium-api typecheck
```

Expected: exit 0

**Step 5: Smoke-test Swagger endpoints manually**

Start the server:

```bash
pnpm --filter @colloquium/colloquium-api dev &
sleep 2
curl -s http://localhost:5002/api/openapi.json | python3 -m json.tool | head -20
curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/docs
pkill -f "src/index.ts"
```

Expected: openapi.json prints valid JSON with `"openapi": "3.1.0"`; docs returns `200`

**Step 6: Commit**

```bash
git add apps/colloquium-api/src/app.ts
git commit -m "feat(colloquium-api): migrate to OpenAPIHono with typed createRoute for CT-004"
```

---

### Task 3: Update feature-spec.md — add UAT-method tag rule

**Files:**

- Modify: `.claude/commands/colloquium/feature-spec.md`

**Step 1: Read the current file in full**

**Step 2: Add an enforcement rule**

After the existing Rule 3 ("Failure modes must be real scenarios"), add Rule 4:

```markdown
4. **UAT-method tag required.** The UAT bullet in "Test Strategy" must carry a
   `UAT-method:` tag. Valid values: `api-curl`, `playwright`, `test-suite`. If omitted,
   `feature-verify` will stop with an error.
```

**Step 3: Update the spec template (Step 5 in feature-spec.md)**

Replace the E2E bullet in the Test Strategy block:

Old:

```markdown
- [ ] E2E: <what critical path E2E steps cover> _(omit if not a critical path node)_
```

New:

```markdown
- [ ] **E2E / UAT:** `UAT-method: <api-curl | playwright | test-suite>`
      <description of what the UAT step verifies>
      _(omit if this feature has no external surface and no UAT is needed)_
```

**Step 4: Update the banner (Step 7 in feature-spec.md)**

In the completion banner, add a UAT-method line under the Test Strategy display:

```
  UAT method:   <api-curl | playwright | test-suite>
```

**Step 5: Commit**

```bash
git add .claude/commands/colloquium/feature-spec.md
git commit -m "feat(sdlc): add UAT-method tag rule and template to feature-spec"
```

---

### Task 4: Update feature-verify.md — three-way UAT branch

**Files:**

- Modify: `.claude/commands/colloquium/feature-verify.md`

**Step 1: Read the current file in full**

**Step 2: Add a hard-stop rule for missing UAT-method tag**

After the existing Rule 2, add Rule 3 (before the Execution section):

```markdown
3. **UAT-method tag required.** Before executing Step 2, read the feature spec's "Test
   Strategy" section and extract the `UAT-method:` tag from the E2E / UAT bullet.

   Valid values: `api-curl`, `playwright`, `test-suite`.

   If the tag is missing, display:
```

❌ UAT-method tag missing from spec's Test Strategy section.

Add one of the following to the UAT bullet in docs/features/<BC>/<Aggregate>/spec.md:
UAT-method: api-curl (feature has an HTTP endpoint, no browser UI yet)
UAT-method: playwright (feature has a browser-rendered UI surface)
UAT-method: test-suite (pure in-process feature, no HTTP or UI surface)

```

Then stop.
```

**Step 3: Replace Step 2 entirely**

Replace the current "Step 2: UAT via Playwright MCP" section with:

````markdown
### Step 2: UAT — method determined by spec tag

Read `UAT-method` from the spec's Test Strategy section (extracted in Rule 3 check above).
Branch on the value:

---

#### Branch A: `UAT-method: api-curl`

**Goal:** Verify the HTTP endpoint contract via curl against a live server.

1. **Start server.** Check if `colloquium-api` is already running on port 5002
   (or `$PORT` env var):

   ```bash
   curl -s http://localhost:5002/api/health
   ```

   - If it responds: use the running server. Note: data is whatever is in the running
     instance — this only works for features whose UAT steps do not require specific
     seeded data.
   - If not running AND a `uat-seed-server.ts` exists at
     `apps/colloquium-api/src/uat-seed-server.ts`: start it instead (runs on port 5099
     by convention, seeds test data):
     ```bash
     pnpm --filter @colloquium/colloquium-api exec tsx src/uat-seed-server.ts &
     sleep 2
     ```
   - If not running AND no seed server: start the dev server:
     ```bash
     pnpm --filter @colloquium/colloquium-api dev &
     sleep 3
     ```
     Record which server was started (for shutdown in step 6).

2. **Generate test JWT** (only needed if seed server not used — seed server prints its own):

   ```bash
   node -e "const j=require('jsonwebtoken'); console.log(j.sign({sub:'uat-user'}, process.env.JWT_SECRET??'dev-secret'))"
   ```

3. **Execute each UAT step from the spec** as a `curl` command. For each step N:

   ```bash
   curl -s \
     -H "Authorization: Bearer <token>" \
     "http://localhost:<port>/channels/<channelId>/messages" \
     | tee feat-<id>-step-<n>.json | python3 -m json.tool
   ```

   Pipe through `python3 -m json.tool` for readable output.

4. **Assert** each expected value by parsing the saved JSON:

   ```bash
   python3 -c "
   import json, sys
   d = json.load(open('feat-<id>-step-<n>.json'))
   assert isinstance(d['messages'], list), 'messages must be array'
   assert 'nextCursor' in d, 'nextCursor must be present'
   print('PASS')
   "
   ```

   Record PASS or FAIL for each step.

5. **Evidence:** The saved `.json` files are the UAT evidence (replace screenshots).
   List them in `uat.md` under "Evidence Files" instead of "Screenshots".

6. **Shut down** any server started by this skill:

   ```bash
   pkill -f "uat-seed-server" 2>/dev/null || pkill -f "src/index.ts" 2>/dev/null || true
   ```

7. **Log check:** Scan server stderr output for `ERROR` or `FATAL` lines. If any new
   high-severity errors are found, follow the same flow as the original Step 3.

**Failure format** (same as original):

```
❌ UAT failed at step <n>
Feature: <feat-id> — <name>
Action:   <curl command>
Expected: <expected JSON shape or value>
Observed: <actual response>
```

On failure: do NOT write uat.md, set state to C6, display routing message, stop.

---

#### Branch B: `UAT-method: playwright`

Navigate the feature's critical path using Playwright MCP. For each step:

1. Perform the action described in the spec's UAT section
2. Take a screenshot immediately after, named `<feat-id>-step-<n>.png`
3. Assert the expected outcome is visible or present
4. Record the result (observed state vs. expected state)

Browser console log check applies (Step 3 below).

Failure format and routing: identical to original skill behaviour.

---

#### Branch C: `UAT-method: test-suite`

Pure in-process feature — no HTTP server, no browser needed.

1. Run the relevant test package:

   ```bash
   pnpm --filter <package-name> test --reporter=verbose
   ```

   Derive `<package-name>` from the feature's `bc` field (e.g., `bc: "Messaging"` →
   `@colloquium/messaging`).

2. Assert exit code 0.

3. Save terminal output to `feat-<id>-test-output.txt` as evidence.

4. **Log check: skipped** (no server, no browser).

Failure: if exit code is non-zero, set state to C6 and route back to feature-implement.
````

**Step 4: Update Step 3 (log check) to note it is skipped for test-suite**

In the existing Step 3 preamble, add:

```markdown
> This step applies to `api-curl` and `playwright` only. For `test-suite` features,
> skip to Step 4.
```

**Step 5: Update Step 4 (regression) to be method-aware**

Replace the regression loop instruction:

Old:

```
Re-run the first (most critical) step of that feature's UAT via Playwright MCP
```

New:

```
Re-run the first (most critical) step of that feature's UAT using the method recorded
in that feature's uat.md "UAT Method" field:
- `api-curl`: re-run the first curl step from that feature's uat.md against the running server
- `playwright`: re-run the first Playwright step
- `test-suite`: run `pnpm --filter <pkg> test` and confirm exit 0
```

**Step 6: Update the uat.md template**

In the uat.md template (Step 5), add a "UAT Method" field after Result/Date/Feature/Slice:

```markdown
**UAT Method:** api-curl | playwright | test-suite
```

And replace the "Screenshots" section heading with:

```markdown
## Evidence

_(For `api-curl`: list `.json` response files. For `playwright`: list `.png` screenshots.
For `test-suite`: list terminal output file.)_

- <feat-id>-step-<n>.json (or .png / -test-output.txt)
```

**Step 7: Commit**

```bash
git add .claude/commands/colloquium/feature-verify.md
git commit -m "feat(sdlc): branch feature-verify UAT on api-curl / playwright / test-suite"
```

---

### Task 5: Update feature-implement.md — OpenAPI requirement at C5→C6

**Files:**

- Modify: `.claude/commands/colloquium/feature-implement.md`

**Step 1: Read the current file in full**

**Step 2: Add the OpenAPI requirement**

In the "Sub-step C5 → C6: Adapters + Read Model" section, after Action 2 ("HTTP handler / controller"), add:

```markdown
> **OpenAPI requirement:** Every new HTTP route must be defined with `createRoute()`
> from `@hono/zod-openapi`, not with `app.get/post/put/delete()` directly.
> The `createRoute()` definition must include Zod schemas for:
>
> - All path params and query params
> - Request body (if applicable)
> - All response shapes: 2xx success and each expected error (400, 401, 403, 404, etc.)
>
> If the app file still uses `new Hono()`, replace it with `new OpenAPIHono()` first —
> it is a drop-in replacement. Verify existing tests pass after the swap.
```

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/feature-implement.md
git commit -m "feat(sdlc): require createRoute() for all new HTTP routes at C5→C6"
```

---

### Task 6: Verify end-to-end and update continuation prompt

**Step 1: Run the full monorepo typecheck**

```bash
pnpm turbo typecheck
```

Expected: all packages pass

**Step 2: Run the full test suite**

```bash
pnpm turbo test
```

Expected: all packages pass (colloquium-api still 11/11)

**Step 3: Confirm Swagger UI is reachable**

```bash
pnpm --filter @colloquium/colloquium-api dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5002/api/docs
curl -s http://localhost:5002/api/openapi.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('paths:', list(d['paths'].keys()))"
pkill -f "src/index.ts"
```

Expected:

- `/api/docs` → `200`
- openapi.json paths → `['/channels/{channelId}/messages']`

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify api-testing + swagger implementation complete"
```

---

## Continuation Prompt Safety

The current continuation prompt has `v1/SL-002/feat-001` at `F4`. The next skill is
`/colloquium:feature-integrate`, which does not read the spec's UAT-method tag and
does not run UAT. It is safe to run the continuation prompt before, during, or after
this implementation plan.

After this plan is complete, the next feature to go through `feature-verify` will be
`feat-002` (message-composer-aggregate). Its spec does not exist yet — it will be
written by `feature-spec`, which will now emit a `UAT-method` tag per the updated
template.
