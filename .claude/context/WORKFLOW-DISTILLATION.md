# Colloquium Workflow Distillation

**Status:** Canonical reference — v2 Simple Workflow
**Date:** 2026-02-23
**Supersedes:** 2026-02-21 Maximum Skill Workflow (7 phases)

---

## Design Principles

1. **Local-only.** No external services during development. No Vercel, no Supabase, no deployed URLs. Everything runs on the developer's machine.

2. **Human-controlled git.** The AI never creates branches, pushes, or opens PRs. It works on whatever branch is currently checked out. The developer controls all git operations.

3. **No automated looping.** Phase 3 does not use ralph-loop. Every task advances only when the user explicitly confirms continuation.

4. **Extreme resumability.** State is written to `.claude/dispatch-state.json` after every single step. A session can end at any point; the next invocation of `/colloquium:feature` resumes from the exact step.

5. **TDD is enforced.** Every task in Phase 3 requires a failing test before implementation. Red before green is not optional.

---

## Four Phases

| Phase | Name      | Role                                                                            |
| ----- | --------- | ------------------------------------------------------------------------------- |
| 0     | State     | Check for existing session; resume or start fresh                               |
| 1     | Discover  | Understand codebase, pull library docs, brainstorm + get design approval        |
| 2     | Plan      | Package boundary map, optional UI design, implementation plan, CLAUDE.md update |
| 3     | Implement | Per-task TDD loop with self-review after each task                              |
| 4     | Test      | Local validation (unit + type + build + lint) + E2E against local dev server    |

After Phase 4 passes — workflow complete. AI outputs a summary. Human handles merge.

---

## Phase Diagram

```
Phase 0 · STATE MANAGEMENT
→ check for existing session, resume or start fresh

Phase 1 · DISCOVER [6 steps]
→ understand codebase, find reusable code, define feature design
HARD GATE: brainstorming approval required

Phase 2 · PLAN [4 steps]
→ package boundary map, optional UI design, implementation plan, CLAUDE.md update
HARD GATE: plan approval required

Phase 3 · IMPLEMENT [per-task, manual progression]
→ executing-plans setup → subagent-driven-development framework
→ per task: context7 → TDD (red→loop→green) → debug → simplify → review
CONFIRMATION: user confirms each task before next begins

Phase 4 · TEST [2 steps]
→ 2 parallel branches: quality gates (local) | E2E (local dev server)
→ verification gate
```

---

## Phase 0 · State Management

**Runs on every invocation of `/colloquium:feature`.**

### Step 0.1 — Check for existing state

```bash
cat .claude/dispatch-state.json 2>/dev/null || echo "NO_STATE_FILE"
```

### Step 0.2 — If state file exists: check schema version

- If `version` field is missing or `< 2`: display schema mismatch notice and offer clean start:

  ```
  ⚠️  State file schema v1 detected — this is from the old 7-phase workflow.
  Starting fresh with the 4-phase workflow.
  ```

  Delete the old state file and proceed to Step 0.3.

- If `version === 2`: display resume banner and ask:

  ```
  ════════════════════════════════════════════════════════════════
  🔄 COLLOQUIUM DISPATCH — Resume Detected
  ════════════════════════════════════════════════════════════════
  Feature:   [feature field from state]
  Phase:     [phase] · [phase name]
  Step:      [step]  · [step name]
  Last seen: [lastUpdated field from state]
  Completed: [count of completedSteps] steps done
  ════════════════════════════════════════════════════════════════
  ```

  Ask: "Resume from Phase [N] · Step [N] · [name], or start fresh?"
  - Resume: jump to the recorded phase and step
  - Start fresh: delete state file and proceed to Step 0.3

### Step 0.3 — If no state file: capture feature description

- If argument provided to `/colloquium:feature`: use as description
- If no argument: display prompt box and wait for user input

### Step 0.4 — Create initial state file

Write `.claude/dispatch-state.json`:

```json
{
  "version": 2,
  "feature": "[derived 2-3 word name]",
  "description": "[full description]",
  "phase": 1,
  "step": "1.1",
  "currentTaskIndex": null,
  "totalTasks": null,
  "completedSteps": [],
  "artifacts": {
    "designDoc": null,
    "boundaryMap": null,
    "planFile": null
  },
  "lastUpdated": "[ISO timestamp]"
}
```

State is updated (phase, step, completedSteps, lastUpdated) after every step.

---

## Phase 1 · Discover

**Goal:** Understand the codebase deeply and define the feature before designing anything.
**Hard gate:** No code, no scaffolding, no implementation action until Step 1.6 completes with explicit design approval.

---

### Step 1.1 · `superpowers:using-superpowers`

**Tool:** Skill
**Goal:** Check for applicable skills at the start of this session
**Failure:** Cannot fail; if skill unavailable, proceed and note the gap
**State update:** step → 1.2

---

### Step 1.2 · `claude-code-setup:claude-automation-recommender`

**Tool:** Skill
**Goal:** Verify the Claude Code setup (hooks, MCPs, plugins) is optimal for this monorepo
**Failure:** Cannot fail; if tool unavailable, proceed
**State update:** step → 1.3

---

### Step 1.3 · `feature-dev:code-explorer` (subagent)

**Tool:** Task (subagent_type: `feature-dev:code-explorer`)
**Goal:** Deep-trace the existing codebase — produce a structured dependency map
**Prompt to subagent:**

> "Explore the codebase to understand the current package structure, all exports from packages/, existing hooks, Zod schemas, TypeScript types, shared utilities, and anything relevant to: [description from state]. Produce a structured dependency map showing: which packages exist, what they export, which packages depend on which, and which existing code could be reused for this feature."

**Failure:** If subagent fails, invoke directly using Glob + Grep; do not skip
**State update:** step → 1.4

---

### Step 1.4 · `greptile` MCP

**Tool:** MCP direct
**Goal:** Search for existing utilities, patterns, and abstractions that overlap with the feature domain
**Operations:**

- `search_custom_context` — query for patterns related to the feature description
- `list_merge_requests` — review recent PRs to understand recently established patterns

**Failure:** If greptile unavailable, use Grep + Glob to approximate; note the gap
**State update:** step → 1.5

---

### Step 1.5 · `context7` MCP

**Tool:** MCP direct
**Goal:** Pull current, version-accurate documentation for every library the feature will touch
**Operations:**

- `resolve-library-id` for each relevant library
- `query-docs` scoped to the specific methods or APIs the feature will use

**Failure:** If context7 unavailable, note which library docs could not be fetched; proceed
**State update:** step → 1.6

---

### Step 1.6 · `superpowers:brainstorming` ← HARD GATE

**Tool:** Skill
**Goal:** Collaborative design exploration — clarifying questions, 2–3 approaches with trade-offs, approved design before proceeding
**Hard gate rule:** Do NOT proceed to Phase 2 until the user explicitly approves the design.
**Outputs:**

- Approved feature design written to `docs/plans/[date]-[feature]-design.md`
- Design doc path stored in state `artifacts.designDoc`

**State update:** step → 2.1; `artifacts.designDoc` → path of design document

**Phase 1 complete banner:**

```
════════════════════════════════════════════════════════════════
✅ PHASE 1 · DISCOVER COMPLETE
════════════════════════════════════════════════════════════════
  1.1 using-superpowers ✅
  1.2 claude-automation-recommender ✅
  1.3 code-explorer ✅
  1.4 greptile-search ✅
  1.5 context7-docs ✅
  1.6 brainstorming-approved ✅
Proceeding to Phase 2 · Plan...
════════════════════════════════════════════════════════════════
```

---

## Phase 2 · Plan

**Goal:** Produce a concrete architecture with explicit package ownership before any implementation starts.
**Hard gate:** No implementation task may be assigned to a file not declared in the package boundary map from Step 2.1.

---

### Step 2.1 · `feature-dev:code-architect` (subagent)

**Tool:** Task (subagent_type: `feature-dev:code-architect`)
**Goal:** Produce the package boundary map — which package owns each piece of new logic
**Prompt to subagent:**

> "Design the package boundary map for this feature: [description]. Reference the approved design doc at [artifacts.designDoc]. Reference the dependency map produced by code-explorer in Phase 1. Produce: (1) a table showing which package/app owns each new piece of logic; (2) what each package exports; (3) the TypeScript module graph between packages; (4) any new packages that need to be created. Enforce these rules: packages/utils has zero framework deps, apps/ do not import from each other, shared logic goes to packages/ not apps/."

**State update:** step → 2.2; `artifacts.boundaryMap` → inline reference

---

### Step 2.2 · `frontend-design:frontend-design` (conditional)

**Smart pause:** "Does this feature include UI components (touching apps/\* or packages/ui)?"

Ask: "Does this feature touch packages/ui or any apps/ UI layer?"

- Yes → invoke `frontend-design:frontend-design`
  - Constraint: components must reference `packages/ui` and `packages/types`, never app-internal code
- No → skip

**State update:** step → 2.3

---

### Step 2.3 · `superpowers:writing-plans` ← HARD GATE

**Tool:** Skill
**Goal:** Translate the approved design + package boundary map into bite-sized implementation tasks
**Each task in the produced plan must specify:**

- Exact file path including package directory
- Which package it belongs to
- Expected exports from that file
- Test file location
- Verification command (`pnpm turbo test --filter [package]`)
- Dependencies on prior tasks

**Plan file location:** `docs/plans/[date]-[feature]-impl.md`

**Hard gate rule:** Display the plan to the user. Ask for approval before proceeding to Phase 3. If revisions needed, re-invoke. Loop until approved.

**State update after approval:** step → 2.4; `artifacts.planFile` → plan file path

---

### Step 2.4 · `claude-md-management:claude-md-improver`

**Tool:** Skill
**Goal:** Update `CLAUDE.md` (root + affected packages) with architectural patterns decided in this phase before implementation starts
**What to record:** Package boundary rules, naming conventions, new shared abstractions, new package ownership rules

**State update:** step → 3.0

**Phase 2 complete banner:**

```
════════════════════════════════════════════════════════════════
✅ PHASE 2 · PLAN COMPLETE
════════════════════════════════════════════════════════════════
  2.1 code-architect (boundary map) ✅
  2.2 frontend-design (conditional) ✅
  2.3 writing-plans (approved) ✅
  2.4 claude-md-improver ✅
Plan file: [artifacts.planFile]
Proceeding to Phase 3 · Implement...
════════════════════════════════════════════════════════════════
```

---

## Phase 3 · Implement

**Goal:** Iteratively implement the plan with continuous quality gates.
**Model:** No automated looping. Tasks advance only when the user explicitly confirms continuation.

---

### Step 3.0 · `superpowers:executing-plans` — Plan Execution Setup

**Tool:** Skill
**Goal:** Initialize the plan execution framework — read the plan file, enumerate all tasks, establish execution approach
**Emergency check:** If `artifacts.planFile` is null or the file does not exist:

```
❌ HARD STOP — Plan file not found
Complete Phase 2 before entering Phase 3.
```

**State update:** step → 3.sub; `totalTasks` → count of tasks

---

### Step 3.sub · `superpowers:subagent-driven-development` — Dispatch Framework

**Tool:** Skill
**Goal:** Establish the subagent dispatch framework for per-task execution
**What this establishes:**

- Each task is dispatched as a fresh subagent
- Each subagent receives: task spec, package boundary map, approved design doc, current git SHA
- The subagent follows the per-task inner cycle (Steps 3a–3f)
- The main session collects results, updates state, and handles user confirmation

**State update:** step → first task

---

### Per-Task Inner Cycle (Steps 3a–3f)

**Executed for each task in `artifacts.planFile`.**

At the start of every task, display:

```
════════════════════════════════════════════════════════════════
▶ PHASE 3 · IMPLEMENT — Task [N] of [total]
════════════════════════════════════════════════════════════════
Task:         [task title from plan]
Package:      [package this task belongs to]
Files:        [file paths from plan]
Exports:      [expected exports from plan]
Test file:    [test file path from plan]
Verify with:  [verification command from plan]
Dependencies: [prior tasks this task depends on]
════════════════════════════════════════════════════════════════
```

---

#### Step 3a · `context7` MCP — Task-specific docs

**Goal:** Pull current docs for the specific library or API this task touches
**Operations:** `resolve-library-id` + `query-docs` scoped to this task's library
**Rule:** Do not skip. Even if library was fetched in Step 1.5, re-fetch scoped to the specific method being implemented.

---

#### Step 3b · `superpowers:test-driven-development` — Red → Loop → Green

**Tool:** Skill
**Goal:** Strict TDD cycle — red before green, loop until green

**Enforced sequence:**

1. Write the failing test in the correct package test directory
2. Run the test — confirm RED. If it passes immediately, the test is wrong; rewrite it.
3. Write the minimal implementation that makes the test pass
4. Run the test:
   - If RED: adjust implementation and return to step 3 (loop)
   - If stuck 3+ times: trigger Step 3c before continuing
   - If GREEN: continue to step 5
5. Refactor with tests remaining green

**Hard rule:** Red before green is not optional. If the test passes immediately, rewrite the test.

---

#### Step 3c · `superpowers:systematic-debugging` (conditional — only if stuck)

**Trigger:** 3 or more consecutive fix attempts have failed for this task

**Smart pause:**

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Architecture Issue Detected
Reason: 3+ consecutive fix attempts failed
═══════════════════════════════════════════════════════════════
This is an architecture problem, not an implementation problem.
Invoking systematic-debugging. If debugging also fails to resolve
the issue, escalate: return to Phase 2 Step 2.1 (code-architect
redesign of the package boundary map).
═══════════════════════════════════════════════════════════════
```

**Escalation rule:** If systematic-debugging also fails, stop Phase 3. Return to Phase 2 Step 2.1. Do not attempt more fixes.

---

#### Step 3d · `code-simplifier:code-simplifier`

**Tool:** Task (subagent_type: `code-simplifier:code-simplifier`)
**Trigger:** Only after tests are GREEN
**Goal:** Post-green cleanup — remove duplication, enforce single-responsibility
**Rule:** Simplification must not break tests. Run tests again after this step.

---

#### Step 3e · `superpowers:requesting-code-review`

**Tool:** Skill
**Goal:** Dispatch `feature-dev:code-reviewer` with the task spec and package boundary map
**Context provided:** Task spec, git SHA range, boundary map, expected exports
**Rule:** Critical issues must be resolved or explicitly accepted before proceeding to the next task.

---

#### Step 3f · `superpowers:receiving-code-review`

**Tool:** Skill
**Goal:** Evaluate review feedback technically — not performatively
**Evaluation criteria:**

- Does this suggestion violate YAGNI?
- Does it break declared package boundaries?
- Does it introduce unnecessary complexity?
- Is the suggestion technically correct given the current library version?

**Rule:** Never implement feedback blindly. Push back with reasoning if suggestions violate the above. Accept valid criticisms.

---

#### After each task: State update and user confirmation

Update state: mark task as completed, increment `currentTaskIndex`, record timestamp.

Display:

```
════════════════════════════════════════════════════════════════
✅ Task [N] of [total] complete — [task title]
════════════════════════════════════════════════════════════════
Tests:    PASS
Review:   resolved / accepted
Progress: [N] of [total] tasks complete
State saved.
════════════════════════════════════════════════════════════════
```

Ask: "Continue to Task [N+1] — [next task title], or stop here for this session?"

- Continue → begin next task inner cycle
- Stop → display session-end banner and exit:

```
════════════════════════════════════════════════════════════════
⏸ SESSION PAUSED
════════════════════════════════════════════════════════════════
Progress: [N] of [total] tasks complete
State saved to: .claude/dispatch-state.json
Resume by running: /colloquium:feature
════════════════════════════════════════════════════════════════
```

When ALL tasks complete:

```
════════════════════════════════════════════════════════════════
✅ PHASE 3 · IMPLEMENT COMPLETE
════════════════════════════════════════════════════════════════
All [total] tasks complete. State saved.
Proceeding to Phase 4 · Test...
════════════════════════════════════════════════════════════════
```

---

## Phase 4 · Test

**Goal:** Prove correctness with evidence before claiming the feature is done.
**Rule:** Both steps must pass. No completion claim without explicit evidence.

---

### Step 4.1 · `superpowers:dispatching-parallel-agents` — 2 branches

**Tool:** Skill
**Goal:** Run two independent validation branches in parallel; collect all results before proceeding

```
Branch A — Local quality gates:
  pnpm turbo test
  pnpm turbo typecheck
  pnpm turbo build
  pnpm turbo lint
  (All must exit 0)

Branch B — E2E (local dev server):
  Start local dev server (pnpm --filter [app] dev or equivalent)
  playwright MCP: navigate to feature entry point
  playwright MCP: take accessibility snapshot
  playwright MCP: exercise critical user path end-to-end; assert expected outcomes
  puppeteer MCP: screenshot key states for human review
```

**Failure handling:**

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Validation Branch [A/B] Failed
═══════════════════════════════════════════════════════════════
Branch A quality failure → fix, re-run Branch A only
Branch B E2E failure     → debug the specific flow, re-run Branch B only
═══════════════════════════════════════════════════════════════
```

Re-run only the failing branch after fixing. Do not re-run passing branches.

**State update:** step → 4.2

---

### Step 4.2 · `superpowers:verification-before-completion`

**Tool:** Skill
**Goal:** Run fresh verification commands and present explicit evidence
**Commands run fresh (not from cache):**

```bash
pnpm turbo build
pnpm turbo typecheck
pnpm turbo test
pnpm turbo lint
```

**Rule:** All commands must exit 0. Any failure stops progression. Evidence must be shown explicitly.

**State update:** workflow complete

**Workflow complete banner:**

```
════════════════════════════════════════════════════════════════
🎉 COLLOQUIUM DISPATCH — WORKFLOW COMPLETE
════════════════════════════════════════════════════════════════
Feature:          [feature from state]
Phases completed: 4 phases

All local quality gates: PASS
E2E tests: PASS

State file preserved at .claude/dispatch-state.json
Human handles merge. To start a new feature: /colloquium:feature "description"
════════════════════════════════════════════════════════════════
```

---

## Phase Transition Gates

| Transition        | Gate condition                                                        |
| ----------------- | --------------------------------------------------------------------- |
| Phase 1 → Phase 2 | `superpowers:brainstorming` completes with explicit design approval   |
| Phase 2 → Phase 3 | Package boundary map approved AND CLAUDE.md updated AND plan approved |
| Task N → Task N+1 | Tests GREEN + review resolved/accepted + user confirms continuation   |
| Phase 3 → Phase 4 | All plan tasks marked complete                                        |
| Phase 4 complete  | Branch A + Branch B pass + verification-before-completion cleared     |

---

## Emergency Exits

| Situation                                   | Action                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| 3+ failed fixes in a row                    | Stop Phase 3. Return to Phase 2 Step 2.1. Redesign package boundaries.   |
| Review suggests bad architectural direction | `receiving-code-review` — push back with technical rigor. Never blindly. |
| Test passes immediately on first write      | Test is wrong. Red must come before green. Rewrite it.                   |
| State file has version < 2                  | Discard old state. Start fresh with 4-phase workflow.                    |
| Plan file missing at Phase 3 entry          | Hard stop: "Plan file not found — complete Phase 2 first."               |

---

## State File Schema (v2)

`.claude/dispatch-state.json` — written after every step, gitignored.

```json
{
  "version": 2,
  "feature": "2-3 word feature name",
  "description": "full feature description",
  "phase": 3,
  "step": "3b",
  "currentTaskIndex": 2,
  "totalTasks": 5,
  "completedSteps": [
    { "phase": 1, "step": "1.1", "name": "using-superpowers", "ts": "2026-02-23T10:30:00Z" },
    { "phase": 1, "step": "1.2", "name": "automation-recommender", "ts": "2026-02-23T10:33:00Z" },
    { "phase": 1, "step": "1.3", "name": "code-explorer", "ts": "2026-02-23T10:41:00Z" },
    { "phase": 1, "step": "1.4", "name": "greptile-search", "ts": "2026-02-23T10:44:00Z" },
    { "phase": 1, "step": "1.5", "name": "context7-docs", "ts": "2026-02-23T10:47:00Z" },
    { "phase": 1, "step": "1.6", "name": "brainstorming-approved", "ts": "2026-02-23T11:02:00Z" },
    { "phase": 2, "step": "2.1", "name": "code-architect", "ts": "2026-02-23T11:15:00Z" },
    { "phase": 2, "step": "2.2", "name": "frontend-design-skipped", "ts": "2026-02-23T11:15:00Z" },
    { "phase": 2, "step": "2.3", "name": "writing-plans-approved", "ts": "2026-02-23T11:35:00Z" },
    { "phase": 2, "step": "2.4", "name": "claude-md-improver", "ts": "2026-02-23T11:40:00Z" },
    { "phase": 3, "step": "3.0", "name": "executing-plans", "ts": "2026-02-23T11:42:00Z" },
    {
      "phase": 3,
      "step": "3.sub",
      "name": "subagent-driven-development",
      "ts": "2026-02-23T11:43:00Z"
    },
    {
      "phase": 3,
      "step": "task-1",
      "name": "Zod schemas in packages/types",
      "ts": "2026-02-23T12:00:00Z"
    }
  ],
  "artifacts": {
    "designDoc": "docs/plans/2026-02-23-feature-design.md",
    "boundaryMap": "inline — recorded in session context at step 2.1",
    "planFile": "docs/plans/2026-02-23-feature-impl.md"
  },
  "lastUpdated": "2026-02-23T12:00:00Z"
}
```

---

## Capability Inventory

### Skills (via `Skill` tool)

| Skill                                             | Phase | Step                       |
| ------------------------------------------------- | ----- | -------------------------- |
| `superpowers:using-superpowers`                   | 1     | 1.1                        |
| `claude-code-setup:claude-automation-recommender` | 1     | 1.2                        |
| `superpowers:brainstorming`                       | 1     | 1.6 ← HARD GATE            |
| `frontend-design:frontend-design`                 | 2     | 2.2 (conditional)          |
| `superpowers:writing-plans`                       | 2     | 2.3 ← HARD GATE            |
| `claude-md-management:claude-md-improver`         | 2     | 2.4                        |
| `superpowers:executing-plans`                     | 3     | 3.0 — plan execution setup |
| `superpowers:subagent-driven-development`         | 3     | 3.sub — per-task dispatch  |
| `superpowers:test-driven-development`             | 3     | 3b (per task)              |
| `superpowers:systematic-debugging`                | 3     | 3c (per task, if stuck)    |
| `superpowers:requesting-code-review`              | 3     | 3e (per task)              |
| `superpowers:receiving-code-review`               | 3     | 3f (per task)              |
| `superpowers:verification-before-completion`      | 4     | 4.2                        |
| `superpowers:dispatching-parallel-agents`         | 4     | 4.1                        |

### MCP Servers

| MCP          | Phase | Step               |
| ------------ | ----- | ------------------ |
| `greptile`   | 1     | 1.4                |
| `context7`   | 1, 3  | 1.5, 3a (per task) |
| `playwright` | 4     | 4.1 (Branch B)     |
| `puppeteer`  | 4     | 4.1 (Branch B)     |

### Specialized Agents (via `Task` tool)

| Agent                             | Phase | Step                                       |
| --------------------------------- | ----- | ------------------------------------------ |
| `feature-dev:code-explorer`       | 1     | 1.3                                        |
| `feature-dev:code-architect`      | 2     | 2.1                                        |
| `feature-dev:code-reviewer`       | 3     | 3e (dispatched via requesting-code-review) |
| `code-simplifier:code-simplifier` | 3     | 3d (per task, post-green)                  |
