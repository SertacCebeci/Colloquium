# SDLC v3 — Feature Taxonomy and Specialized Loops

**Status:** Revised design, 2026-02-27 v2 (v1: D0/P0 ownership split, nano decomposed into DDD types, loop variants eliminated, concurrency removed; v2: V1 semantic fix, start-gate removed, H-loop split → hook+api-client, F-loop added, D-loop code review before D4, feature-integrate documented). Ready for implementation.
**Authored:** 2026-02-27, supersedes 2026-02-26 first draft.
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
| `frontend:hook`         | H-loop | `packages/ui/src/hooks/`                   | React hooks only (`useState`, `useReducer`, `useEffect`, TanStack Query wrappers)                 |
| `frontend:api-client`   | F-loop | `apps/*/src/api/`                          | Typed `fetch` wrappers coupled to `colloquium-api` Zod schemas — app-specific, not React-specific |
| `frontend:component`    | D-loop | `packages/ui/src/ComponentName/`           | UI components (stories at step D4)                                                                |
| `frontend:page`         | P-loop | `apps/*/src/pages/`                        | Assembled pages (E2E at step P3)                                                                  |

### Ordering Rule

`slice-deliver` infers default ordering from type using this precedence chain:

```
core:value-object → core:domain-service → core:aggregate
  → backend:migration → backend:repository → backend:projection
  → backend:api → backend:event-handler
  → frontend:hook → frontend:api-client → frontend:component → frontend:page
```

**This is sequential. `activeFeature` is a single pointer — features execute one at a time.
No concurrent feature execution at this stage. The pointer advances only when the current
feature reaches `done` — there is no start-gate.**

---

## Loop Designs

### Cross-Loop Quality Gate

Runs before every state advance. Non-negotiable.

1. `pnpm turbo typecheck` — zero TypeScript errors
2. `pnpm turbo lint` — zero new ESLint warnings in modified files
3. All tests in affected package — passing

---

### `core:value-object` — V-loop

Pure domain primitives: value objects, policies, specifications. No injected dependencies.
**No spec.md.** The type or function signature with JSDoc IS the documentation.

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
done → implementation written + quality gate + exported from package index; then integrated
```

State writes: V0 activation, V1 (by feature-spec on template display), done. Three writes.

---

### `core:domain-service` — S-loop

Stateless domain services with injected dependencies. No mutable class fields. No I/O that is
not injected as a typed interface.
**No spec.md.** The TypeScript interface IS the documentation.

```
S0 → queued
S1 → TypeScript interface written + JSDoc:
     - Method signatures
     - All injected dependencies listed as constructor parameters (typed interfaces, not
       concrete classes)
     - One-paragraph description of what the service coordinates
S2 → mocked unit tests written (Vitest, all dependencies mocked with vi.fn()):
     - One test per method
     - Test behavior given various mocked return values
     All must FAIL before implementation exists.
S3 → implementation written + quality gate + exported from package index
S4 → code review:
     - All dependencies injected (none instantiated inline)?
     - Stateless (no mutable class fields)?
     - No hidden I/O (file system, fetch, etc.) outside injected deps?
     (Code review failure at S4 → fix in-place at S4, re-run quality gate, re-request review.
     Do NOT reset to S0. The next session resumes at S4 context using source file inspection.)
done → integrated
```

State writes: S0 activation, S2 (tests written), S3 (implementation written — crash recovery checkpoint), S4 (pre-code-review), done. Five writes.

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

State writes: C0 activation, C4 (after GREEN), done. Three writes.
Spec: full spec.md in `docs/features/<BC>/<AggregateName>/spec.md` — unchanged.

---

### `backend:migration` — M-loop

Prisma schema migrations. Deployment risk, rollback consequence, ordering constraint.
**No automated unit tests.** Correctness is verified against a real test DB.
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
done → integrated
```

State writes: M0 activation, done. Two writes.

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
A4 → tests GREEN + code review:
     - Auth checked before domain call?
     - All error mapping rows covered by tests?
     - N+1 risk in domain call?
     - OpenAPI schema matches actual response shape?
done → integrated
```

State writes: A0 activation, done. Two writes.
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
E4 → code review:
     - CT-NNN Zod schema validated before any domain call?
     - Invalid payload behavior matches spec (discard vs. reject)?
     - No N+1 in domain call?
done → integrated
```

State writes: E0 activation, done. Two writes.
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
R1 → TypeScript interface written (this IS the spec — no spec.md file)
R2 → integration tests written (Vitest + real Prisma client against test DB):
     - One test per interface method (save, findById, delete, etc.)
     - Not-found behavior (null return vs. throw — document which in the interface JSDoc)
     - Transaction behavior if applicable
     All must FAIL before implementation exists.
R3 → Prisma implementation written (quality gate)
R4 → tests GREEN + code review:
     - N+1 in any method?
     - Missing indexes identified?
     - Connection released correctly in all paths?
done → integrated
```

State writes: R0 activation, R2 (interface written), R3 (tests written — crash recovery checkpoint), R4 (implementation written), done. Five writes.

---

### `backend:projection` — Q-loop

Prisma query-side projections materializing read models from domain events. Implements a
projection interface with `applyEvent` + query methods.
**Hard prerequisite:** test DB must be running. Block Q0 activation if absent.

```
Q0 → queued (test DB running check — if absent, block and do not proceed)
Q1 → TypeScript interface written (this IS the spec — no spec.md file):
     - `applyEvent(event: DomainEvent): Promise<void>` method
     - Query methods for the materialized view (findById, list, etc.)
     - JSDoc on applyEvent: which CT-NNN event(s) trigger it
Q2 → integration tests written (Vitest + real Prisma client against test DB):
     - Projection test: call applyEvent with a sequence of realistic domain events
       (using the CT-NNN payload shape) → query the read-side table → assert correct
       materialized state. Must FAIL before implementation exists.
     - Query method tests: findById, list return correct shape and ordering
     All must FAIL before implementation exists.
Q3 → Prisma implementation written (quality gate)
Q4 → code review:
     - Is applyEvent idempotent? (same event applied twice = no duplicate or inconsistency)
     - Missing indexes on read-side table for common query patterns?
     - Connection released in all paths?
done → integrated
```

State writes: Q0 activation, Q2 (interface written), Q3 (implementation written — crash recovery checkpoint), Q4 (pre-code-review), done. Five writes.

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
H4 → tests GREEN + convention check:
     - Exported from packages/ui/src/index.ts?
     - TypeScript interface exported separately?
     - Returns named state values, not boolean flags?
     - JSDoc block in place?
     Lightweight code review.
done → integrated
```

State writes: H0 activation, done. Two writes.

---

### `frontend:api-client` — F-loop

Typed `fetch` wrappers coupled to `colloquium-api`'s Zod schemas and endpoint paths.
**Not React-specific — no RTL, no QueryClientProvider.** Tests use `vi.spyOn(fetch)`.
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
F3 → Vitest tests written (vi.spyOn(fetch) — no RTL, no QueryClientProvider):
     - Happy path: spy returns correct response → client decodes and returns correct value
     - Error path: spy returns 4xx/5xx → client throws or returns correct error shape
     All must FAIL before implementation exists.
done → implementation written + quality gate + integrated
```

State writes: F0 activation, F1 (by feature-spec on JSDoc display), done. Three writes.

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
done → integrated
```

State writes: D1 (written by feature-spec on approval), D4 (human visual confirmed), done.
**Three writes total — D1 in feature-spec, D4 and done in D-loop.**
D4 is a tracked state — a feature cannot reach `done` without a recorded D4 checkpoint.
The dispatcher enforces: if `feature.state = "D3"`, resume at D4 checkpoint — do not skip.

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
P2 → RTL test: full page render with all hooks mocked, tests wiring correctness
P3 → Playwright E2E: one test per critical path node from JSDoc assembly plan
     Run against real running server (not mocked).
     Code review after E2E GREEN.
done → integrated
```

State writes: P1 (written by feature-spec on approval), done. Two writes total.

---

## CLAUDE.md Changes

**Budget:** 96 lines current. Hard ceiling: 200 lines. Calculated upfront.

**Remove (~28 lines reclaimed):**

- `## Skills Available` — fully redundant; skills listed in system prompt every session
- `## Known Workflow Gap` — closed by this redesign
- ``## `cn` helper`` — folded into Frontend Conventions

**Add (~68 lines):**

- Feature taxonomy table + ordering rule (~26 lines — 11 types)
- Testing strategy by layer (~10 lines)
- Quality gate (~7 lines)
- File locations (~12 lines)
- Backend conventions (~8 lines)
- Frontend conventions (~7 lines, absorbs the `cn` rule)

**Result: ~136 lines.** 64 lines of headroom for future additions.

Content of each section is specified in the implementation plan (Task 2).

---

## Impact on Existing Skills

### Skills rewritten

| Skill                          | Change                                                                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colloquium:feature-spec`      | 12-type routing — V/S/F get JSDoc, D invokes ui-design-expert (D0→D1), P gets assembly JSDoc (P0→P1), M/R/Q get no spec.md, E gets table spec.md                                                                                                                        |
| `colloquium:feature-implement` | Rewritten as 12-route dispatcher; no loop logic                                                                                                                                                                                                                         |
| `colloquium:slice-deliver`     | v3 schema check, 12-type naming, sequential ordering rule (no start-gate)                                                                                                                                                                                               |
| `colloquium:feature-verify`    | Restricted to `core:aggregate` at C7 only; all other types integrate directly                                                                                                                                                                                           |
| `colloquium:feature-integrate` | Accepts `done` state for all non-aggregate types (previously required F4 only); queue scanner updated to check type-appropriate initial states {V0, S0, C0, M0, A0, E0, R0, Q0, H0, F0, D0, P0}; `completedFeatures` written in scoped `"{sliceId}/{featureId}"` format |

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
| `colloquium:feature-implement-hook`           | H-loop                                            |
| `colloquium:feature-implement-api-client`     | F-loop                                            |
| `colloquium:feature-implement-component`      | D-loop                                            |
| `colloquium:feature-implement-page`           | P-loop                                            |

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

**completedFeatures normalization:** Bare IDs normalized to `"{sliceId}/{featureId}"` scoped format.

**Nano features:** Replaced by `core:value-object` and `core:domain-service`. Both are always
tracked in state.json.

**State code prefixes by loop:**

- Aggregate: C0, C2, C3, C4, C5, C6, C7
- Value Object: V0, V1, V2, V3
- Domain Service: S0 (queued), S2 (tests written), S3 (impl written), S4 (pre-review) [all tracked]
- Migration: M0, M1, M2, M3
- API: A0, A1, A2, A3, A4
- Event Handler: E0, E1, E2, E3, E4
- Repository: R0 (queued), R2 (interface written), R3 (tests written), R4 (impl written) [all tracked]
- Projection: Q0 (queued), Q2 (interface written), Q3 (impl written), Q4 (pre-review) [all tracked]
- Hook: H0, H1, H2, H3, H4
- API Client: F0 (queued), F1 (JSDoc approved, set by feature-spec — entry for F-loop), F2, F3
- Component: D1 (entry, set by feature-spec), D2, D3, D4 (human visual gate)
- Page: P1 (entry, set by feature-spec), P2, P3

**D0 and P0** exist only in state.json as the "queued but not yet spec'd" initial state.
`feature-spec` advances D0 → D1 and P0 → P1. `feature-implement-component` and
`feature-implement-page` never see D0 or P0 — they enforce this with a hard check.

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
8. Expert skills invoked fewer than once per slice on average — CLAUDE.md covers the routine cases
9. No loop has branches or skip-variants — every instance of the same loop type executes the same steps (H2 always requires a real assertion, never a no-op)
10. D-loop and P-loop: `feature-spec` is the sole owner of D0→D1 and P0→P1 transitions; D-loop code review is completed at D3, before D4 is written
11. `feature-integrate` advances the queue using type-appropriate initial states and writes `completedFeatures` in scoped format
