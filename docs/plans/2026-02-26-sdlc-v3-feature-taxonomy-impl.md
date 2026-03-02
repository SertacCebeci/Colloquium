# SDLC v3 Feature Taxonomy — Implementation Plan

> **For Claude:** Use `superpowers:executing-plans` to implement this plan task-by-task.

**Revised:** 2026-03-03 — v8 second adversarial review applied on top of v7 (v7: 12 types → 7
types with variants; L-loop batching + direct-done; per-C-state migration mapping; apps-only
client location; visual harness providers; cross-slice deps; light gate skip; M-loop deadlock
escape; P-loop gap fix; 7 sub-skills. v8: pause resume mechanism; batched items status field;
task reordering — migration moved to Task 9.8; M-loop test-fix auto-feature; dependency-first
ordering; hook testing contradiction fixed; C6 concrete deliverables with skip; api-client
direct-done; out-of-scope boundary; quality gate wording; provider sync test; C1/UV naming;
rollback SQL in file locations).

**Goal:** Replace the 3-type flat feature model with a 7-type `{domain}:{type}:{name}` taxonomy
with variant fields, each with an invariant loop (per variant), eliminating the "DDD loop applied
to React hooks" problem from SL-002 while keeping the feature count per slice at ~10-12.

**Architecture:** `colloquium:feature-implement` dispatcher reads `feature.type`, routes to one of
7 specialized sub-skill files. Variant-specific behavior handled within each sub-skill.
CLAUDE.md carries conventions; skills carry only process. State.json bumps to schemaVersion 3.

**Execution:** Sequential. Git commit after each task. No worktrees or branch creation.
If any task fails, stop and handle manually — do not proceed to the next task.

**Critical ordering rule:** All skill updates (Tasks 5–9.7) MUST accept BOTH schemaVersion 2
AND 3 (`schemaVersion ∈ {2, 3}`). The actual migration (Task 4) runs AFTER all skills are
updated. This guarantees the system works at every intermediate point: before migration (v2
state + v2/v3-accepting skills) and after migration (v3 state + v2/v3-accepting skills).
If the migration fails, all skills still work with v2.

---

## Pre-Flight Checks

Before Task 1, verify:

```bash
cat .claude/sdlc/state.json | python3 -m json.tool | grep schemaVersion
# Must show: 2

pnpm turbo typecheck
# Must pass before any changes begin
```

Also verify all features in state.json are at `done` state (SL-001 and SL-002 complete).

---

## Task 1: Delete Deprecated Skill

**File:** `.claude/commands/colloquium/project.md`

**Step 1:** Verify nothing references it:

```bash
grep -r "colloquium:project" .claude/ docs/ CLAUDE.md
```

Expected: zero matches. If matches found, remove them before deleting.

**Step 2:** Delete the file:

```bash
rm .claude/commands/colloquium/project.md
```

**Step 3:** Commit:

```bash
git add -u .claude/commands/colloquium/project.md
git commit -m "chore(sdlc): remove deprecated colloquium:project skill"
```

---

## Task 2: CLAUDE.md Surgery

**File:** `CLAUDE.md`

Read CLAUDE.md first.

**Step 0: Fix stale app names in Monorepo Package Boundaries table**

Replace:

- `apps/colloquium-blog-api` → `apps/colloquium-api`
- `apps/colloquium-blog` → `apps/colloquium-web`

**Step 1: Remove three sections**

Remove entirely:

- `## Skills Available` (heading + all content until next `##`)
- `## Known Workflow Gap` (heading + all content)
- ``## `cn` helper — two implementations, use the right one`` (heading + all content)

**Step 2: Append Feature Taxonomy section**

```markdown
## Feature Taxonomy

All features: `{domain}:{type}:{kebab-name}` with optional `variant` field in state.json.

| Type                  | Loop   | Variants                   | Location                                   |
| --------------------- | ------ | -------------------------- | ------------------------------------------ |
| `core:aggregate`      | C-loop | —                          | `packages/<bc-name>/`                      |
| `core:primitive`      | L-loop | `value-object`, `service`  | `packages/<bc-name>/` or `packages/utils/` |
| `backend:migration`   | M-loop | —                          | `apps/colloquium-api/prisma/`              |
| `backend:handler`     | A-loop | `api`, `event`             | `apps/colloquium-api/`                     |
| `backend:persistence` | R-loop | `repository`, `projection` | `apps/colloquium-api/`                     |
| `frontend:client`     | F-loop | `api-client`, `hook`       | `apps/*/src/api/` or `apps/*/src/hooks/`   |
| `frontend:visual`     | D-loop | `component`, `page`        | `packages/ui/` or `apps/*/src/pages/`      |

**Ordering rule (sequential — `activeFeature` is a single pointer):**
`core:primitive → core:aggregate → backend:migration → backend:persistence → backend:handler → frontend:client → frontend:visual`
```

**Step 3: Append Testing Strategy section**

```markdown
## Testing Strategy by Layer

**The "Never" column is law.**

| Type                  | Variant      | Tool                                     | What to test                        | Never                     |
| --------------------- | ------------ | ---------------------------------------- | ----------------------------------- | ------------------------- |
| `core:aggregate`      | —            | Vitest, zero mocks                       | Invariants, state transitions       | I/O, network              |
| `core:primitive`      | value-object | Vitest, zero mocks                       | Valid/invalid, equality             | I/O, mocks                |
| `core:primitive`      | service      | Vitest, vi.fn() mocks                    | Method behavior given mocked deps   | I/O, real deps            |
| `backend:migration`   | —            | Real test DB (manual verify)             | Schema correctness, rollback        | Unit mocks                |
| `backend:handler`     | api          | Hono `app.request()`                     | Auth, validation, error mapping     | Playwright                |
| `backend:handler`     | event        | Direct handler call                      | Schema rejection, happy path        | app.request(), Playwright |
| `backend:persistence` | repository   | Vitest + test DB                         | CRUD, transactions, not-found       | Unit mocks of DB          |
| `backend:persistence` | projection   | Vitest + test DB                         | Event sequence → materialized state | Unit mocks                |
| `frontend:client`     | api-client   | Vitest + `vi.spyOn(globalThis, 'fetch')` | Request encoding, response decoding | RTL, QueryClientProvider  |
| `frontend:client`     | hook         | RTL + QueryClientProvider                | State transitions, error handling   | Visual rendering          |
| `frontend:visual`     | component    | RTL (hooks mocked)                       | Render, interaction, conditionals   | Hook logic                |
| `frontend:visual`     | page         | Playwright                               | Critical user paths                 | API response codes        |

API behavior is **never** tested through Playwright — use `app.request()` in the A-loop.
Event handler behavior is **never** tested through `app.request()` — use direct handler calls.
```

**Step 4: Append Quality Gate section**

```markdown
## Quality Gate

Two tiers. Which runs depends on whether the advance is mid-loop or loop-complete.

**Light gate (mid-loop):** typecheck + lint + tests in affected package only.
**Full gate (loop-complete):** typecheck + lint + `pnpm turbo test` (all packages).

`core:primitive` value-object variant skips mid-loop light gates entirely (pure functions
with zero side effects — typecheck is sufficient). Full gate runs at L4 only.
```

**Step 5: Append File Locations section**

````markdown
## File Locations (Stable — Do Not Re-Discover)

```
Value objects / policies → packages/<bc>/src/<Name>.ts
Domain services          → packages/<bc>/src/<Name>Service.ts
UI components            → packages/ui/src/ComponentName/ComponentName.tsx
shadcn components        → packages/ui/src/components/ui/
API routes               → apps/colloquium-api/src/routes/<resource>.ts
Event handlers           → apps/colloquium-api/src/handlers/<EventName>.ts
Repositories             → apps/colloquium-api/src/<domain>/<Name>Repository.ts
Projections              → apps/colloquium-api/src/<domain>/<Name>Projection.ts
Typed API clients        → apps/*/src/api/<name>.ts
React hooks              → apps/*/src/hooks/use<Name>.ts
Contract docs            → docs/contracts/CT-NNN-<kebab-name>.md
Aggregate specs          → docs/features/<BC>/<AggregateName>/spec.md
Handler specs            → docs/features/<BC>/<EndpointOrEventName>/spec.md (table, max 30 lines)
Component designs        → docs/features/<BC>/<ComponentName>/design.md
Migration rollback SQL   → docs/migrations/rollbacks/<name>-rollback.sql
```
````

**Step 6: Append Backend Conventions section**

```markdown
## Backend Conventions (Hard Rules)

- All public REST routes: OpenAPIHono `createRoute` — never plain `app.get()` for public-facing routes
- Auth: extract `requesterId` from Bearer JWT in route handler before any domain call
- Error mapping: domain error → HTTP status lives in route handler, never in domain layer
- DB: one `PrismaClient` singleton per process — never instantiate per-request
- Event handlers: validate against CT-NNN Zod schema before any domain call
```

**Step 7: Append Frontend Conventions section**

```markdown
## Frontend Conventions (Hard Rules)

- Server state: TanStack Query only — never raw `fetch()` inside a React component
- Class merging: `cn` always from `@colloquium/ui` (clsx + tailwind-merge — handles class conflicts). `@colloquium/utils` has a DIFFERENT `cn` (simple string join — NOT Tailwind-aware). Never use the utils version in components.
- Shadcn check: verify `packages/ui/src/components/ui/` before building any custom primitive
- Hook returns: named state values (`state: "Idle" | "Loading" | ...`), not boolean flags
- All hooks live in `apps/*/src/hooks/` — never in `packages/ui` during initial development. Components in `packages/ui` receive data via props, not hook imports.
```

**Step 8: Verify final line count**

```bash
wc -l CLAUDE.md
```

Must be ≤ 250. If over: tighten new sections.

**Step 9:** Commit:

```bash
git add CLAUDE.md
git commit -m "docs(claude): v3 taxonomy — add 6 sections, remove 3 outdated sections"
```

---

## Task 3: Update `version.md` — Add --migrate-v3 Handler

**File:** `.claude/commands/colloquium/version.md`

Read the file first. Find the section handling `--migrate` (v1→v2). Add a new section directly
after it:

````markdown
### --migrate-v3: Upgrade schemaVersion 2 → 3

When invoked as `/colloquium:version --migrate-v3`:

1. Read `.claude/sdlc/state.json`.
   If `schemaVersion` is already `3`, display "Already v3" and stop.
   If `schemaVersion` is not `2`, display error and stop.

2. Normalize `completedFeatures`: for each version in `state.versions`, rewrite any bare ID
   (e.g., `"feat-001"`) to scoped format (e.g., `"SL-001/feat-001"`).
   Scoped IDs (those containing "/") are already correct — leave unchanged.
   Use the slice ID from the version's `slices` keys to determine the prefix.
   If a bare ID cannot be matched to a slice, **stop and require manual correction**.

3. Set `schemaVersion` to `3`.

4. Set `lastUpdated` to current ISO timestamp.

5. Write the updated state.json.

6. Scan all features across all slices. Collect any features with `state ≠ "done"`.
   Leave their `type` values as-is (do NOT auto-reclassify — requires human judgement).

7. Display:

```
✅ Migrated to schemaVersion 3
Normalized completedFeatures: <count> bare IDs → scoped format
New features should use {domain}:{type}:{name} format with variant field.

⚠️ In-progress features (type must be manually reclassified before resuming):
<list each: featureId, current type, current state — or "none" if all done>

⚠️ Legacy "contract" features require manual reclassification:
The dispatcher cannot auto-route "contract" — it may be backend:handler (api) or
backend:handler (event). Reclassify and set variant before running /colloquium:feature-implement.
<list each: featureId with type="contract", regardless of state>
```

8. **State mapping for reclassified in-progress features:** When the user reclassifies a legacy
   feature that is NOT at `done` state, apply per-C-state mapping (not ranges):

   **For `contract` → `backend:handler`:**

   | Legacy state | → variant: api | → variant: event |
   | ------------ | -------------- | ---------------- |
   | C0           | A0             | A0               |
   | C2           | A1             | A1               |
   | C3           | A2             | A2               |
   | C4           | A3             | A3               |
   | C5           | A3             | A3               |
   | C6           | A3             | A3               |
   | C7           | A4             | A4               |

   **For `read-model` → frontend types:**

   | Legacy state | → client (hook) | → client (api-client) | → visual (component) | → visual (page) |
   | ------------ | --------------- | --------------------- | -------------------- | --------------- |
   | C0           | F0              | F0                    | D0                   | D0              |
   | C2           | F1              | F1                    | D1                   | D1              |
   | C3           | F2              | F2                    | D2                   | D2              |
   | C4           | F3              | F3                    | D3                   | D3              |
   | C5           | F3              | F3                    | D3                   | D3              |
   | C6           | F3              | F3                    | D3                   | D3              |
   | C7           | F4              | F4                    | D3                   | D3              |

   Write the mapped state to state.json. Display a warning:
   "State mapped from legacy C-state <old> → <new>. The mapping is approximate — review the
   current sub-step before proceeding."

   Legacy features at `done` state are unaffected.
````

Commit:

```bash
git add .claude/commands/colloquium/version.md
git commit -m "feat(sdlc): add --migrate-v3 handler to version skill"
```

---

## Task 4: ~~Run the Migration~~ DEFERRED — see Task 9.8

**Moved to Task 9.8.** The migration must run AFTER all skills accept schemaVersion 3.
Running it here would leave the system in a half-migrated state if any skill update (Tasks 5–9.7)
fails. See "Critical ordering rule" in the execution section above.

---

## Task 5: Update `slice-deliver` for v3

**File:** `.claude/commands/colloquium/slice-deliver.md`

Read the file first. Make these targeted changes:

**Step 1:** Change all `schemaVersion = 2` checks to accept `schemaVersion ∈ {2, 3}` (both).

**Step 2:** Rewrite the feature decomposition section to produce all 7 types with variants.

Replace the current three-category decomposition with:

```markdown
### Decomposition — Core Types (from model.md aggregates)

For each aggregate in model.md:

- Create one `core:aggregate` feature per aggregate
- **Bundle** all value objects referenced by the aggregate into a single `core:primitive`
  feature (variant: `value-object`). Set `items` array listing each VO name and kind.
  Dependency: none.
- For each domain service: create one `core:primitive` feature (variant: `service`).
  Dependency: the value objects it uses.

### Decomposition — Backend Types

For each aggregate that requires persistence:

- Create one `backend:migration` feature if new tables needed. Dependency: none.
- Create one `backend:persistence` feature (variant: `repository`).
  Dependency: the migration that creates its table.
- If read-side view needed: create one `backend:persistence` feature (variant: `projection`).
  Dependency: the migration that creates its read-side table.

For each contract in `currentSlice.contracts`:

- Read the CT-NNN file. If HTTP endpoint: create `backend:handler` (variant: `api`).
  If domain event: create `backend:handler` (variant: `event`). Do not guess — read the file.
  Dependency: the aggregate(s) on both sides.

### Decomposition — Frontend Types

For each API endpoint exposed by a `backend:handler` (api variant):

- Create one `frontend:client` feature (variant: `api-client`).
  Dependency: the `backend:handler` feature.

For each React hook needed to wire API data to UI:

- Create one `frontend:client` feature (variant: `hook`).
  Dependency: the `frontend:client` (api-client) it wraps (if any).

For each reusable UI component:

- Create one `frontend:visual` feature (variant: `component`). Dependency: none.

For each page assembling hooks + components:

- Create one `frontend:visual` feature (variant: `page`).
  Dependency: the hooks and components it uses.

**Frontend splitting criteria (when to create a separate feature vs. inline):**

- Component used by ≥ 2 pages → separate `frontend:visual` component
- Component with ≥ 3 visual states → separate `frontend:visual` component
- Hook managing domain state (not just a UI toggle) → separate `frontend:client` hook
- Hook wrapping API client with caching/mutation → separate `frontend:client` hook
- Page with ≥ 2 distinct user actions → separate `frontend:visual` page
- **Default:** When in doubt, inline. Extract later via reclassification if needed.

### Cross-slice dependencies

When decomposing features for SL-003 that depend on SL-002 artifacts, add the scoped ID
(e.g., `"SL-002/feat-001"`) to the `dependencies` array. Check `completedFeatures` to verify
the dependency exists. If not: warn "Cross-slice dependency not in completedFeatures."

### Legacy type conversion (for partially migrated slices)

- `type: "aggregate"` → `type: "core:aggregate"`
- `type: "contract"` → read CT-NNN. HTTP = `"backend:handler"` variant `"api"`,
  event = `"backend:handler"` variant `"event"`. If ambiguous, ask user.
- `type: "read-model"` → ask user: hook, api-client, component, or page?
```

**Step 3:** Replace the dependency ordering section with the sequential ordering rule:

```markdown
**Ordering rule (sequential — no concurrent features, dependency-first):**

Assign feature order using **dependency-first, type-precedence as tiebreaker**:

1. **Primary sort: topological order by `dependencies` array.** Features with no dependencies
   first. Features that depend on others come after their dependencies.
2. **Tiebreaker: type-precedence chain** (among features with identical dependency depth):
   `core:primitive → core:aggregate → backend:migration → backend:persistence → backend:handler → frontend:client → frontend:visual`
3. **Secondary tiebreaker:** alphabetical by BC name.

`activeFeature` is a single pointer. One feature executes at a time. The pointer advances
only when the current feature reaches `done` — there is no start-gate.

Set `activeFeature` to the first feature in the dependency-then-precedence-ordered queue.
```

**Step 3b:** Update the queue advance logic. Replace any check for `state = "C0"` with a
check for the type-appropriate initial state:

| Type                  | Queued (initial) state |
| --------------------- | ---------------------- |
| `core:primitive`      | `"L0"`                 |
| `core:aggregate`      | `"C0"`                 |
| `backend:migration`   | `"M0"`                 |
| `backend:handler`     | `"A0"`                 |
| `backend:persistence` | `"R0"`                 |
| `frontend:client`     | `"F0"`                 |
| `frontend:visual`     | `"D0"`                 |

The queue scanner sets `activeFeature` to the first feature (in topological-then-type-precedence
order) whose state equals the type-appropriate initial state **AND all entries in its
`dependencies` array exist in `completedFeatures`**. It then checks for paused features
(see stuck handling): if no initial-state features are eligible, offer paused features to the
user via AskUserQuestion.

**Step 4:** Update the example feature JSON:

```json
{
  "id": "feat-001",
  "name": "messaging-primitives",
  "bc": "Messaging",
  "type": "core:primitive",
  "variant": "value-object",
  "items": [
    { "name": "channel-id", "kind": "value-object", "status": "pending" },
    { "name": "message-content", "kind": "value-object", "status": "pending" }
  ],
  "dependencies": [],
  "state": "L0",
  "history": []
}
```

For non-batched features (no items array):

```json
{
  "id": "feat-003",
  "name": "get-channel-messages",
  "bc": "Messaging",
  "type": "backend:handler",
  "variant": "api",
  "dependencies": ["feat-002"],
  "state": "A0",
  "history": []
}
```

**Step 4b:** Set correct initial state for each type when creating feature entries:

| Type                  | Initial state | Note                                     |
| --------------------- | ------------- | ---------------------------------------- |
| `core:primitive`      | `"L0"`        | activation                               |
| `core:aggregate`      | `"C0"`        | activation                               |
| `backend:migration`   | `"M0"`        | activation                               |
| `backend:handler`     | `"A0"`        | activation                               |
| `backend:persistence` | `"R0"`        | activation                               |
| `frontend:client`     | `"F0"`        | activation                               |
| `frontend:visual`     | `"D0"`        | activation (feature-spec advances to D1) |

Commit:

```bash
git add .claude/commands/colloquium/slice-deliver.md
git commit -m "feat(sdlc): update slice-deliver — v3 7 types + variants + batching"
```

---

## Task 6: Rewrite `feature-spec` as Type-Aware

**File:** `.claude/commands/colloquium/feature-spec.md`

Read the file first. Replace the generation mode section with 7-type routing:

````markdown
### Step 3: Route by feature type

Read `currentFeature.type` and `currentFeature.variant`.

**`core:aggregate`:**
Generate full spec.md. Format unchanged: state machine, invariants, failure modes, external
contracts, test strategy. File: `docs/features/<bc>/<PascalName>/spec.md`.
State advance: C0 → C2.

**`core:primitive`:**
Display JSDoc template based on variant:

_value-object variant:_

```typescript
/**
 * [Name]: [one sentence — what value does this represent?]
 *
 * Validation: [list rules — e.g., "must be non-empty", "must be positive integer"]
 * Equality: [value equality by attribute(s)]
 */
```

_service variant:_

```typescript
/**
 * [ServiceName]: [one sentence — what does this service coordinate?]
 *
 * Dependencies:
 *   - [DependencyInterface]: [purpose]
 */
export interface [ServiceName] {
  [methodName]([params]): Promise<[ReturnType]>;
}
```

For batched features (items array present), display a JSDoc template for EACH item in the bundle.
No file written. State advance: L0 → L1.

**`backend:migration`:**
Check: test DB must be running. If absent: display warning and stop.
Display: "No spec.md for migrations. Write schema changes at M1."
State advance: M0 → M1.

**`backend:handler`:**
Generate table-format spec.md (max 30 lines) based on variant:

_api variant:_ endpoint path + method, Zod request/response, auth, error mapping table.
_event variant:_ event name, CT-NNN reference (file MUST exist), consumed Zod schema, command
produced, error handling. Before writing: verify CT-NNN file exists.

If spec exceeds 30 lines: split into two features. Do not proceed.
File: `docs/features/<bc>/<Name>/spec.md`.
State advance: A0 → A1.

**`backend:persistence`:**
Check: test DB must be running. If absent: display warning and stop.
Display: "TypeScript interface IS the spec — no spec.md. Write the interface at R1."
State advance: R0 → R1.

**`frontend:client`:**
Display JSDoc block template (max 20 lines) based on variant:

_api-client variant:_

```typescript
/**
 * [Name]Api: typed client for [description].
 *
 * Endpoint: [METHOD] /path
 * Request: [Zod input type]
 * Response: [Zod response type]
 * Auth: [Bearer token | none]
 */
```

_hook variant:_

```typescript
/**
 * [Hook name]: [one sentence description]
 *
 * State machine: Idle | Loading | Loaded | Error (if applicable)
 *
 * @param [param] - [description]
 * @returns [description]
 *
 * Depends on: [CT-NNN or Zustand store or other hook]
 */
```

No file written. State advance: F0 → F1.

**`frontend:visual`:**

_component variant:_
Invoke `skills:ui-design-expert` to generate design proposal. Display and wait for user
approval before writing anything.
On approval: write `docs/features/<bc>/<ComponentName>/design.md`.
State advance: D0 → D1.

_page variant:_
Generate assembly plan JSDoc. Display and wait for user approval.
Content: hooks used, components assembled, URL params, layout, all page states.
On approval: write JSDoc as comment block to page component file.
State advance: D0 → D1.
````

Update schemaVersion checks to accept `{2, 3}` (both).

**Replace the enforcement check:** The current feature-spec enforces `currentFeature.state = "C0"`.
Replace with type-appropriate initial state check:

| Type                  | Required initial state |
| --------------------- | ---------------------- |
| `core:primitive`      | `"L0"`                 |
| `core:aggregate`      | `"C0"`                 |
| `backend:migration`   | `"M0"`                 |
| `backend:handler`     | `"A0"`                 |
| `backend:persistence` | `"R0"`                 |
| `frontend:client`     | `"F0"`                 |
| `frontend:visual`     | `"D0"`                 |

Commit:

```bash
git add .claude/commands/colloquium/feature-spec.md
git commit -m "feat(sdlc): make feature-spec type-aware — 7-type routing with variants"
```

---

## Task 7: Write Six Sub-Skill Files

Write each file in order. All are invoked by the dispatcher (Task 8), not by the user directly.

**Cross-cutting: quality gate tiers.** Every sub-skill has two quality gate tiers:

- **Light gate** (mid-loop advances): `pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm --filter <affected-package> test`
- **Full gate** (loop-complete advance ONLY): `pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm turbo test` (all packages)

**Exception:** L-loop value-object variant skips mid-loop light gates. Full gate at L4 only.

**Cross-cutting: stuck handling.** Every sub-skill file must include in its Enforcement Rules:

```markdown
N. **Stuck escape hatch.** At any human checkpoint or quality gate failure, if the user
replies `stuck: <reason>`, trigger the stuck-handling flow:

- Record history entry: `{ type: "stuck", reason: "<reason>", state: "<current>" }`
- Ask via AskUserQuestion: Rollback (reset to initial), Remove (skip), Reclassify (change type),
  or Pause (set `feature.paused = true`, advance to next feature).
- **Reclassify:** resets to new loop's initial state. Old artifacts deleted.
- **Pause resume:** paused features are offered by the queue scanner after all initial-state
  features are exhausted. User can also force-resume via `/colloquium:sdlc --resume <feat-id>`.
- Update state.json. Display: "Feature <feat-id> marked as <choice>. Run /colloquium:sdlc."
```

---

### Task 7a: `feature-implement-aggregate.md`

**File:** `.claude/commands/colloquium/feature-implement-aggregate.md`

Copy from current feature-implement.md then edit:

```bash
cp .claude/commands/colloquium/feature-implement.md \
   .claude/commands/colloquium/feature-implement-aggregate.md
```

Changes:

1. Title: `# colloquium:feature-implement-aggregate — DDD Aggregate Loop (C2 → C7)`
2. Schema check: accept `schemaVersion ∈ {2, 3}` (both)
3. Remove feature-type enforcement — dispatcher handles routing
4. Add quality gate blocks (light for mid-loop, full for C7)
5. Add domain event creation step at C5
6. **Redefine C6**: aggregate-internal wiring only. Concrete deliverables checklist:
   - Domain event type files at `packages/<bc>/src/events/<EventName>.ts` (skip if zero events)
   - Port interfaces (TypeScript interfaces for external deps like repos, publishers) (skip if zero ports)
   - Aggregate factory/builder (skip if constructor is sufficient)
   - If ALL three items are skipped: advance directly from C5 to C7. Record history:
     `{ type: "c6-skip", reason: "no events, no ports, no factory" }`.
   - NOT: repository implementation (R-loop), HTTP handler (A-loop), projection (R-loop).

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-aggregate.md
git commit -m "feat(sdlc): add feature-implement-aggregate (DDD loop extracted)"
```

---

### Task 7b: `feature-implement-primitive.md`

**File:** `.claude/commands/colloquium/feature-implement-primitive.md`

Write from scratch:

````markdown
# colloquium:feature-implement-primitive — Lightweight Loop (L1 → L4)

**Purpose:** Implement `core:primitive` features — value objects, policies, specifications
(variant: value-object) and stateless domain services (variant: service).
Supports batched features (items array). Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "core:primitive"`.
   Require `feature.state` ∈ {L1, L2, L3}.
   Read `feature.variant` — determines test style and review requirements.

---

## Session Start

Display:

```
════════════════════════════════════════════════════════════════
▶ PRIMITIVE LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Variant: <feature.variant>
File: packages/<bc>/src/<Name>.ts (or packages/utils/src/<name>.ts)
Items: <list items if batched, else "single">
════════════════════════════════════════════════════════════════
```

Jump to sub-step matching current state.
For batched features, check `item.status` field — skip items with `status = "done"`,
continue from first `"pending"` item. This enables crash recovery mid-bundle.

---

## L1 → L2: Write Signature + Tests

**Package scaffold check:** If `packages/<bc-name>/` does not exist, create the package
scaffold: `package.json`, `tsconfig.json`, `src/index.ts`. Add to turbo pipeline. Run
`pnpm install` to link.

**For each item (or single feature):**

### value-object variant:

Write the type/function signature with JSDoc in source file:

```typescript
/**
 * ChannelId: identifies a channel uniquely.
 * Validation: must be a non-empty string UUID (v4).
 * Equality: value equality.
 */
export type ChannelId = string & { readonly _brand: "ChannelId" };
export function channelId(value: string): ChannelId { ... }
```

Write pure tests (Vitest, zero mocks):

- Valid construction
- Invalid construction (throws/error)
- Equality semantics
  All must FAIL before implementation.

### service variant:

Write TypeScript interface + JSDoc:

```typescript
export interface ChannelAccessService {
  canPost(userId: UserId, channelId: ChannelId): Promise<boolean>;
}
```

All injected dependencies as constructor parameters (typed interfaces, never concrete classes).

Write mocked unit tests (vi.fn()):

- One test per method
- Test behavior given various mocked return values
  All must FAIL before implementation.

**Quality gate:** value-object variant skips mid-loop gate (pure functions, zero side effects).
Service variant runs light gate.
State write: `"L2"`.

---

## L2 → L3: Implement + Export

**For each item (or single feature):**

1. Write implementation satisfying signature/interface.
2. Run tests — all must pass.
3. Export from package index.
4. **Batched features:** set `item.status = "done"` in state.json for the completed item.

**Service variant only — code review:**

- All dependencies injected (none inline)?
- Stateless (no mutable fields)?
- No hidden I/O?
  Code review failure → fix in-place, re-run, re-request. Do NOT reset.

State write: `"L3"`.

---

## L3 → L4: Done (Direct — No feature-integrate)

Full quality gate: `pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm turbo test`.

Write `"done"` to state.json (L-loop owns the done transition for core:primitive).
Add to `completedFeatures` with idempotent append.
Advance `activeFeature` to next queued feature.

Display:

```
════════════════════════════════════════════════════════════════
✅ Primitive loop complete — <feat-id>: <name>
<count> items implemented. Next feature activated.
════════════════════════════════════════════════════════════════
```
````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-primitive.md
git commit -m "feat(sdlc): add feature-implement-primitive (L-loop, batching, direct-done)"
```

---

### Task 7c: `feature-implement-migration.md`

**File:** `.claude/commands/colloquium/feature-implement-migration.md`

Write from scratch:

````markdown
# colloquium:feature-implement-migration — Migration Loop (M1 → M4)

**Purpose:** Implement `backend:migration` features — Prisma schema changes with deployment
risk, rollback documentation, and test DB verification. No automated unit tests.
Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "backend:migration"`.
   Require `feature.state` ∈ {M1, M2, M3}.
2. Test DB must be running. If absent: display "Test DB is not running." Stop.

---

## Session Start

Display:

```
════════════════════════════════════════════════════════════════
▶ MIGRATION LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Schema: apps/colloquium-api/prisma/schema.prisma
════════════════════════════════════════════════════════════════
```

---

## M1 → M2: Update schema.prisma

1. Edit schema.prisma — add table, column, or index.
2. Document rollback path in a comment block.
3. Quality gate: typecheck (schema changes regenerate Prisma client).
   State write: `"M2"`.

---

## M2 → M3: Generate Migration File

```bash
cd apps/colloquium-api
pnpm prisma migrate dev --name <kebab-name> --create-only
```

Review generated SQL: additive only, no data loss, no irreversible ops without sign-off.
State write: `"M3"`.

---

## M3 → M4: Deploy to Test DB + Verify

```bash
cd apps/colloquium-api
pnpm prisma migrate deploy
```

Verify migration succeeded. Write rollback SQL to `docs/migrations/rollbacks/<name>-rollback.sql`.

Quality gate (typecheck + lint after client regeneration).

**Deadlock escape:** If the full gate reveals a broken test owned by a different feature (e.g.,
a repository integration test), do NOT fix it here.

1. Record history: `{ type: "test-breakage", details: "<which test, which package>" }`.
2. Check if the owning feature is **ahead** (not yet done) or **behind** (already at `done`):
   - **Ahead:** The owning feature will fix it when its loop activates. No further action.
   - **Behind (already done):** Auto-create a `core:primitive` (variant: `service`) fix feature
     in the current slice queue, with dependency on this migration, placed immediately after it.
     The L-loop will fix the test and verify at L4's full gate.
3. Advance to M4.

Advance to `"M4"` (loop-complete). **Do NOT write `"done"` — feature-integrate owns that.**

Display:

```
════════════════════════════════════════════════════════════════
✅ Migration loop complete — <feat-id>: <name>
Rollback SQL: docs/migrations/rollbacks/<name>-rollback.sql
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════
```
````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-migration.md
git commit -m "feat(sdlc): add feature-implement-migration (M-loop, deadlock escape)"
```

---

### Task 7d: `feature-implement-handler.md`

**File:** `.claude/commands/colloquium/feature-implement-handler.md`

Write from scratch:

````markdown
# colloquium:feature-implement-handler — Handler Loop (A1 → A4)

**Purpose:** Implement `backend:handler` features — REST endpoints (variant: api) and domain
event ACL handlers (variant: event). Tests via app.request() for api, direct call for event.
Playwright never tests handler behavior. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "backend:handler"`.
   Require `feature.state` ∈ {A1, A2, A3}.
   Read `feature.variant` — determines test tool and spec format.
2. Read spec at `docs/features/<bc>/<name>/spec.md`.
3. Event variant only: read the CT-NNN contract file referenced in spec.

---

## Session Start

Display:

```
════════════════════════════════════════════════════════════════
▶ HANDLER LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Variant: <feature.variant>
Spec: docs/features/<bc>/<name>/spec.md
════════════════════════════════════════════════════════════════
```

---

## A1 → A2: Write Tests

### api variant:

Before tests: verify spec ≤ 30 lines. If over: split or extract shared errors.

1. One test per error mapping row using `app.request()`.
2. One happy-path test (valid auth + valid payload → expected response).
3. One missing-auth test (no Authorization → 401).
   All must FAIL.

### event variant:

Before tests: verify consumed Zod schema matches CT-NNN line by line. If divergent, update spec.

1. Schema-rejection test: payload missing required CT-NNN field → handler rejects (Zod parse fail),
   domain command NOT issued. Direct handler function call.
2. Happy-path test: valid CT-NNN payload → correct domain command issued. Direct call.
   All must FAIL.

Quality gate on test files. State write: `"A2"`.

---

## A2 → A3: Implement Handler

### api variant:

OpenAPIHono `createRoute`, auth extraction (Bearer JWT → requesterId), Zod validation,
domain call, error mapping per spec.

### event variant:

Zod parse of incoming payload against CT-NNN schema. Domain command if valid. Reject if invalid.

Run tests — all must pass.
Quality gate. State write: `"A3"`.

---

## A3 → A4: Code Review

Invoke `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

### api variant checklist:

- Auth checked before domain call?
- Every error mapping row covered by a test?
- N+1 risk in domain call?
- OpenAPI schema matches actual response shape?

### event variant checklist:

- CT-NNN Zod schema validated before any domain call?
- Invalid payload behavior matches spec (discard vs. reject)?
- No N+1 in domain call?

Full quality gate. Advance to `"A4"` (loop-complete).
**Do NOT write `"done"` — feature-integrate owns that.**

Display:

```
════════════════════════════════════════════════════════════════
✅ Handler loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════
```
````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-handler.md
git commit -m "feat(sdlc): add feature-implement-handler (A-loop, api+event variants)"
```

---

### Task 7e: `feature-implement-persistence.md`

**File:** `.claude/commands/colloquium/feature-implement-persistence.md`

Write from scratch:

````markdown
# colloquium:feature-implement-persistence — Persistence Loop (R1 → R5)

**Purpose:** Implement `backend:persistence` features — command-side repositories (variant:
repository) and query-side projections (variant: projection). TypeScript interface IS the spec.
Integration tests use real Prisma client against test DB. Invoked by dispatcher.

---

## Enforcement

1. Resolve context (v3). Require `feature.type = "backend:persistence"`.
   Require `feature.state` ∈ {R1, R2, R3, R4}.
   Read `feature.variant`.
2. Test DB must be running. If absent: display "Test DB is not running." Stop.

---

## Session Start

Display:

```
════════════════════════════════════════════════════════════════
▶ PERSISTENCE LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Variant: <feature.variant>
Interface: apps/colloquium-api/src/<domain>/<Name>.ts
════════════════════════════════════════════════════════════════
```

---

## R1 → R2: Write TypeScript Interface

### repository variant:

```typescript
export interface ChannelRepository {
  save(channel: Channel): Promise<void>;
  findById(id: ChannelId): Promise<Channel | null>;
}
```

### projection variant:

```typescript
export interface ChannelFeedProjection {
  applyEvent(event: DomainEvent): Promise<void>;
  findFeedByChannelId(channelId: ChannelId): Promise<FeedItem[]>;
}
```

JSDoc on applyEvent must name CT-NNN event(s) that trigger it.

Quality gate. State write: `"R2"`.

---

## R2 → R3: Write Integration Tests

Test DB must be available.

### repository variant:

One test per method. Not-found behavior. Transaction behavior if applicable.

### projection variant:

Call applyEvent with sequence of realistic events (CT-NNN payload shape) → query read-side
table → assert correct materialized state. Query method tests: shape and ordering.

All must FAIL before implementation.
Quality gate. State write: `"R3"`.

---

## R3 → R4: Implement

Write Prisma implementation satisfying the interface.
Quality gate. State write: `"R4"`.

---

## R4 → R5: Code Review

Invoke `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

### repository variant checklist:

- N+1 in any method?
- Missing indexes?
- Connection released in all paths?

### projection variant checklist:

- applyEvent idempotent? (same event twice = no duplicate)
- Missing indexes on read-side table?
- Connection released in all paths?

Full quality gate. Advance to `"R5"` (loop-complete).
**Do NOT write `"done"` — feature-integrate owns that.**
````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-persistence.md
git commit -m "feat(sdlc): add feature-implement-persistence (R-loop, repo+projection variants)"
```

---

### Task 7f: `feature-implement-client.md`

**File:** `.claude/commands/colloquium/feature-implement-client.md`

Write from scratch:

````markdown
# colloquium:feature-implement-client — Client Loop (F1 → F4)

**Purpose:** Implement `frontend:client` features — typed fetch wrappers (variant: api-client)
and React hooks (variant: hook). All client features live in apps/, never packages/ui.
Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "frontend:client"`.
   Require `feature.state` ∈ {F1, F2, F3}.
   Read `feature.variant`.
2. If `feature.state = "F0"`: display "JSDoc not approved — run /colloquium:feature-spec." Stop.

---

## Session Start

Display:

```
════════════════════════════════════════════════════════════════
▶ CLIENT LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Variant: <feature.variant>
File: apps/<app>/src/api/<name>.ts (api-client) or apps/<app>/src/hooks/use<Name>.ts (hook)
════════════════════════════════════════════════════════════════
```

---

## F1 → F2: Write Interface + Tests

### api-client variant:

Write interface in source file. JSDoc: endpoint, Zod types, auth.
Write tests using `vi.spyOn(globalThis, 'fetch')`. No RTL. No QueryClientProvider.

- Happy path: spy returns 200 → correct decode
- Error path: spy returns 4xx/5xx → correct error shape
  All must FAIL.

### hook variant:

Write interface in source file. JSDoc: state machine, params, returns, dependencies.

If hook has state machine (useReducer or state enum):

- Extract reducer/transition as pure function
- Write pure tests (zero React imports): input state + action → output state
- Write RTL renderHook integration test
  All must FAIL.

If hook has no state machine:

- Write RTL renderHook return-shape test (must assert something real — never
  `expect(true).toBe(true)`)
- If TanStack Query hook: QueryClientProvider + real QueryClient + vi.spyOn(globalThis, 'fetch')
  Must FAIL.

Quality gate. State write: `"F2"`.

---

## F2 → F3: Implement + Quality Gate

Implement, run tests (all PASS), export.
Quality gate. State write: `"F3"`.

---

## F3 → F4: Convention Check + Loop-Complete

### api-client variant:

No convention check. Full quality gate. Write `"done"` directly (F-loop owns `done` for
api-client — skips feature-integrate, same rationale as L-loop for core:primitive).
Add to `completedFeatures` with idempotent append. Advance `activeFeature` to next queued feature.

Display:

```
════════════════════════════════════════════════════════════════
✅ Client loop complete (direct-done) — <feat-id>: <name>
Next feature activated.
════════════════════════════════════════════════════════════════
```

### hook variant:

Verify convention checklist:

- Exported from `apps/*/src/hooks/`?
- TypeScript interface exported as named type?
- Returns named state values, not boolean flags?
- JSDoc matches F1 template?
  Fix in-place if any fail. F4 is a verify checkpoint, not a restart.

Full quality gate. Advance to `"F4"` (loop-complete).
**Do NOT write `"done"` — feature-integrate owns that (hook variant only).**

Display:

```
════════════════════════════════════════════════════════════════
✅ Client loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════
```
````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-client.md
git commit -m "feat(sdlc): add feature-implement-client (F-loop, api-client+hook variants)"
```

---

### Task 7g: `feature-implement-visual.md`

**File:** `.claude/commands/colloquium/feature-implement-visual.md`

Write from scratch:

````markdown
# colloquium:feature-implement-visual — Visual Loop (D1 → D4)

**Purpose:** Implement `frontend:visual` features — reusable React components (variant:
component) and assembled pages (variant: page). D0 → D1 is owned by `feature-spec`.
This loop starts at D1. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "frontend:visual"`.
   Require `feature.state` ∈ {D1, D2, D3}.
   Read `feature.variant`.
2. If `feature.state = "D0"`: display "Design/plan gate not complete — run
   /colloquium:feature-spec first." Stop.
3. Component variant: read `docs/features/<bc>/<ComponentName>/design.md`.
   Page variant: read JSDoc from page file.

---

## Session Start

Display:

```
════════════════════════════════════════════════════════════════
▶ VISUAL LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Variant: <feature.variant>
Design: <design.md path (component) or page file path (page)>
════════════════════════════════════════════════════════════════
```

---

## D1 → D2: Tests

### component variant:

Read design.md. Write RTL tests (all hooks mocked via vi.fn()):

- One test per visual state
- Interaction tests (click, input, submit)
- Conditional display tests
  All must FAIL before component exists.

### page variant:

Page was assembled at D1 (by feature-spec writing JSDoc + this loop assembling the page).
Assemble the page if not yet done:

- Import hooks from apps/\*/src/hooks/, components from packages/ui
- Handle all states: loading, error, empty, populated

Write RTL tests (hooks mocked): loading state, error state, populated state.
Tests must PASS (assembly-first — tests verify already-assembled page).
If tests FAIL: fix assembly at D2, re-run. Stay at D2 until passing. Do NOT go back to D1
(that would re-do the plan). If the plan itself is wrong, use `stuck: <reason>` → Rollback.

Quality gate. State write: `"D2"`.

---

## D2 → D3: Implement + Review

### component variant:

1. Implement per design.md: Tailwind, shadcn/ui, zero inline styles.
2. Generate visual harness: `packages/ui/src/<ComponentName>/__visual__/<ComponentName>.visual.tsx`
   Harness MUST wrap components in same providers as production app:
   - Theme provider / design tokens
   - CSS reset / global styles
   - Test QueryClient (for mocked hooks)
     Import providers from `packages/ui/src/__visual__/providers.tsx` (shared across all harnesses).
3. Export from `packages/ui/src/index.ts`.
4. Run RTL tests — all pass.
5. Code review: matches design.md? zero inline styles? tests passing? exported? harness renders
   all states?

### page variant:

1. Write Playwright E2E tests: one per critical path from JSDoc.
   Run against real server. Use data-testid or role selectors (no flaky CSS selectors).
2. Start dev server if not running.
3. Run Playwright — all pass.
4. Code review: all critical paths covered? no flaky selectors? teardown correct?
   If critical user-facing path, include manual walkthrough in E2E test file comment.

Quality gate. State write: `"D3"`.

---

## D3 → D4: Visual/E2E Gate

### component variant:

1. Start Vite dev server if not running.
2. Navigate Playwright to visual harness.
3. Take screenshot of each visual state section.
4. Display each screenshot alongside design.md spec.
5. **HUMAN CHECKPOINT — hard gate:**
   "Compare screenshots against design.md. Reply 'confirmed' or 'fix: <description>'."
6. If fix: return to D3, fix, re-run tests, re-present gate.
7. If 'redesign: <reason>': reset to D1, rewrite design.md, delete RTL + impl, re-enter D2.
   State write: `"D1"`, history: `{ type: "redesign", reason: "<reason>" }`.

### page variant:

Re-run full Playwright E2E suite as final integration check (non-mocked environment).
If all pass: D4 confirmed automatically (no human gate for pages — E2E is the gate).
If any fail: return to D3, fix, re-run.

State write: `"D4"` — loop-complete.
**Do NOT write `"done"` — feature-integrate owns that.**

Display:

```
════════════════════════════════════════════════════════════════
✅ Visual loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════
```
````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-visual.md
git commit -m "feat(sdlc): add feature-implement-visual (D-loop, component+page variants)"
```

---

## Task 8: Rewrite `feature-implement` as Dispatcher

**File:** `.claude/commands/colloquium/feature-implement.md`

Replace the entire file content:

````markdown
# colloquium:feature-implement — Implementation Dispatcher

**Purpose:** Read `feature.type` from state.json. Route to the correct specialized loop.
Contains NO implementation logic.

---

## Enforcement

1. Read `.claude/sdlc/state.json`. Accept `schemaVersion = 3` (or `2` for legacy).

   Resolve cursor:
   - Split `state.activeSlice` on "/" → [versionId, sliceId]
   - Split `state.activeFeature` on "/" → [versionId, sliceId, featureId]
   - `currentFeature = state.versions[versionId].slices[sliceId].features[featureId]`

   If no `activeFeature`: display "No active feature — run /colloquium:slice-deliver first." Stop.

2. Display:

```
════════════════════════════════════════════════════════════════
▶ FEATURE IMPLEMENT — <featureId>: <name>
════════════════════════════════════════════════════════════════
Type: <feature.type> (variant: <feature.variant>)
State: <feature.state>
════════════════════════════════════════════════════════════════
```

---

## Routing Table

| feature.type          | Route to                        | Legacy match                  |
| --------------------- | ------------------------------- | ----------------------------- |
| `core:aggregate`      | `feature-implement-aggregate`   | `aggregate`                   |
| `core:primitive`      | `feature-implement-primitive`   | —                             |
| `backend:migration`   | `feature-implement-migration`   | —                             |
| `backend:handler`     | `feature-implement-handler`     | —                             |
| `backend:persistence` | `feature-implement-persistence` | —                             |
| `frontend:client`     | `feature-implement-client`      | —                             |
| `frontend:visual`     | `feature-implement-visual`      | `read-model` (component/page) |

**For legacy `contract`:** Ask the user:
"Is this feature a REST endpoint or a domain event handler? Reply 'api' or 'event'."
Route to `feature-implement-handler` with the chosen variant.

**For legacy `read-model`:** Ask the user:
"Is this feature a hook, api-client, component, or page?"
Route to `feature-implement-client` or `feature-implement-visual` with chosen variant.

**For unrecognized types:**

```
❌ Unknown feature.type: "<type>"
Expected: core:aggregate | core:primitive | backend:migration | backend:handler
| backend:persistence | frontend:client | frontend:visual
Run /colloquium:slice-deliver to reclassify.
```

Stop.

---

## Dispatch

Announce: "Type is `<type>` (variant: `<variant>`) — routing to `<skill-name>`."

**Loop-complete state guard:** If `currentFeature.state` is the loop-complete state for its
type (L4, M4, A4, R5, F4, D4 — or C7/UV for aggregates), do NOT dispatch.

For `core:primitive` at L4 or done: display "Feature is already complete."
For `core:aggregate` at C7: display "Run /colloquium:feature-verify."
For `core:aggregate` at UV: display "Run /colloquium:feature-integrate."
For all other types at loop-complete: display "Run /colloquium:feature-integrate."

Invoke the target skill via the Skill tool. Do not repeat any loop logic here.
````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement.md
git commit -m "feat(sdlc): rewrite feature-implement as 7-route dispatcher"
```

---

## Task 9: Update `feature-verify`

**File:** `.claude/commands/colloquium/feature-verify.md`

Read the file first. Make these changes:

**Step 1:** Update schemaVersion check to accept `3` (and `2` for legacy).

**Step 2:** Replace the state enforcement block:

```markdown
Require `currentFeature.type = "core:aggregate"` (or legacy `"aggregate"`)
AND `currentFeature.state = "C7"`.

For all other types or states, display:
"feature-verify applies to core:aggregate features at C7 only.
All other feature types integrate directly from their final loop state.
Run /colloquium:feature-integrate instead."
Stop.
```

**Step 3:** Replace the state write from `"F4"` to `"UV"` (UAT Verified).

Commit:

```bash
git add .claude/commands/colloquium/feature-verify.md
git commit -m "feat(sdlc): restrict feature-verify to core:aggregate at C7"
```

---

## Task 9.5: Update `feature-integrate`

**File:** `.claude/commands/colloquium/feature-integrate.md`

Read the file first. Make these targeted changes:

**Step 1:** Update the entry state enforcement.

Replace: `Require currentFeature.state = "F4".`

With:

```markdown
`feature-integrate` is the **sole owner** of the `"done"` transition for all types EXCEPT
`core:primitive` (L-loop writes done directly) and `frontend:client` api-client variant
(F-loop writes done directly).

Entry state enforcement by type:

| Type                                   | Required entry state              |
| -------------------------------------- | --------------------------------- |
| `core:aggregate`                       | `"UV"` (set by feature-verify)    |
| `core:primitive`                       | N/A (L-loop writes done directly) |
| `frontend:client` (api-client variant) | N/A (F-loop writes done directly) |
| `backend:migration`                    | `"M4"`                            |
| `backend:handler`                      | `"A4"`                            |
| `backend:persistence`                  | `"R5"`                            |
| `frontend:client` (hook variant)       | `"F4"`                            |
| `frontend:visual`                      | `"D4"`                            |
| (any type)                             | `"done"` (crash recovery — no-op) |

If `currentFeature.type = "core:primitive"`: display "core:primitive features are marked
done by the L-loop directly. This feature should already be done." Stop.

If `currentFeature.type = "frontend:client"` AND `currentFeature.variant = "api-client"`:
display "api-client features are marked done by the F-loop directly." Stop.

If `currentFeature.state = "done"`: crash recovery — skip checklist, skip write, proceed
to queue advance.
```

**Step 2:** Update the queue advance logic.

Replace any check for `state = "C0"` with type-appropriate initial state:

| Type                  | Queued (initial) state |
| --------------------- | ---------------------- |
| `core:primitive`      | `"L0"`                 |
| `core:aggregate`      | `"C0"`                 |
| `backend:migration`   | `"M0"`                 |
| `backend:handler`     | `"A0"`                 |
| `backend:persistence` | `"R0"`                 |
| `frontend:client`     | `"F0"`                 |
| `frontend:visual`     | `"D0"`                 |

Scanner sets `activeFeature` to first feature (in topological-then-type-precedence order) at
initial state **AND all `dependencies` in `completedFeatures`**. After exhausting initial-state
features, check for paused features (`feature.paused = true` with met dependencies) and offer
them to the user via AskUserQuestion.

**Step 3:** Fix the `completedFeatures` write — idempotent scoped format:

```
const scopedId = `${sliceId}/${featureId}`;
if (!completedFeatures.includes(scopedId)) {
  completedFeatures.push(scopedId);
}
```

**Step 4:** Update schemaVersion check to accept `3` (and `2` for legacy).

**Step 5:** Make uat.md read conditional:

```markdown
If `currentFeature.type = "core:aggregate"` (or legacy `"aggregate"`):
Read `docs/features/<bc>/<AggregateName>/uat.md`.
Else:
Skip uat.md read.
```

**Step 6:** Make the integration checklist type-aware:

```markdown
**Integration checklist by type:**

`core:aggregate`, `backend:handler` (event variant):

1. Upstream wiring (event connections)
2. Downstream wiring (event connections)
3. Policy documents for new cross-cutting interactions
4. Feature flag lifecycle

`backend:handler` (api variant), `backend:persistence`:

1. Feature flag lifecycle
2. Verify no N+1 queries escaped code review

`backend:migration`:

1. Rollback SQL verified at `docs/migrations/rollbacks/`
2. Feature flag lifecycle (if behind a flag)

`frontend:client`, `frontend:visual`:

1. Feature flag lifecycle
```

Commit:

```bash
git add .claude/commands/colloquium/feature-integrate.md
git commit -m "feat(sdlc): update feature-integrate — 7 types, primitive skip, type-aware checklist"
```

---

## Task 9.6: Update `sdlc.md` Dispatcher Routing Table

**File:** `.claude/commands/colloquium/sdlc.md`

Read the file first. Replace the routing section with:

```markdown
### Routing by feature type and state

Read `currentFeature.type` and `currentFeature.state`.

| Type                                     | States  | Route to                              |
| ---------------------------------------- | ------- | ------------------------------------- |
| `core:aggregate` (or legacy `aggregate`) | C0      | `feature-spec`                        |
| `core:aggregate`                         | C2–C6   | `feature-implement` (→ aggregate)     |
| `core:aggregate`                         | C7      | `feature-verify`                      |
| `core:aggregate`                         | UV      | `feature-integrate`                   |
| `core:primitive`                         | L0      | `feature-spec`                        |
| `core:primitive`                         | L1–L3   | `feature-implement` (→ primitive)     |
| `core:primitive`                         | L4/done | Already complete                      |
| `backend:migration`                      | M0      | `feature-spec`                        |
| `backend:migration`                      | M1–M3   | `feature-implement` (→ migration)     |
| `backend:migration`                      | M4      | `feature-integrate`                   |
| `backend:handler`                        | A0      | `feature-spec`                        |
| `backend:handler`                        | A1–A3   | `feature-implement` (→ handler)       |
| `backend:handler`                        | A4      | `feature-integrate`                   |
| `backend:persistence`                    | R0      | `feature-spec`                        |
| `backend:persistence`                    | R1–R4   | `feature-implement` (→ persistence)   |
| `backend:persistence`                    | R5      | `feature-integrate`                   |
| `frontend:client`                        | F0      | `feature-spec`                        |
| `frontend:client`                        | F1–F3   | `feature-implement` (→ client)        |
| `frontend:client` (api-client)           | F4/done | Already complete (F-loop writes done) |
| `frontend:client` (hook)                 | F4      | `feature-integrate`                   |
| `frontend:visual`                        | D0      | `feature-spec`                        |
| `frontend:visual`                        | D1–D3   | `feature-implement` (→ visual)        |
| `frontend:visual`                        | D4      | `feature-integrate`                   |

**"done" state for ANY type:** already integrated. If activeFeature points here,
feature-integrate handles as no-op pass-through (queue advance).

For legacy types (`contract`, `read-model`): ask user to reclassify.
Display: "Legacy type '<type>' — reclassify to v3 type before proceeding.
Run /colloquium:version --migrate-v3 for guidance."

### --resume handler

When invoked as `/colloquium:sdlc --resume <feat-id>`:

1. Find the feature by ID across all slices in the active version.
2. Reject if feature is `done` or has `{ type: "removed" }` in history.
3. Clear `feature.paused` if set.
4. Set `activeFeature` to the feature's full path (`versionId/sliceId/featId`).
5. Route to the appropriate skill per the routing table above.

This is the explicit mechanism for resuming paused features or manually overriding the
queue scanner's feature selection.
```

**Step 2:** Update schemaVersion check to accept `{2, 3}` (both).

Commit:

```bash
git add .claude/commands/colloquium/sdlc.md
git commit -m "feat(sdlc): update sdlc dispatcher routing table for v3 7-type states"
```

---

## Task 9.7: Update `status.md` for New State Codes

**File:** `.claude/commands/colloquium/status.md`

Read the file first. Add state descriptions for all new prefixes:

```markdown
### State Code Descriptions

| Code  | Meaning                                 |
| ----- | --------------------------------------- |
| L0    | Queued (primitive)                      |
| L1    | JSDoc/interface template approved       |
| L2    | Signature + tests written               |
| L3    | Implementation complete                 |
| L4    | Done (L-loop writes done directly)      |
| M0    | Queued (migration)                      |
| M1    | Schema.prisma updated                   |
| M2    | Migration file generated                |
| M3    | Migration deployed to test DB           |
| M4    | Migration verified (loop-complete)      |
| A0    | Queued (handler)                        |
| A1    | Spec written (table format)             |
| A2    | Tests written                           |
| A3    | Handler implemented                     |
| A4    | Code review complete (loop-complete)    |
| R0    | Queued (persistence)                    |
| R1    | Spec acknowledged                       |
| R2    | Interface written                       |
| R3    | Integration tests written               |
| R4    | Implementation written (pre-review)     |
| R5    | Code review passed (loop-complete)      |
| F0    | Queued (client)                         |
| F1    | JSDoc template approved                 |
| F2    | Interface + tests written               |
| F3    | Implementation complete                 |
| F4    | Convention check passed (loop-complete) |
| D0    | Queued (visual — needs feature-spec)    |
| D1    | Design/plan approved                    |
| D2    | Tests written                           |
| D3    | Implemented + reviewed                  |
| D4    | Visual/E2E gate confirmed               |
| UV    | UAT verified (aggregate only)           |
| C0–C7 | (Unchanged — aggregate states)          |
```

**Step 2:** Update schemaVersion check to accept `{2, 3}` (both).

Commit:

```bash
git add .claude/commands/colloquium/status.md
git commit -m "feat(sdlc): update status dashboard with v3 7-type state descriptions"
```

---

## Task 9.8: Run the Migration (MOVED from Task 4)

**Why here:** All skills now accept schemaVersion 2 AND 3. The migration is safe — if it fails,
`git checkout -- .claude/sdlc/state.json` restores v2 and all skills still work.

Invoke `/colloquium:version --migrate-v3`.

**Rollback:** If the migration produces incorrect results:

```bash
git checkout -- .claude/sdlc/state.json
```

After completion, verify:

```bash
cat .claude/sdlc/state.json | python3 -m json.tool | grep schemaVersion
# Must show: 3

cat .claude/sdlc/state.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
```

Commit:

```bash
git add .claude/sdlc/state.json
git commit -m "feat(sdlc): migrate state.json to schemaVersion 3"
```

---

## Task 10: End-to-End Validation

**Step 1:** Read `feature-implement.md`. Confirm all 7 types have a route in the routing table.

**Step 2:** Verify sub-skill files exist:

```bash
ls .claude/commands/colloquium/feature-implement-*.md
```

Expected (7 files):
`aggregate.md`, `primitive.md`, `migration.md`, `handler.md`, `persistence.md`,
`client.md`, `visual.md`

**Step 3:** Verify state.json:

```bash
cat .claude/sdlc/state.json | python3 -m json.tool | grep schemaVersion
# Must show: 3

cat .claude/sdlc/state.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
```

**Step 4:** Verify CLAUDE.md line count:

```bash
wc -l CLAUDE.md
# Must be ≤ 250
```

**Step 5:** Verify deprecated skill is gone:

```bash
ls .claude/commands/colloquium/project.md 2>&1
# Must show: No such file or directory
```

**Step 6:** Verify D-loop entry enforcement:
Read `feature-implement-visual.md` — confirm it blocks at D0 with message to run feature-spec.

**Step 7:** If `simulate.md` exists, update routing tables for 7 types. If absent, skip.

**Step 8:** Verify `sdlc.md` routing covers all new states including loop-complete:
L0–L4, M0–M4, A0–A4, R0–R5, F0–F4, D0–D4 in addition to existing C0–C7.

**Step 9:** Verify `status.md` has descriptions for all state codes.

**Step 10: Dry-run validation — route-test three loop families through the dispatcher.**

**10a. Core family — `core:primitive` (value-object variant):**

1. Create throwaway: `type: "core:primitive"`, `variant: "value-object"`, `state: "L0"`.
2. Invoke `/colloquium:sdlc`. Verify: routes to `feature-spec`.
3. Set state to `"L2"`. Invoke `/colloquium:sdlc`. Verify: routes to `feature-implement` → primitive.
4. Set state to `"L4"`. Invoke `/colloquium:sdlc`. Verify: shows "already complete."

**10b. Backend family — `backend:handler` (api variant):**

1. Create throwaway: `type: "backend:handler"`, `variant: "api"`, `state: "A0"`.
2. Invoke `/colloquium:sdlc`. Verify: routes to `feature-spec`.
3. Set state to `"A2"`. Verify: routes to `feature-implement` → handler.
4. Set state to `"A4"`. Verify: routes to `feature-integrate`.

**10c. Frontend family — `frontend:visual` (component variant):**

1. Create throwaway: `type: "frontend:visual"`, `variant: "component"`, `state: "D0"`.
2. Invoke `/colloquium:sdlc`. Verify: routes to `feature-spec`.
3. Set state to `"D2"`. Verify: routes to `feature-implement` → visual.
4. Set state to `"D4"`. Verify: routes to `feature-integrate`.

**10d. Legacy type handling:**

1. Create throwaway: `type: "contract"`, `state: "C2"`.
2. Invoke `/colloquium:sdlc`. Verify: asks user to reclassify.

**10e. Crash recovery:**

1. Create throwaway: `type: "backend:handler"`, `state: "done"`.
2. Invoke `/colloquium:sdlc`. Verify: routes to `feature-integrate` → no-op pass-through.

**10f. Clean up.** Remove all throwaway features. Restore `activeFeature`.

**Step 11:** Invoke `superpowers:verification-before-completion`.

**Final commit:**

```bash
git add .claude/commands/colloquium/
git commit -m "feat(sdlc): complete v3 taxonomy — 7-type dispatcher + variant loops"
```
