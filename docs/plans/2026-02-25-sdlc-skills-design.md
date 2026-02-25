# Colloquium SDLC Skills — Design

**Date:** 2026-02-25
**Status:** Approved
**Scope:** Replace `colloquium:project-*` skills with a full DDD-first, event-bounded, stateful SDLC skill suite

---

## Problem

The existing `colloquium:project-*` skills (plan, implement, features, mvp) follow a "200-test TDD factory" model — fast bootstrapping for standalone apps. They lack domain modeling, bounded context thinking, event storming, aggregate commitment, and contract stabilization.

The desired workflow is the DDD-first, event-bounded SDLC described in `sdlc/ddd-plan.md` and `sdlc/ricky-tom-event-bounded.md`: three nested state machines with explicit exit gates, evidence-based progression, and stateful resume across sessions.

---

## Decision

- **Replaces** `colloquium:project-plan`, `colloquium:project-implement`, `colloquium:project-features`, `colloquium:project-mvp`
- **Full DDD rigor** — every gate is a hard block; no skipping
- **Stateful** — `state.json` written after every transition; crash-safe resume at sub-step granularity
- **One domain per monorepo** — domain artifacts live at root level
- **Maximum separation** — 17 skills, each handling exactly one state transition
- **Both dispatcher + direct invocation** — ergonomic default + surgical override

---

## Architecture

### Three State Machines

| Layer                 | Scope                 | States | Skills   |
| --------------------- | --------------------- | ------ | -------- |
| A — Domain Discovery  | One-time per monorepo | A0→A4  | 4 skills |
| B — Slice Lifecycle   | Per capability slice  | B0→B5  | 6 skills |
| C — Feature Lifecycle | Per feature (daily)   | C0→C7  | 4 skills |

Plus: 1 dispatcher, 2 cross-cutting utilities = **17 skills total**.

---

## State File

Lives at `.claude/sdlc/state.json`. Written after every gate transition.

```json
{
  "version": 1,
  "domain": {
    "state": "A2",
    "completed": ["A0", "A1"]
  },
  "activeSlice": {
    "id": "SL-001",
    "name": "user-auth-flow",
    "state": "B3"
  },
  "activeFeature": {
    "id": "feat-007",
    "name": "login-aggregate",
    "state": "C4",
    "sliceId": "SL-001"
  },
  "completedSlices": ["SL-000"],
  "completedFeatures": ["feat-001", "feat-002"],
  "lastUpdated": "2026-02-25T10:00:00Z",
  "lastSkill": "colloquium:slice-contracts"
}
```

---

## Artifact Structure

```
docs/
  domain/
    glossary.md              ← domain-frame (A0→A1)
    framing.md               ← domain-frame (A0→A1)
    subdomains.md            ← domain-subdomains (A1→A2)
    bounded-contexts.md      ← domain-contexts (A2→A3)
    context-map.md           ← domain-map (A3→A4)
    delivery-shape.md        ← domain-map (A3→A4)
  slices/
    SL-001/
      slice.md               ← slice-select (B0→B1)
      event-storm.md         ← slice-storm (B1→B2)
      model.md               ← slice-model (B2→B3)
  contracts/
    CT-001-<name>.md         ← slice-contracts (B3→B4)
  features/
    <bc>/<aggregate>/
      spec.md                ← feature-spec (C0→C2)
      uat.md                 ← feature-verify (C7→F4)
  policies/
    PL-001-<name>.md         ← policy (cross-cutting)
  releases/
    SL-001-internal.md       ← slice-deliver (B4→B5)
    SL-001-public.md         ← slice-validate (B5→done)
.claude/
  sdlc/
    state.json               ← written after every transition
```

---

## Skill Inventory

### Dispatcher

#### `colloquium:sdlc`

Reads `state.json` and routes to the correct next skill. If no state file exists, starts at `domain-frame`. Displays current position across all three state machines before routing.

Routing table:

| Condition                                 | Routes to                    |
| ----------------------------------------- | ---------------------------- |
| No state.json                             | `domain-frame`               |
| domain.state = A0                         | `domain-subdomains`          |
| domain.state = A1                         | `domain-contexts`            |
| domain.state = A2                         | `domain-map`                 |
| domain.state = A3 + no activeSlice        | `slice-select`               |
| activeSlice.state = B1                    | `slice-storm`                |
| activeSlice.state = B2                    | `slice-model`                |
| activeSlice.state = B3                    | `slice-contracts`            |
| activeSlice.state = B4                    | `slice-deliver`              |
| activeSlice.state = B5                    | `slice-validate`             |
| activeSlice.state = B5 + no activeFeature | `feature-spec`               |
| activeFeature.state = C0–C1               | `feature-implement`          |
| activeFeature.state = C2–C7               | `feature-implement` (resume) |
| activeFeature.state = C7                  | `feature-verify`             |
| activeFeature.state = F4                  | `feature-integrate`          |

---

### Layer A — Domain Discovery (one-time)

#### `colloquium:domain-frame` (A0 → A1)

**Input:** nothing
**Output:** `docs/domain/glossary.md`, `docs/domain/framing.md`

Q&A (4 questions):

1. Core business outcome in one sentence
2. Primary users and their goals
3. Top 3–5 unknowns that could derail the project
4. What is explicitly out of scope

Generates:

- `glossary.md` — 10–30 key terms with precise definitions (ubiquitous language seed)
- `framing.md` — core outcome, user goals, non-goals, top risks

Gate: both files exist on disk. Writes `domain.state = "A1"`.

---

#### `colloquium:domain-subdomains` (A1 → A2)

**Input:** `docs/domain/framing.md`
**Output:** `docs/domain/subdomains.md`

No Q&A — generates automatically. Classifies every major area as Core, Supporting, or Generic. Each subdomain gets: purpose, success metric, investment decision.

Gate: file exists, ≥1 Core subdomain. Writes `domain.state = "A2"`.

---

#### `colloquium:domain-contexts` (A2 → A3)

**Input:** `docs/domain/subdomains.md`, `docs/domain/glossary.md`
**Output:** `docs/domain/bounded-contexts.md`

Proposes bounded contexts (one per major capability cluster). For each BC: business capability, language boundary, commands accepted, events emitted, inputs/outputs.

Hard gate: user must explicitly approve BC boundaries. Unclear boundaries trigger Q&A before writing.

Writes `domain.state = "A3"`.

---

#### `colloquium:domain-map` (A3 → A4)

**Input:** `docs/domain/bounded-contexts.md`
**Output:** `docs/domain/context-map.md`, `docs/domain/delivery-shape.md`

For every BC-to-BC relationship assigns a DDD integration pattern (Customer/Supplier, Conformist, ACL, Published Language, Shared Kernel). Specifies: integration mechanism, contract ownership, anti-corruption plan if needed.

`delivery-shape.md` confirms the domain is ready for slice work.

Hard gate: user approves context map. Writes `domain.state = "A4"`. **Domain discovery is permanently closed after A4 — no re-runs without explicit override.**

---

### Layer B — Slice Lifecycle (per capability slice)

#### `colloquium:slice-select` (B0 → B1)

**Input:** `docs/domain/context-map.md`, `docs/domain/bounded-contexts.md`
**Output:** `docs/slices/<id>/slice.md`

Q&A (4 questions):

1. What user journey does this slice deliver end-to-end?
2. Which bounded contexts does it touch? (≤2 recommended)
3. What is the success metric?
4. What is not in this slice?

Assigns stable slice ID (SL-001, SL-002, …). Generates slice narrative.

Gate: narrative exists, contexts listed, metric is measurable. Writes `activeSlice = { id, name, state: "B1" }`.

---

#### `colloquium:slice-storm` (B1 → B2)

**Input:** `docs/slices/<id>/slice.md`
**Output:** `docs/slices/<id>/event-storm.md`

Solo Event Storming pass — five swimlanes:

- Domain Events (orange)
- Commands (blue)
- Policies (purple)
- Read Models (green)
- External Systems (pink)

Also lists hot spots (ambiguous rules). Hot spots trigger Q&A before artifact is written.

Gate: ≥10 candidate events, command list exists, hot spots resolved or explicitly deferred. Writes `activeSlice.state = "B2"`.

---

#### `colloquium:slice-model` (B2 → B3)

**Input:** `docs/slices/<id>/event-storm.md`
**Output:** `docs/slices/<id>/model.md`

Commits aggregate boundaries and invariants. For every aggregate:

- State machine (named states + valid transitions)
- Invariants (testable bullet statements — vague invariants are rejected)
- Commands the aggregate accepts
- Events emitted

For every cross-context integration: draft event schema + versioning approach.

Hard gate: user approves every aggregate state machine and invariant list. Writes `activeSlice.state = "B3"`.

---

#### `colloquium:slice-contracts` (B3 → B4)

**Input:** `docs/slices/<id>/model.md`
**Output:** `docs/contracts/CT-<n>-<name>.md` (one per integration point)

For every cross-context integration: API contract (request/response schema + semantics) OR event contract (schema + payload semantics + versioning rule). Each includes: consumer expectations, producer guarantees, backward compatibility rules, contract test plan.

Gate: every integration point in the model has a corresponding contract file. Writes `activeSlice.state = "B4"`.

---

#### `colloquium:slice-deliver` (B4 → B5)

**Input:** `docs/slices/<id>/model.md`, contracts, slice.md
**Output:** `docs/releases/<id>-internal.md`, feature queue in state.json

Does not write code. Decomposes the slice into an ordered feature queue:

- One feature per aggregate
- One feature per contract
- One feature per read model

Assigns feature IDs and owning bounded contexts. Writes internal release note skeleton. Sets `activeFeature` to first feature.

Gate: feature queue non-empty, first feature has assigned BC. Writes `activeSlice.state = "B5"`, `activeFeature = { id, name, state: "C0" }`.

---

#### `colloquium:slice-validate` (B5 → done)

**Input:** all feature UAT docs, `docs/releases/<id>-internal.md`
**Output:** `docs/releases/<id>-public.md`

Hard gate: all features in the queue must be complete (C7-done) before this skill runs.

Runs:

- Full UAT pass via Playwright MCP
- Regression check on all golden paths
- Guardrail metrics check

Writes public release note: what shipped, flags promoted, known issues, cleanup tasks. Clears `activeSlice`, prompts for next slice selection.

---

### Layer C — Feature Lifecycle (daily work)

#### `colloquium:feature-spec` (C0 → C2)

**Input:** feature entry from slice feature queue
**Output:** `docs/features/<bc>/<aggregate>/spec.md`

Generates automatically for simple features. New aggregates or cross-context features trigger targeted Q&A.

Spec contains:

- Entities — aggregate state machine (from model.md, refined)
- Invariants — every invariant as a testable statement
- Failure modes — top 3–5 edge cases + expected behavior
- External contracts — list of contracts consumed/produced
- Test strategy — which layers need tests

Gate: every invariant is testable, failure modes enumerated. Writes `activeFeature.state = "C2"`.

---

#### `colloquium:feature-implement` (C2 → C7)

**Input:** `docs/features/<bc>/<aggregate>/spec.md`
**Output:** working code — tests green, behind a flag, telemetry hooked

TDD inner loop in DDD delivery order:

| Step             | State | Work                                                                 |
| ---------------- | ----- | -------------------------------------------------------------------- |
| Domain tests RED | C2→C3 | Write pure aggregate/invariant tests, confirm RED                    |
| Domain GREEN     | C3→C4 | Implement domain logic, all tests pass, refactor                     |
| Contract tests   | C4→C5 | Consumer-driven contract tests, pass                                 |
| Adapters         | C5→C6 | Repository mappings, handlers, projections (integration tests green) |
| Journey check    | C6→C7 | One E2E per critical path node via Playwright MCP                    |

At each sub-step: uses `superpowers:test-driven-development`, `superpowers:systematic-debugging` (if stuck 3+), `code-simplifier:code-simplifier` (post-green), `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

State written after every sub-step (C3, C4, C5, C6, C7) — crash recovery at sub-step granularity.

Gate at C7: journey check passes in Playwright. Writes `activeFeature.state = "C7"`.

---

#### `colloquium:feature-verify` (C7 → F4)

**Input:** feature spec, UAT steps from spec.md
**Output:** `docs/features/<bc>/<aggregate>/uat.md`

Runs full UAT verification:

- Executes every step in spec's test strategy via Playwright MCP
- Screenshots at each key state
- No new high-severity errors in logs
- Regression on all golden paths

Hard gate: UAT pass required before `uat.md` is written. UAT failure routes back to `feature-implement` with specific failure context.

Writes `activeFeature.state = "F4"`.

---

#### `colloquium:feature-integrate` (F4 → done)

**Input:** UAT doc, slice model, existing policy docs
**Output:** updated policy/rule docs, flag lifecycle update

Checklist:

1. Feature wired to upstream/downstream features (events flowing correctly)
2. New interactions discovered → creates/updates `docs/policies/<id>.md`
3. Flag lifecycle updated: promotion criteria (internal → beta → on) + cleanup ticket

Gate: upstream/downstream connections verified, flag plan exists. Marks feature done, advances to next feature in queue or prompts `slice-validate` if queue empty.

---

### Cross-Cutting Skills

#### `colloquium:policy`

**Input:** user describes a cross-cutting behavior
**Output:** `docs/policies/PL-<n>-<name>.md`

Q&A (5 questions):

1. What domain event triggers this policy?
2. What condition must hold when that event fires?
3. What command does the policy issue?
4. Which bounded context owns it?
5. Eventually consistent or synchronous?

Generates policy doc with: trigger event, condition, command issued, owning context, consistency model, idempotency key, test plan.

Does not modify `state.json`.

---

#### `colloquium:status`

**Input:** `state.json` + all artifact folders
**Output:** dashboard display — no writes

Read-only. Safe to invoke at any time. Displays:

- Domain state + BC count
- Active slice + B-state
- Feature queue (completed / active / queued)
- Active policies
- Feature flags + promotion status

---

## Full Skill Inventory

| Skill                          | Layer         | Input                       | Output                                    |
| ------------------------------ | ------------- | --------------------------- | ----------------------------------------- |
| `colloquium:sdlc`              | Dispatcher    | state.json                  | routes to next skill                      |
| `colloquium:domain-frame`      | A             | nothing                     | glossary.md, framing.md                   |
| `colloquium:domain-subdomains` | A             | framing.md                  | subdomains.md                             |
| `colloquium:domain-contexts`   | A             | subdomains.md + glossary.md | bounded-contexts.md                       |
| `colloquium:domain-map`        | A             | bounded-contexts.md         | context-map.md, delivery-shape.md         |
| `colloquium:slice-select`      | B             | context-map.md              | slice.md                                  |
| `colloquium:slice-storm`       | B             | slice.md                    | event-storm.md                            |
| `colloquium:slice-model`       | B             | event-storm.md              | model.md                                  |
| `colloquium:slice-contracts`   | B             | model.md                    | CT-\*.md files                            |
| `colloquium:slice-deliver`     | B             | model + contracts           | releases/<id>-internal.md + feature queue |
| `colloquium:slice-validate`    | B             | feature UATs                | releases/<id>-public.md                   |
| `colloquium:feature-spec`      | C             | feature queue entry         | spec.md                                   |
| `colloquium:feature-implement` | C             | spec.md                     | green code + flag                         |
| `colloquium:feature-verify`    | C             | spec + Playwright           | uat.md                                    |
| `colloquium:feature-integrate` | C             | UAT doc                     | updated policies + flag plan              |
| `colloquium:policy`            | cross-cutting | user Q&A                    | PL-\*.md                                  |
| `colloquium:status`            | cross-cutting | state.json                  | dashboard (read-only)                     |

---

## What Is Explicitly Not in Scope

- Git branch creation, push, PR — human controls all git
- Vercel, deployment, external services
- The existing `colloquium:project-*` skills (they are replaced, not extended)
- Multi-domain support (one domain per monorepo, fixed)
