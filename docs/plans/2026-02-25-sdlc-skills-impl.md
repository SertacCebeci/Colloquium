# Colloquium SDLC Skills — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Write 17 skill files (markdown documents) that implement the full DDD-first SDLC described in the design doc.

**Architecture:** Each skill is a `.md` file in `.claude/commands/colloquium/`. Skills are invoked via the Skill tool. Each file is a self-contained prompt document specifying exact Q&A, artifact outputs, gate conditions, and state.json writes. The dispatcher (`sdlc.md`) is written last, once all routing targets exist.

**Tech Stack:** Markdown skill files, `.claude/sdlc/state.json` (runtime state), `docs/` artifact tree, Playwright MCP (feature-verify), context7 MCP (feature-implement), superpowers sub-skills (feature-implement).

**Design doc:** `docs/plans/2026-02-25-sdlc-skills-design.md`

---

## Conventions (read before any task)

- All skill files live in `.claude/commands/colloquium/`
- Skill name `colloquium:foo` → file `foo.md` in that directory
- Every skill file MUST contain: header, enforcement rules, state.json read/write spec, artifact paths, gate condition, completion banner
- State file path: `.claude/sdlc/state.json`
- Artifact root: `docs/`
- "Test" for each task = cross-reference every gate and artifact from the design doc (section by section checklist at end of each task)
- Commit after every skill file — do not batch

---

## Task 1: `colloquium:status` (cross-cutting, read-only)

**Files:**

- Create: `.claude/commands/colloquium/status.md`

**Step 1: Write the skill file**

Content must cover:

- Purpose: read-only dashboard, safe at any time, no state writes
- Reads: `.claude/sdlc/state.json` + all `docs/` artifact folders
- Display sections (in order):
  1. Domain state + BC count (from `docs/domain/bounded-contexts.md`)
  2. Completed slices (from `completedSlices` in state.json)
  3. Active slice + B-state + feature queue breakdown (completed/active/queued)
  4. Active feature + C-state
  5. Policies (count from `docs/policies/`)
  6. Feature flags + promotion status (if any flag mentions exist in docs)
  7. "Next:" line — reads `lastSkill` from state.json and shows `/colloquium:sdlc` as the resume command
- Graceful handling: if `state.json` does not exist, display "No SDLC session started. Run /colloquium:sdlc to begin."
- No writes to any file under any condition

**Banner format:**

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC STATUS
════════════════════════════════════════════════════════════════
Domain:    [state] — [summary]
           [N] bounded contexts: [names]

Slices:    [completed list with ✓]
           [active slice] ► active — [B-state] ([N] features queued)

Features:  [completed with ✓] [active with ►] [queued with ○]

Policies:  [count]

Next:  /colloquium:sdlc
════════════════════════════════════════════════════════════════
```

**Step 2: Verify against design doc**

Checklist (all must be ✓):

- [ ] Displays all three state machine positions
- [ ] Shows feature queue breakdown (completed / active / queued)
- [ ] Shows policy count
- [ ] Shows "Next:" resume line
- [ ] Handles missing state.json gracefully
- [ ] Zero file writes

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/status.md
git commit -m "feat(sdlc-skills): add colloquium:status — read-only SDLC dashboard"
```

---

## Task 2: `colloquium:policy` (cross-cutting, additive)

**Files:**

- Create: `.claude/commands/colloquium/policy.md`

**Step 1: Write the skill file**

Content must cover:

- Purpose: generate a cross-cutting policy document, additive (does not modify state.json)
- Auto-assign next available PL-NNN ID (scan `docs/policies/` for existing files)
- Q&A (5 questions, in order):
  1. What domain event triggers this policy?
  2. What condition must hold when that event fires?
  3. What command does the policy issue?
  4. Which bounded context owns it?
  5. Eventually consistent or synchronous?
- Output file: `docs/policies/PL-<n>-<kebab-name>.md`
- File content template:

  ```markdown
  # PL-<n>: <Name>

  **Trigger event:** <event>
  **Condition:** <condition>
  **Command issued:** <command>
  **Owning context:** <BC name>
  **Consistency:** <eventually consistent / synchronous>
  **Idempotency key:** <key>
  **Test plan:**

  - <unit test description>
  - <integration test description>
  ```

- Creates `docs/policies/` if it does not exist
- Does NOT modify `state.json`
- Completion banner:
  ```
  ════════════════════════════════════════════════════════════════
  ✅ Policy created — PL-<n>: <Name>
  ════════════════════════════════════════════════════════════════
  File: docs/policies/PL-<n>-<name>.md
  ════════════════════════════════════════════════════════════════
  ```

**Step 2: Verify against design doc**

Checklist:

- [ ] All 5 Q&A questions present
- [ ] Idempotency key in output
- [ ] Test plan in output
- [ ] No state.json write
- [ ] Auto-increments PL-NNN
- [ ] Creates docs/policies/ if missing

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/policy.md
git commit -m "feat(sdlc-skills): add colloquium:policy — cross-cutting policy document generator"
```

---

## Task 3: `colloquium:domain-frame` (A0 → A1)

**Files:**

- Create: `.claude/commands/colloquium/domain-frame.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement rules (top of file):
  1. Never run if `domain.state` already exists in `state.json` and is beyond A0 — display error and stop
  2. Both output files must exist on disk before writing state.json — verify with ls
  3. Writes state.json after and only after both files confirmed to exist
- Q&A (4 questions, asked via AskUserQuestion, block of 2 then block of 2):
  1. What is Colloquium's core business outcome in one sentence?
  2. Who are the primary users and what do they achieve?
  3. What are the top 3–5 unknowns that could derail the project?
  4. What is explicitly out of scope?
- Output artifacts:
  - `docs/domain/glossary.md` — 10–30 terms, each with: term, definition, bounded context (if applicable), example usage sentence
  - `docs/domain/framing.md` — sections: Core Outcome, Primary Users, Out of Scope, Top Risks/Unknowns
- Creates `docs/domain/` if it does not exist
- State write: set `domain.state = "A1"`, `domain.completed = ["A0"]` in `.claude/sdlc/state.json`
- Creates `.claude/sdlc/` if it does not exist
- Completion banner:

  ```
  ════════════════════════════════════════════════════════════════
  ✅ Domain framed — A0 → A1
  ════════════════════════════════════════════════════════════════
  docs/domain/glossary.md    ✅  (N terms)
  docs/domain/framing.md     ✅
  state.json                 ✅  domain.state = "A1"

  Next: /colloquium:domain-subdomains
  ════════════════════════════════════════════════════════════════
  ```

**Step 2: Verify against design doc**

Checklist:

- [ ] Guard against re-run (state already > A0)
- [ ] Both output files documented with exact content requirements
- [ ] glossary.md has 10–30 terms
- [ ] framing.md has all four sections
- [ ] state.json write spec is exact (field names, values)
- [ ] Hard gate: ls verification before state write
- [ ] Next step shown in banner

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/domain-frame.md
git commit -m "feat(sdlc-skills): add colloquium:domain-frame — A0→A1 ubiquitous language seed"
```

---

## Task 4: `colloquium:domain-subdomains` (A1 → A2)

**Files:**

- Create: `.claude/commands/colloquium/domain-subdomains.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `domain.state = "A1"` in state.json — error if not
- Input: reads `docs/domain/framing.md`
- No Q&A — generates automatically from framing content
- Classification: every major area gets Core / Supporting / Generic label
- For each subdomain: purpose (one sentence), success metric (measurable), investment decision (model deeply / use off-the-shelf / ignore)
- Output: `docs/domain/subdomains.md`
- Subdomains.md structure:

  ```markdown
  # Subdomains

  ## Core

  ### <Name>

  **Purpose:** ...
  **Success metric:** ...
  **Investment:** Model deeply

  ## Supporting

  ...

  ## Generic

  ...
  ```

- Gate: ≥1 Core subdomain must exist
- State write: `domain.state = "A2"`, append "A1" to `domain.completed`
- Completion banner with count per category + next step

**Step 2: Verify against design doc**

Checklist:

- [ ] Requires state A1 — errors if not
- [ ] Reads framing.md (no Q&A)
- [ ] Three classification tiers
- [ ] Each subdomain has purpose + metric + investment
- [ ] Gate: ≥1 Core required
- [ ] State write is correct

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/domain-subdomains.md
git commit -m "feat(sdlc-skills): add colloquium:domain-subdomains — A1→A2 subdomain classification"
```

---

## Task 5: `colloquium:domain-contexts` (A2 → A3)

**Files:**

- Create: `.claude/commands/colloquium/domain-contexts.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `domain.state = "A2"` — error if not
- Inputs: reads `docs/domain/subdomains.md` + `docs/domain/glossary.md`
- Generates draft bounded contexts, one per major capability cluster
- For each BC:
  - Name (PascalCase)
  - Business capability (one sentence)
  - Language boundary: key terms and their meaning _within this context_ (may differ from glossary)
  - Commands accepted (list)
  - Events emitted (list)
  - Inputs from other contexts
  - Outputs to other contexts
- **Hard gate:** presents draft to user and waits for explicit approval before writing
- Unclear boundaries → targeted Q&A before proceeding (not skippable)
- Output: `docs/domain/bounded-contexts.md`
- Bounded-contexts.md structure:

  ```markdown
  # Bounded Contexts

  ## <BCName>

  **Business capability:** ...

  **Language (within this context):**

  - <term>: <local definition>

  **Commands:** ...
  **Events emitted:** ...
  **Inputs:** ...
  **Outputs:** ...
  ```

- State write: `domain.state = "A3"`, append "A2" to `domain.completed`
- Completion banner with BC count + next step

**Step 2: Verify against design doc**

Checklist:

- [ ] Requires state A2
- [ ] Language boundary section per BC (local definitions)
- [ ] Commands + events + inputs + outputs per BC
- [ ] Hard gate: user approval before writing
- [ ] Unclear boundary → Q&A loop
- [ ] State write correct

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/domain-contexts.md
git commit -m "feat(sdlc-skills): add colloquium:domain-contexts — A2→A3 bounded context boundaries"
```

---

## Task 6: `colloquium:domain-map` (A3 → A4)

**Files:**

- Create: `.claude/commands/colloquium/domain-map.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `domain.state = "A3"` — error if not
- Input: reads `docs/domain/bounded-contexts.md`
- For every BC-to-BC relationship, assigns one of: Customer/Supplier, Conformist, ACL, Published Language, Shared Kernel
- For each relationship:
  - Pattern name
  - Integration mechanism: events vs API
  - Contract ownership (which BC publishes / which consumes)
  - Anti-corruption layer plan if needed
- Output 1: `docs/domain/context-map.md`
- Context-map.md structure:

  ```markdown
  # Context Map

  ## <BCName> → <BCName>

  **Pattern:** Customer/Supplier
  **Mechanism:** Domain events
  **Contract owner:** <BC>
  **ACL needed:** yes/no — <reason if yes>
  ```

- Output 2: `docs/domain/delivery-shape.md`
- Delivery-shape.md must answer: "Can a thin slice be implemented with one context's internal model protected and integration via explicit contract?" Answer must be "yes" with justification, or list blockers.
- **Hard gate:** user approves context map before writing either file
- **Final lock:** after A4 is written, skill adds a warning to state.json: `"domainLocked": true`. Any subsequent attempt to run A-layer skills displays: "Domain discovery is permanently closed. To override, manually delete domainLocked from state.json."
- State write: `domain.state = "A4"`, append "A3" to `domain.completed`, `domainLocked: true`
- Completion banner:

  ```
  ════════════════════════════════════════════════════════════════
  ✅ Domain complete — A4
  ════════════════════════════════════════════════════════════════
  docs/domain/context-map.md      ✅
  docs/domain/delivery-shape.md   ✅
  Domain locked (domainLocked: true)

  Next: /colloquium:slice-select
  ════════════════════════════════════════════════════════════════
  ```

**Step 2: Verify against design doc**

Checklist:

- [ ] Requires state A3
- [ ] All 5 DDD patterns documented (Customer/Supplier, Conformist, ACL, Published Language, Shared Kernel)
- [ ] Every relationship has mechanism + contract owner + ACL plan
- [ ] delivery-shape.md confirms slice-readiness
- [ ] Hard gate: user approves before writing
- [ ] domainLocked flag set
- [ ] A-layer re-run guard references domainLocked

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/domain-map.md
git commit -m "feat(sdlc-skills): add colloquium:domain-map — A3→A4 context map + domain lock"
```

---

## Task 7: `colloquium:slice-select` (B0 → B1)

**Files:**

- Create: `.claude/commands/colloquium/slice-select.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `domain.state = "A4"` — error if not
- Enforcement: requires no current `activeSlice` in state.json — if one exists, display it and ask "Complete the active slice first or abandon it?"
- Q&A (4 questions):
  1. What user journey does this slice deliver end-to-end?
  2. Which bounded contexts does it touch? (display available BCs from bounded-contexts.md; recommend ≤2)
  3. What is the success metric — how will you know this slice worked? (must be measurable)
  4. What is explicitly not in this slice?
- Auto-assign next available slice ID: scan `docs/slices/` for existing SL-NNN folders
- Output: `docs/slices/SL-<n>/slice.md`
- Slice.md structure:

  ```markdown
  # SL-<n>: <Name>

  **User journey:** ...

  **Bounded contexts involved:** <BC1>, <BC2>

  **Success metric:** ...

  **Not in this slice:** ...
  ```

- Creates `docs/slices/SL-<n>/` directory
- Gate: narrative exists, contexts listed, metric is measurable (non-vague check — if metric is vague like "feels fast", reject and re-ask)
- State write: `activeSlice = { id: "SL-<n>", name: "<kebab-name>", state: "B1" }`
- Completion banner with slice ID + next step

**Step 2: Verify against design doc**

Checklist:

- [ ] Requires A4 domain
- [ ] Guards against active slice
- [ ] Shows available BCs from bounded-contexts.md
- [ ] Warns if >2 BCs selected
- [ ] Metric vagueness check
- [ ] Auto-increments SL-NNN
- [ ] State write correct

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-select.md
git commit -m "feat(sdlc-skills): add colloquium:slice-select — B0→B1 slice narrative"
```

---

## Task 8: `colloquium:slice-storm` (B1 → B2)

**Files:**

- Create: `.claude/commands/colloquium/slice-storm.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeSlice.state = "B1"` — error if not
- Input: reads `docs/slices/<activeSlice.id>/slice.md`
- Runs solo Event Storming pass — generates all five swimlanes:
  1. **Domain Events** (orange) — past-tense facts (`VideoUploaded`, `UserRegistered`)
  2. **Commands** (blue) — imperative triggers (`UploadVideo`, `RegisterUser`)
  3. **Policies** (purple) — "When <event> then <command>" rules
  4. **Read Models** (green) — what the UI / query side needs to display
  5. **External Systems** (pink) — systems outside slice boundary
- Also generates: **Hot Spots** list — ambiguous business rules requiring decisions
- Hot spots trigger Q&A — for each hot spot, asks user to resolve it before continuing. Not skippable.
- Output: `docs/slices/<id>/event-storm.md`
- Event-storm.md structure:

  ```markdown
  # Event Storm — SL-<n>

  ## Domain Events

  - `<EventName>` — <description>

  ## Commands

  - `<CommandName>` — <description>

  ## Policies

  - When `<event>` → `<command>` — <condition if any>

  ## Read Models

  - `<ReadModelName>` — <what it shows>

  ## External Systems

  - `<SystemName>` — <role in this slice>

  ## Hot Spots (resolved)

  - <description> → <resolution>
  ```

- Gate: ≥10 candidate domain events, command list non-empty, all hot spots resolved or explicitly deferred (deferred ones marked as such in the doc)
- State write: `activeSlice.state = "B2"`

**Step 2: Verify against design doc**

Checklist:

- [ ] All 5 swimlanes
- [ ] Hot spots section
- [ ] Hot spots trigger Q&A (not skippable)
- [ ] Deferred hot spots allowed but must be marked
- [ ] Gate: ≥10 events
- [ ] State write correct

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-storm.md
git commit -m "feat(sdlc-skills): add colloquium:slice-storm — B1→B2 event storming"
```

---

## Task 9: `colloquium:slice-model` (B2 → B3)

**Files:**

- Create: `.claude/commands/colloquium/slice-model.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeSlice.state = "B2"` — error if not
- Input: reads `docs/slices/<id>/event-storm.md`
- For every aggregate (derived from event storm commands + events):
  - **State machine:** named states + valid transitions (drawn as a table or list)
  - **Invariants:** bullet list of "must always hold" — each must be testable. Vague invariants ("should be safe") are rejected and rewritten via Q&A
  - **Commands:** methods the aggregate accepts (maps to commands from storm)
  - **Events emitted:** what it publishes (maps to domain events from storm)
- For every cross-context integration:
  - Draft event schema (field names + types + semantics)
  - Versioning approach (`v1`, backward-compatible-only rule)
- **Hard gate:** presents every aggregate's state machine + invariant list to user for explicit approval. Cannot write model.md until user approves all aggregates. Unapproved aggregates loop back to Q&A.
- Output: `docs/slices/<id>/model.md`
- Model.md structure:

  ```markdown
  # Model — SL-<n>

  ## Aggregate: <Name> (<BoundedContext>)

  ### States

  | State | Description |
  | ----- | ----------- |
  | Draft | ...         |

  ### Transitions

  | From | Command | To  |
  | ---- | ------- | --- |

  ### Invariants

  - <testable statement>

  ### Commands

  - `<CommandName>(<params>)` — <description>

  ### Events Emitted

  - `<EventName>` — <payload summary>

  ## Cross-Context Integrations

  ### <EventName> (v1)

  **Schema:** `{ field: type, ... }`
  **Semantics:** ...
  **Versioning:** backward-compatible fields only
  ```

- State write: `activeSlice.state = "B3"`

**Step 2: Verify against design doc**

Checklist:

- [ ] State machine table per aggregate
- [ ] Invariants as testable statements (vague rejection enforced)
- [ ] Commands + events per aggregate
- [ ] Draft schema per cross-context integration
- [ ] Versioning rule documented
- [ ] Hard gate: user approves each aggregate
- [ ] State write correct

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-model.md
git commit -m "feat(sdlc-skills): add colloquium:slice-model — B2→B3 aggregate commitment"
```

---

## Task 10: `colloquium:slice-contracts` (B3 → B4)

**Files:**

- Create: `.claude/commands/colloquium/slice-contracts.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeSlice.state = "B3"` — error if not
- Input: reads `docs/slices/<id>/model.md`
- Identifies every cross-context integration from model's "Cross-Context Integrations" section
- For each integration, generates one contract file: `docs/contracts/CT-<n>-<kebab-name>.md`
- Each contract file must include:
  - Contract type: API (request/response) OR Event (schema + semantics)
  - For API: method, path, request schema, response schema, error codes
  - For Event: event name, version, full payload schema, semantics (what it means), when it fires
  - **Consumer expectations:** what the consuming BC assumes about this contract
  - **Producer guarantees:** what the publishing BC commits to
  - **Backward compatibility rule:** "new optional fields only; breaking changes require v2"
  - **Contract test plan:** one sentence describing the test (e.g., "Pact test between Publishing and Playback for VideoPublished v1")
- Auto-assigns CT-NNN IDs by scanning `docs/contracts/`
- Creates `docs/contracts/` if it does not exist
- **Gate:** every integration point in model.md has a corresponding CT-\*.md file. Missing contract = hard stop.
- State write: `activeSlice.state = "B4"`, add contract IDs to `activeSlice.contracts[]`
- Completion banner listing all contracts created

**Step 2: Verify against design doc**

Checklist:

- [ ] Handles both API and event contract types
- [ ] Consumer expectations + producer guarantees
- [ ] Backward compatibility rule
- [ ] Contract test plan per contract
- [ ] Gate: every integration point covered (hard stop if any missing)
- [ ] Auto-increments CT-NNN
- [ ] Contracts added to state.json

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-contracts.md
git commit -m "feat(sdlc-skills): add colloquium:slice-contracts — B3→B4 contract stabilization"
```

---

## Task 11: `colloquium:slice-deliver` (B4 → B5)

**Files:**

- Create: `.claude/commands/colloquium/slice-deliver.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeSlice.state = "B4"` — error if not
- **Explicit rule: this skill writes NO code.** It only generates documents and state.
- Input: reads model.md + contract files + slice.md
- Decomposes slice into ordered feature queue:
  - One feature per aggregate (ordered: foundation aggregates first, dependent last)
  - One feature per contract (integration wiring)
  - One feature per read model (query side)
- Each feature entry:
  - Stable feature ID (feat-001, feat-002, … scoped per slice, stored in state)
  - Name (kebab-case)
  - Owning bounded context
  - Type: aggregate | contract | read-model
  - Dependencies: list of feat-IDs that must be done first
- Output: `docs/releases/<id>-internal.md` skeleton
- Internal release note skeleton:

  ```markdown
  # SL-<n> Internal Release Note

  **Status:** In progress
  **Features:** <count>
  **Feature queue:** <list of feat IDs with names>

  ## What Ships

  [to be filled when validate runs]

  ## Known Issues

  [to be filled]
  ```

- State write:
  - `activeSlice.state = "B5"`
  - `activeSlice.featureQueue = [{ id, name, bc, type, dependencies, state: "C0" }]`
  - `activeFeature = { id: "<first feature id>", name: "<name>", state: "C0", sliceId: "<slice id>" }`
- Completion banner:

  ```
  ════════════════════════════════════════════════════════════════
  ✅ Slice decomposed — SL-<n> ready for implementation
  ════════════════════════════════════════════════════════════════
  Features queued:  <count>
  First feature:    <feat-id> — <name> (<type>)

  Next: /colloquium:feature-spec
  ════════════════════════════════════════════════════════════════
  ```

**Step 2: Verify against design doc**

Checklist:

- [ ] No code written (explicitly stated in skill)
- [ ] Three decomposition sources: aggregates, contracts, read models
- [ ] Dependency ordering documented
- [ ] Internal release note skeleton written
- [ ] featureQueue in state.json with full entries
- [ ] activeFeature set to first item
- [ ] State writes correct

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-deliver.md
git commit -m "feat(sdlc-skills): add colloquium:slice-deliver — B4→B5 slice decomposition"
```

---

## Task 12: `colloquium:slice-validate` (B5 → done)

**Files:**

- Create: `.claude/commands/colloquium/slice-validate.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeSlice.state = "B5"` — error if not
- **Hard gate (pre-check):** reads `activeSlice.featureQueue` from state.json — every feature must have `state: "done"`. If any feature is not done, displays which ones are incomplete and refuses to continue.
- Runs (in order):
  1. Full UAT pass via Playwright MCP — navigates the full user journey described in slice.md
  2. Regression check — re-runs UAT steps for all previously completed slices' golden paths
  3. Guardrail check — reads any metrics docs, confirms failure rate below threshold
- Each step must pass before next step runs
- UAT failure: displays exact failing step, routes back to `feature-implement` for the relevant feature with failure context (sets that feature back to C6)
- Writes: `docs/releases/<id>-public.md`
- Public release note structure:

  ```markdown
  # SL-<n> Release Note

  **Released:** <date>

  ## What Ships

  <prose description of the slice's user journey>

  ## Features

  - feat-001: <name> ✅
  - ...

  ## Flags Promoted

  - <flag-name>: internal → beta

  ## Known Issues

  - <any>

  ## Cleanup Tasks

  - Remove flag <name> after beta validation
  ```

- State write:
  - Remove `activeSlice` from state.json
  - Append slice ID to `completedSlices[]`
  - Clear `activeFeature`
- After writing: displays "Slice complete. Start next slice with /colloquium:slice-select or run /colloquium:status to review."

**Step 2: Verify against design doc**

Checklist:

- [ ] Hard gate: all features done before UAT
- [ ] Playwright MCP UAT pass
- [ ] Regression on previous slices
- [ ] UAT failure routes back to feature-implement (not just errors)
- [ ] Public release note with all required sections
- [ ] State cleared correctly
- [ ] Post-completion prompt for next slice

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-validate.md
git commit -m "feat(sdlc-skills): add colloquium:slice-validate — B5→done slice UAT + release note"
```

---

## Task 13: `colloquium:feature-spec` (C0 → C2)

**Files:**

- Create: `.claude/commands/colloquium/feature-spec.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeFeature` exists and `activeFeature.state = "C0"` — error if not
- Input: reads feature entry from `activeSlice.featureQueue` in state.json, then reads `docs/slices/<id>/model.md`
- For simple features (aggregate type, no new state machines): generates automatically from model.md
- For features touching new aggregates or cross-context boundaries: asks 2–3 targeted clarifying questions
- Output: `docs/features/<bc>/<aggregate>/spec.md`
- Creates directory if not exists
- Spec.md must contain all five sections:
  1. **Entities** — aggregate state machine (copied from model.md, refined for this feature scope)
  2. **Invariants** — every invariant as a testable statement. Vague ones rejected.
  3. **Failure modes** — top 3–5 edge cases with: trigger condition + expected system behavior
  4. **External contracts** — list of CT-NNN contracts this feature consumes or produces
  5. **Test strategy** — which layers need tests:
     - Domain unit tests (pure aggregate tests)
     - Contract tests (if integration point)
     - Integration tests (if adapter/persistence)
     - E2E/UAT (if critical path node)
- Spec.md template:

  ```markdown
  # Feature Spec: <name> (<feat-id>)

  **Owning BC:** <name>
  **Type:** aggregate | contract | read-model
  **Slice:** SL-<n>

  ## Entities

  <aggregate state machine>

  ## Invariants

  - <testable statement>

  ## Failure Modes

  | Trigger     | Expected behavior |
  | ----------- | ----------------- |
  | <condition> | <system response> |

  ## External Contracts

  - CT-<n>: <name> (consumed | produced)

  ## Test Strategy

  - [ ] Domain unit: <what>
  - [ ] Contract: <what> (if applicable)
  - [ ] Integration: <what>
  - [ ] E2E: <what> (if critical path)
  ```

- State write: `activeFeature.state = "C2"`
- Completion banner with spec path + test strategy summary

**Step 2: Verify against design doc**

Checklist:

- [ ] All 5 spec sections present
- [ ] Invariants vagueness check
- [ ] Failure modes table
- [ ] Test strategy with layer breakdown
- [ ] Auto vs. Q&A based on feature type
- [ ] State write correct (C0 → C2, skipping C1)

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/feature-spec.md
git commit -m "feat(sdlc-skills): add colloquium:feature-spec — C0→C2 feature specification"
```

---

## Task 14: `colloquium:feature-implement` (C2 → C7)

**Files:**

- Create: `.claude/commands/colloquium/feature-implement.md`

**Step 1: Write the skill file**

This is the most complex skill — covers 5 sub-steps, each with its own gate and state write.

Content must cover:

- Enforcement: requires `activeFeature.state` is one of C2, C3, C4, C5, C6 — resumes from current sub-step. Error if C0, C1, C7, or done.
- Reads spec from `docs/features/<bc>/<aggregate>/spec.md` at session start
- On session start: displays which C-state the feature is at and what sub-step comes next

**Sub-step C2 → C3: Domain Tests RED**

- Uses `superpowers:test-driven-development` skill
- Writes pure aggregate/invariant tests (no DB, no HTTP, no framework — pure functions)
- Tests derived from the Invariants section of spec.md
- Confirms RED (if test passes immediately, the test is wrong — must rewrite)
- State write: `activeFeature.state = "C3"` after RED confirmed

**Sub-step C3 → C4: Domain GREEN**

- Implements domain logic (aggregate class, value objects, domain events)
- Runs tests — must be GREEN
- Refactors with tests remaining green
- Uses `code-simplifier:code-simplifier` post-green
- Uses `superpowers:requesting-code-review` + `superpowers:receiving-code-review`
- State write: `activeFeature.state = "C4"`

**Sub-step C4 → C5: Contract Tests**

- Only if feature has external contracts (from spec External Contracts section)
- If no contracts: skip directly to C5 (write state C5 immediately)
- Writes consumer-driven contract tests (even solo — define both sides)
- Contract test must reference CT-NNN file for schema
- State write: `activeFeature.state = "C5"`

**Sub-step C5 → C6: Adapters + Read Model**

- Implements persistence (repository mappings), HTTP handlers/controllers, projections/read models
- Runs integration tests (DB/API layer tests)
- All integration tests must be green
- If stuck 3+ consecutive attempts: invokes `superpowers:systematic-debugging`
- State write: `activeFeature.state = "C6"`

**Sub-step C6 → C7: Journey Check (minimal E2E)**

- Uses Playwright MCP
- One E2E test per critical path node in spec test strategy
- If E2E automation is wasteful (complex UI): adds UAT step to spec instead, documents why
- State write: `activeFeature.state = "C7"`

After C7: displays "Feature implementation complete. Next: /colloquium:feature-verify"

**Stuck handling across all sub-steps:** if stuck 3+ consecutive attempts on any sub-step, invokes `superpowers:systematic-debugging`. If that also fails, stops and asks user to review the spec at `docs/features/<bc>/<aggregate>/spec.md` — the feature may be under-specified.

**Step 2: Verify against design doc**

Checklist:

- [ ] Resumes from current C-state (not always starts at C2)
- [ ] All 5 sub-steps documented with their own state writes
- [ ] C4→C5 skip if no contracts
- [ ] TDD sub-skill used (C2→C3, C3→C4)
- [ ] Systematic-debugging used if stuck 3+
- [ ] Code-simplifier post-green
- [ ] Code review after each sub-step
- [ ] Playwright MCP for C6→C7
- [ ] UAT alternative for complex UI E2E
- [ ] State written at each sub-step (crash recovery)

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/feature-implement.md
git commit -m "feat(sdlc-skills): add colloquium:feature-implement — C2→C7 TDD DDD delivery loop"
```

---

## Task 15: `colloquium:feature-verify` (C7 → F4)

**Files:**

- Create: `.claude/commands/colloquium/feature-verify.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeFeature.state = "C7"` — error if not
- Input: reads `docs/features/<bc>/<aggregate>/spec.md` for the test strategy section
- Runs (in order):
  1. Execute every test strategy item from spec via Playwright MCP
  2. Screenshot at each key state (named: `<feat-id>-step-<n>.png`)
  3. Check logs for new high-severity errors (any ERROR or FATAL not present before)
  4. Regression on golden paths: re-run all previously verified features' UAT steps
- **Hard gate:** UAT pass required before `uat.md` is written. No exceptions.
- UAT failure: does NOT write uat.md. Sets `activeFeature.state = "C6"` (routes back to implement). Displays exactly which step failed and what was observed vs. expected.
- UAT pass: writes `docs/features/<bc>/<aggregate>/uat.md`
- uat.md structure:

  ```markdown
  # UAT — <feature name> (<feat-id>)

  **Result:** PASS
  **Date:** <date>

  ## Steps Executed

  | Step | Action | Expected | Observed | Result |
  | ---- | ------ | -------- | -------- | ------ |
  | 1    | ...    | ...      | ...      | ✅     |

  ## Screenshots

  - <feat-id>-step-1.png
  - ...

  ## Regressions Checked

  - <feat-id>: ✅
  ```

- State write: `activeFeature.state = "F4"`
- Completion banner with UAT result + next step

**Step 2: Verify against design doc**

Checklist:

- [ ] Hard gate: no uat.md without UAT pass
- [ ] Failure: routes back to C6 (not just error)
- [ ] Screenshots taken at each key state
- [ ] Log check for new high-severity errors
- [ ] Regression on all previous features' golden paths
- [ ] uat.md structure with full table
- [ ] State write: C7 → F4

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/feature-verify.md
git commit -m "feat(sdlc-skills): add colloquium:feature-verify — C7→F4 UAT hard gate"
```

---

## Task 16: `colloquium:feature-integrate` (F4 → done)

**Files:**

- Create: `.claude/commands/colloquium/feature-integrate.md`

**Step 1: Write the skill file**

Content must cover:

- Enforcement: requires `activeFeature.state = "F4"` — error if not
- Input: reads uat.md + `docs/slices/<id>/model.md` + existing `docs/policies/` files
- Runs integration checklist:
  1. **Upstream wiring:** verify events from upstream features are consumed correctly (check that events listed in spec's External Contracts section are actually wired)
  2. **Downstream wiring:** verify events emitted by this feature are consumed by downstream features in the queue (or documented as "pending wiring" if downstream feature not yet implemented)
  3. **New interactions:** if implementation discovered any cross-cutting behavior not in the model, create or update `docs/policies/<id>.md` via the policy doc format (same format as `colloquium:policy` output)
  4. **Flag lifecycle:** set promotion criteria for any feature flag created during implementation:
     - Internal → Beta criteria
     - Beta → Default-on criteria
     - Cleanup ticket (note to remove flag once default-on)
- All four checklist items must be addressed (even if "N/A — no upstream" is the answer)
- State write:
  - Set feature state to `"done"` in `activeSlice.featureQueue`
  - Clear `activeFeature`
  - Append feat-id to `completedFeatures[]`
- After writing: check if featureQueue has more items with state "C0"
  - If yes: set `activeFeature` to next C0 feature, display "Next: /colloquium:feature-spec for <feat-id>"
  - If queue is exhausted: display "All features done. Next: /colloquium:slice-validate"
- Completion banner showing integration status + next feature or slice-validate prompt

**Step 2: Verify against design doc**

Checklist:

- [ ] All 4 checklist items
- [ ] Downstream "pending wiring" allowed for unimplemented features
- [ ] New interactions → policy doc (inline, not via skill invocation)
- [ ] Flag lifecycle: all 3 criteria + cleanup ticket
- [ ] State: feature → done, activeFeature cleared, completedFeatures updated
- [ ] Auto-advances to next feature or prompts slice-validate

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/feature-integrate.md
git commit -m "feat(sdlc-skills): add colloquium:feature-integrate — F4→done integration + flag lifecycle"
```

---

## Task 17: `colloquium:sdlc` (Dispatcher — write last)

**Files:**

- Create: `.claude/commands/colloquium/sdlc.md`

**Step 1: Write the skill file**

Content must cover:

- Reads `.claude/sdlc/state.json` on every invocation — no assumptions, always re-reads
- If state.json missing: routes to `colloquium:domain-frame`, displays "Starting fresh — domain discovery first."
- If state.json exists: displays current position banner, then routes

**Current position banner:**

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC — Current Position
════════════════════════════════════════════════════════════════
Domain:         <state> — <one-line summary>
Active Slice:   <id> "<name>" — <B-state> (<B-state description>)
Active Feature: <feat-id> "<name>" — <C-state> (<C-state description>)
════════════════════════════════════════════════════════════════
Next step: <skill name>
Routing you there now...
════════════════════════════════════════════════════════════════
```

**Full routing table:**

| Condition                                      | Routes to           | Description                 |
| ---------------------------------------------- | ------------------- | --------------------------- |
| No state.json                                  | `domain-frame`      | First ever run              |
| domain.state = "A0"                            | `domain-subdomains` | Frame done                  |
| domain.state = "A1"                            | `domain-contexts`   | Subdomains done             |
| domain.state = "A2"                            | `domain-map`        | Contexts done               |
| domain.state = "A3" AND no activeSlice         | `slice-select`      | Map done, no slice          |
| domain.state = "A4" AND no activeSlice         | `slice-select`      | Domain complete, pick slice |
| activeSlice.state = "B1"                       | `slice-storm`       | Slice selected              |
| activeSlice.state = "B2"                       | `slice-model`       | Storm done                  |
| activeSlice.state = "B3"                       | `slice-contracts`   | Model done                  |
| activeSlice.state = "B4"                       | `slice-deliver`     | Contracts done              |
| activeSlice.state = "B5" AND no activeFeature  | `feature-spec`      | Delivered, pick feature     |
| activeFeature.state = "C0"                     | `feature-spec`      | Feature queued              |
| activeFeature.state = "C2"–"C7"                | `feature-implement` | Feature in progress         |
| activeFeature.state = "F4"                     | `feature-integrate` | Feature verified            |
| activeSlice.state = "B5" AND all features done | `slice-validate`    | All features complete       |

- After displaying banner + routing, invokes the target skill directly via Skill tool
- Accepts optional `--status` flag to show status without routing (delegates to `colloquium:status`)

**Step 2: Verify against design doc**

Checklist:

- [ ] Full routing table — every state transition covered
- [ ] Handles missing state.json
- [ ] Current position banner before routing
- [ ] Invokes target skill (doesn't just tell user to run it)
- [ ] --status flag delegates to colloquium:status
- [ ] Routing for "all features done → slice-validate"

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/sdlc.md
git commit -m "feat(sdlc-skills): add colloquium:sdlc — dispatcher routing all 17 skills"
```

---

## Task 18: Deprecate `colloquium:project.md`

**Files:**

- Modify: `.claude/commands/colloquium/project.md`

**Step 1: Replace project.md content**

Replace the current content with a deprecation notice:

```markdown
# Colloquium Project (DEPRECATED)

> ⚠️ This skill suite has been replaced by the DDD SDLC skill suite.

The `colloquium:project-*` skills (project-plan, project-implement, features, mvp) are no longer maintained.

## New workflow

Use `/colloquium:sdlc` — it routes you to the right step automatically.

Or invoke skills directly:

| Old command                     | New equivalent                                                  |
| ------------------------------- | --------------------------------------------------------------- |
| `/colloquium:project-plan`      | `/colloquium:domain-frame` (then follow the pipeline)           |
| `/colloquium:project-implement` | `/colloquium:feature-implement`                                 |
| `/colloquium:project-features`  | Not replaced — feature list is derived from slice decomposition |
| `/colloquium:project-mvp`       | Not replaced — MVP scope is set during slice selection          |

**Start here:** `/colloquium:sdlc`
```

**Step 2: Verify**

- [ ] Deprecation notice is clear
- [ ] Maps old commands to new equivalents
- [ ] Points to `/colloquium:sdlc` as the entry point

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(sdlc-skills): deprecate colloquium:project-* — replaced by sdlc skill suite"
```

---

## Task 19: Final consistency pass

**Files:**

- Read all 17 new skill files

**Step 1: Cross-reference state.json field names**

Read each skill file and verify:

- Every skill that reads state.json uses the exact field names from the design doc state schema
- Every skill that writes state.json produces valid JSON with the exact field names
- No skill invents new field names not in the schema
- State transitions are consistent (no skill writes a state that another skill doesn't recognize as an input)

**Step 2: Cross-reference artifact paths**

Verify:

- Every skill reads from / writes to the exact paths in the artifact structure from the design doc
- No skill creates files in undocumented locations
- Every output file from one skill is consumed by the correct next skill

**Step 3: Cross-reference banners**

Verify:

- Every skill has a completion banner
- Every banner shows the "Next:" step
- Banner format is consistent (═ borders, ✅ for success, ❌ for error)

**Step 4: Commit if any fixes were needed**

```bash
git add .claude/commands/colloquium/
git commit -m "fix(sdlc-skills): consistency fixes — state field names, artifact paths, banners"
```

---

## Summary

**17 skill files to create:**

| Task | Skill               | Layer         |
| ---- | ------------------- | ------------- |
| 1    | `status`            | cross-cutting |
| 2    | `policy`            | cross-cutting |
| 3    | `domain-frame`      | A             |
| 4    | `domain-subdomains` | A             |
| 5    | `domain-contexts`   | A             |
| 6    | `domain-map`        | A             |
| 7    | `slice-select`      | B             |
| 8    | `slice-storm`       | B             |
| 9    | `slice-model`       | B             |
| 10   | `slice-contracts`   | B             |
| 11   | `slice-deliver`     | B             |
| 12   | `slice-validate`    | B             |
| 13   | `feature-spec`      | C             |
| 14   | `feature-implement` | C             |
| 15   | `feature-verify`    | C             |
| 16   | `feature-integrate` | C             |
| 17   | `sdlc` (dispatcher) | dispatcher    |

Plus: deprecate `project.md` (Task 18) + consistency pass (Task 19).

**Total commits: 19**
