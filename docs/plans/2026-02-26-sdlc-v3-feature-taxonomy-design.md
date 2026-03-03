# SDLC v3 — Feature Taxonomy and Specialized Loops

**Status:** v9, 2026-03-03. Full revision history in git (`git log --oneline -- docs/plans/2026-02-26-sdlc-v3-feature-taxonomy-design.md`).
**Supersedes:** Loop section of `2026-02-26-multi-track-sdlc-redesign.md`.

---

## Problem Statement

The current SDLC has three feature types: `aggregate`, `contract`, `read-model`. All three run
through the same C2→C7 loop with 8 state transitions and a mandatory spec.md.

SL-002 produced 9 features. 6 were `read-model` features that were actually:

- 4 React hooks
- 1 assembled page component (ChannelFeedPage)
- 1 Playwright E2E suite

Each went through "domain tests RED/GREEN" — inapplicable to hooks or page assembly. Each produced
a 100–200 line spec.md that added zero implementation value. ChannelFeedPage was delivered as raw
unstyled HTML because the C-loop has no design step.

**Root causes:**

1. `read-model` was a catch-all for everything that isn't an aggregate or route handler
2. No design step exists for UI components
3. API tests ran through Playwright instead of `app.request()`
4. Loop variants (event-handler ACL, projection, migration prerequisite) made loops non-invariant
5. spec.md written for every feature regardless of value

**v6 over-correction (identified by adversarial review):**

v6 proposed 12 types with 12 loops. The review found that structurally identical loops (V≈S,
A≈E, R≈Q, F≈H) doubled the feature count per slice without proportional benefit. v7
consolidates to 7 types with variant fields, preserving type-appropriate behavior while
halving the maintenance surface.

**Realistic feature count per slice:**

A minimal slice (1 aggregate, 1 page): ~8 features. A typical slice (1-2 aggregates, 2-3
endpoints, 1 page): **12-18 features**. This is higher than v2's 9 features per slice because
v2 bundled domain + repository + handler + E2E into a single C-loop pass. v3 separates them
into dedicated loops. The tradeoff: each feature is faster (simpler loop), but there are more
features. Total wall-clock time should decrease because trivial features (primitives,
api-clients) complete in minutes, not the 30+ minutes a misapplied C-loop took in v2.

Under 12-type v6, the same slice would produce ~24+ features — v7's variant consolidation
halves that back to a manageable range.

---

## Solution: 7-Type Taxonomy with Variants

**Design principle:** one type = one loop. Structurally identical loops are merged into a single
type with a `variant` field that captures the differences (test tool, spec format, review
requirements). The variant field creates controlled branching points within a loop — not the
unbounded branching of the old 3-type system, but specific, documented differences at specific
states.

**Exception — D-loop page variant uses verification-first, not test-first.** All other loops
follow TDD: tests are written first and must FAIL before implementation. The D-loop page variant
is assembly-first because page implementation is pure wiring of already-tested hooks and
components — there is no meaningful "failing state" for import-and-compose. D2 tests verify
that the assembly is correct, they don't drive it. This is the only loop variant that deviates
from TDD and the deviation is intentional.

### Naming Convention

`{domain}:{type}:{kebab-name}`

**Variant is NOT part of the name.** The variant is stored in `state.json` only and determines
behavior within the loop. The naming convention uses the type, not the variant.

Examples:

```
core:aggregate:channel
core:primitive:channel-id
core:primitive:channel-access-service
backend:migration:add-message-table
backend:handler:get-channel-messages
backend:handler:channel-message-received
backend:persistence:channel-repository
backend:persistence:channel-feed-view
frontend:client:channels-api
frontend:client:use-channel-feed
frontend:visual:message-item
frontend:visual:channel-feed-page
```

### Taxonomy

| Type                  | Loop   | Variants                   | Package location                           | Covers                                                   |
| --------------------- | ------ | -------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `core:aggregate`      | C-loop | —                          | `packages/<bc-name>/`                      | Aggregates only                                          |
| `core:primitive`      | L-loop | `value-object`, `service`  | `packages/<bc-name>/` or `packages/utils/` | Value objects, policies, specifications, domain services |
| `backend:migration`   | M-loop | —                          | `apps/colloquium-api/prisma/`              | Prisma schema migrations                                 |
| `backend:handler`     | A-loop | `api`, `event`             | `apps/colloquium-api/`                     | REST endpoints + domain event ACL handlers               |
| `backend:persistence` | R-loop | `repository`, `projection` | `apps/colloquium-api/`                     | Prisma command-side repos + query-side projections       |
| `frontend:client`     | F-loop | `api-client`, `hook`       | `apps/*/src/api/` or `apps/*/src/hooks/`   | Typed fetch wrappers + React hooks                       |
| `frontend:visual`     | D-loop | `component`, `page`        | `packages/ui/` or `apps/*/src/pages/`      | UI components (visual gate) + assembled pages (E2E)      |

### Client Location Rule

All `frontend:client` features live in `apps/`. The `feature.app` field (set by `slice-deliver`)
resolves the `*` wildcard to a concrete app directory:

- `api-client` variant: `apps/${feature.app}/src/api/<name>.ts`
- `hook` variant: `apps/${feature.app}/src/hooks/use<Name>.ts`

**No hooks in `packages/ui/src/hooks/` during initial development.** This eliminates the
prediction problem (will this hook need API access?) that made the v6 split rule fragile.
Components in `packages/ui` receive data via props, not by importing hooks.

If a hook proves genuinely reusable with zero app dependencies after battle-testing across
2+ slices, extract to `packages/ui` as a follow-up. But the default is always `apps/`.

### Ordering Rule

`slice-deliver` assigns a default ordering using **dependency-first, type-precedence as
tiebreaker**:

1. **Primary sort: topological order by `dependencies` array.** Features with no dependencies
   come first. Features that depend on other features come after their dependencies.
2. **Tiebreaker: type-precedence chain.** Among features with identical dependency depth, sort
   by this chain:

```
core:primitive → core:aggregate
  → backend:migration → backend:persistence
  → backend:handler
  → frontend:client → frontend:visual
```

3. **Secondary tiebreaker: alphabetical by BC name.**

This ensures a `backend:handler` with zero persistence dependencies is NOT blocked behind
unrelated `backend:persistence` features. The type-precedence chain is a sensible default that
matches most dependency graphs naturally, but it does NOT override explicit dependency
information.

**This is sequential. `activeFeature` is a single pointer — features execute one at a time.
No concurrent feature execution at this stage. The pointer advances only when the current
feature reaches `done` — there is no start-gate.**

**Why sequential — cost tradeoff acknowledged:** A single-pointer model means independent
features (e.g., two `frontend:visual` components with no shared dependencies) cannot execute
in parallel even when both are eligible. This is a deliberate tradeoff:

- **Pro:** Zero coordination complexity. No merge conflicts from parallel feature branches.
  Quality gates run against a known-good codebase. State.json has exactly one cursor.
- **Con:** Throughput ceiling. A slice with 18 features executes ~18 sessions serially.
- **Future escape hatch:** If this becomes a bottleneck, the design can be extended to allow
  2–3 concurrent `activeFeature` pointers for features with disjoint file sets. This is NOT
  planned for v3 — complexity vs. benefit doesn't justify it yet.

**Cycle detection (mandatory):** After computing topological order, `slice-deliver` MUST verify
the dependency graph is acyclic. If a cycle is detected (topological sort fails to include all
features), `slice-deliver` must:

1. Report the cycle: "Dependency cycle detected: feat-X → feat-Y → feat-Z → feat-X"
2. Ask the user which dependency edge to remove (AskUserQuestion listing the cycle edges)
3. Re-run topological sort after the user's choice
   Do NOT silently drop edges or guess. A cycle means the decomposition is wrong.

**Queue scanner dependency check (mandatory):** The queue scanner finds the next feature as:
the first feature (in topological-then-type-precedence order) whose state equals the
type-appropriate initial state **AND all entries in its `dependencies` array exist in
`completedFeatures`**.

### Queue Advance Algorithm (Canonical — Single Source of Truth)

**Three code paths write `done` and advance the queue:** `feature-integrate` (most types),
the L-loop (core:primitive), and the F-loop (frontend:client api-client variant). All three
MUST use this identical algorithm. Do NOT duplicate or reimplement — reference this section.

```
1. Write feature.state = "done".
2. Append `${sliceId}/${featureId}` to completedFeatures (idempotent — skip if present).
3. Scan featureOrder in topological-then-type-precedence order:
   a. Skip features with state ≠ type-appropriate initial state.
   b. Skip features whose history contains { type: "removed" }.
   c. Skip features whose dependencies are NOT all in completedFeatures.
   d. First passing feature: set activeFeature = "versionId/sliceId/featureId". Done.
4. If no feature found at initial state, scan for paused features
   (feature.paused = true AND all dependencies in completedFeatures).
   Offer via AskUserQuestion: "Paused feature <feat-id> is eligible. Resume or skip?"
   On resume: set paused = false, set activeFeature. Feature continues from current state.
5. If no feature found at all: set activeFeature = null. Queue exhausted.
   Display: "All features complete for <sliceId>. Next: /colloquium:slice-validate."
```

**Implementation rule:** `feature-integrate`, the L-loop's done-write step, and the F-loop's
api-client done-write step must each reference "Queue Advance Algorithm" from this design doc.
If the algorithm changes, all three locations update by reference, not by copy.

**Cross-slice dependencies:** `completedFeatures` is version-scoped, so features from prior
slices are visible. When `slice-deliver` generates features for SL-003 that depend on SL-002
artifacts, it adds `"SL-002/feat-001"` (scoped format) to the `dependencies` array. The
decomposition rules must check `completedFeatures` for prior-slice artifacts when determining
dependencies. If a dependency from a prior slice is NOT in `completedFeatures` (the prior
slice wasn't completed), `slice-deliver` must warn: "Cross-slice dependency SL-002/feat-001
is not in completedFeatures — ensure SL-002 is delivered first."

---

## Loop Designs

### Cross-Loop Quality Gate

Two tiers. Which tier runs depends on whether the state advance is mid-loop or loop-complete.

**Light gate (mid-loop state advances):**

1. `pnpm turbo typecheck` — zero TypeScript errors
2. `pnpm turbo lint` — zero new ESLint warnings in modified files
3. Tests in the affected package only — `pnpm --filter <affected-package> test`

**Full gate (loop-complete state advances only — L3→done, M4, A4, R5, F3→done(api-client), F4, D4, C7):**

1. `pnpm turbo typecheck` — zero TypeScript errors
2. `pnpm turbo lint` — zero new ESLint warnings in modified files
3. All tests across all packages — `pnpm turbo test`
4. **Regression check (if Playwright E2E tests exist):** Re-run all existing Playwright E2E
   tests. If any fail, the current feature broke a previously verified user path. Stop and fix
   before advancing. This ensures non-aggregate features (handlers, persistence, clients) that
   modify backend behavior are caught immediately — not deferred to the next aggregate's
   `feature-verify` pass.

**Regression scope by type:**

- `core:primitive`, `frontend:client` (api-client): Skip E2E regression (pure/typed, zero
  user-facing impact). `pnpm turbo test` is sufficient.
- All other types: Run E2E regression at full gate if any `*.spec.ts` Playwright files exist
  under `apps/*/e2e/` or `apps/*/tests/`.

**Exception — L-loop (core:primitive) skips mid-loop light gates.** For a 5-line branded type,
running 45-90 seconds of CI per gate × 3 gates is disproportionate. Pure functions have zero
side effects — typecheck catches type errors, and the full gate at L3→done catches cross-package
regressions. The `service` variant still runs the full gate at loop-complete.

### Test DB Availability Check

Required by M-loop and R-loop before activation. Use this exact command:

```bash
cd apps/colloquium-api && pnpm prisma db execute --stdin <<< "SELECT 1" 2>/dev/null && echo "DB OK" || echo "DB UNAVAILABLE"
```

If the command outputs "DB UNAVAILABLE", display: "Test DB is not running — start it before
activating this feature." and block the loop from proceeding.

### Cross-Loop Stuck Handling

Every sub-skill must support the `stuck` escape hatch at every human checkpoint and quality
gate failure.

**Trigger mechanism:** At every human checkpoint or quality gate failure, include an
"I'm stuck" option in the AskUserQuestion alongside the normal options (e.g., "confirmed",
"fix: description"). Do NOT rely on free-text pattern matching like `stuck: <reason>` —
use structured AskUserQuestion options only. When the user selects "I'm stuck", ask a
follow-up: "Briefly describe the reason:" (free-text input is acceptable for the reason
AFTER the structured trigger).

**When `stuck` is triggered:**

1. Record a history entry: `{ type: "stuck", reason: "<reason>", state: "<current-state>" }`
2. Ask the user via AskUserQuestion:
   - **"Rollback"** — reset the feature to its initial loop state. Delete all artifacts.
   - **"Remove"** — mark the feature as removed. Skipped by queue scanner.
   - **"Reclassify"** — the feature's type was wrong. Before executing: list all files that
     will be deleted (loop artifacts from old type) and ask "These files will be deleted.
     Proceed?" Mid-loop reclassification always resets to the new loop's initial state. All
     artifacts from the old loop are deleted. The `--migrate-v3` mapping tables are for legacy
     C-state migration only and do NOT apply here.
   - **"Pause"** — leave at current state. Add `feature.paused = true`. Advance `activeFeature`
     to next feature.
3. Update state.json. Display: "Feature <feat-id> marked as <choice>. Run /colloquium:sdlc."

**Resuming paused features:** The queue scanner checks for paused features AFTER exhausting all
initial-state features. Scan order: (1) features at initial state with met dependencies (normal),
(2) features with `paused = true` and met dependencies (offered to user via AskUserQuestion:
"Paused feature <feat-id> is eligible. Resume or skip?"). On resume: set `paused = false`,
set `activeFeature` to the paused feature. The feature continues from its current state —
no reset.

Alternatively, the user can force-resume at any time by running `/colloquium:sdlc --resume <feat-id>`,
which sets `activeFeature` to the named feature (must exist and not be `done` or `removed`)
and clears `paused` if set. **`--resume` MUST also update `activeSlice`** to match the
resumed feature's slice (derive from the feature's path: `versionId/sliceId`). Without this,
`activeSlice` and `activeFeature` become inconsistent and cursor resolution breaks in every
skill that reads `activeSlice` to find `currentSlice`.

---

### `core:primitive` — L-loop

Pure domain primitives (value objects, policies, specifications) and stateless domain services.
**No spec.md.** The type/function signature with JSDoc IS the documentation.

**Variants:**

- `value-object`: pure tests (zero mocks), no code review, eligible for batching
- `service`: mocked tests (vi.fn()), code review at L3, not eligible for batching

**Batching (value-object variant only):** `slice-deliver` groups multiple related value objects
into a single `core:primitive` feature with an `items` array. The L-loop processes each item
in the bundle sequentially (L1→L3 per item), running one quality gate at the end. A slice with
4 value objects creates 1 feature (1 L-loop cycle) instead of 4 separate features (4 cycles).
Domain services are never batched — they have injected dependencies and need individual review.

```
L0 → queued
L1 → JSDoc/interface template approved (feature-spec displayed the template; no file written)
     - value-object: validation rules, equality semantics
     - service: method signatures, injected typed interfaces
L2 → signature + tests written in source file:
     - value-object: branded type + factory + pure tests (zero mocks, zero framework imports)
       Valid construction, invalid construction, equality semantics. All must FAIL.
     - service: TypeScript interface + mocked unit tests (vi.fn()).
       One test per method, test behavior given mocked deps. All must FAIL.
L3 → implementation complete + exported from package index:
     - value-object: implement, run tests (all PASS), export. No code review.
     - service: implement, run tests (all PASS), export. Code review:
       All dependencies injected? Stateless? No hidden I/O?
       (Code review failure → fix in-place at L3, re-run quality gate, re-request review.)
     Full quality gate runs at end of L3. On pass: L-loop writes "done" directly
     (skips feature-integrate). Trivial types have no integration concerns.
     There is NO L4 state code. L3 → (full gate) → done is atomic from the state machine's
     perspective. The full gate at loop-complete is gated by L3's quality check.
```

**Package prerequisite:** If `packages/<bc-name>/` does not exist yet (first core feature in a
new BC), create the package scaffold before L2: `package.json`, `tsconfig.json`, `src/index.ts`.

State writes: L0 activation, L1 (by feature-spec), L2 (signature + tests), L3 (implementation),
done (written by L-loop directly from L3, NOT by feature-integrate). Four writes per feature.

**Batched features:** For bundles, L1 is approved for the entire bundle. L2→L3 repeat per item.
During L1→L2: after writing each item's signature + tests, set `item.status = "tested"`.
During L2→L3: after implementing each item, set `item.status = "done"`.
On session resume, skip items already at the current phase's target status and continue from
the first item that hasn't reached it. This enables crash recovery in BOTH phases.
Full quality gate runs once after all items complete, then L-loop writes `done` directly.

---

### `core:aggregate` — C-loop (REVISED for v3)

The C-loop retains its structure but **C6 is redefined**. In v2, C6 built adapters (repository,
HTTP handler, projection) inline. In v3, those adapters are separate feature types with their own
loops (R-loop, A-loop). C6 now covers **aggregate-internal wiring only**.

```
C0 → queued
C2 → spec written (state machine, invariants, commands, events, failure modes, external contracts)
C3 → domain tests RED (pure TypeScript — if any test passes, the test is wrong)
C4 → domain GREEN + code review
C5 → contract tests (skip to C6 if no external contracts)
C6 → aggregate-internal wiring (concrete deliverables checklist):
     1. Domain event type files: one TypeScript type per event the aggregate emits,
        at `packages/<bc>/src/events/<EventName>.ts`, exported from package index.
        Deliverable: type file exists + exported. Skip if aggregate emits zero events.
     2. Port interfaces: TypeScript interfaces for each external dependency the aggregate
        needs (e.g., `ChannelRepository`, `EventPublisher`). These are INTERFACES in the
        domain package — NOT implementations. Implementations live in R-loop/A-loop.
        Deliverable: interface file exists + exported. Skip if aggregate has zero ports.
     3. Aggregate factory or builder: if the aggregate requires multi-step construction,
        create a factory function. Deliverable: factory exported. Skip if constructor is
        sufficient (most aggregates).
     - If ALL three items are skipped (aggregate emits no events, has no ports, needs no
       factory): advance directly from C5 to C7. Record history:
       `{ type: "c6-skip", reason: "no events, no ports, no factory" }`.
     - NOT: repository implementation (R-loop), HTTP handler (A-loop), projection (R-loop).
C7 → journey check (Playwright E2E if critical path node)
done → integrated (via feature-verify → UV → feature-integrate)
```

State writes: C0, C2 (feature-spec), C3, C4, C5, C6, C7. Seven writes. `done` written by
feature-integrate after feature-verify (C7 → UV → done).

---

### `backend:migration` — M-loop

Prisma schema migrations. Deployment risk, rollback consequence, ordering constraint.
**No new tests written for the migration itself.** Correctness is verified manually against a
real test DB.
**Hard prerequisite:** test DB must be running. Block M0 activation if absent.

```
M0 → queued (test DB running check — if absent, block)
M1 → Prisma schema.prisma updated + rollback path documented
M2 → Migration file generated: `prisma migrate dev --name <kebab-name> --create-only`
     Review generated SQL (additive only, no data loss, no irreversible ops without sign-off)
M3 → Migration deployed to test DB: `prisma migrate deploy`
     Verify schema, write rollback SQL to docs/migrations/rollbacks/<name>-rollback.sql
M4 → migration verified (loop-complete — feature-integrate transitions to done)
```

**Deadlock escape:** If the migration breaks an existing test (detected by the quality gate at
M4), the failing test belongs to a different feature's loop (e.g., R-loop's integration tests).
Do NOT try to fix the test inside the M-loop. Instead:

1. Record a history entry: `{ type: "test-breakage", details: "<which test, which package>" }`
2. Check whether the owning feature is **ahead** in the queue (not yet activated) or **behind**
   (already at `done`).
   - **Ahead (not yet done):** The owning feature will fix the test when its loop activates.
     Advance to M4 with the history entry. No further action needed.
   - **Behind (already done):** The owning feature's loop will never re-activate. The fix is
     a **direct commit** (see Out-of-Scope Work table): fix the broken test in-place, run the
     full quality gate (`pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm turbo test`), commit
     with message `fix(test): update <test-name> for migration <migration-name>`. No feature
     entry created — test-only fixes are infrastructure, not domain behavior. Record the direct
     commit SHA in the migration feature's history:
     `{ type: "test-fix-commit", sha: "<commit>", brokenTest: "<test>" }`.
3. Advance the migration to M4. The M-loop's responsibility is schema correctness, not
   fixing downstream test consumers — but it MUST ensure someone is responsible.

State writes: M0, M1 (feature-spec), M2, M3, M4. Five writes. `done` by feature-integrate.

---

### Test DB Lifecycle (M-loop prerequisite)

The M-loop's M0 check (`prisma db execute --stdin <<< "SELECT 1"`) requires a running test DB.
This section documents the expected lifecycle so the M-loop doesn't silently stall.

**Start:** `docker compose up -d db` (or equivalent from project's `docker-compose.yml`).
The M-loop does NOT start the DB — it only checks. If absent, M0 blocks with a clear message:
"Test DB not running. Start it with `docker compose up -d db` and re-run /colloquium:sdlc."

**Reset between slices:** `prisma migrate reset --force` drops and recreates. Run this between
slices if the test DB accumulated drift from manual testing. This is optional — Prisma tracks
migration state, so `migrate deploy` is idempotent.

**Teardown:** `docker compose down` after session. Not automated — the SDLC does not manage
Docker lifecycle. If the user forgets, subsequent M0 checks will remind them.

**CI/CD note:** In CI, the test DB is ephemeral (spun up per pipeline). This lifecycle section
applies to local development only.

---

### `backend:handler` — A-loop

REST handlers AND domain event ACL handlers.
**Tests via `app.request()` for API variant, direct handler call for event variant.**
**Playwright never tests API or event handler behavior.**

**Variants:**

- `api`: REST endpoint. Tests via Hono `app.request()`. Spec includes endpoint path, Zod schemas.
- `event`: Domain event handler. Tests via direct function call. Spec references CT-NNN document.

```
A0 → queued
A1 → spec written (table format, max 50 lines):
     - api: endpoint path + method, Zod request/response, auth, error mapping
     - event: event name, CT-NNN reference (file MUST exist), consumed Zod schema, command produced
     If spec exceeds 50 lines: the endpoint is doing too much — split the ENDPOINT, not just the
     feature. Use shared Zod type references instead of inlining schemas to compress.
A2 → tests written:
     - api: one test per error mapping row + happy path + missing auth. app.request(). All FAIL.
     - event: schema-rejection test + happy-path test. Direct handler call. All FAIL.
       Before writing tests: verify consumed Zod schema matches CT-NNN line by line.
A3 → handler implemented + quality gate:
     - api: OpenAPIHono createRoute, auth extraction, Zod validation, error mapping per spec.
     - event: Zod parse of incoming payload, domain command if valid, reject if invalid.
A4 → code review complete (loop-complete — feature-integrate transitions to done):
     - api: auth before domain call? error mapping rows covered? N+1? OpenAPI schema matches?
     - event: CT-NNN schema validated? invalid payload behavior matches spec? N+1?
```

State writes: A0, A1 (feature-spec), A2, A3, A4. Five writes. `done` by feature-integrate.

---

### `backend:persistence` — R-loop

Prisma command-side repositories AND query-side projections.
**TypeScript interface IS the spec — no spec.md.**
**Hard prerequisite:** test DB must be running. Block R0 activation if absent.

**Variants:**

- `repository`: command-side CRUD. Interface with save/findById/delete methods.
- `projection`: query-side. Interface with `applyEvent` + query methods. Idempotency required.

```
R0 → queued (test DB running check — if absent, block)
R1 → spec acknowledged (feature-spec confirmed "TypeScript interface IS the spec.")
R2 → TypeScript interface written:
     - repository: method signatures, JSDoc for not-found behavior, transaction docs
     - projection: applyEvent method (naming CT-NNN events), query methods, JSDoc
R3 → integration tests written (Vitest + real Prisma client against test DB):
     - repository: one test per method, not-found, transactions. All FAIL.
     - projection: applyEvent with event sequence → query materialized state. All FAIL.
R4 → Prisma implementation written + quality gate (crash recovery checkpoint, pre-review):
     Code review checklist:
     - repository: N+1? missing indexes? connection released?
     - projection: applyEvent idempotent? missing indexes? connection released?
R5 → code review passed (loop-complete — feature-integrate transitions to done)
```

State writes: R0, R1 (feature-spec), R2, R3, R4, R5. Six writes. `done` by feature-integrate.

---

### `frontend:client` — F-loop

Typed `fetch` wrappers AND React hooks.
**Not in `packages/ui` — all client features live in `apps/`.**

**Variants:**

- `api-client`: typed fetch wrapper. Tests use `vi.spyOn(globalThis, 'fetch')`. No RTL.
  Location: `apps/*/src/api/<name>.ts`.
- `hook`: React hook. Tests use RTL `renderHook` + QueryClientProvider (for TanStack Query)
  or pure reducer tests (for useReducer). Location: `apps/*/src/hooks/use<Name>.ts`.

```
F0 → queued
F1 → JSDoc/interface template approved (feature-spec):
     - api-client: endpoint path, Zod types, auth requirements
     - hook: state machine (if applicable), inputs, outputs, dependencies
F2 → interface + tests written in source file:
     - api-client: interface + vi.spyOn(globalThis, 'fetch') tests. Happy path + error path.
     - hook (state machine): pure reducer tests (zero React imports) + RTL renderHook integration.
     - hook (no state machine): RTL renderHook return-shape test (must assert something real —
       never `expect(true).toBe(true)`).
     All must FAIL before implementation exists.
F3 → implementation complete + quality gate:
     - api-client: implement, run tests (all PASS), export.
     - hook: implement, run all tests (pure + RTL PASS), export.
F4 → convention check + loop-complete (hook variant only):
     - api-client: There is NO F4 state code for api-client. F3 → (full gate) → done is
       atomic. The F-loop writes done directly from F3 (skips feature-integrate). Typed fetch
       wrappers have no integration concerns — no events, no policies, no wiring.
     - hook: verify exported from apps/*/src/hooks/, TypeScript interface exported as named type,
       returns named state values (not boolean flags), JSDoc matches F1 template.
       Fix in-place if any fail — F4 is a verify checkpoint, not a restart.
     Loop-complete — feature-integrate transitions to done (hook variant only).
```

**Note on hook testing:** TanStack Query hooks MAY use `vi.spyOn(globalThis, 'fetch')` in F2
to verify network integration (e.g., correct URL, auth headers passed through). This is NOT
the same as testing the fetch wrapper itself — that's the `api-client` variant's job. The hook
test verifies that the hook correctly orchestrates the network call via TanStack Query. If the
hook only wraps a single api-client call with no additional logic, a `renderHook` return-shape
test is sufficient — do not add a redundant fetch spy.

State writes: F0, F1 (feature-spec), F2, F3, F4. Five writes. `done` by feature-integrate.

---

### `frontend:visual` — D-loop

Reusable React components AND assembled pages.
**D0 → D1 (design/plan gate) is owned by `feature-spec`.**
**D4 is the visual/E2E validation gate.**

**Variants:**

- `component`: reusable React component. Design approved via ui-design-expert. Visual gate
  via Playwright screenshots + human confirmation. Location: `packages/ui/src/ComponentName/`.
- `page`: assembled page wiring hooks + components. Assembly plan approved. Playwright E2E
  validation. Location: `apps/*/src/pages/`.

```
(D0 → D1: feature-spec generates design/plan, user approves)
D1 → design/plan approved:
     - component: design.md at docs/features/<BC>/<ComponentName>/design.md (written by feature-spec
       via ui-design-expert). This loop starts here.
     - page: assembly plan JSDoc in page file (written by feature-spec). Page assembled from plan:
       import hooks, import components, handle all states (loading, error, empty, populated).
       Quality gate runs here for page variant.
D2 → tests written (component) / tests written AND passing (page):
     - component: RTL tests (all hooks mocked via vi.fn()). One test per visual state,
       interaction tests, conditional display tests. All must FAIL (TDD — tests drive D3).
     - page: RTL tests (all hooks mocked). Wiring correctness: loading renders indicator,
       error renders message, populated renders components with correct props.
       Tests must PASS — because the page was already assembled at D1 (verification-first;
       see "Exception — D-loop page variant" at the top of this section).
       If tests FAIL: fix the assembly at D2, re-run. Stay at D2 until passing.
       D2 is the combined "write tests + confirm they pass" state for pages — there is no
       separate "implement" step because the page is pure assembly with no new logic.
D3 → implemented + reviewed:
     - component: implement per design.md. Tailwind, shadcn/ui, zero inline styles.
       Generate visual harness at packages/ui/src/<ComponentName>/__visual__/<ComponentName>.visual.tsx
       for D4 screenshots. Code review: matches design.md? zero inline styles? tests passing?
     - page: Playwright E2E tests written and passing. One test per critical path from JSDoc.
       Run against real server. Code review: all critical paths covered? no flaky selectors?
       If critical user-facing path, include manual walkthrough documentation in E2E test file.
D4 → visual/E2E gate confirmed (loop-complete):
     - component: Playwright MCP screenshots of each visual state from harness. Display alongside
       design.md. HUMAN CHECKPOINT: "Reply 'confirmed' or 'fix: <description>' to return to D3."
       If 'redesign: <reason>': reset to D1, rewrite design.md, delete RTL + impl, re-enter D2.
     - page: Playwright E2E already passed at D3. D4 is a final integration check — verify the
       page works with real (non-mocked) hooks by running the full E2E suite one more time.
     Loop-complete — feature-integrate transitions to done.
```

**Visual harness requirements (component variant):** The harness MUST wrap components in the
same providers the production app uses: theme provider (design tokens), CSS reset/global styles,
QueryClientProvider (if hooks are mocked at the component level, use a test QueryClient).
Document the required providers in `packages/ui/src/__visual__/providers.tsx` once; all visual
harnesses import from there. Without matching providers, a component can pass D4 and look
broken in the actual app.

**Provider sync check (D4 gate checklist item, not automated test):** `packages/ui` cannot
import from `apps/` (monorepo boundary rule). An automated provider sync test would require
a circular dependency. Instead: document the canonical provider list as a const array in
`providers.tsx`. At every D4 visual gate, the checklist includes: "Verify providers.tsx
provider list matches the target app's root layout providers." This is a manual check — if
providers drift, the D4 screenshot comparison will usually catch the visual difference, and
this checklist item catches the cases where drift is invisible (e.g., a new i18n provider
that doesn't affect visual rendering).

**D-loop P-loop gap fix (page variant):** If D2 RTL tests reveal the assembly is incorrect,
the fix happens at D2 — edit the assembly, re-run tests, stay at D2 until passing. Do NOT go
back to D1 (that would re-do the assembly plan). If the assembly plan itself is wrong (not just
the implementation), use the stuck handler → Rollback to D1.

State writes: D1 (feature-spec), D2, D3, D4. Four writes. `done` by feature-integrate.

---

### Code Review Rationale by Loop

| Loop   | Review? | Rationale                                                             |
| ------ | ------- | --------------------------------------------------------------------- |
| C-loop | Yes C4  | Aggregate invariant correctness is highest-risk                       |
| L-loop | Service | Service variant only (at L3). Value objects: TDD + gate is sufficient |
| M-loop | No      | Manual DB verification at M3 serves as review                         |
| A-loop | Yes A4  | Auth + error mapping (api), cross-BC event handling (event)           |
| R-loop | Yes R4  | N+1, indexes, idempotency (projection) require human verification     |
| F-loop | No      | Convention check at F4 (hooks), TDD + gate (api-clients) sufficient   |
| D-loop | Yes D3  | Design conformance (component), E2E coverage (page) require review    |

---

### Per-Loop Integration Checklist

Each sub-skill declares what `feature-integrate` must check. `feature-integrate` reads
`feature.type` and `feature.variant` to select the checklist — but the checklist content
is defined HERE (in the design doc) and embedded in the sub-skill files, NOT hardcoded in
`feature-integrate`. This prevents `feature-integrate` from becoming a god-skill.

| Type / Variant                            | Integration checklist                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `core:aggregate`                          | Upstream wiring, downstream wiring, policy documents, feature flag lifecycle  |
| `backend:handler` (event)                 | Upstream wiring, downstream wiring, policy documents, feature flag lifecycle  |
| `backend:handler` (api)                   | Feature flag lifecycle, verify no N+1 escaped review                          |
| `backend:persistence`                     | Feature flag lifecycle, verify no N+1 escaped review                          |
| `backend:migration`                       | Rollback SQL verified at `docs/migrations/rollbacks/`, feature flag lifecycle |
| `frontend:client` (hook)                  | Feature flag lifecycle                                                        |
| `frontend:visual` (component)             | Feature flag lifecycle                                                        |
| `frontend:visual` (page)                  | Route reachable from expected entry points, feature flag lifecycle            |
| `core:primitive`, `frontend:client` (api) | N/A — loop writes `done` directly, skips `feature-integrate`                  |

`feature-integrate` is a **dispatcher for the checklist**, not the owner of checklist content.
Each sub-skill file embeds its own checklist as a `## Integration Checklist` section that
`feature-integrate` can reference for context. The benefit: adding a checklist item for
handlers doesn't require touching `feature-integrate` — only the handler sub-skill.

---

## CLAUDE.md Changes

**Budget:** 96 lines current. Hard ceiling: 250 lines.

**Remove (~28 lines reclaimed):**

- `## Skills Available` — redundant; skills listed in system prompt
- `## Known Workflow Gap` — closed by this redesign
- ``## `cn` helper`` — folded into Frontend Conventions

**Fix:** CLAUDE.md references stale app names (`apps/colloquium-blog-api`, `apps/colloquium-blog`).
The actual directories are `apps/colloquium-api` and `apps/colloquium-web`.

**Add (~60 lines):**

- Feature taxonomy table + ordering rule (~18 lines — 7 types instead of 12)
- Testing strategy by layer (~10 lines)
- Quality gate (~7 lines)
- File locations (~12 lines)
- Backend conventions (~8 lines)
- Frontend conventions (~8 lines, absorbs `cn` rule)

**Estimated result: ~128 lines.** (96 current − ~28 removed + ~60 added.) ~122 lines of
headroom. Actual count may vary — verify after Task 2 and adjust if near 200 lines.

---

## Impact on Existing Skills

### Skills rewritten

| Skill                          | Change                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `colloquium:feature-spec`      | 7-type routing (down from 12). Manageable in single file.                                               |
| `colloquium:feature-implement` | Rewritten as 7-route dispatcher with variant handling; no loop logic                                    |
| `colloquium:slice-deliver`     | v3 schema, 7-type naming, batching for primitives, cross-slice deps                                     |
| `colloquium:feature-verify`    | Restricted to `core:aggregate` at C7 only                                                               |
| `colloquium:feature-integrate` | Sole owner of `"done"` for types that go through it. L-loop and F-loop (api-client) write done directly |

### New sub-skills (invoked by dispatcher, not user-facing)

| Skill                                      | Loop   | Replaces v6                      |
| ------------------------------------------ | ------ | -------------------------------- |
| `colloquium:feature-implement-aggregate`   | C-loop | Same as v6                       |
| `colloquium:feature-implement-primitive`   | L-loop | v6 value-object + domain-service |
| `colloquium:feature-implement-migration`   | M-loop | Same as v6                       |
| `colloquium:feature-implement-handler`     | A-loop | v6 api + event-handler           |
| `colloquium:feature-implement-persistence` | R-loop | v6 repository + projection       |
| `colloquium:feature-implement-client`      | F-loop | v6 api-client + hook             |
| `colloquium:feature-implement-visual`      | D-loop | v6 component + page              |

**7 sub-skill files instead of 12.** Cross-cutting changes (quality gate, stuck handling)
hit 7 files instead of 12 — a 42% reduction in maintenance surface.

**Mitigation:** Each sub-skill file includes:
`<!-- Quality gate: see CLAUDE.md § Quality Gate — keep in sync across all 7 sub-skills -->`

**v4 trigger condition — when to reconsolidate:** Consider a v4 "loop runner" refactor when
ANY of these thresholds is crossed:

- A cross-cutting change applied to all 7 files ≥ 5 times **post-v3-implementation**
- A new loop type is needed (8th type)
- A bug is found where one sub-skill was missed during a coordinated update

### Deleted

- `colloquium:project.md` — deprecated, nothing references it

### Demoted to escalation-only

- `skills:backend-expert`, `skills:frontend-expert`, `skills:testing-expert`
  CLAUDE.md now carries routine conventions. Invoke only for unusual situations.

---

## State.json Schema Changes

**schemaVersion:** 2 → 3

**Feature type field:** New features use compound format (`core:aggregate`, `backend:handler`,
etc.). Legacy values (`aggregate`, `contract`, `read-model`) preserved as-is.

**Feature variant field (new):** `feature.variant` — required for types with variants:

- `core:primitive`: `"value-object"` or `"service"`
- `backend:handler`: `"api"` or `"event"`
- `backend:persistence`: `"repository"` or `"projection"`
- `frontend:client`: `"api-client"` or `"hook"`
- `frontend:visual`: `"component"` or `"page"`
  Types without variants (`core:aggregate`, `backend:migration`) omit this field.

**Feature paused field (new, optional):** `feature.paused` — boolean. Set to `true` by the
stuck handler's "Pause" option. The queue scanner skips paused features during normal
scanning (step 3 of Queue Advance Algorithm) and offers them after exhausting all
initial-state features (step 4). Cleared by `--resume` or by the user accepting the
queue scanner's resume prompt. Omitted (or `false`) for active features.

**Feature app field (new, optional):** `feature.app` — required for `frontend:client` and
`frontend:visual` (page variant) features. Specifies which app directory the feature targets
(e.g., `"colloquium-web"`, `"sonar"`). Path resolution uses `apps/${feature.app}/src/...`
instead of `apps/*/src/...`. Omitted for `core:*` and `backend:*` features (they target
fixed locations). Also omitted for `frontend:visual` component variant (those live in
`packages/ui/`, not in an app directory).

**How `slice-deliver` resolves `feature.app`:**

1. If the slice targets a single app (the common case), all frontend features inherit that
   app name. `slice-deliver` infers this from the slice's model.md — if all endpoints are
   in one API app and all pages are in one web app, the mapping is unambiguous.
2. If the slice spans multiple apps (e.g., both `colloquium-web` and `sonar` consume the
   same API), `slice-deliver` asks the user per feature via AskUserQuestion: "Which app
   does `<feature-name>` target?" with options listing each app directory found in `apps/`.
3. If no app can be inferred (e.g., a hook with no obvious consumer), default to the app
   that contains the page feature in the same slice. If multiple page features target
   different apps, ask the user.

**Feature items array (new, optional):** For batched `core:primitive` features (value-object
variant), `feature.items` is an array of
`{ name: string, kind: "value-object" | "policy", status: "pending" | "tested" | "done" }`.
The `status` field tracks per-item progress within the bundle for crash recovery:

- `"pending"` → item not yet started
- `"tested"` → signature + tests written (L1→L2 phase complete for this item)
- `"done"` → implementation complete (L2→L3 phase complete for this item)
  The L-loop sets `status = "tested"` after writing each item's signature + tests, and
  `status = "done"` after implementing each item. On session resume, the L-loop skips items
  that are already at the current phase's target status and continues from the first item
  that hasn't reached it. This prevents re-doing already-written signatures/tests after a
  crash during the L1→L2 phase.
  Omitted for non-batched features.

**Legacy `contract` type:** Cannot be auto-routed. May map to `backend:handler` (api variant)
or `backend:handler` (event variant). Dispatcher asks user to reclassify. `--migrate-v3`
explicitly warns about manual reclassification.

**Legacy state mapping (for `--migrate-v3` reclassification):**

The migration hard-gates: ALL features must be at `done` or `C0` before migration proceeds.
Mid-loop features (C2–C7) block migration — complete or rollback them first. This eliminates
the need for approximate mid-loop state mapping tables, which were lossy and error-prone.

For `C0` features, mapping is trivial — C0 maps to each loop's initial state:

- `aggregate` C0 → `core:aggregate` C0
- `contract` C0 → `backend:handler` A0 (ask user: api or event variant)
- `read-model` C0 → ask user which type, then: F0, D0, etc.

Legacy features at `done` state are unaffected.

**completedFeatures normalization:** Bare IDs normalized to `"{sliceId}/{featureId}"` scoped
format. Algorithm: for each bare ID in `completedFeatures`, scan the version's `slices` keys
to find which slice contains that feature ID. If a bare ID exists in exactly one slice, prefix
with that slice ID. If a bare ID exists in multiple slices (ambiguous), stop and require
manual correction — do NOT guess. IDs already containing "/" are left unchanged.

**State code prefixes by loop (loop-complete state in bold):**

- Aggregate: C0, C2, C3, C4, C5, C6, **C7** (then feature-verify → **UV** → done)
  _(C1 was removed in v2 when the discovery step was folded into feature-spec. The gap is
  preserved to avoid renumbering existing state.json data. UV = "UAT Verified" — intentionally
  breaks the letter+number convention to signal it's a cross-skill handoff state, not a
  loop-internal state.)_
- Primitive: L0, L1, L2, **L3** (L3 → full gate → done directly — no L4 state, no feature-integrate)
- Migration: M0, M1, M2, M3, **M4**
- Handler: A0, A1, A2, A3, **A4**
- Persistence: R0, R1, R2, R3, R4, **R5**
- Client: F0, F1, F2, F3, **F4**
- Visual: D0, D1, D2, D3, **D4** (human visual gate for component, E2E for page)

**"done" ownership:**

- `core:primitive` features: `done` written by L-loop directly from L3 after full gate pass
  (no L4 state, no feature-integrate)
- `frontend:client` (api-client variant): `done` written by F-loop directly from F3 after
  full gate pass (no F4 state for api-client, no feature-integrate). Typed fetch wrappers
  have zero integration concerns.
- All other types: `done` written by `feature-integrate` only

**Crash recovery:** If `feature-integrate` crashes after writing `done` but before advancing
`activeFeature`, accept `done` as a no-op pass-through: skip checklist, skip write, proceed
to queue advance.

**Loop-complete state → feature-integrate entry mapping:**

| Type                           | Loop-complete state | feature-integrate accepts                 |
| ------------------------------ | ------------------- | ----------------------------------------- |
| `core:aggregate`               | C7 (via UV)         | UV (after feature-verify)                 |
| `core:primitive`               | L3 → done (direct)  | N/A (L-loop writes done directly from L3) |
| `frontend:client` (api-client) | F3 → done (direct)  | N/A (F-loop writes done directly from F3) |
| `backend:migration`            | M4                  | M4                                        |
| `backend:handler`              | A4                  | A4                                        |
| `backend:persistence`          | R5                  | R5                                        |
| `frontend:client` (hook)       | F4                  | F4                                        |
| `frontend:visual`              | D4                  | D4                                        |
| (any type at `done`)           | done                | done (no-op pass-through)                 |

**D0** exists only in state.json as the "queued but not yet spec'd" initial state.
`feature-spec` advances D0 → D1. `feature-implement-visual` never sees D0.

---

## Slice Decomposition — Full 7-Type Coverage

`slice-deliver` must produce all 7 types with appropriate variants.

### Step 3: Decompose core types from model.md

For each aggregate in model.md:

- Create one `core:aggregate` feature per aggregate
- **Bundle** all value objects referenced by the aggregate into a single `core:primitive`
  feature (variant: `value-object`). Set `items` array with each VO's name and kind.
  Dependency: none (value objects are foundation).
- For each domain service: create one `core:primitive` feature (variant: `service`).
  Dependency: the value objects it uses.

### Step 4: Decompose backend types

For each aggregate that requires persistence:

- Create one `backend:migration` feature if new tables needed. Dependency: none.
- Create one `backend:persistence` feature (variant: `repository`).
  Dependency: the migration that creates its table.
- If read-side view needed: create one `backend:persistence` feature (variant: `projection`).
  Dependency: the migration that creates its read-side table.

For each contract in `currentSlice.contracts`:

- Read the CT-NNN file. If HTTP endpoint: create `backend:handler` (variant: `api`).
  If domain event: create `backend:handler` (variant: `event`). Do not guess — read the file.

### Step 5: Decompose frontend types

For each API endpoint exposed by a `backend:handler` (api variant):

- Create one `frontend:client` feature (variant: `api-client`).
  Dependency: the `backend:handler` feature.

For each React hook needed:

- Create one `frontend:client` feature (variant: `hook`).
  Dependency: the `frontend:client` (api-client) it wraps (if any).

For each reusable UI component:

- Create one `frontend:visual` feature (variant: `component`).

For each page:

- Create one `frontend:visual` feature (variant: `page`).
  Dependency: the hooks and components it uses.

**Frontend splitting criteria:**

| Question                                     | If YES → separate feature   | If NO → inline      |
| -------------------------------------------- | --------------------------- | ------------------- |
| Component used by ≥ 2 pages?                 | `frontend:visual` component | Inline in page      |
| Component has ≥ 3 visual states?             | `frontend:visual` component | Inline in page      |
| Hook manages domain state (not UI toggle)?   | `frontend:client` hook      | Inline useState     |
| Hook wraps API client with caching/mutation? | `frontend:client` hook      | Call API directly   |
| Page has ≥ 2 distinct user actions?          | `frontend:visual` page      | Merge into existing |

**Default:** When in doubt, inline. Over-splitting creates dependency chains. Extract later.

### Legacy type conversion

- `type: "aggregate"` → `type: "core:aggregate"`
- `type: "contract"` → read CT-NNN. HTTP = `"backend:handler"` variant `"api"`,
  event = `"backend:handler"` variant `"event"`. If ambiguous, ask user.
- `type: "read-model"` → ask user: hook, api-client, component, or page? Route accordingly.

---

## Domain Event Type Location

Domain events are NOT a standalone type. They are:

- **Within BC:** `packages/<bc>/src/events/<EventName>.ts`, exported from package index.
  Created by C-loop at step C5/C6.
- **Cross-BC shared schemas:** Zod schema in CT-NNN contract file. TypeScript type generated
  at consumption site (event handler).
- **No separate loop.** If a shared event schema needs its own type, create as `core:primitive`
  (value-object variant).

---

## Out-of-Scope Work (Not Tracked by Feature Loops)

The 7-type taxonomy covers feature development. The following work items are NOT feature types
and do NOT go through a feature loop:

| Work type                   | How to handle                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment/config changes  | Direct commit with conventional commit message. Must pass full gate.                                                                            |
| CI/CD pipeline changes      | Direct commit. Must pass full gate.                                                                                                             |
| Cross-cutting middleware    | If it affects handler behavior: `backend:handler` feature. Otherwise: direct commit.                                                            |
| Refactoring (no behavior Δ) | Direct commit. Must pass full gate. If touching ≥ 5 files: code review.                                                                         |
| Test-only additions         | Direct commit. Must pass full gate.                                                                                                             |
| Background jobs / workers   | `backend:handler` (event variant) if triggered by domain events. Otherwise: `backend:handler` (api variant) if triggered by HTTP/cron endpoint. |
| Dependency upgrades         | Direct commit. Must pass full gate.                                                                                                             |

**"Direct commit" means:** commit to the current branch without creating a feature entry in
state.json. The full quality gate (`pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm turbo test`)
MUST pass. These commits are untracked by the SDLC — they have no loop, no spec, no review
unless explicitly noted.

**When in doubt:** If the work changes domain behavior or user-facing functionality, it's a
feature. If it changes infrastructure without behavioral impact, it's a direct commit.

---

## State Rollback Mechanism

```bash
# Option 1: Git restore (preferred)
git checkout -- .claude/sdlc/state.json

# Option 2: Manual edit
# Edit state.json directly, then run /colloquium:sdlc
```

---

## Feature Reclassification (In-Progress v3 Features)

If you discover mid-loop that a feature has the wrong type:

1. Note current state and work done
2. Edit state.json: change `feature.type` and `feature.variant`, reset state to new loop's
   initial state. All old artifacts are deleted.
3. Run `/colloquium:sdlc` — dispatcher reads corrected type and routes correctly
4. Accept that some work may need to be re-done under the new loop's quality gate

**Cost acknowledgment:** Reclassification destroys all loop artifacts (tests, specs, source
files) from the old type. This is intentional — loops produce type-specific artifacts that
cannot carry over. Before confirming reclassification, the stuck handler lists which files
will be deleted and asks: "These files will be deleted. Proceed?" This prevents accidental
data loss when the user meant to use a different stuck option (rollback, pause).

---

## Idempotent completedFeatures Append

`feature-integrate` (and L-loop for primitives) must check for duplicates:

```
if (!completedFeatures.includes(`${sliceId}/${featureId}`)) {
  completedFeatures.push(`${sliceId}/${featureId}`);
}
```

Guards against crash-recovery duplicates.

---

## Documentation Reduction

| Type                  | Before                  | After                                        |
| --------------------- | ----------------------- | -------------------------------------------- |
| `core:aggregate`      | spec.md (full)          | spec.md (full, unchanged)                    |
| `core:primitive`      | spec.md (100–200 lines) | JSDoc in source (both variants)              |
| `backend:migration`   | ad hoc notes            | rollback SQL in docs/migrations/rollbacks/   |
| `backend:handler`     | spec.md (narrative)     | spec.md (table, 50 lines max, both variants) |
| `backend:persistence` | spec.md                 | TypeScript interface (no spec.md)            |
| `frontend:client`     | spec.md or nothing      | JSDoc in source (both variants)              |
| `frontend:visual`     | nothing / spec.md       | design.md (component) / JSDoc (page)         |

SL-002 had 9 spec.md files. Under new taxonomy: ~4. >50% reduction.

---

## Success Criteria

1. A `frontend:client` hook feature completes in half the time a `core:aggregate` takes
2. A `frontend:visual` component feature produces a Tailwind-styled component with Playwright screenshot visual gate
3. API behavior tested exclusively with `app.request()` — Playwright never asserts HTTP status
4. Event handler tested via direct handler call — never `app.request()` or Playwright
5. Dispatcher reads `feature.type` and routes to one of 7 loops without asking the user
6. A new session can determine loop, sub-step, and next action from state.json + source files
7. CLAUDE.md stays under 250 lines after all additions
8. Expert skills invoked only where structurally required: `ui-design-expert` at D0→D1 for component variant (1 per component feature), no expert skills for non-visual features
9. No loop has unbounded branching — variants are documented, finite, and enumerated
10. D-loop: `feature-spec` owns D0→D1; D-loop code review at D3 before D4
11. `feature-integrate` owns `done` for all types except `core:primitive` (L-loop) and `frontend:client` api-client variant (F-loop), which write done directly
12. `slice-deliver` decomposes all 7 types with variants from model.md
13. `completedFeatures` never contains duplicates (idempotent append)
14. A realistic slice produces 12-18 features (not ~24+ as under 12-type v6)
15. `core:primitive` value-object bundles process multiple items in one feature cycle
