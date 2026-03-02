# SDLC v3 — Feature Taxonomy and Specialized Loops

**Status:** Revised design, 2026-03-02 v5 (v1–v4: see git history; v5: review findings applied — "done" state overloading fixed (sub-skills end at final loop state, feature-integrate is sole owner of "done" transition), C-loop state write count corrected, H-loop state write count aligned between design and impl, P-loop TDD language fixed, slice-deliver extended to decompose all 12 types, api-client option added to read-model reclassification, reclassification path for in-progress v3 features, Storybook prerequisite for D-loop, page UAT consideration, domain event type location documented, app name corrected (colloquium-api not colloquium-blog-api), state rollback mechanism, completedFeatures idempotent append, minor fixes throughout).
**Authored:** 2026-03-02, supersedes 2026-02-28 v4.
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
2. `core:nano` was a catch-all for small DDD concepts — not bijective with any loop
3. No design step exists for UI components
4. API tests ran through Playwright instead of `app.request()`
5. Loop variants (event-handler ACL, projection, migration prerequisite) made loops non-invariant
6. spec.md written for every feature regardless of value
7. D0 and P0 state transitions were claimed by two skills simultaneously

---

## Solution: 12-Type Taxonomy, Bijective with Loops

**Design principle:** one type = one loop. If two types share a loop, they are one type.
Every loop is **invariant** — every instance of the same loop type follows the same steps
with no branching, no skip variants, no conditional sub-steps. Differences that were previously
"variants" become separate types.

### Naming Convention

`{domain}:{type}:{kebab-name}`

**BC disambiguation:** The naming convention does not include the BC because collisions are
unlikely within a single project. If two BCs share the same kebab-name (e.g., `core:aggregate:channel`
in both Messaging and VideoConferencing), the `bc` field in state.json disambiguates, and the
`docs/features/<BC>/` path structure prevents file collisions. The naming convention is
display-only — state.json is the source of truth for BC assignment.

Examples:

```
core:aggregate:channel
core:value-object:channel-id
core:domain-service:channel-access-service
backend:migration:add-message-table
backend:api:get-channel-messages
backend:event-handler:channel-message-received
backend:repository:channel-repository
backend:projection:channel-feed-view
frontend:hook:use-channel-feed
frontend:component:message-item
frontend:page:channel-feed-page
```

### Taxonomy

| Type                    | Loop   | Package location                           | Covers                                                                                            |
| ----------------------- | ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `core:aggregate`        | C-loop | `packages/<bc-name>/`                      | Aggregates only                                                                                   |
| `core:value-object`     | V-loop | `packages/<bc-name>/` or `packages/utils/` | Value objects, policies, specifications — pure, no injected deps                                  |
| `core:domain-service`   | S-loop | `packages/<bc-name>/`                      | Stateless domain services with injected dependencies                                              |
| `backend:migration`     | M-loop | `apps/colloquium-api/prisma/`              | Prisma schema migrations — must precede any repository that needs new tables                      |
| `backend:api`           | A-loop | `apps/colloquium-api/`                     | REST handlers (HTTP endpoints only)                                                               |
| `backend:event-handler` | E-loop | `apps/colloquium-api/`                     | Domain event ACL handlers — cross-BC event ingestion                                              |
| `backend:repository`    | R-loop | `apps/colloquium-api/`                     | Prisma command-side repository implementations                                                    |
| `backend:projection`    | Q-loop | `apps/colloquium-api/`                     | Prisma query-side projections fed by domain events                                                |
| `frontend:api-client`   | F-loop | `apps/*/src/api/`                          | Typed `fetch` wrappers coupled to `colloquium-api` Zod schemas — app-specific, not React-specific |
| `frontend:hook`         | H-loop | `packages/ui/src/hooks/`                   | React hooks only (`useState`, `useReducer`, `useEffect`, TanStack Query wrappers)                 |
| `frontend:component`    | D-loop | `packages/ui/src/ComponentName/`           | UI components (stories at step D4)                                                                |
| `frontend:page`         | P-loop | `apps/*/src/pages/`                        | Assembled pages (E2E at step P3)                                                                  |

### Ordering Rule

`slice-deliver` infers default ordering from type using this precedence chain:

```
core:value-object → core:domain-service → core:aggregate
  → backend:migration → backend:repository → backend:projection
  → backend:api → backend:event-handler
  → frontend:api-client → frontend:hook → frontend:component → frontend:page
```

**This is sequential. `activeFeature` is a single pointer — features execute one at a time.
No concurrent feature execution at this stage. The pointer advances only when the current
feature reaches `done` — there is no start-gate.**

**Rationale — type ordering as primary, not dependency-first:** Type ordering avoids context
switching between layers (backend → frontend → backend). A dependency-first ordering with type
as tiebreaker would allow independent frontend work to start earlier, but for a solo developer
the cognitive cost of layer switching outweighs the parallelism benefit. Dependencies are still
checked — the queue scanner verifies dependency satisfaction before advancing. The type ordering
ensures features are processed in natural bottom-up layer order.

---

## Loop Designs

### Cross-Loop Quality Gate

Runs before every state advance. Non-negotiable.

1. `pnpm turbo typecheck` — zero TypeScript errors
2. `pnpm turbo lint` — zero new ESLint warnings in modified files
3. All tests in affected package — passing

### Test DB Availability Check

Required by M-loop, R-loop, and Q-loop before activation. Use this exact command:

```bash
cd apps/colloquium-api && pnpm prisma db execute --stdin <<< "SELECT 1" 2>/dev/null && echo "DB OK" || echo "DB UNAVAILABLE"
```

If the command outputs "DB UNAVAILABLE", display: "Test DB is not running — start it before
activating this feature." and block the loop from proceeding. The connection string is read
from the `DATABASE_URL` environment variable in `apps/colloquium-api/.env`.

---

### `core:value-object` — V-loop

Pure domain primitives: value objects, policies, specifications. No injected dependencies.
**No spec.md.** The type or function signature with JSDoc IS the documentation.
**Package prerequisite:** If `packages/<bc-name>/` does not exist yet (first core feature in a
new BC), create the package scaffold before V1:
`package.json` (name: `@colloquium/<bc-kebab>`), `tsconfig.json` (extends shared config),
`src/index.ts` (barrel export). Add to turbo pipeline. This is a one-time setup per BC.

```
V0 → queued
V1 → JSDoc template approved (feature-spec displayed the template; no file written yet.
     This is the entry state for feature-implement-value-object.)
V2 → type or function signature written in source file + JSDoc:
     - Value object: branded type or class with construction factory + validation rules
     - Policy/specification: predicate function signature + business rule in JSDoc
V3 → pure tests written (Vitest, zero mocks, zero framework imports):
     - Value object: valid construction, invalid construction (rejected), equality semantics
     - Policy: true cases, false cases, boundary/edge cases
     All must FAIL before implementation exists.
V4 → implementation written + quality gate + exported from package index
     (loop-complete — feature-integrate transitions to done)
```

State writes: V0 activation, V1 (by feature-spec on template display), V2 (signature written), V3 (tests written), V4 (implementation complete). Five writes. `done` written by feature-integrate only.

---

### `core:domain-service` — S-loop

Stateless domain services with injected dependencies. No mutable class fields. No I/O that is
not injected as a typed interface.
**No spec.md.** The TypeScript interface template with JSDoc IS the specification.
**Package prerequisite:** Same as V-loop — if `packages/<bc-name>/` does not exist, create the
package scaffold before S1 (see V-loop for details).

```
S0 → queued
S1 → TypeScript interface template approved (feature-spec displayed the template; no file
     written yet. This is the entry state for feature-implement-domain-service.):
     - Method signatures
     - All injected dependencies listed as constructor parameters (typed interfaces, not
       concrete classes)
     - One-paragraph description of what the service coordinates
S2 → TypeScript interface + JSDoc written in source file:
     - All method signatures from the approved template
     - All injected dependencies as constructor parameters (typed interfaces, not concrete classes)
S3 → mocked unit tests written (Vitest, all dependencies mocked with vi.fn()):
     - One test per method
     - Test behavior given various mocked return values
     All must FAIL before implementation exists.
S4 → implementation written + quality gate + exported from package index (crash recovery
     checkpoint — pre-code-review):
     code review checklist:
     - All dependencies injected (none instantiated inline)?
     - Stateless (no mutable class fields)?
     - No hidden I/O (file system, fetch, etc.) outside injected deps?
     (Code review failure at S4 → fix in-place at S4, re-run quality gate, re-request review.
     Do NOT reset to S0. The next session resumes at S4 context using source file inspection.)
S5 → code review passed (loop-complete — feature-integrate transitions to done)
```

State writes: S0 activation, S1 (by feature-spec on template display), S2 (interface written), S3 (tests written), S4 (implementation written — crash recovery checkpoint, pre-code-review), S5 (code review passed). Six writes. `done` written by feature-integrate only.

---

### `core:aggregate` — C-loop (UNCHANGED)

The existing C-loop is preserved exactly. This is the system's strongest capability.

```
C0 → queued
C2 → spec written (state machine, invariants, commands, events, failure modes, external contracts)
C3 → domain tests RED (pure TypeScript — if any test passes, the test is wrong)
C4 → domain GREEN + code review
C5 → contract tests (skip to C6 if no external contracts)
C6 → adapters built (repository, HTTP handler, projection)
C7 → journey check (Playwright E2E if this aggregate is a critical path node)
done → integrated
```

State writes: C0 activation, C2 (spec written, by feature-spec), C3 (tests RED), C4 (domain GREEN + code review), C5 (contract tests), C6 (adapters built), C7 (journey check). Seven writes across lifecycle. `done` written by feature-integrate after feature-verify (C7 → F4 → done).
Spec: full spec.md in `docs/features/<BC>/<AggregateName>/spec.md` — unchanged.

---

### `backend:migration` — M-loop

Prisma schema migrations. Deployment risk, rollback consequence, ordering constraint.
**No new tests written for the migration itself.** Correctness is verified manually against a
real test DB. The quality gate still runs existing tests in the affected package (schema changes
can break existing code via Prisma client regeneration).
**Hard prerequisite:** test DB must be running. Block M0 activation if absent.

```
M0 → queued (test DB running check — if absent, block and do not proceed)
M1 → Prisma schema.prisma updated:
     - Document what table/column/index is added or changed
     - Document the rollback path (Prisma has no auto-down — write the SQL that undoes this)
M2 → Migration file generated: `prisma migrate dev --name <kebab-name> --create-only`
     Review the generated SQL before deploying:
     - No data loss (additive only unless explicitly reviewed)
     - No irreversible destructive operations without explicit sign-off
M3 → Migration deployed to test DB: `prisma migrate deploy`
     - Verify: schema matches expectations (table/column exists with correct type + constraints)
     - Verify: rollback SQL script written to `docs/migrations/rollbacks/<migration_name>-rollback.sql`
       (outside the Prisma-managed directory — survives `prisma migrate reset`, not parsed by
       Prisma tooling, survives squashing because you control the naming)
     Quality gate (typecheck + lint — schema changes regenerate Prisma client)
M4 → migration verified + rollback SQL written
     (loop-complete — feature-integrate transitions to done)
```

State writes: M0 activation, M1 (by feature-spec), M2 (schema.prisma updated), M3 (migration file generated), M4 (migration verified). Five writes. `done` written by feature-integrate only.

---

### `backend:api` — A-loop

Hono route handlers for REST HTTP endpoints **only**.
**Hard rule: all tests via `app.request()`. Playwright never tests API behavior.**
**Scope: HTTP endpoints only. Domain event ingestion is `backend:event-handler`.**

```
A0 → queued
A1 → spec written (table format, max 30 lines):
     - Endpoint path + method
     - Zod request schema (body or query params)
     - Zod response schema (success case)
     - Auth requirements
     - Error mapping: domain error → HTTP status → response body
     If the spec exceeds 30 lines: split into two `backend:api` features or extract
     shared error policies to a referenced policy doc.
A2 → contract tests written (app.request()):
     - One test per error mapping row
     - One happy-path test (valid auth + valid payload → expected response)
     - One missing-auth test (no Authorization header → 401)
     All must FAIL before handler exists.
A3 → handler implemented (OpenAPIHono createRoute, quality gate)
A4 → code review complete (loop-complete — feature-integrate transitions to done):
     - Auth checked before domain call?
     - All error mapping rows covered by tests?
     - N+1 risk in domain call?
     - OpenAPI schema matches actual response shape?
```

State writes: A0 activation, A1 (by feature-spec on spec write), A2 (contract tests written), A3 (handler implemented), A4 (code review complete). Five writes. `done` written by feature-integrate only.
Spec: `docs/features/<BC>/<EndpointName>/spec.md` — table format, max 30 lines.

---

### `backend:event-handler` — E-loop

Domain event ACL handlers: receive cross-BC domain events, validate against the CT-NNN schema,
issue commands or state changes in the consumer domain.
**Tests via direct handler function call — NOT `app.request()`. Playwright never tests event
handlers.**

```
E0 → queued
E1 → spec written (table format, max 30 lines):
     - Event name (the cross-BC event this handler consumes)
     - CT-NNN document reference — the file MUST exist before E1 completes;
       if absent, block E1 and display: "CT-NNN file required — run /colloquium:slice-contracts."
     - Consumed event Zod schema (copied verbatim from CT-NNN — do not paraphrase)
     - Command produced in consumer BC (or: state change in consumer aggregate)
     - Error handling: invalid payload → discard / reject / DLQ (document which)
E2 → tests written (direct handler function call, NOT app.request()):
     - Schema-rejection test: payload that violates CT-NNN schema → handler rejects it
       (Zod parse failure — assert the domain command is NOT issued)
     - Happy-path test: valid CT-NNN payload → correct domain command issued to consumer BC
     All must FAIL before handler exists.
E3 → handler implemented:
     - Zod parse of incoming event payload against CT-NNN schema
     - Domain command issued if valid
     - Rejection/discard behavior per spec if invalid
     Quality gate runs here.
E4 → code review complete (loop-complete — feature-integrate transitions to done):
     - CT-NNN Zod schema validated before any domain call?
     - Invalid payload behavior matches spec (discard vs. reject)?
     - No N+1 in domain call?
```

State writes: E0 activation, E1 (by feature-spec on spec write), E2 (tests written), E3 (handler implemented), E4 (code review complete). Five writes. `done` written by feature-integrate only.
Spec: `docs/features/<BC>/<EventName>/spec.md` — table format, max 30 lines.

---

### `backend:repository` — R-loop

Prisma command-side repository implementations. Implements a domain repository interface.
**Projection repositories are `backend:projection`. Schema migrations are `backend:migration`.
If new tables are needed: create a `backend:migration` feature with an explicit dependency —
do not include migration work in the R-loop.**
**Hard prerequisite:** test DB must be running. Block R0 activation if absent.

```
R0 → queued (test DB running check — if absent, block and do not proceed)
R1 → spec acknowledged (feature-spec confirmed "TypeScript interface IS the spec — no
     spec.md file." This is the entry state for feature-implement-repository. No file
     written yet.)
R2 → TypeScript interface written (this IS the spec — no spec.md file):
     - Method signatures (save, findById, delete, etc.)
     - JSDoc documenting not-found behavior (null return vs. throw)
     - Transaction behavior if applicable
R3 → integration tests written (Vitest + real Prisma client against test DB):
     - One test per interface method
     - Not-found behavior tested
     - Transaction behavior tested if applicable
     All must FAIL before implementation exists.
R4 → Prisma implementation written (quality gate — crash recovery checkpoint, pre-code-review):
     code review checklist:
     - N+1 in any method?
     - Missing indexes identified?
     - Connection released correctly in all paths?
R5 → code review passed (loop-complete — feature-integrate transitions to done)
```

State writes: R0 activation, R1 (by feature-spec on acknowledgement), R2 (interface written), R3 (integration tests written), R4 (implementation written — crash recovery checkpoint, pre-code-review), R5 (code review passed). Six writes. `done` written by feature-integrate only.

---

### `backend:projection` — Q-loop

Prisma query-side projections materializing read models from domain events. Implements a
projection interface with `applyEvent` + query methods.
**Hard prerequisite:** test DB must be running. Block Q0 activation if absent.

```
Q0 → queued (test DB running check — if absent, block and do not proceed)
Q1 → spec acknowledged (feature-spec confirmed "TypeScript interface IS the spec — no
     spec.md file." This is the entry state for feature-implement-projection. No file
     written yet.)
Q2 → TypeScript interface written (this IS the spec — no spec.md file):
     - `applyEvent(event: DomainEvent): Promise<void>` method
     - Query methods for the materialized view (findById, list, etc.)
     - JSDoc on applyEvent: which CT-NNN event(s) trigger it
Q3 → integration tests written (Vitest + real Prisma client against test DB):
     - Projection test: call applyEvent with a sequence of realistic domain events
       (using the CT-NNN payload shape) → query the read-side table → assert correct
       materialized state. Must FAIL before implementation exists.
     - Query method tests: findById, list return correct shape and ordering
     All must FAIL before implementation exists.
Q4 → Prisma implementation written (quality gate — crash recovery checkpoint, pre-code-review):
     code review checklist:
     - Is applyEvent idempotent? (same event applied twice = no duplicate or inconsistency)
     - Missing indexes on read-side table for common query patterns?
     - Connection released in all paths?
Q5 → code review passed (loop-complete — feature-integrate transitions to done)
```

State writes: Q0 activation, Q1 (by feature-spec on acknowledgement), Q2 (interface written), Q3 (integration tests written), Q4 (implementation written — crash recovery checkpoint, pre-code-review), Q5 (code review passed). Six writes. `done` written by feature-integrate only.

---

### `frontend:hook` — H-loop

Custom React hooks: `useState`, `useReducer`, `useEffect`, TanStack Query wrappers.
**Typed API clients (`fetch` wrappers) are `frontend:api-client` (F-loop) — not here.**
**No spec.md.** The TypeScript interface + JSDoc IS the specification.
**Location:** `packages/ui/src/hooks/`

```
H0 → queued
H1 → TypeScript interface + JSDoc block written in source file (max 20 lines):
     - State machine (if applicable)
     - Inputs, outputs, external dependencies (CT-NNN, Zustand store, other hook)
H2 → unit tests for state machine written (pure — no RTL, no QueryClientProvider):
     - Test each state transition
     If the hook has no state machine (no `useReducer`, no state enum): write a minimal
     RTL `renderHook` test asserting the hook's return shape (expected fields with correct
     types). Never write `expect(true).toBe(true)` — it asserts nothing and must be rejected.
     H2 is always required. All tests must FAIL before implementation exists.
H3 → RTL integration tests written (pattern depends on hook type):
     - TanStack Query hooks: QueryClientProvider + real QueryClient +
       vi.spyOn(globalThis, 'fetch') or MSW to intercept network. Do NOT use vi.fn() for
       server state — TanStack Query has no injectable dependency to mock. Test happy path
       (data returned), error path (fetch throws), loading state.
     - useReducer/useState hooks (no server state): renderHook without provider is correct.
       Test component-level integration if applicable.
     - Edge cases from JSDoc for both patterns.
     Quality gate runs here.
H4 → tests GREEN + convention check (loop-complete — feature-integrate transitions to done):
     - Exported from packages/ui/src/index.ts?
     - TypeScript interface exported separately?
     - Returns named state values, not boolean flags?
     - JSDoc block in place?
     Lightweight code review.
```

State writes: H0 activation, H1 (by feature-spec on JSDoc display), H2 (state machine tests written), H3 (RTL integration tests written), H4 (convention check passed). Five writes. `done` written by feature-integrate only.

---

### `frontend:api-client` — F-loop

Typed `fetch` wrappers coupled to `colloquium-api`'s Zod schemas and endpoint paths.
**Not React-specific — no RTL, no QueryClientProvider.** Tests use `vi.spyOn(globalThis, 'fetch')`.
**Location:** `apps/*/src/api/`. Placing in `packages/ui` would give the UI package a
dependency on application-level API contracts, violating CLAUDE.md package boundaries.
**F0 → F1 is owned by `feature-spec`.** This loop starts at F1 — JSDoc template is already
approved. `feature-implement-api-client` enforces entry at F1 and blocks if state is F0.

```
(F0 → F1: feature-spec displays JSDoc template, user approves — no file written yet)
F1 → JSDoc template approved (entry state for feature-implement-api-client)
F2 → TypeScript interface written in source file + JSDoc (max 20 lines):
     - Endpoint path + method
     - Zod request type (input)
     - Zod response type (output)
     - Auth requirements (Bearer token, API key, none)
F3 → Vitest tests written (vi.spyOn(globalThis, 'fetch') — no RTL, no QueryClientProvider):
     - Happy path: spy returns correct response → client decodes and returns correct value
     - Error path: spy returns 4xx/5xx → client throws or returns correct error shape
     All must FAIL before implementation exists.
F4 → implementation written + quality gate
     (loop-complete — feature-integrate transitions to done)
```

State writes: F0 activation, F1 (by feature-spec on JSDoc display), F2 (interface written), F3 (tests written), F4 (implementation complete). Five writes. `done` written by feature-integrate only.

---

### `frontend:component` — D-loop

Reusable React components with visual design.
**D0 → D1 (design gate) is owned by `feature-spec`.** This loop starts at D1 — design is
already approved and `design.md` is already written by `feature-spec`.
**D4 is a hard human visual gate.**

```
(D0 → D1: feature-spec generates design proposal, user approves, design.md written)
D1 → design approved, design.md at docs/features/<BC>/<ComponentName>/design.md
D2 → RTL tests written (all hooks mocked via vi.fn()):
     - One test per visual state
     - Interaction tests (click, input, submit)
     - Conditional display tests
     All must FAIL.
D3 → component implemented per design.md + quality gate + code review:
     - Tailwind classes from the approved plan
     - shadcn/ui primitives as specified
     - Zero inline styles
     - Exported from packages/ui/src/index.ts
     Code review checklist: matches design.md? zero inline styles? all D2 tests passing?
     exported correctly?
     (Code review failure → fix in D3, re-run quality gate, re-request review before D4.)
D4 → Storybook stories written (one per visual state from design.md).
     **HUMAN CHECKPOINT — hard gate:**
     Display: "Run Storybook and verify each story against design.md. Reply 'confirmed' when
     all stories visually match, or 'fix: <description>' to return to D3."
     Wait for explicit user confirmation before advancing.
     State write: `"D4"` — written only after user confirms visual check passes.
     If user reports a mismatch: return to D3, fix, re-run tests, re-present D4 gate.
     (loop-complete — feature-integrate transitions to done)
```

**Storybook prerequisite:** D4 requires Storybook to be installed and configured. If
`packages/ui/.storybook/` does not exist, D4 must set up Storybook before writing stories:
install `@storybook/react`, `@storybook/react-vite`, create minimal `.storybook/main.ts` and
`.storybook/preview.ts`. This is a one-time setup per project. Alternatively, if Storybook
setup is not desired, D4 may use Playwright screenshots as the visual gate:
take a screenshot of each visual state via Playwright MCP, display to user for comparison
against design.md. The human confirmation step is identical either way.

State writes: D1 (written by feature-spec on approval), D2 (RTL tests), D3 (implementation + code review), D4 (human visual confirmed).
**Four writes total — D1 in feature-spec, D2/D3/D4 in D-loop.**
D4 is a tracked state — a feature cannot reach `done` without a recorded D4 checkpoint.
The dispatcher enforces: if `feature.state = "D3"`, resume at D4 checkpoint — do not skip.
`done` written by feature-integrate only.

---

### `frontend:page` — P-loop

Assembled pages wiring hooks + components into a routed view.
**P0 → P1 (assembly plan gate) is owned by `feature-spec`.** This loop starts at P1 — the
assembly plan is already approved and JSDoc is already written to the page file.
**Playwright runs here and only here in the feature loop.**

```
(P0 → P1: feature-spec generates assembly plan, user approves, JSDoc written to page file)
P1 → page assembled:
     - Hooks imported from packages/ui/src/hooks/ (React hooks) or apps/*/src/api/ (API clients)
     - Components imported from packages/ui/src/ComponentName/
     - All states handled: loading, error, empty, populated
     Quality gate runs here.
P2 → RTL test: full page render with all hooks mocked, tests wiring correctness.
     NOTE: P-loop is assembly-first, not TDD. The page is assembled at P1, tests are written
     at P2 to verify wiring correctness. Tests must PASS — they verify an already-assembled
     page, not drive implementation.
P3 → Playwright E2E: one test per critical path node from JSDoc assembly plan.
     Run against real running server (not mocked).
     Code review after E2E GREEN.
     **Page UAT consideration:** If the page is a critical user-facing path, the code review
     at P3 should include a manual walkthrough of the user journey (not just automated E2E).
     Document the walkthrough result in a comment within the E2E test file.
     (loop-complete — feature-integrate transitions to done)
```

State writes: P0 activation, P1 (written by feature-spec on approval), P2 (RTL tests written), P3 (Playwright E2E done). Four writes total. `done` written by feature-integrate only.

---

### Code Review Rationale by Loop

| Loop   | Code Review? | Rationale                                                                                |
| ------ | ------------ | ---------------------------------------------------------------------------------------- |
| C-loop | Yes (C4)     | Aggregate invariant correctness is the system's highest-risk area                        |
| V-loop | No           | Pure functions — TDD + quality gate is sufficient; zero side effects. V4 = loop-complete |
| S-loop | Yes (S4)     | Injected dependency contracts must be verified (no hidden I/O)                           |
| M-loop | No           | Manual DB verification at M3 serves as review; schema changes are SQL-inspected          |
| A-loop | Yes (A4)     | Auth + error mapping correctness requires human verification                             |
| E-loop | Yes (E4)     | Cross-BC event handling is a critical integration boundary                               |
| R-loop | Yes (R4)     | N+1 queries and missing indexes are hard to catch with tests alone                       |
| Q-loop | Yes (Q4)     | Idempotency and index coverage require design judgment                                   |
| H-loop | No           | Convention check at H4 serves as lightweight review; hooks are small                     |
| F-loop | No           | Pure fetch wrappers — TDD + quality gate is sufficient; no auth logic                    |
| D-loop | Yes (D3)     | Design conformance and style rules require review before visual gate                     |
| P-loop | No           | Playwright E2E at P3 validates the assembled page end-to-end                             |

---

## CLAUDE.md Changes

**Budget:** 96 lines current. Hard ceiling: 200 lines. Calculated upfront.

**Remove (~28 lines reclaimed):**

- `## Skills Available` — fully redundant; skills listed in system prompt every session
- `## Known Workflow Gap` — closed by this redesign
- ``## `cn` helper`` — folded into Frontend Conventions

**Fix:** CLAUDE.md references stale app names (`apps/colloquium-blog-api`, `apps/colloquium-blog`).
The actual directories are `apps/colloquium-api` and `apps/colloquium-web`. Update the
Monorepo Package Boundaries table during Task 2.

**Add (~68 lines):**

- Feature taxonomy table + ordering rule (~26 lines — 12 types)
- Testing strategy by layer (~10 lines)
- Quality gate (~7 lines)
- File locations (~12 lines)
- Backend conventions (~8 lines)
- Frontend conventions (~8 lines, absorbs the `cn` rule — must preserve the context that
  `@colloquium/utils` has a DIFFERENT `cn` (simple string join, NOT Tailwind-aware))

**Result: ~136 lines.** 64 lines of headroom for future additions.

Content of each section is specified in the implementation plan (Task 2).

---

## Impact on Existing Skills

### Skills rewritten

| Skill                          | Change                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colloquium:feature-spec`      | 12-type routing — V/S/F get JSDoc, D invokes ui-design-expert (D0→D1), P gets assembly JSDoc (P0→P1), M/R/Q get no spec.md, E gets table spec.md                                                                                                                                                                                              |
| `colloquium:feature-implement` | Rewritten as 12-route dispatcher; no loop logic                                                                                                                                                                                                                                                                                               |
| `colloquium:slice-deliver`     | v3 schema check, 12-type naming, full 12-type decomposition logic (not just aggregate/contract/read-model), sequential ordering rule (no start-gate)                                                                                                                                                                                          |
| `colloquium:feature-verify`    | Restricted to `core:aggregate` at C7 only; all other types integrate directly                                                                                                                                                                                                                                                                 |
| `colloquium:feature-integrate` | Sole owner of `"done"` transition for ALL types. Entry states: C7/F4 for aggregate (via feature-verify), loop-complete state for all others (V4, S5, M4, A4, E4, R5, Q5, H4, F4, D4, P3). Queue scanner checks type-appropriate initial states. `completedFeatures` written in scoped `"{sliceId}/{featureId}"` format with idempotent append |

### New sub-skills (invoked by dispatcher, not user-facing)

| Skill                                         | Loop                                              |
| --------------------------------------------- | ------------------------------------------------- |
| `colloquium:feature-implement-aggregate`      | C-loop (extracted from current feature-implement) |
| `colloquium:feature-implement-value-object`   | V-loop                                            |
| `colloquium:feature-implement-domain-service` | S-loop                                            |
| `colloquium:feature-implement-migration`      | M-loop                                            |
| `colloquium:feature-implement-api`            | A-loop                                            |
| `colloquium:feature-implement-event-handler`  | E-loop                                            |
| `colloquium:feature-implement-repository`     | R-loop                                            |
| `colloquium:feature-implement-projection`     | Q-loop                                            |
| `colloquium:feature-implement-api-client`     | F-loop                                            |
| `colloquium:feature-implement-hook`           | H-loop                                            |
| `colloquium:feature-implement-component`      | D-loop                                            |
| `colloquium:feature-implement-page`           | P-loop                                            |

**Maintenance note:** 12 sub-skill files contain duplicated boilerplate (enforcement, session
banner, quality gate, completion banner, state write JSON). When a shared element changes
(e.g., quality gate command), all 12 files must be updated. This trades one kind of maintenance
burden (a single oversized loop with branches) for another (12 explicit files with shared
patterns). The current approach is more explicit and harder to get wrong per-type. A shared
"loop runner" with pluggable step definitions could reduce this duplication in v4.

**Mitigation:** Each sub-skill file must include a comment at the top:
`<!-- Quality gate: see CLAUDE.md § Quality Gate — keep in sync across all 12 sub-skills -->`
This makes grep-able the shared sections that need coordinated updates.

### Deleted

- `colloquium:project.md` — deprecated, nothing references it

### Demoted to escalation-only

- `skills:backend-expert`, `skills:frontend-expert`, `skills:testing-expert`
  CLAUDE.md now carries routine conventions. Invoke only for unusual situations.

---

## State.json Schema Changes

**schemaVersion:** 2 → 3

**Feature type field:** New features use compound format (`core:aggregate`, `backend:api`, etc.).
Legacy values (`aggregate`, `contract`, `read-model`) preserved as-is in existing feature records.
Dispatcher routing table handles legacy matching permanently. No `_legacyType` field.

**Exception: legacy `contract` type cannot be auto-routed.** A `contract` feature may map to
`backend:api` (HTTP endpoint) or `backend:event-handler` (domain event handler) — the type
encodes two different loops. The dispatcher cannot resolve this without reading the CT-NNN file,
which adds document-inspection logic to every dispatch call. Instead: the dispatcher must ask
the user to reclassify any legacy `contract` feature before routing. The `--migrate-v3` handler
explicitly warns that `contract` features require manual reclassification. This is consistent
with the `--migrate-v3` rule "do NOT auto-reclassify — requires human judgement."

**Legacy in-progress features (state ≠ "done"):** After reclassification, a legacy feature's
C-state (C2–C7) may not match the new loop's expected states. The `--migrate-v3` handler must
map legacy C-states to the new loop's equivalent states when the user reclassifies:

| Legacy state | Reclassified to `backend:api` | Reclassified to `backend:event-handler` |
| ------------ | ----------------------------- | --------------------------------------- |
| C0           | A0                            | E0                                      |
| C2           | A1 (spec exists)              | E1 (spec exists)                        |
| C3–C4        | A2 (tests phase)              | E2 (tests phase)                        |
| C5–C6        | A3 (impl phase)               | E3 (impl phase)                         |
| C7           | A4 (pre-done)                 | E4 (pre-done)                           |

For `read-model` reclassified to `frontend:hook`, `frontend:component`, or `frontend:page`:

| Legacy state | Hook | Component | Page |
| ------------ | ---- | --------- | ---- |
| C0           | H0   | D0        | P0   |
| C2           | H1   | D1        | P1   |
| C3–C4        | H2   | D2        | P2   |
| C5–C6        | H3   | D3        | P3   |
| C7           | H4   | D3        | P3   |

The mapping is approximate — the new loop may require re-doing some work. The dispatcher
displays a warning: "State mapped from legacy C-state — review the current sub-step before
proceeding. Some work may need to be re-verified under the new loop's quality gate."

Legacy features at `done` state are unaffected — they remain at `done` regardless of type.

**completedFeatures normalization:** Bare IDs normalized to `"{sliceId}/{featureId}"` scoped format.

**Nano features:** Replaced by `core:value-object` and `core:domain-service`. Both are always
tracked in state.json.

**State code prefixes by loop (loop-complete state in bold):**

- Aggregate: C0, C2, C3, C4, C5, C6, **C7** (then feature-verify → F4 → feature-integrate → done)
- Value Object: V0, V1, V2, V3, **V4**
- Domain Service: S0, S1, S2, S3, S4, **S5**
- Migration: M0, M1, M2, M3, **M4**
- API: A0, A1, A2, A3, **A4**
- Event Handler: E0, E1, E2, E3, **E4**
- Repository: R0, R1, R2, R3, R4, **R5**
- Projection: Q0, Q1, Q2, Q3, Q4, **Q5**
- Hook: H0, H1, H2, H3, **H4**
- API Client: F0, F1, F2, F3, **F4**
- Component: D0, D1, D2, D3, **D4** (human visual gate)
- Page: P0, P1, P2, **P3**

**"done" is NEVER written by a sub-skill.** `feature-integrate` is the sole owner of the
`done` transition for all types. Sub-skills advance to the loop-complete state (bolded above).
`feature-integrate` accepts the loop-complete state as its entry condition.

**Loop-complete state → feature-integrate entry mapping:**

| Type                    | Loop-complete state | feature-integrate accepts |
| ----------------------- | ------------------- | ------------------------- |
| `core:aggregate`        | C7 (via F4)         | F4 (after feature-verify) |
| `core:value-object`     | V4                  | V4                        |
| `core:domain-service`   | S5                  | S5                        |
| `backend:migration`     | M4                  | M4                        |
| `backend:api`           | A4                  | A4                        |
| `backend:event-handler` | E4                  | E4                        |
| `backend:repository`    | R5                  | R5                        |
| `backend:projection`    | Q5                  | Q5                        |
| `frontend:hook`         | H4                  | H4                        |
| `frontend:api-client`   | F4                  | F4                        |
| `frontend:component`    | D4                  | D4                        |
| `frontend:page`         | P3                  | P3                        |

**D0 and P0** exist only in state.json as the "queued but not yet spec'd" initial state.
`feature-spec` advances D0 → D1 and P0 → P1. `feature-implement-component` and
`feature-implement-page` never see D0 or P0 — they enforce this with a hard check.

---

## Slice Decomposition — Full 12-Type Coverage

`slice-deliver` must be able to produce ALL 12 types, not just aggregate/contract/read-model.
The decomposition logic is extended:

### Step 3: Decompose core types from model.md

For each aggregate in model.md:

- Create one `core:aggregate` feature per aggregate
- For each value object referenced by the aggregate (e.g., `ChannelId`, `MessageContent`):
  create one `core:value-object` feature. Dependency: none (value objects are foundation).
- For each domain service referenced in cross-aggregate coordination or complex business rules:
  create one `core:domain-service` feature. Dependency: the value objects it uses.

### Step 4: Decompose backend types

For each aggregate that requires persistence:

- Create one `backend:migration` feature if new tables are needed. Dependency: none.
- Create one `backend:repository` feature. Dependency: the migration that creates its table.
- If the aggregate has a read-side view: create one `backend:projection` feature.
  Dependency: the migration that creates its read-side table.

For each contract in `currentSlice.contracts`:

- Read the CT-NNN file. If it describes an HTTP endpoint: create `backend:api`. If it
  describes a domain event: create `backend:event-handler`. Do not guess — read the file.
  Dependency: the aggregate(s) on both sides.

### Step 5: Decompose frontend types

For each API endpoint exposed by a `backend:api` feature:

- Create one `frontend:api-client` feature. Dependency: the `backend:api` feature.

For each React hook needed to wire API data to UI:

- Create one `frontend:hook` feature. Dependency: the `frontend:api-client` it wraps (if any).

For each reusable UI component identified in the event storm or model read models:

- Create one `frontend:component` feature. Dependency: none (components are standalone).

For each page that assembles hooks + components into a routed view:

- Create one `frontend:page` feature. Dependency: the hooks and components it uses.

**Type identification heuristic for ambiguous items:**

- "Something the user sees" → `frontend:page` or `frontend:component`
- "Data fetching wrapper" → `frontend:api-client`
- "React state management" → `frontend:hook`
- "Schema change" → `backend:migration`
- "CRUD operations" → `backend:repository`
- "Materialized view" → `backend:projection`

---

## Domain Event Type Location

Domain events are NOT a standalone type in the taxonomy. They are defined as follows:

- **Within a BC:** Domain event TypeScript types live alongside the aggregate that emits them,
  in `packages/<bc>/src/events/<EventName>.ts`. They are exported from the package index.
- **Cross-BC shared schemas:** The Zod schema lives in the CT-NNN contract file
  (`docs/contracts/CT-NNN-<name>.md`). The TypeScript type is generated from the Zod schema
  at the consumption site (the event handler or projection that uses it).
- **No separate loop:** Domain events do not have their own loop because they are always
  co-created with the aggregate (C-loop) or consumed by the event handler (E-loop).
  If a shared event schema needs its own type file, create it as a `core:value-object`
  feature (the Zod schema + branded type pattern).

---

## State Rollback Mechanism

If a sub-skill writes an incorrect state (e.g., marks V3 when tests weren't actually written),
the recommended recovery path is:

```bash
# Option 1: Git restore (preferred — reverts to last committed state)
git checkout -- .claude/sdlc/state.json

# Option 2: Manual edit (when git restore is too coarse)
# Edit .claude/sdlc/state.json directly, setting the feature's state to the desired value.
# Then run /colloquium:sdlc to resume from the corrected state.
```

A future `--reset-feature-state <featureId> <state>` option on `colloquium:version` could
automate this, but manual editing of state.json is sufficient for v3.

---

## Feature Reclassification (In-Progress v3 Features)

If you discover mid-loop that a feature has the wrong type (e.g., `frontend:hook` should be
`frontend:component`), the reclassification path is:

1. Note the current state and the work already done (source files, tests).
2. Edit `.claude/sdlc/state.json` manually:
   - Change `feature.type` to the correct type
   - Map the current state to the new loop's equivalent state using this table:

| Current state phase | New type's equivalent |
| ------------------- | --------------------- |
| Initial (X0)        | New type's X0         |
| Spec/template done  | New type's X1         |
| Tests written       | New type's test state |
| Implementation done | New type's impl state |

3. Run `/colloquium:sdlc` to resume. The dispatcher reads the corrected type and routes
   to the appropriate sub-skill.
4. The sub-skill may require re-doing some work under the new loop's quality gate.
   Accept this — it's cheaper than continuing with the wrong type.

---

## Idempotent completedFeatures Append

`feature-integrate` must check for duplicates before appending to `completedFeatures`:

```
if (!completedFeatures.includes(`${sliceId}/${featureId}`)) {
  completedFeatures.push(`${sliceId}/${featureId}`);
}
```

This guards against crash-recovery scenarios where feature-integrate appends but crashes
before clearing `activeFeature`, causing a re-run that would create a duplicate entry.

---

## Documentation Reduction

| Type                    | Before                  | After                                        |
| ----------------------- | ----------------------- | -------------------------------------------- |
| `core:aggregate`        | spec.md (full)          | spec.md (full, unchanged)                    |
| `core:value-object`     | spec.md (100–200 lines) | JSDoc in source                              |
| `core:domain-service`   | spec.md                 | TypeScript interface (no spec.md)            |
| `backend:migration`     | ad hoc notes            | rollback SQL in `docs/migrations/rollbacks/` |
| `backend:api`           | spec.md (narrative)     | spec.md (table, 30 lines max)                |
| `backend:event-handler` | spec.md (narrative)     | spec.md (table, 30 lines max)                |
| `backend:repository`    | spec.md                 | TypeScript interface (no spec.md)            |
| `backend:projection`    | spec.md                 | TypeScript interface (no spec.md)            |
| `frontend:hook`         | spec.md (100–200 lines) | JSDoc in source (20 lines)                   |
| `frontend:api-client`   | spec.md or nothing      | JSDoc in source (20 lines)                   |
| `frontend:component`    | nothing                 | design.md (D1 output, from ui-design-expert) |
| `frontend:page`         | spec.md (narrative)     | assembly spec in JSDoc                       |

SL-002 had 9 spec.md files. Under new taxonomy: 4 (2 aggregates + 2 API routes). 55% reduction.

---

## Success Criteria

1. A `frontend:hook` feature completes in half the time a `core:aggregate` feature takes
2. A `frontend:component` feature produces a Tailwind-styled component with Storybook stories — not raw HTML
3. API behavior is tested exclusively with `app.request()` — Playwright never asserts an HTTP status code
4. Event handler behavior is tested via direct handler function call — never via `app.request()` or Playwright
5. `colloquium:feature-implement` dispatcher reads `feature.type` and routes to one of 12 loops without asking the user
6. A new session picking up mid-feature can determine its loop, current sub-step, and next required action from state.json + the feature's source files. State.json provides the loop type and current state code; source files provide the work already done.
7. CLAUDE.md stays under 200 lines after all additions
8. Expert skills invoked fewer than once per slice on average — CLAUDE.md covers the routine cases.
   Exception: `skills:ui-design-expert` invocation by feature-spec for `frontend:component` (D0→D1)
   is excluded from this count — it is a mandatory design gate, not an escalation.
9. No loop has branches or skip-variants — every instance of the same loop type executes the same steps (H2 always requires a real assertion, never a no-op)
10. D-loop and P-loop: `feature-spec` is the sole owner of D0→D1 and P0→P1 transitions; D-loop code review is completed at D3, before D4 is written
11. `feature-integrate` is the sole owner of the `done` transition for ALL types — no sub-skill writes `"done"`. `feature-integrate` advances the queue using type-appropriate initial states and writes `completedFeatures` in scoped format with idempotent append.
12. `slice-deliver` can decompose all 12 types from model.md — not just aggregate/contract/read-model
13. `completedFeatures` never contains duplicate entries (idempotent append enforced)
