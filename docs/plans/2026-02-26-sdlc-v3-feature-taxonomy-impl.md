# SDLC v3 Feature Taxonomy — Implementation Plan

> **For Claude:** Use `superpowers:executing-plans` to implement this plan task-by-task.

**Revised:** 2026-03-02 — v5 review findings applied (all previous revisions preserved; v5: "done"
state overloading fixed — sub-skills end at loop-complete states, feature-integrate is sole owner
of "done" transition; C-loop state write count corrected; H-loop write count aligned; P-loop TDD
language fixed; slice-deliver extended to decompose all 12 types; api-client added to read-model
reclassification options; completedFeatures idempotent append; Playwright screenshot visual gate for D4;
page UAT consideration; loop-complete state guard in dispatcher; CLAUDE.md app names fixed;
cn helper context preserved; Task 7a title corrected; new states V4/S5/M4/R5/Q5/F4 added to
status.md).

**Goal:** Replace the 3-type flat feature model with a 12-type `{domain}:{type}:{name}` taxonomy,
each with an invariant loop, eliminating the "DDD loop applied to React hooks" problem from SL-002.

**Architecture:** `colloquium:feature-implement` dispatcher reads `feature.type`, routes to one of
12 specialized sub-skill files. CLAUDE.md carries conventions; skills carry only process.
State.json bumps to schemaVersion 3.

**Execution:** Sequential. Git commit after each task. No worktrees or branch creation.
If any task fails, stop and handle manually — do not proceed to the next task.

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

These are the actual directory names. The old names are stale references.

**Step 1: Remove three sections**

Remove entirely:

- `## Skills Available` (heading + all content until next `##`)
- `## Known Workflow Gap` (heading + all content)
- ``## `cn` helper — two implementations, use the right one`` (heading + all content)

**Step 2: Append Feature Taxonomy section**

```markdown
## Feature Taxonomy

All features: `{domain}:{type}:{kebab-name}`

| Type                    | Loop   | Location                                   |
| ----------------------- | ------ | ------------------------------------------ |
| `core:aggregate`        | C-loop | `packages/<bc-name>/`                      |
| `core:value-object`     | V-loop | `packages/<bc-name>/` or `packages/utils/` |
| `core:domain-service`   | S-loop | `packages/<bc-name>/`                      |
| `backend:migration`     | M-loop | `apps/colloquium-api/prisma/`              |
| `backend:api`           | A-loop | `apps/colloquium-api/`                     |
| `backend:event-handler` | E-loop | `apps/colloquium-api/`                     |
| `backend:repository`    | R-loop | `apps/colloquium-api/`                     |
| `backend:projection`    | Q-loop | `apps/colloquium-api/`                     |
| `frontend:api-client`   | F-loop | `apps/*/src/api/`                          |
| `frontend:hook`         | H-loop | `packages/ui/src/hooks/`                   |
| `frontend:component`    | D-loop | `packages/ui/src/ComponentName/`           |
| `frontend:page`         | P-loop | `apps/*/src/pages/`                        |

**Ordering rule (sequential — `activeFeature` is a single pointer):**
`core:value-object → core:domain-service → core:aggregate → backend:migration → backend:repository → backend:projection → backend:api → backend:event-handler → frontend:api-client → frontend:hook → frontend:component → frontend:page`
```

**Step 3: Append Testing Strategy section**

```markdown
## Testing Strategy by Layer

**The "Never" column is law.**

| Type                    | Tool                                     | What to test                                      | Never                         |
| ----------------------- | ---------------------------------------- | ------------------------------------------------- | ----------------------------- |
| `core:aggregate`        | Vitest, zero mocks                       | Invariants, state transitions                     | I/O, network                  |
| `core:value-object`     | Vitest, zero mocks                       | Valid/invalid construction, equality              | I/O, mocks                    |
| `core:domain-service`   | Vitest, vi.fn() mocks                    | Method behavior given mocked deps                 | I/O, real deps                |
| `backend:migration`     | Real test DB (manual verify)             | Schema correctness, rollback                      | Unit mocks                    |
| `backend:api`           | Hono `app.request()`                     | Auth, validation, error mapping                   | Playwright                    |
| `backend:event-handler` | Direct handler call                      | Schema rejection, happy path                      | app.request(), Playwright     |
| `backend:repository`    | Vitest + test DB                         | CRUD, transactions, not-found                     | Unit mocks of DB              |
| `backend:projection`    | Vitest + test DB                         | Event sequence → materialized state               | Unit mocks                    |
| `frontend:hook`         | RTL + QueryClientProvider                | State transitions, error handling                 | Visual rendering, fetch calls |
| `frontend:api-client`   | Vitest + `vi.spyOn(globalThis, 'fetch')` | Request encoding, response decoding, error shapes | RTL, QueryClientProvider      |
| `frontend:component`    | RTL (hooks mocked)                       | Render, interaction, conditionals                 | Hook logic                    |
| `frontend:page`         | Playwright                               | Critical user paths                               | API status codes              |

API behavior is **never** tested through Playwright.
Event handler behavior is **never** tested through `app.request()`.
```

**Step 4: Append Quality Gate section**

```markdown
## Quality Gate

Runs before every state advance. No exceptions.

1. `pnpm turbo typecheck` — zero TypeScript errors
2. `pnpm turbo lint` — zero new ESLint warnings in modified files
3. All tests in affected package — passing
```

**Step 5: Append File Locations section**

````markdown
## File Locations (Stable — Do Not Re-Discover)

```
Value objects / policies → packages/<bc>/src/<Name>.ts
Domain services          → packages/<bc>/src/<Name>Service.ts
Domain hooks             → packages/ui/src/hooks/use<Name>.ts
UI components            → packages/ui/src/ComponentName/ComponentName.tsx
shadcn components        → packages/ui/src/components/ui/
API routes               → apps/colloquium-api/src/routes/<resource>.ts
Event handlers           → apps/colloquium-api/src/handlers/<EventName>.ts
Repositories             → apps/colloquium-api/src/<domain>/<Name>Repository.ts
Projections              → apps/colloquium-api/src/<domain>/<Name>Projection.ts
Typed API clients        → apps/*/src/api/<name>.ts
Contract docs            → docs/contracts/CT-NNN-<kebab-name>.md
Aggregate specs          → docs/features/<BC>/<AggregateName>/spec.md
API / event-handler specs → docs/features/<BC>/<EndpointOrEventName>/spec.md (table, max 30 lines)
Component designs        → docs/features/<BC>/<ComponentName>/design.md
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
```

**Step 8: Verify final line count**

```bash
wc -l CLAUDE.md
```

Must be ≤ 200. If over: tighten new sections (drop redundant words, collapse table rows).
Do not remove substantive content.

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

```markdown
### --migrate-v3: Upgrade schemaVersion 2 → 3

When invoked as `/colloquium:version --migrate-v3`:

1. Read `.claude/sdlc/state.json`.
   If `schemaVersion` is already `3`, display "Already v3" and stop.
   If `schemaVersion` is not `2`, display error and stop.

2. Normalize `completedFeatures`: for each version in `state.versions`, rewrite any bare ID
   (e.g., `"feat-001"`) to scoped format (e.g., `"SL-001/feat-001"`).
   Scoped IDs (those containing "/") are already correct — leave them unchanged.
   Use the slice ID from the version's `slices` keys to determine the correct prefix.
   If a bare ID cannot be matched to a slice, **stop and require manual correction**. Write a
   warning list of unmatched IDs — do not silently assign.

3. Set `schemaVersion` to `3`.

4. Set `lastUpdated` to current ISO timestamp.

5. Write the updated state.json.

6. Scan all features across all slices. Collect any features with `state ≠ "done"`.
   Leave their `type` values as-is (do NOT auto-reclassify — requires human judgement).

7. Display:
```

✅ Migrated to schemaVersion 3
Normalized completedFeatures: <count> bare IDs → scoped format
New features should use {domain}:{type}:{name} format going forward.

⚠️ In-progress features (type must be manually reclassified before resuming):
<list each: featureId, current type, current state — or "none" if all features are done>

⚠️ Legacy "contract" features require manual reclassification:
The dispatcher cannot auto-route "contract" — it may be backend:api or backend:event-handler.
Reclassify each "contract" feature manually before running /colloquium:feature-implement.
<list each: featureId with type="contract", regardless of state>

```

8. **State mapping for reclassified in-progress features:** When the user reclassifies a legacy
   feature that is NOT at `done` state, the C-state must be mapped to the new loop's equivalent
   state. After the user provides the new type, apply this mapping:

   | Legacy state | → backend:api | → backend:event-handler | → frontend:hook | → frontend:component | → frontend:page |
   | ------------ | ------------- | ----------------------- | --------------- | -------------------- | --------------- |
   | C0           | A0            | E0                      | H0              | D0                   | P0              |
   | C2           | A1            | E1                      | H1              | D1                   | P1              |
   | C3–C4        | A2            | E2                      | H2              | D2                   | P2              |
   | C5–C6        | A3            | E3                      | H3              | D3                   | P3              |
   | C7           | A4            | E4                      | H4              | D3                   | P3              |

   Write the mapped state to state.json. Display a warning:
   "State mapped from legacy C-state <old> → <new>. The mapping is approximate — review the
   current sub-step before proceeding. Some work may need to be re-verified under the new
   loop's quality gate."

   Legacy features at `done` state are unaffected — they remain at `done` regardless of type.

```

Commit:

```bash
git add .claude/commands/colloquium/version.md
git commit -m "feat(sdlc): add --migrate-v3 handler to version skill"
```

---

## Task 4: Run the Migration

Invoke `/colloquium:version --migrate-v3`.

**Rollback:** If the migration produces incorrect results, revert via:

```bash
git checkout -- .claude/sdlc/state.json
```

This restores the pre-migration state.json. Investigate and fix the `--migrate-v3` handler
before re-running.

After completion, verify:

```bash
cat .claude/sdlc/state.json | python3 -m json.tool | grep schemaVersion
# Must show: 3

cat .claude/sdlc/state.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
# Must show: Valid JSON
```

Commit:

```bash
git add .claude/sdlc/state.json
git commit -m "feat(sdlc): migrate state.json to schemaVersion 3"
```

---

## Task 5: Update `slice-deliver` for v3

**File:** `.claude/commands/colloquium/slice-deliver.md`

Read the file first. Make these targeted changes:

**Step 1:** Change all `schemaVersion = 2` checks to `schemaVersion = 3`.
Update error message: reference `--migrate-v3` instead of `--migrate`.

**Step 2:** Rewrite the feature decomposition section to produce all 12 types.

Replace the current three-category decomposition (Steps 3–5: aggregates, contracts, read-models)
with full 12-type decomposition logic:

```markdown
### Decomposition — Core Types (from model.md aggregates)

For each aggregate in model.md:

- Create one `core:aggregate` feature per aggregate
- For each value object referenced by the aggregate (e.g., `ChannelId`, `MessageContent`):
  create one `core:value-object` feature. Dependency: none (value objects are foundation).
- For each domain service referenced in cross-aggregate coordination or complex business rules:
  create one `core:domain-service` feature. Dependency: the value objects it uses.

### Decomposition — Backend Types

For each aggregate that requires persistence:

- Create one `backend:migration` feature if new tables are needed. Dependency: none.
- Create one `backend:repository` feature. Dependency: the migration that creates its table.
- If the aggregate has a read-side view: create one `backend:projection` feature.
  Dependency: the migration that creates its read-side table.

For each contract in `currentSlice.contracts`:

- Read the CT-NNN file. If it describes an HTTP endpoint: create `backend:api`.
  If it describes a domain event: create `backend:event-handler`. Do not guess — read the file.
  Dependency: the aggregate(s) on both sides.

### Decomposition — Frontend Types

For each API endpoint exposed by a `backend:api` feature:

- Create one `frontend:api-client` feature. Dependency: the `backend:api` feature.

For each React hook needed to wire API data to UI:

- Create one `frontend:hook` feature. Dependency: the `frontend:api-client` it wraps (if any).

For each reusable UI component identified in the event storm or model read models:

- Create one `frontend:component` feature. Dependency: none (components are standalone).

For each page that assembles hooks + components into a routed view:

- Create one `frontend:page` feature. Dependency: the hooks and components it uses.

**Frontend splitting criteria (when to create a separate feature vs. inline):**

- Component used by ≥ 2 pages → separate `frontend:component` feature
- Component with ≥ 3 visual states → separate `frontend:component` feature
- Hook managing domain state (not just a UI toggle) → separate `frontend:hook` feature
- Hook wrapping API client with caching/mutation → separate `frontend:hook` feature
- Page with ≥ 2 distinct user actions → separate `frontend:page` feature
- **Default:** When in doubt, inline into the page feature. Over-splitting creates dependency
  chains that slow delivery. Extract later via reclassification if needed.

### Legacy type conversion (for partially migrated slices)

- `type: "aggregate"` → `type: "core:aggregate"`
- `type: "contract"` → read the CT-NNN file. HTTP path = `"backend:api"`,
  event name = `"backend:event-handler"`. If ambiguous, ask the user.
- `type: "read-model"` → ask the user: "Is this a hook, component, page, or api-client?"
  Route to `frontend:hook`, `frontend:component`, `frontend:page`, or `frontend:api-client`.
```

**Step 3:** Replace the dependency ordering section with the sequential ordering rule:

```markdown
**Ordering rule (sequential — no concurrent features):**

Assign feature order using this precedence chain:
`core:value-object → core:domain-service → core:aggregate → backend:migration → backend:repository → backend:projection → backend:api → backend:event-handler → frontend:api-client → frontend:hook → frontend:component → frontend:page`

`activeFeature` is a single pointer. One feature executes at a time. The pointer advances
only when the current feature reaches `done` (set by feature-integrate) — there is no start-gate.

**Multi-BC sort:** Within each type tier, sort features alphabetically by BC name. This keeps
same-type features grouped while keeping BC-local features adjacent.

Set `activeFeature` to the first feature in the precedence-ordered queue.
```

**Step 3b:** Update the queue advance logic (the section that scans for the next `activeFeature`).
Replace any check for `state = "C0"` with a check for the type-appropriate initial state:

| Type                    | Queued (initial) state |
| ----------------------- | ---------------------- |
| `core:value-object`     | `"V0"`                 |
| `core:domain-service`   | `"S0"`                 |
| `core:aggregate`        | `"C0"`                 |
| `backend:migration`     | `"M0"`                 |
| `backend:api`           | `"A0"`                 |
| `backend:event-handler` | `"E0"`                 |
| `backend:repository`    | `"R0"`                 |
| `backend:projection`    | `"Q0"`                 |
| `frontend:api-client`   | `"F0"`                 |
| `frontend:hook`         | `"H0"`                 |
| `frontend:component`    | `"D0"`                 |
| `frontend:page`         | `"P0"`                 |

The queue scanner should set `activeFeature` to the first feature (in precedence order)
whose state equals the type-appropriate initial state listed above.

**Step 4:** Update the example feature JSON in the state write step:

```json
{
  "id": "feat-001",
  "name": "channel-id",
  "bc": "Messaging",
  "type": "core:value-object",
  "dependencies": [],
  "state": "V0",
  "history": []
}
```

**Step 4b:** Explicitly set the correct initial state for each type when creating feature entries.
The initial state must match the type — do NOT default all features to `"C0"`:

| Type                    | Initial state | Owned by                                 |
| ----------------------- | ------------- | ---------------------------------------- |
| `core:value-object`     | `"V0"`        | activation                               |
| `core:domain-service`   | `"S0"`        | activation                               |
| `core:aggregate`        | `"C0"`        | activation                               |
| `backend:migration`     | `"M0"`        | activation                               |
| `backend:api`           | `"A0"`        | activation                               |
| `backend:event-handler` | `"E0"`        | activation                               |
| `backend:repository`    | `"R0"`        | activation                               |
| `backend:projection`    | `"Q0"`        | activation                               |
| `frontend:api-client`   | `"F0"`        | activation                               |
| `frontend:hook`         | `"H0"`        | activation                               |
| `frontend:component`    | `"D0"`        | activation (feature-spec advances to D1) |
| `frontend:page`         | `"P0"`        | activation (feature-spec advances to P1) |

D-type features created with `"state": "C0"` will be routed to the C-loop (aggregate) by the
dispatcher. P-type features created with `"state": "C0"` will do the same. This is a silent
misrouting bug — always write `"D0"` for `frontend:component` and `"P0"` for `frontend:page`.

Commit:

```bash
git add .claude/commands/colloquium/slice-deliver.md
git commit -m "feat(sdlc): update slice-deliver — v3 types + sequential ordering rule"
```

---

## Task 6: Rewrite `feature-spec` as Type-Aware

**File:** `.claude/commands/colloquium/feature-spec.md`

Read the file first. Replace the generation mode section (currently handles aggregate/contract/
read-model) with 11-type routing:

````markdown
### Step 3: Route by feature type

Read `currentFeature.type`.

**`core:aggregate`:**
Generate full spec.md. Format unchanged: state machine, invariants, failure modes, external
contracts, test strategy. File: `docs/features/<bc>/<PascalName>/spec.md`.
State advance: C0 → C2.

**`core:value-object`:**
Display JSDoc template:

```typescript
/**
 * [Name]: [one sentence — what value does this represent?]
 *
 * Validation: [list rules — e.g., "must be non-empty", "must be positive integer"]
 * Equality: [value equality by attribute(s)]
 */
```
````

No file written. State advance: V0 → V1.

**`core:domain-service`:**
Generate TypeScript interface template (max 20 lines). Display to user. Do NOT write a file.

```typescript
/**
 * [ServiceName]: [one sentence — what does this service coordinate?]
 *
 * Dependencies:
 *   - [DependencyInterface]: [purpose]
 *   - [DependencyInterface]: [purpose]
 */
export interface [ServiceName] {
  [methodName]([params]): Promise<[ReturnType]>;
}
```

State advance: S0 → S1.

**`backend:migration`:**
Check: test DB must be running before advancing. If absent:
Display: "Test DB is not running — start it before activating this migration feature." Stop.
Display: "No spec.md for migrations. Write schema changes to schema.prisma at M1.
Document rollback path in M1 JSDoc comment."
State advance: M0 → M1.

**`backend:api`:**
Generate table-format spec.md (max 30 lines): endpoint path + method, Zod request schema,
Zod response schema (success only), auth requirements, error mapping table.
If the spec would exceed 30 lines: split into two `backend:api` features. Do not proceed.
File: `docs/features/<bc>/<EndpointName>/spec.md`.
State advance: A0 → A1.

**`backend:event-handler`:**
Check: the CT-NNN contract file for this event must exist in `docs/contracts/`.
If absent: display "CT-NNN contract file required — run /colloquium:slice-contracts first." Stop.
Generate table-format spec.md (max 30 lines): event name, CT-NNN reference, consumed event
Zod schema (verbatim from CT-NNN), command produced in consumer BC, error handling behavior.
File: `docs/features/<bc>/<EventName>/spec.md`.
State advance: E0 → E1.

**`backend:repository`:**
Check: test DB must be running before advancing. If absent:
Display: "Test DB is not running — start it before activating this repository feature." Stop.
Display: "TypeScript interface IS the spec — no spec.md. Write the interface at R1."
State advance: R0 → R1.

**`backend:projection`:**
Check: test DB must be running before advancing. If absent:
Display: "Test DB is not running — start it before activating this projection feature." Stop.
Display: "TypeScript interface IS the spec — no spec.md. Write the interface at Q1."
State advance: Q0 → Q1.

**`frontend:hook`:**
Generate JSDoc block template (max 20 lines). Display to user. Do NOT write a file.

```typescript
/**
 * [Hook name]: [one sentence description]
 *
 * State machine: Idle | Loading | Loaded | Error (if applicable — omit if simple useState)
 *
 * @param [param] - [description]
 * @returns [description]
 *
 * Depends on: [CT-NNN or Zustand store or other hook]
 */
```

State advance: H0 → H1.

**`frontend:component`:**
Invoke `skills:ui-design-expert` to generate the design proposal. The UI expert skill
generates: component tree, visual states table, props interface, Tailwind class plan,
shadcn/ui components to use (checking `packages/ui/src/components/ui/` first), accessibility.
Display the proposal and wait for explicit user approval before writing anything.
On approval: write `docs/features/<bc>/<ComponentName>/design.md`.
State advance: D0 → D1.

**`frontend:page`:**
Generate assembly plan JSDoc. Display and wait for explicit user approval before writing.
Content: hooks used + state produced, components assembled, URL params, layout structure,
all page states (loading, error, empty, populated).
On approval: write JSDoc as comment block to the page component file (create file if needed).
State advance: P0 → P1.

**`frontend:api-client`:**
Generate JSDoc block template (max 20 lines). Display to user. Do NOT write a file.

```typescript
/**
 * [Name]Api: typed client for [description of endpoint(s) covered].
 *
 * Endpoint: [METHOD] /path/to/endpoint
 * Request: [Zod input type]
 * Response: [Zod response type]
 * Auth: [Bearer token | none]
 */
```

State advance: F0 → F1.

````

Update schemaVersion checks to accept `3` (and `2` for legacy features).

**Replace the enforcement check:** The current feature-spec enforces `currentFeature.state = "C0"`.
Replace this with a check for the type-appropriate initial state:

| Type                    | Required initial state |
| ----------------------- | ---------------------- |
| `core:value-object`     | `"V0"`                 |
| `core:domain-service`   | `"S0"`                 |
| `core:aggregate`        | `"C0"`                 |
| `backend:migration`     | `"M0"`                 |
| `backend:api`           | `"A0"`                 |
| `backend:event-handler` | `"E0"`                 |
| `backend:repository`    | `"R0"`                 |
| `backend:projection`    | `"Q0"`                 |
| `frontend:api-client`   | `"F0"`                 |
| `frontend:hook`         | `"H0"`                 |
| `frontend:component`    | `"D0"`                 |
| `frontend:page`         | `"P0"`                 |

If `currentFeature.state` does not match the type-appropriate initial state, display:
"Feature is not at initial state — expected <expected> but got <actual>.
Feature-spec can only run on features that haven't been spec'd yet." Stop.

Update completion banner to show type-appropriate next step for each type.

Commit:

```bash
git add .claude/commands/colloquium/feature-spec.md
git commit -m "feat(sdlc): make feature-spec type-aware — 12-type routing"
````

---

## Task 7: Write Eleven Sub-Skill Files

Write each file in order. All are invoked by the dispatcher (Task 8), not by the user directly.

**Cross-cutting: quality gate tiers.** Every sub-skill has two quality gate tiers:

- **Light gate** (mid-loop advances): `pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm --filter <affected-package> test`
- **Full gate** (loop-complete advance ONLY): `pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm turbo test` (all packages)

When the sub-skill descriptions below say "quality gate", use the light gate. The final
state advance (to loop-complete) uses the full gate. This distinction is critical for keeping
short loops (V-loop, M-loop) fast.

**Cross-cutting: stuck handling.** Every sub-skill file must include this in its Enforcement Rules:

```markdown
N. **Stuck escape hatch.** At any human checkpoint or quality gate failure, if the user
replies `stuck: <reason>`, trigger the stuck-handling flow:

- Record history entry: `{ type: "stuck", reason: "<reason>", state: "<current>" }`
- Ask via AskUserQuestion: Rollback (reset to initial loop state), Remove (skip feature),
  Reclassify (change feature type), or Pause (advance to next feature, resume later).
- Update state.json. Display: "Feature <feat-id> marked as <choice>. Run /colloquium:sdlc."
```

---

### Task 7a: `feature-implement-aggregate.md`

**File:** `.claude/commands/colloquium/feature-implement-aggregate.md`

Copy from the current feature-implement.md then edit:

```bash
cp .claude/commands/colloquium/feature-implement.md \
   .claude/commands/colloquium/feature-implement-aggregate.md
```

Changes to make:

1. Title: `# colloquium:feature-implement-aggregate — DDD Aggregate Loop (C2 → C7)`
2. Purpose line: "Full TDD + DDD loop for `core:aggregate` features only. Invoked by the
   `colloquium:feature-implement` dispatcher."
3. Schema check: accept `schemaVersion = 3` (also accept `2` for legacy features)
4. Remove any feature-type enforcement — the dispatcher handles routing
5. Add quality gate block after each implementation sub-step (C3→C4, C5→C6, C6→C7):

```markdown
**Light gate (mid-loop state advances):**

- `pnpm turbo typecheck` → zero errors
- `pnpm turbo lint` → zero new warnings
- `pnpm --filter <affected-package> test` → all passing

**Full gate (loop-complete state advance only — e.g., C7 for aggregates):**

- `pnpm turbo typecheck` → zero errors
- `pnpm turbo lint` → zero new warnings
- `pnpm turbo test` → all tests across all packages passing
```

6. Add explicit domain event creation step at C5: "Create event type files in
   `packages/<bc>/src/events/` for each domain event emitted by this aggregate. Export
   from the package index. These types are consumed by `backend:event-handler` features —
   the aggregate is the sole creator."

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-aggregate.md
git commit -m "feat(sdlc): add feature-implement-aggregate (DDD loop extracted)"
```

---

### Task 7b: `feature-implement-value-object.md`

**File:** `.claude/commands/colloquium/feature-implement-value-object.md`

Write from scratch:

```markdown
# colloquium:feature-implement-value-object — Value Object Loop (V1 → V4)

**Purpose:** Implement `core:value-object` features — value objects, policies, specifications.
Pure: no injected dependencies, no mocks. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (standard v3 cursor).
   Require `feature.type = "core:value-object"`.
   Require `feature.state` ∈ {V1, V2, V3}.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ VALUE OBJECT LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
File: packages/<bc>/src/<Name>.ts (or packages/utils/src/<name>.ts)
════════════════════════════════════════════════════════════════

````
Jump to sub-step matching current state.

---

## V1 → V2: Write Signature + JSDoc in Source File

Write the type or function signature in the source file. The JSDoc IS the documentation.

Value object example:
```typescript
/**
 * ChannelId: identifies a channel uniquely.
 * Validation: must be a non-empty string UUID (v4).
 * Equality: value equality — two ChannelId values are equal if their string value matches.
 */
export type ChannelId = string & { readonly _brand: "ChannelId" };
export function channelId(value: string): ChannelId { ... }
````

Policy example:

```typescript
/**
 * canPostMessage: returns true if the user is an active member of the channel.
 * Business rule: user must have joined the channel and not have been removed.
 */
export function canPostMessage(userId: UserId, members: UserId[]): boolean { ... }
```

Quality gate on the type file (typecheck + lint). State write: `"V2"`.

---

## V2 → V3: Write Pure Tests

Vitest, zero mocks, zero framework imports.

Value object tests:

- Valid construction (valid input → value created)
- Invalid construction (invalid input → throws or returns error)
- Equality semantics (same value → equal, different value → not equal)

Policy tests:

- True cases (condition met → returns true)
- False cases (condition not met → returns false)
- Boundary/edge cases from JSDoc

All must FAIL before implementation exists.
Quality gate on test file. State write: `"V3"`.

---

## V3 → V4: Implement + Export

1. Write implementation satisfying the type/signature.
2. Run tests — all must pass.
3. Export from package index (`packages/<bc>/src/index.ts` or `packages/utils/src/index.ts`).
4. Quality gate: `pnpm turbo typecheck` + `pnpm turbo lint` + `pnpm --filter <package> test`.

Advance to `"V4"` (loop-complete). Write state.json. **Do NOT write `"done"` — feature-integrate owns that transition.**

Display:

```
════════════════════════════════════════════════════════════════
✅ Value object loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════
```

````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-value-object.md
git commit -m "feat(sdlc): add feature-implement-value-object (V-loop, pure tests)"
````

---

### Task 7c: `feature-implement-domain-service.md`

**File:** `.claude/commands/colloquium/feature-implement-domain-service.md`

Write from scratch:

```markdown
# colloquium:feature-implement-domain-service — Domain Service Loop (S1 → S5)

**Purpose:** Implement `core:domain-service` features — stateless services with injected
typed interfaces as dependencies. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "core:domain-service"`.
   Require `feature.state` ∈ {S1, S2, S3, S4, S5}.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ DOMAIN SERVICE LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
File: packages/<bc>/src/<Name>Service.ts
════════════════════════════════════════════════════════════════

````

---

## S1 → S2: Write TypeScript Interface + JSDoc

```typescript
/**
 * ChannelAccessService: determines access rights for channel operations.
 * Coordinates: ChannelRepository (to check membership), PolicyService (to evaluate rules).
 */
export interface ChannelAccessService {
  canPost(userId: UserId, channelId: ChannelId): Promise<boolean>;
}
````

All injected dependencies must appear as constructor parameters using typed interfaces —
never concrete classes, never `new Dependency()` inside the service.
Quality gate on interface file. State write: `"S2"`.

---

## S2 → S3: Write Mocked Unit Tests

Mock all dependencies with `vi.fn()`. One test per method.
Test behavior given various mocked return values (success, failure, not-found).
All must FAIL before implementation exists.
Quality gate on test file. State write: `"S3"`.

---

## S3 → S4: Implement + Export

1. Write implementation satisfying the interface.
2. Run tests — all must pass.
3. Export from `packages/<bc>/src/index.ts`.
4. Quality gate.
   State write: `"S4"`.

---

## S4 → S5: Code Review

Check:

- All dependencies injected (none instantiated inline)?
- Stateless (no mutable class fields)?
- No hidden I/O outside injected deps?

Invoke `superpowers:requesting-code-review` (service-focused checklist).
Quality gate. Advance to `"S5"` (loop-complete). Write state.json. **Do NOT write `"done"` — feature-integrate owns that transition.**

**Code review failure at S4:** Fix in-place without resetting state. Re-run quality gate.
Re-request review. The next session resumes at S4 using source file inspection — do NOT
write S0 or restart the loop. State S4 is a tracked checkpoint; recovery is deterministic.

````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-domain-service.md
git commit -m "feat(sdlc): add feature-implement-domain-service (S-loop, vi.fn() mocks)"
````

---

### Task 7d: `feature-implement-migration.md`

**File:** `.claude/commands/colloquium/feature-implement-migration.md`

Write from scratch:

```markdown
# colloquium:feature-implement-migration — Migration Loop (M1 → M4)

**Purpose:** Implement `backend:migration` features — Prisma schema changes with deployment
risk, rollback documentation, and test DB verification. No automated unit tests.
Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "backend:migration"`.
   Require `feature.state` ∈ {M1, M2, M3, M4}.
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

````

---

## M1 → M2: Update schema.prisma

1. Edit `apps/colloquium-api/prisma/schema.prisma` — add table, column, or index.
2. Write a comment block at the top of the new model documenting:
   - What this table stores and why
   - Rollback path: the SQL `DROP TABLE` / `DROP COLUMN` / `DROP INDEX` that undoes this
3. Quality gate: `pnpm turbo typecheck` (schema changes regenerate Prisma client).
State write: `"M2"`.

---

## M2 → M3: Generate Migration File

```bash
cd apps/colloquium-api
pnpm prisma migrate dev --name <kebab-name> --create-only
````

Read the generated migration SQL. Verify:

- Additive only (or destructive change has been explicitly reviewed)
- No data loss for existing rows
- No irreversible operation without sign-off

If the SQL looks wrong: edit schema.prisma and re-run `--create-only`.
State write: `"M3"`.

---

## M3 → M4: Deploy to Test DB + Rollback Verification

```bash
cd apps/colloquium-api
pnpm prisma migrate deploy
```

Verify:

- Migration succeeded (no error output)
- Table/column/index exists with correct type and constraints (inspect via Prisma Studio or
  raw SQL: `\d <table>`)

Write rollback SQL to a stable path outside the Prisma-managed directory:
`docs/migrations/rollbacks/<name>-rollback.sql`
(This path survives `prisma migrate reset` and is not parsed by Prisma tooling.)

Quality gate (typecheck + lint after client regeneration).
Advance to `"M4"` (loop-complete). Write state.json. **Do NOT write `"done"` — feature-integrate owns that transition.**

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
git commit -m "feat(sdlc): add feature-implement-migration (M-loop, test DB verification)"
````

---

### Task 7e: `feature-implement-api.md`

**File:** `.claude/commands/colloquium/feature-implement-api.md`

Write from scratch:

```markdown
# colloquium:feature-implement-api — API Loop (A1 → A4)

**Purpose:** Implement `backend:api` features (REST handlers only).
Tests via Hono `app.request()` only. Playwright is never used.
Domain event handlers are `backend:event-handler` — not this loop. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (standard v3 cursor).
   Require `feature.type = "backend:api"`.
   Require `feature.state` ∈ {A1, A2, A3, A4}.
2. Read spec at `docs/features/<bc>/<name>/spec.md` before starting any sub-step.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ API LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Spec: docs/features/<bc>/<name>/spec.md
════════════════════════════════════════════════════════════════

```
Jump to sub-step matching current state.

---

## A1 → A2: Write Contract Tests

Before reading tests: verify spec is ≤ 30 lines. If over 30 lines, display:
"Spec exceeds 30 lines — split into two backend:api features or extract shared errors to a
policy doc before continuing." Do not proceed to A2 until resolved.

1. Read spec error mapping table + endpoint definition.
2. For each row in the error mapping table, write one test using `app.request()`.
3. Write one happy-path test (valid auth + valid payload → expected 200/201 response).
4. Write one missing-auth test (no Authorization header → 401).
5. Run tests. All must FAIL (handler doesn't exist yet).
6. Quality gate on test files (typecheck + lint).
7. State write: `"A2"`.

---

## A2 → A3: Implement Handler

1. Write handler: OpenAPIHono `createRoute`, auth extraction (Bearer JWT → requesterId),
   Zod validation, domain call, error mapping per spec, success response.
2. Run contract tests. All must pass.
3. Quality gate: `pnpm turbo typecheck` + `pnpm turbo lint` +
   `pnpm --filter @colloquium/colloquium-api test`.
4. State write: `"A3"`.

---

## A3 → A4: Code Review

Invoke `superpowers:requesting-code-review` then `superpowers:receiving-code-review`.

Checklist:
- Auth checked before any domain call?
- Every error mapping row covered by a test?
- N+1 risk in domain call?
- OpenAPI schema matches actual response shape?

State write: `"A4"`.

---

## Completion

A4 is loop-complete. Write state.json with `"A4"`. **Do NOT write `"done"` — feature-integrate owns that transition.**

Display:
```

════════════════════════════════════════════════════════════════
✅ API loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════

```

```

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-api.md
git commit -m "feat(sdlc): add feature-implement-api (A-loop, app.request() only)"
```

---

### Task 7f: `feature-implement-event-handler.md`

**File:** `.claude/commands/colloquium/feature-implement-event-handler.md`

Write from scratch:

```markdown
# colloquium:feature-implement-event-handler — Event Handler Loop (E1 → E4)

**Purpose:** Implement `backend:event-handler` features — domain event ACL handlers that
validate a cross-BC event against a CT-NNN schema and issue a command in the consumer domain.
Tests via direct handler call. Never `app.request()`. Never Playwright. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "backend:event-handler"`.
   Require `feature.state` ∈ {E1, E2, E3, E4}.
2. Read spec at `docs/features/<bc>/<name>/spec.md` before any sub-step.
3. Read the CT-NNN contract file referenced in the spec before writing any tests.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ EVENT HANDLER LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Spec: docs/features/<bc>/<name>/spec.md
CT-NNN: docs/contracts/<CT-NNN-file>.md
════════════════════════════════════════════════════════════════

```

---

## E1 → E2: Write Tests

Read the spec. Read the CT-NNN contract file. Compare the consumed event Zod schema in the
spec against the CT-NNN payload schema line by line. If they diverge, update the spec to
match CT-NNN before writing any tests. Display: "CT-NNN schema verified ✅" or "CT-NNN
mismatch — spec updated to match CT-NNN."

Write two tests (direct handler function call — NOT app.request()):

1. Schema-rejection test: send a payload missing a required CT-NNN field. Assert the handler
   rejects it (Zod parse failure) and does NOT issue any domain command.
2. Happy-path test: send a valid CT-NNN payload. Assert the correct domain command is issued.

All must FAIL before handler exists.
Quality gate on test file. State write: `"E2"`.

---

## E2 → E3: Implement Handler

1. Write handler: Zod parse of incoming payload against CT-NNN schema. If valid: issue the
   domain command specified in spec. If invalid: discard/reject per spec.
2. Run tests — all must pass.
3. Quality gate.
State write: `"E3"`.

---

## E3 → E4: Code Review

Invoke `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

Checklist:
- CT-NNN Zod schema validated before any domain call?
- Invalid payload behavior matches spec (discard vs. reject)?
- No N+1 in domain call?

State write: `"E4"`.

---

## Completion

E4 is loop-complete. Write state.json with `"E4"`. **Do NOT write `"done"` — feature-integrate owns that transition.**

Display:
```

════════════════════════════════════════════════════════════════
✅ Event handler loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════

```

```

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-event-handler.md
git commit -m "feat(sdlc): add feature-implement-event-handler (E-loop, direct call tests)"
```

---

### Task 7g: `feature-implement-repository.md`

**File:** `.claude/commands/colloquium/feature-implement-repository.md`

Write from scratch:

```markdown
# colloquium:feature-implement-repository — Repository Loop (R1 → R5)

**Purpose:** Implement `backend:repository` features — command-side Prisma repository.
TypeScript interface IS the spec. Integration tests use real Prisma client against test DB.
If this repository needs a new table: create a `backend:migration` feature with explicit
dependency — do not perform migrations inside this loop. Invoked by dispatcher.

---

## Enforcement

1. Resolve context (v3). Require `feature.type = "backend:repository"`.
   Require `feature.state` ∈ {R1, R2, R3, R4, R5}.
2. Test DB must be running. If absent: display "Test DB is not running." Stop.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ REPOSITORY LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Interface: apps/colloquium-api/src/<domain>/<Name>Repository.ts
════════════════════════════════════════════════════════════════

````

---

## R1 → R2: Write TypeScript Interface

Write the interface the domain layer depends on. This IS the spec — no spec.md file.

```typescript
export interface ChannelRepository {
  save(channel: Channel): Promise<void>;
  findById(id: ChannelId): Promise<Channel | null>;
  findByMemberId(memberId: UserId): Promise<Channel[]>;
}
````

Quality gate on interface file. State write: `"R2"`.

---

## R2 → R3: Write Integration Tests

Test DB must be available.

One test per interface method. Test not-found behavior (null return vs. throw — match the
interface JSDoc). Test transaction behavior if applicable.
All must FAIL before implementation exists.

Quality gate on test files. State write: `"R3"`.

---

## R3 → R4: Implement Repository

Write Prisma implementation satisfying the interface.

Quality gate: `pnpm turbo typecheck` + `pnpm turbo lint` +
`pnpm --filter @colloquium/colloquium-api test`.

State write: `"R4"`.

---

## R4 → R5: Code Review

Invoke `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

Checklist:

- N+1 in any method?
- Missing indexes identified?
- Connection released correctly in all paths?

Quality gate. Advance to `"R5"` (loop-complete). Write state.json. **Do NOT write `"done"` — feature-integrate owns that transition.**

````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-repository.md
git commit -m "feat(sdlc): add feature-implement-repository (R-loop, no migration variants)"
````

---

### Task 7h: `feature-implement-projection.md`

**File:** `.claude/commands/colloquium/feature-implement-projection.md`

Write from scratch:

```markdown
# colloquium:feature-implement-projection — Projection Loop (Q1 → Q5)

**Purpose:** Implement `backend:projection` features — query-side projections that
materialize read models from domain events. TypeScript interface IS the spec.
Integration tests use real Prisma client against test DB. Invoked by dispatcher.

---

## Enforcement

1. Resolve context (v3). Require `feature.type = "backend:projection"`.
   Require `feature.state` ∈ {Q1, Q2, Q3, Q4, Q5}.
2. Test DB must be running. If absent: display "Test DB is not running." Stop.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ PROJECTION LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Interface: apps/colloquium-api/src/<domain>/<Name>Projection.ts
════════════════════════════════════════════════════════════════

````

---

## Q1 → Q2: Write TypeScript Interface

```typescript
/**
 * ChannelFeedProjection: materializes the channel message feed view.
 * Handles: ChannelMessageSent (CT-003) — upserts into channel_feed_view.
 */
export interface ChannelFeedProjection {
  applyEvent(event: DomainEvent): Promise<void>;
  findFeedByChannelId(channelId: ChannelId): Promise<FeedItem[]>;
}
````

JSDoc on `applyEvent` must name the CT-NNN event(s) that trigger it.
Quality gate on interface file. State write: `"Q2"`.

---

## Q2 → Q3: Write Integration Tests

**Projection test (required):**
Call `applyEvent` with a sequence of realistic domain events (use the CT-NNN payload shape
from `docs/contracts/`). Then query the read-side table. Assert the materialized state is
correct. Must FAIL before implementation exists.

**Query method tests:**
findFeedByChannelId, list methods return correct shape and ordering.
All must FAIL before implementation exists.

Quality gate on test files. State write: `"Q3"`.

---

## Q3 → Q4: Implement Projection

Write Prisma implementation satisfying the interface.

Quality gate: `pnpm turbo typecheck` + `pnpm turbo lint` +
`pnpm --filter @colloquium/colloquium-api test`.

State write: `"Q4"`.

---

## Q4 → Q5: Code Review

Invoke `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

Checklist:

- Is applyEvent idempotent? (same event applied twice = no duplicate or inconsistency)
- Missing indexes on read-side table for common query patterns?
- Connection released in all paths?

Quality gate. Advance to `"Q5"` (loop-complete). Write state.json. **Do NOT write `"done"` — feature-integrate owns that transition.**

````

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-projection.md
git commit -m "feat(sdlc): add feature-implement-projection (Q-loop, event-sequence tests)"
````

---

### Task 7i: `feature-implement-hook.md`

**File:** `.claude/commands/colloquium/feature-implement-hook.md`

Write from scratch. Key constraints for this version:

- **React hooks only.** H-loop covers `useState`, `useReducer`, `useEffect`, TanStack Query
  wrappers. Typed API clients (`fetch` wrappers) are NOT in scope — if encountered, display:
  "This feature is `frontend:api-client` — run /colloquium:feature-implement-api-client."
- **H2 is always required and must assert something real:**
  - If the hook has a state machine (`useReducer` or state enum): test each state transition
    (pure — no RTL, no QueryClientProvider).
  - If the hook has no state machine: write a minimal RTL `renderHook` test asserting the
    hook's return shape. Never write `expect(true).toBe(true)` — this must be explicitly
    flagged as a test-washing no-op and rejected.
  - All tests must FAIL before implementation exists.
- **H3:** RTL integration tests. Pattern depends on hook type:
  - TanStack Query hooks: QueryClientProvider + real QueryClient + vi.spyOn(globalThis, 'fetch')
    or MSW. Do NOT use vi.fn() for server state — TanStack Query has no injectable dependency
    to mock. vi.spyOn(globalThis, 'fetch') here is correct; it intercepts the network layer, not a React dep.
  - useReducer/useState hooks: renderHook without provider is correct. H2 tests cover the state
    machine; H3 tests component-level integration if applicable.
    Note: vi.spyOn(globalThis, 'fetch') in H3 for TanStack Query hooks is intentional. The F-loop boundary is:
    F-loop tests a typed fetch wrapper directly. H3 tests that a hook correctly USES the network.

The loop header and session start display follow the pattern of other sub-skills.

H4 is loop-complete. Write state.json with `"H4"`. **Do NOT write `"done"` — feature-integrate owns that transition.**

Display:

```
════════════════════════════════════════════════════════════════
✅ Hook loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════
```

State writes: H1 (by feature-spec), H2 (state machine tests written), H3 (RTL integration tests written), H4 (convention check passed). Four writes within the H-loop sub-skill. H0 written by slice-deliver (activation). `done` written by feature-integrate only.

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-hook.md
git commit -m "feat(sdlc): add feature-implement-hook (H-loop, React only, H2 always real assertion)"
```

---

### Task 7j: `feature-implement-component.md`

**File:** `.claude/commands/colloquium/feature-implement-component.md`

Write from scratch. Key changes from original plan:

- Loop starts at **D1** (not D0). Enforce: `feature.state` ∈ {D1, D2, D3, D4}.
- D0 → D1 is owned by `feature-spec`. If `feature.state = "D0"` when this skill is invoked,
  display: "Design gate not complete — run /colloquium:feature-spec first to generate and
  approve the design proposal." Stop.
- Read `docs/features/<bc>/<ComponentName>/design.md` at D1 — it was written by feature-spec.

Write from scratch:

```markdown
# colloquium:feature-implement-component — Component Loop (D1 → D4)

**Purpose:** Implement `frontend:component` features — reusable React components with visual
design gate. D0 → D1 is owned by `feature-spec`. This loop starts at D1.
Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "frontend:component"`.
   Require `feature.state` ∈ {D1, D2, D3, D4}.
2. If `feature.state = "D0"`: display "Design gate not complete — run
   /colloquium:feature-spec first to generate and approve the design proposal." Stop.
3. Read `docs/features/<bc>/<ComponentName>/design.md` — written by feature-spec at D0 → D1.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ COMPONENT LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Design: docs/features/<bc>/<ComponentName>/design.md
════════════════════════════════════════════════════════════════

```
Jump to sub-step matching current state.

---

## D1 → D2: Write RTL Tests

Read design.md. Write RTL tests (all hooks mocked via vi.fn()):

- One test per visual state from design.md
- Interaction tests (click, input, submit)
- Conditional display tests

All must FAIL before component exists.
Quality gate on test files. State write: `"D2"`.

---

## D2 → D3: Implement Component + Code Review

1. Implement component per design.md:
   - Tailwind classes from the approved plan
   - shadcn/ui primitives as specified
   - Zero inline styles
   - Export from `packages/ui/src/index.ts`
2. Run RTL tests — all must pass.
3. Quality gate: `pnpm turbo typecheck` + `pnpm turbo lint` +
   `pnpm --filter @colloquium/ui test`.
4. Code review checklist:
   - Matches design.md?
   - Zero inline styles?
   - All D2 tests passing?
   - Exported correctly from package index?

Code review failure → fix in D3, re-run quality gate, re-request review before D4.
State write: `"D3"`.

---

## D3 → D4: Playwright Screenshot Visual Gate

1. Take a Playwright MCP screenshot of each visual state from design.md.
2. Display each screenshot to the user alongside the corresponding design.md spec.
3. **HUMAN CHECKPOINT — hard gate:**
   Display: "Compare each screenshot against design.md. Reply 'confirmed' when
   all states visually match, or 'fix: <description>' to return to D3."
4. Wait for explicit user confirmation before advancing.
5. If user reports a mismatch: return to D3, fix, re-run tests, re-present D4 gate.
6. If user replies `redesign: <reason>`: reset to D1 — rewrite design.md with the new
   direction, delete existing RTL tests + implementation, re-enter at D2. Write state `"D1"`,
   add history entry `{ type: "redesign", reason: "<reason>" }`.

State write: `"D4"` — written only after user confirms visual check passes.

---

## Completion

D4 is loop-complete. Write state.json with `"D4"`. **Do NOT write `"done"` — feature-integrate owns that transition.**

Display:
```

════════════════════════════════════════════════════════════════
✅ Component loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════

```

```

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-component.md
git commit -m "feat(sdlc): add feature-implement-component (D-loop, starts at D1)"
```

---

### Task 7k: `feature-implement-page.md`

**File:** `.claude/commands/colloquium/feature-implement-page.md`

Write from scratch. Key changes from original plan:

- Loop starts at **P1** (not P0). Enforce: `feature.state` ∈ {P1, P2, P3}.
- P0 → P1 is owned by `feature-spec`. If `feature.state = "P0"` when this skill is invoked,
  display: "Assembly plan not approved — run /colloquium:feature-spec first to generate and
  approve the assembly plan." Stop.
- At P1: read JSDoc from the page file (written by feature-spec). Assemble the page from that
  approved plan. Do NOT re-display the assembly plan — it was already approved.

State writes: P0 activation, P1 (by feature-spec), P2 (RTL tests), P3 (Playwright E2E), done.

Write from scratch:

```markdown
# colloquium:feature-implement-page — Page Loop (P1 → P3)

**Purpose:** Implement `frontend:page` features — assembled pages wiring hooks + components
into a routed view. P0 → P1 is owned by `feature-spec`. This loop starts at P1.
Playwright runs here and only here in the feature loop. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "frontend:page"`.
   Require `feature.state` ∈ {P1, P2, P3}.
2. If `feature.state = "P0"`: display "Assembly plan not approved — run
   /colloquium:feature-spec first to generate and approve the assembly plan." Stop.
3. Read JSDoc from the page file (written by feature-spec at P0 → P1).

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ PAGE LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
Page file: apps/<app>/src/pages/<PageName>.tsx
════════════════════════════════════════════════════════════════

```
Jump to sub-step matching current state.

---

## P1 → P2: Assemble Page + RTL Test

1. Read the JSDoc assembly plan from the page file.
2. Assemble the page:
   - Import hooks from `packages/ui/src/hooks/` (React hooks) or `apps/*/src/api/` (API clients)
   - Import components from `packages/ui/src/ComponentName/`
   - Handle all states: loading, error, empty, populated
3. Quality gate: `pnpm turbo typecheck` + `pnpm turbo lint`.
4. Write RTL test: full page render with all hooks mocked via `vi.fn()`.
   Test that the page wires hooks to components correctly:
   - Loading state renders loading indicator
   - Error state renders error message
   - Populated state renders correct components with correct props
5. Run tests — all must PASS (page was assembled in step 2, RTL tests verify wiring correctness).
   NOTE: P-loop is assembly-first, not TDD. Tests verify an already-assembled page.
6. Quality gate on test files.
State write: `"P2"`.

---

## P2 → P3: Playwright E2E

1. Write Playwright E2E test: one test per critical path node from JSDoc assembly plan.
   Run against a real running server (not mocked).
   - Navigate to the page URL
   - Assert critical UI elements are visible
   - Test user interactions from the assembly plan
2. Start dev server if not running.
3. Run Playwright tests — all must pass.
4. Code review after E2E GREEN:
   - All critical paths from JSDoc covered?
   - No flaky selectors (prefer data-testid or role selectors)?
   - Test teardown correct (no leaked state between tests)?
   - **Page UAT consideration:** If this is a critical user-facing path, include a manual
     walkthrough of the user journey during code review. Document the result in a comment
     within the E2E test file.
5. Quality gate.
State write: `"P3"` (loop-complete). **Do NOT write `"done"` — feature-integrate owns that transition.**

---

## Completion

P3 is loop-complete.

Display:
```

════════════════════════════════════════════════════════════════
✅ Page loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════

```

```

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-page.md
git commit -m "feat(sdlc): add feature-implement-page (P-loop, starts at P1)"
```

---

### Task 7l: `feature-implement-api-client.md`

**File:** `.claude/commands/colloquium/feature-implement-api-client.md`

Write from scratch:

```markdown
# colloquium:feature-implement-api-client — API Client Loop (F1 → F4)

**Purpose:** Implement `frontend:api-client` features — typed `fetch` wrappers coupled to
`colloquium-api`'s Zod schemas and endpoint paths. Not React-specific. No RTL.
Tests use `vi.spyOn(globalThis, 'fetch')`. Invoked by dispatcher.

---

## Enforcement

1. Read state.json. Resolve context (v3 cursor).
   Require `feature.type = "frontend:api-client"`.
   Require `feature.state` ∈ {F1, F2, F3, F4}.

---

## Session Start

Display:
```

════════════════════════════════════════════════════════════════
▶ API CLIENT LOOP — <featureId>: <name>
════════════════════════════════════════════════════════════════
State: <feature.state>
File: apps/<app>/src/api/<name>.ts
════════════════════════════════════════════════════════════════

```
Jump to sub-step matching current state.

---

## F1 → F2: Write TypeScript Interface + JSDoc

Write the interface in the source file. JSDoc must document:
- Endpoint path + method
- Zod request type (input)
- Zod response type (output)
- Auth requirements (Bearer token, API key, none)

Quality gate on interface file (typecheck + lint). State write: `"F2"`.

---

## F2 → F3: Write Vitest Tests

Tests use `vi.spyOn(globalThis, 'fetch')`. No RTL. No QueryClientProvider.

1. Happy path: spy returns correct 200 response → client decodes and returns correct value.
2. Error path: spy returns 4xx/5xx → client throws or returns correct error shape.

All must FAIL before implementation exists.
Quality gate on test files. State write: `"F3"`.

---

## F3 → F4: Implement + Export

1. Write implementation satisfying the interface.
2. Run tests — all must pass.
3. Quality gate: `pnpm turbo typecheck` + `pnpm turbo lint` +
   `pnpm --filter <app-name> test`.

Advance to `"F4"` (loop-complete). Write state.json. **Do NOT write `"done"` — feature-integrate owns that transition.**

Display:
```

════════════════════════════════════════════════════════════════
✅ API client loop complete — <feat-id>: <name>
Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════

```

```

Commit:

```bash
git add .claude/commands/colloquium/feature-implement-api-client.md
git commit -m "feat(sdlc): add feature-implement-api-client (F-loop, vi.spyOn(globalThis, 'fetch'), no RTL)"
```

---

## Task 8: Rewrite `feature-implement` as Dispatcher

**File:** `.claude/commands/colloquium/feature-implement.md`

Replace the entire file content:

```markdown
# colloquium:feature-implement — Implementation Dispatcher

**Purpose:** Read `feature.type` from state.json. Route to the correct specialized loop.
Contains NO implementation logic.

---

## Enforcement

1. Read `.claude/sdlc/state.json`. Accept `schemaVersion = 3` (or `2` for legacy features).

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
Type: <feature.type>
State: <feature.state>
════════════════════════════════════════════════════════════════

```

---

## Routing Table

| feature.type | Route to | Legacy match |
| ------------ | -------- | ------------ |
| `core:aggregate` | `feature-implement-aggregate` | `aggregate` |
| `core:value-object` | `feature-implement-value-object` | — |
| `core:domain-service` | `feature-implement-domain-service` | — |
| `backend:migration` | `feature-implement-migration` | — |
| `backend:api` | `feature-implement-api` | — |
| `backend:event-handler` | `feature-implement-event-handler` | — |
| `backend:repository` | `feature-implement-repository` | — |
| `backend:projection` | `feature-implement-projection` | — |
| `frontend:hook` | `feature-implement-hook` | `read-model` (hook variant) |
| `frontend:api-client` | `feature-implement-api-client` | — |
| `frontend:component` | `feature-implement-component` | `read-model` (component variant) |
| `frontend:page` | `feature-implement-page` | `read-model` (page variant) |

**For legacy `contract`:** The type is ambiguous — it may be a REST endpoint (`backend:api`)
or a domain event handler (`backend:event-handler`). Ask the user:
"Is this feature a REST endpoint or a domain event handler? Reply 'api' or 'event-handler'."
Route to `feature-implement-api` or `feature-implement-event-handler` based on answer.
Do NOT auto-route legacy `contract` to `backend:api` — it would silently misroute event handlers.

**For legacy `read-model`:** Ask the user:
"Is this feature a hook, component, page, or api-client? (Legacy feature — reclassify to route correctly.)"
Route to the appropriate sub-skill based on answer.

**For unrecognized types:**
```

❌ Unknown feature.type: "<type>"
Expected: core:aggregate | core:value-object | core:domain-service | backend:migration
| backend:api | backend:event-handler | backend:repository | backend:projection
| frontend:hook | frontend:api-client | frontend:component | frontend:page
Run /colloquium:slice-deliver to reclassify.

```
Stop.

---

## Dispatch

Announce: "Type is `<type>` — routing to `<skill-name>`."

**Loop-complete state guard:** If `currentFeature.state` is the loop-complete state for its
type (V4, S5, M4, A4, E4, R5, Q5, H4, F4, D4, P3 — or C7/UV for aggregates), do NOT
dispatch to a sub-skill. Display: "Feature is at loop-complete state <state> — run
/colloquium:feature-integrate (or /colloquium:feature-verify for aggregates at C7)." Stop.

Invoke the target skill via the Skill tool. Do not repeat any loop logic here.
```

Commit:

```bash
git add .claude/commands/colloquium/feature-implement.md
git commit -m "feat(sdlc): rewrite feature-implement as 12-route dispatcher"
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

Find the state write block that sets `currentFeature.state = "F4"` and change it to `"UV"`.
This eliminates the state code collision with `frontend:api-client`'s F4 (loop-complete).
The `UV` state code is unique to the aggregate UAT verification path.

Commit:

```bash
git add .claude/commands/colloquium/feature-verify.md
git commit -m "feat(sdlc): restrict feature-verify to core:aggregate at C7"
```

---

## Task 9.5: Update `feature-integrate`

**File:** `.claude/commands/colloquium/feature-integrate.md`

Read the file first. Make these six targeted changes:

**Step 1:** Update the entry state enforcement.

Replace: `Require currentFeature.state = "F4".`

With:

```markdown
`feature-integrate` is the **sole owner** of the `"done"` transition for ALL types.
Sub-skills advance to their loop-complete state; feature-integrate transitions to `"done"`.

Entry state enforcement by type:

| Type                    | Required entry state                    |
| ----------------------- | --------------------------------------- |
| `core:aggregate`        | `"UV"` (set by feature-verify after C7) |
| `core:value-object`     | `"V4"`                                  |
| `core:domain-service`   | `"S5"`                                  |
| `backend:migration`     | `"M4"`                                  |
| `backend:api`           | `"A4"`                                  |
| `backend:event-handler` | `"E4"`                                  |
| `backend:repository`    | `"R5"`                                  |
| `backend:projection`    | `"Q5"`                                  |
| `frontend:hook`         | `"H4"`                                  |
| `frontend:api-client`   | `"F4"`                                  |
| `frontend:component`    | `"D4"`                                  |
| `frontend:page`         | `"P3"`                                  |

If `currentFeature.state` does not match the expected entry state for its type:
Display: "Feature is not at loop-complete state — expected <expected> but got <actual>.
Finish all loop steps before integrating."
Stop.

Note: `frontend:api-client` uses F4 as its loop-complete state. `core:aggregate` uses UV
(set by feature-verify). No collision — each type has a unique loop-complete state code.
```

**Step 2:** Update the queue advance logic.

Find the section that advances `activeFeature` to the next queued feature. Replace any
check for `state = "C0"` with a check for the type-appropriate initial state:

| Type                    | Queued (initial) state |
| ----------------------- | ---------------------- |
| `core:value-object`     | `"V0"`                 |
| `core:domain-service`   | `"S0"`                 |
| `core:aggregate`        | `"C0"`                 |
| `backend:migration`     | `"M0"`                 |
| `backend:api`           | `"A0"`                 |
| `backend:event-handler` | `"E0"`                 |
| `backend:repository`    | `"R0"`                 |
| `backend:projection`    | `"Q0"`                 |
| `frontend:api-client`   | `"F0"`                 |
| `frontend:hook`         | `"H0"`                 |
| `frontend:component`    | `"D0"`                 |
| `frontend:page`         | `"P0"`                 |

The scanner sets `activeFeature` to the first feature (in precedence order) whose state
equals the type-appropriate initial state listed above (i.e., queued and not yet started).

**Step 3:** Fix the `completedFeatures` write step.

Find the line that writes to `completedFeatures`. Replace bare ID write with **idempotent** scoped format:

```
const scopedId = `${sliceId}/${featureId}`;
if (!completedFeatures.includes(scopedId)) {
  completedFeatures.push(scopedId);
}
```

This guards against crash-recovery scenarios where feature-integrate crashes after appending
but before clearing `activeFeature`, causing a re-run that would create a duplicate entry.

Verify no other code path writes bare (unscoped) IDs to `completedFeatures`.

**Step 4:** Update schemaVersion check to accept `3` (and `2` for legacy).

**Step 5:** Make uat.md read conditional on feature type.

Find the section that reads `docs/features/<bc>/<aggregate>/uat.md`. This file is written by
`feature-verify`, which in v3 is restricted to `core:aggregate` only. All other feature types
skip `feature-verify` and never produce a `uat.md`.

Wrap the uat.md read in a type check:

```markdown
If `currentFeature.type = "core:aggregate"` (or legacy `"aggregate"`):
Read `docs/features/<bc>/<AggregateName>/uat.md` and include UAT results in integration context.
Else:
Skip uat.md read — this feature type does not produce UAT artifacts.
```

**Step 6:** Make the integration checklist type-aware.

The current integration checklist runs 4 items for every feature type:

1. Upstream wiring (event connections)
2. Downstream wiring (event connections)
3. Policy documents for new cross-cutting interactions
4. Feature flag lifecycle

For most non-aggregate types (value objects, hooks, components, API clients, migrations),
items 1–3 are always N/A. Replace the single checklist with type-routed checklists:

```markdown
**Integration checklist by type:**

`core:aggregate`, `backend:event-handler`:

1. Upstream wiring (event connections)
2. Downstream wiring (event connections)
3. Policy documents for new cross-cutting interactions
4. Feature flag lifecycle

`backend:api`, `backend:repository`, `backend:projection`:

1. Feature flag lifecycle
2. Verify no N+1 queries escaped code review

`core:value-object`, `core:domain-service`:

1. Feature flag lifecycle (if feature is behind a flag)

`backend:migration`:

1. Rollback SQL verified at `docs/migrations/rollbacks/`
2. Feature flag lifecycle (if migration is behind a flag)

`frontend:api-client`, `frontend:hook`, `frontend:component`, `frontend:page`:

1. Feature flag lifecycle
```

Commit:

```bash
git add .claude/commands/colloquium/feature-integrate.md
git commit -m "feat(sdlc): update feature-integrate — accept done for all types, type-aware queue scanner, scoped completedFeatures"
```

---

## Task 9.6: Update `sdlc.md` Dispatcher Routing Table

**File:** `.claude/commands/colloquium/sdlc.md`

Read the file first. The current routing table only handles C0, C2–C7, F4 states. After v3,
features can be in states like V2, S3, H2, M3, A1, E4, R3, Q2, D3, P2, F2, etc.

**Step 1:** Find the routing/dispatch section that maps `currentFeature.state` to the appropriate
skill invocation.

**Step 2:** Replace the existing routing conditions with a type-first routing table:

```markdown
### Routing by feature type and state

Read `currentFeature.type` and `currentFeature.state`.

| Type                                     | States | Route to                                                       |
| ---------------------------------------- | ------ | -------------------------------------------------------------- |
| `core:aggregate` (or legacy `aggregate`) | C0     | `feature-spec`                                                 |
| `core:aggregate`                         | C2–C6  | `feature-implement` (dispatcher routes to aggregate sub-skill) |
| `core:aggregate`                         | C7     | `feature-verify` (UAT gate before integration)                 |
| `core:aggregate`                         | UV     | `feature-integrate`                                            |
| `core:value-object`                      | V0     | `feature-spec`                                                 |
| `core:value-object`                      | V1–V3  | `feature-implement`                                            |
| `core:value-object`                      | V4     | `feature-integrate` (loop-complete)                            |
| `core:domain-service`                    | S0     | `feature-spec`                                                 |
| `core:domain-service`                    | S1–S4  | `feature-implement`                                            |
| `core:domain-service`                    | S5     | `feature-integrate` (loop-complete)                            |
| `backend:migration`                      | M0     | `feature-spec`                                                 |
| `backend:migration`                      | M1–M3  | `feature-implement`                                            |
| `backend:migration`                      | M4     | `feature-integrate` (loop-complete)                            |
| `backend:api`                            | A0     | `feature-spec`                                                 |
| `backend:api`                            | A1–A3  | `feature-implement`                                            |
| `backend:api`                            | A4     | `feature-integrate` (loop-complete)                            |
| `backend:event-handler`                  | E0     | `feature-spec`                                                 |
| `backend:event-handler`                  | E1–E3  | `feature-implement`                                            |
| `backend:event-handler`                  | E4     | `feature-integrate` (loop-complete)                            |
| `backend:repository`                     | R0     | `feature-spec`                                                 |
| `backend:repository`                     | R1–R4  | `feature-implement`                                            |
| `backend:repository`                     | R5     | `feature-integrate` (loop-complete)                            |
| `backend:projection`                     | Q0     | `feature-spec`                                                 |
| `backend:projection`                     | Q1–Q4  | `feature-implement`                                            |
| `backend:projection`                     | Q5     | `feature-integrate` (loop-complete)                            |
| `frontend:api-client`                    | F0     | `feature-spec`                                                 |
| `frontend:api-client`                    | F1–F3  | `feature-implement`                                            |
| `frontend:api-client`                    | F4     | `feature-integrate` (loop-complete)                            |
| `frontend:hook`                          | H0     | `feature-spec`                                                 |
| `frontend:hook`                          | H1–H3  | `feature-implement`                                            |
| `frontend:hook`                          | H4     | `feature-integrate` (loop-complete)                            |
| `frontend:component`                     | D0     | `feature-spec`                                                 |
| `frontend:component`                     | D1–D3  | `feature-implement`                                            |
| `frontend:component`                     | D4     | `feature-integrate` (loop-complete)                            |
| `frontend:page`                          | P0     | `feature-spec`                                                 |
| `frontend:page`                          | P1–P2  | `feature-implement`                                            |
| `frontend:page`                          | P3     | `feature-integrate` (loop-complete)                            |

**"done" state for ANY type:** route to `feature-integrate` (already integrated — feature-integrate is idempotent for already-done features).

For legacy types (`contract`, `read-model`): ask the user to reclassify before routing.
Display: "Legacy feature type '<type>' — reclassify to a v3 type before proceeding.
Run /colloquium:version --migrate-v3 for guidance."

For unrecognized state codes: display error with current type and state, suggest running
the appropriate skill manually.
```

**Step 3:** Update schemaVersion check to accept `3` (and `2` for legacy).

Commit:

```bash
git add .claude/commands/colloquium/sdlc.md
git commit -m "feat(sdlc): update sdlc dispatcher routing table for all v3 state codes"
```

---

## Task 9.7: Update `status.md` for New State Codes

**File:** `.claude/commands/colloquium/status.md`

Read the file first. The status dashboard needs to display descriptions for all new state codes.

**Step 1:** Find the state description table or display logic.

**Step 2:** Add state descriptions for all new prefixes:

```markdown
### State Code Descriptions

| Code  | Meaning                                 |
| ----- | --------------------------------------- |
| V0    | Queued (value object)                   |
| V1    | JSDoc template approved                 |
| V2    | Type/function signature written         |
| V3    | Pure tests written                      |
| V4    | Implementation complete (loop-complete) |
| S0    | Queued (domain service)                 |
| S1    | Interface template approved             |
| S2    | Interface written in source             |
| S3    | Mocked unit tests written               |
| S4    | Implementation written (pre-review)     |
| S5    | Code review passed (loop-complete)      |
| M0    | Queued (migration)                      |
| M1    | Schema.prisma updated                   |
| M2    | Migration file generated                |
| M3    | Migration deployed to test DB           |
| M4    | Migration verified (loop-complete)      |
| A0    | Queued (API)                            |
| A1    | Spec written (table format)             |
| A2    | Contract tests written                  |
| A3    | Handler implemented                     |
| A4    | Code review complete                    |
| E0    | Queued (event handler)                  |
| E1    | Spec written (table format)             |
| E2    | Tests written (direct call)             |
| E3    | Handler implemented                     |
| E4    | Code review complete                    |
| R0    | Queued (repository)                     |
| R1    | Spec acknowledged                       |
| R2    | Interface written                       |
| R3    | Integration tests written               |
| R4    | Implementation written (pre-review)     |
| R5    | Code review passed (loop-complete)      |
| Q0    | Queued (projection)                     |
| Q1    | Spec acknowledged                       |
| Q2    | Interface written                       |
| Q3    | Integration tests written               |
| Q4    | Implementation written (pre-review)     |
| Q5    | Code review passed (loop-complete)      |
| H0    | Queued (hook)                           |
| H1    | JSDoc written                           |
| H2    | State machine tests written             |
| H3    | RTL integration tests written           |
| H4    | Convention check passed                 |
| F0    | Queued (API client)                     |
| F1    | JSDoc template approved                 |
| F2    | Interface written                       |
| F3    | Tests written                           |
| F4    | Implementation complete (loop-complete) |
| D0    | Queued (component — needs feature-spec) |
| D1    | Design approved (design.md written)     |
| D2    | RTL tests written                       |
| D3    | Component implemented (pre-visual-gate) |
| D4    | Human visual gate confirmed             |
| P0    | Queued (page — needs feature-spec)      |
| P1    | Assembly plan approved                  |
| P2    | RTL tests written                       |
| P3    | Playwright E2E done                     |
| UV    | UAT verified (aggregate only)           |
| C0–C7 | (Unchanged — aggregate states)          |
```

**Step 3:** Update schemaVersion check to accept `3`.

Commit:

```bash
git add .claude/commands/colloquium/status.md
git commit -m "feat(sdlc): update status dashboard with all v3 state code descriptions"
```

---

## Task 10: End-to-End Validation

**Step 1:** Read `feature-implement.md`. Confirm all 12 types have a route in the routing table.

**Step 2:** Verify sub-skill files exist:

```bash
ls .claude/commands/colloquium/feature-implement-*.md
```

Expected (12 files):
`aggregate.md`, `value-object.md`, `domain-service.md`, `migration.md`,
`api.md`, `event-handler.md`, `repository.md`, `projection.md`,
`hook.md`, `api-client.md`, `component.md`, `page.md`

**Step 3:** Verify state.json:

```bash
cat .claude/sdlc/state.json | python3 -m json.tool | grep schemaVersion
# Must show: 3

cat .claude/sdlc/state.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
# Must show: Valid JSON
```

**Step 4:** Verify CLAUDE.md line count:

```bash
wc -l CLAUDE.md
# Must be ≤ 200
```

**Step 5:** Verify deprecated skill is gone:

```bash
ls .claude/commands/colloquium/project.md 2>&1
# Must show: No such file or directory
```

**Step 6:** Verify D-loop and P-loop entry enforcement:
Read `feature-implement-component.md` — confirm it enforces `feature.state ∈ {D1, D2, D3, D4}`
and blocks if `feature.state = "D0"` with a message directing to `feature-spec`.
Read `feature-implement-page.md` — confirm it enforces `feature.state ∈ {P1, P2, P3}`
and blocks if `feature.state = "P0"` with a message directing to `feature-spec`.

**Step 7:** If `simulate.md` exists (optional dry-run skill), update its routing tables to add
all 12 types and their embedded step tables. Verify any dispatcher resolution table in
simulate.md matches the dispatcher routing table in feature-implement.md exactly.
If `simulate.md` does not exist, skip this step — it is not required for v3.

**Step 8:** Verify `sdlc.md` routing table handles all new states (including loop-complete):
Read `sdlc.md` — confirm routing covers V0–V4, S0–S5, M0–M4, A0–A4, E0–E4, R0–R5, Q0–Q5,
H0–H4, F0–F4, D0–D4, P0–P3 in addition to existing C0–C7 and F4.
Loop-complete states (V4, S5, M4, A4, E4, R5, Q5, H4, F4, D4, P3) must route to `feature-integrate`.

**Step 9:** Verify `status.md` state descriptions:
Read `status.md` — confirm all new state codes have descriptions.

**Step 10: Dry-run validation — push a throwaway feature through the dispatcher.**

This is the only step that actually tests the system end-to-end. All previous steps are
static file checks.

1. **Create a throwaway feature in state.json.** Pick the simplest loop (`core:value-object`).
   Add a feature entry with `type: "core:value-object"`, `state: "V0"`, `name: "dry-run-test"`.
   Set `activeFeature` to point at it.
2. **Invoke `/colloquium:sdlc`.** Verify it:
   - Reads state.json correctly
   - Displays the current position banner with the V0 state
   - Routes to `feature-spec` (because V0 is the initial state)
3. **Verify feature-spec handles the type.** It should recognize `core:value-object` and
   present the V-loop spec template. Do NOT complete the spec — just verify routing works.
4. **Clean up.** Remove the throwaway feature from state.json. Restore `activeFeature` to its
   previous value.

If the dry-run fails at any point, the dispatcher or sub-skill has a bug. Fix it before
declaring v3 complete.

**Step 11:** Invoke `superpowers:verification-before-completion` before declaring done.

**Final commit:**

```bash
git add .claude/commands/colloquium/
git commit -m "feat(sdlc): complete v3 taxonomy — dispatcher + 12 loops + type-aware spec+verify"
```

---

## Success Checklist

- [ ] `colloquium:project.md` deleted
- [ ] CLAUDE.md ≤ 200 lines, contains taxonomy (12 types), testing strategy, quality gate, file locations, conventions; app names match actual (`colloquium-api`, `colloquium-web`)
- [ ] state.json at `schemaVersion: 3`, all completedFeatures in scoped format (idempotent append)
- [ ] `feature-implement.md` is the dispatcher (no loop logic), routes 12 types; blocks any feature already at a loop-complete state (routes to `feature-integrate` instead)
- [ ] 12 sub-skill files exist: aggregate, value-object, domain-service, migration, api, event-handler, repository, projection, hook, api-client, component, page
- [ ] Each sub-skill writes a **loop-complete** state (V4, S5, M4, A4, E4, R5, Q5, H4, F4, D4, P3) — **never** writes "done"
- [ ] Each sub-skill includes stuck escape hatch (`stuck: <reason>`) with rollback/remove/reclassify/pause options
- [ ] `feature-spec.md` routes by type (12 branches including D0→D1 via ui-design-expert, P0→P1, F0→F1)
- [ ] `feature-verify.md` enforces C7 / core:aggregate only (UAT hard gate for the C-loop)
- [ ] `slice-deliver.md` decomposes all 12 types (core, backend, frontend); uses compound types + sequential ordering rule (no start-gate); queue scanner uses type-appropriate initial states
- [ ] `feature-integrate.md` accepts **loop-complete states** (V4, S5, M4, A4, E4, R5, Q5, H4, F4, D4, P3) and UV (aggregate UAT); is the **sole owner** of the `done` transition; queue scanner checks type-appropriate initial states; completedFeatures written in scoped format with duplicate guard
- [ ] `feature-implement-component.md` enforces entry at D1, blocks D0; code review at D3 before D4; D4 uses Playwright MCP screenshots (no Storybook branch); D4 is loop-complete
- [ ] `feature-implement-page.md` enforces entry at P1, blocks P0; P3 is loop-complete (assembly-first, not TDD)
- [ ] `feature-implement-hook.md` is React-hooks-only; H2 always asserts something real (no expect(true).toBe(true)); H4 is loop-complete
- [ ] `feature-implement-api-client.md` exists; uses vi.spyOn(globalThis, 'fetch'); no RTL; F4 is loop-complete
- [ ] If `simulate.md` exists, its routing tables match feature-implement.md dispatcher exactly (12 types)
- [ ] `sdlc.md` routing table handles all v3 state codes including loop-complete states (V0–V4, S0–S5, M0–M4, A0–A4, E0–E4, R0–R5, Q0–Q5, H0–H4, F0–F4, D0–D4, P0–P3 + legacy C0–C7 + UV); loop-complete states route to `feature-integrate`
- [ ] `status.md` state description table covers all new state codes including loop-complete states (V4, S5, M4, R5, Q5, F4, UV)
