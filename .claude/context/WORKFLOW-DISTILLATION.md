# Colloquium Workflow Distillation

**Status:** Canonical reference — supersedes `WORKFLOW.md` for all behavioral questions
**Date:** 2026-02-21
**Relationship to other docs:**

| Document                                                      | Role                       | Status                                                                          |
| ------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `docs/plans/2026-02-21-maximum-skill-workflow-design.md`      | Original architecture spec | Source of truth for capability inventory and phase structure                    |
| `docs/plans/2026-02-21-colloquium-feature-dispatch-design.md` | Command design spec        | Source of truth for state management, smart pause format, v1 constraints        |
| `docs/WORKFLOW.md`                                            | Quick-start checklist      | Human-readable summary; does NOT reflect v1 vs v2 state                         |
| `.claude/commands/colloquium/feature.md`                      | Executable command         | Implements v1 of this distillation; missing 4 tools (see §Capability Inventory) |
| **This document**                                             | **Distillation**           | **Single ground truth — all future changes happen here first**                  |

---

## Design Principles

1. **No automated looping.** Phase 4 does not use `/ralph-loop`. Every task advances only when the user explicitly confirms continuation. This makes the workflow maximally interruptible and resumable.

2. **Extreme resumability.** State is written to `.claude/dispatch-state.json` after every single step — not just after phases. A session can end at any point; the next invocation of `/colloquium:feature` resumes from the exact step.

3. **Maximum verbosity.** Every step announces itself with a full banner before starting and a completion confirmation after. Smart pauses are labeled with their specific reason. The developer always knows where in the workflow they are.

4. **Maximum skill utilization.** Every available skill, MCP, agent, and command is used at the moment it provides the highest value. No capability is skipped unless it is genuinely conditional (e.g., `vercel:setup` only on first deployment, `frontend-design` only when UI is involved).

5. **Architecture before implementation.** The package boundary map from Phase 3 is the binding constraint for all Phase 4 tasks. No file may be created in Phase 4 that was not declared in the boundary map.

---

## Discrepancies Resolved by This Document

| Issue                                                                                    | Resolution                                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Ralph-loop completion promise: `ALL TASKS COMPLETE` (design doc) vs `DONE` (WORKFLOW.md) | Moot — ralph-loop is deferred to v2. For v2, use `ALL TASKS COMPLETE`.                 |
| 4 tools missing from WORKFLOW.md and feature.md                                          | Restored to their correct phase positions in this document                             |
| `packages/ui` dependency rule softened in CLAUDE.md                                      | Strict rule restored: packages/ui imports ONLY from packages/types within the monorepo |
| Baseline tests gate for Phase 2→3                                                        | Explicitly required in Step 2.1                                                        |
| `superpowers:code-reviewer` (single agent, Phase 5) absent from all downstream docs      | Restored as Step 5.2, distinct from the `/code-review` slash command                   |

---

## Capability Inventory — Complete and Corrected

All 33 capabilities from the original design doc, with their correct phase assignments.

### Skills (via `Skill` tool)

| Skill                                             | Phase        | Step                       |
| ------------------------------------------------- | ------------ | -------------------------- |
| `superpowers:using-superpowers`                   | 1            | 1.1                        |
| `claude-code-setup:claude-automation-recommender` | 1            | 1.2                        |
| `superpowers:brainstorming`                       | 1            | 1.6 ← HARD GATE            |
| `superpowers:using-git-worktrees`                 | 2            | 2.1                        |
| `turborepo:turborepo`                             | 2            | 2.2                        |
| `vercel:setup`                                    | 2            | 2.3 (conditional)          |
| `frontend-design:frontend-design`                 | 3            | 3.2 (conditional)          |
| `superpowers:writing-plans`                       | 3            | 3.3 ← HARD GATE            |
| `claude-md-management:claude-md-improver`         | 3, Post-ship | 3.4, 7.1                   |
| `superpowers:executing-plans`                     | 4            | 4.0 — plan execution setup |
| `superpowers:subagent-driven-development`         | 4            | 4.sub — per-task dispatch  |
| `superpowers:test-driven-development`             | 4            | 4b (per task)              |
| `superpowers:systematic-debugging`                | 4            | 4c (per task, if stuck)    |
| `superpowers:requesting-code-review`              | 4            | 4e (per task)              |
| `superpowers:receiving-code-review`               | 4            | 4f (per task)              |
| `superpowers:verification-before-completion`      | 5            | 5.3                        |
| `superpowers:finishing-a-development-branch`      | 6            | 6.5                        |
| `superpowers:writing-skills`                      | Post-ship    | 7.2 (conditional)          |
| `vercel:deploy`                                   | 6            | 6.1                        |
| `vercel:logs`                                     | 6            | 6.2                        |

### MCP Servers (used directly as tools)

| MCP          | Phase | Step                |
| ------------ | ----- | ------------------- |
| `greptile`   | 1, 5  | 1.4, 5.1 (Branch C) |
| `context7`   | 1, 4  | 1.5, 4a (per task)  |
| `playwright` | 5, 6  | 5.1 (Branch B), 6.3 |
| `puppeteer`  | 5, 6  | 5.1 (Branch B), 6.3 |
| `github`     | 6     | 6.4                 |

### LSP Integrations (passive, always active)

| LSP              | Role                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `typescript-lsp` | Real-time type diagnostics; catches cross-package import leaks passively during every edit |
| `pyright-lsp`    | Active when Python interop is involved                                                     |

### Slash Commands

| Command                                    | Phase     | Step                |
| ------------------------------------------ | --------- | ------------------- |
| `/code-review` (`code-review:code-review`) | 5         | 5.4                 |
| `/cancel-ralph`                            | N/A in v1 | Emergency exit only |

### Specialized Agents (via `Task` tool)

| Agent                                 | Phase | Step                                           |
| ------------------------------------- | ----- | ---------------------------------------------- |
| `feature-dev:code-explorer`           | 1     | 1.3                                            |
| `feature-dev:code-architect`          | 3     | 3.1                                            |
| `feature-dev:code-reviewer`           | 4     | 4e (dispatched via requesting-code-review)     |
| `code-simplifier:code-simplifier`     | 4     | 4d (per task, post-green)                      |
| `agent-sdk-dev:agent-sdk-verifier-ts` | 4     | 4g (per task, conditional — SDK features only) |
| `superpowers:code-reviewer`           | 5     | 5.2 (full-diff focused review)                 |

---

## Phase Diagram

```
Phase 0 · STATE MANAGEMENT
    → check for existing session, resume or start fresh

Phase 1 · DISCOVERY             [6 steps]
    → understand codebase, find reusable code, define feature design
    HARD GATE: brainstorming approval required

Phase 2 · ISOLATION             [3 steps]
    → safe worktree, build pipeline, deployment link
    GATE: worktree created + baseline tests pass

Phase 3 · DESIGN                [4 steps]
    → package boundary map, UI design, implementation plan, CLAUDE.md update
    HARD GATE: plan approval required

Phase 4 · IMPLEMENTATION        [per-task, manual progression]
    → executing-plans setup → subagent-driven-development framework
    → per task: context7 → TDD → debug → simplify → request-review → receive-review → (sdk-verify)
    CONFIRMATION: user confirms each task before next begins

Phase 5 · VALIDATION            [4 steps]
    → 3 parallel branches: types+build | E2E | boundary audit
    → focused code review (superpowers:code-reviewer)
    → verification gate
    → automated PR review (/code-review)

Phase 6 · SHIP                  [5 steps]
    → deploy preview → log check → smoke test → open PR → close branch

Post-ship · MAINTENANCE
    → CLAUDE.md update, write new skills if gaps found
```

---

## Phase 0 · State Management

**Runs on every invocation of `/colloquium:feature`.**

### Step 0.1 — Check for existing state

```bash
cat .claude/dispatch-state.json 2>/dev/null || echo "NO_STATE_FILE"
```

### Step 0.2 — If state file exists: display resume banner and ask

```
════════════════════════════════════════════════════════════════
🔄 COLLOQUIUM DISPATCH — Resume Detected
════════════════════════════════════════════════════════════════
Feature:   [feature field from state]
Phase:     [phase] · [phase name]
Step:      [step]  · [step name]
Last seen: [lastUpdated field from state]
Branch:    [branch field, or "not set yet"]
Completed: [count of completedSteps] steps done
════════════════════════════════════════════════════════════════
```

Ask: "Resume from Phase [N] · Step [N] · [name], or start fresh?"

- If Resume: jump to the recorded phase and step
- If Start fresh: delete state file and proceed as if no state exists

### Step 0.3 — If no state file: capture feature description

- If argument provided to `/colloquium:feature`: use as description
- If no argument: display prompt box and wait for user input

### Step 0.4 — Create initial state file

Write `.claude/dispatch-state.json`:

```json
{
  "version": 1,
  "feature": "[derived 2-3 word name]",
  "description": "[full description]",
  "phase": 1,
  "step": "1.1",
  "currentTaskIndex": null,
  "totalTasks": null,
  "branch": null,
  "worktreeDir": null,
  "completedSteps": [],
  "artifacts": {
    "designDoc": null,
    "boundaryMap": null,
    "planFile": null,
    "vercelProject": null,
    "deployUrl": null,
    "prUrl": null
  },
  "lastUpdated": "[ISO timestamp]"
}
```

State is updated (phase, step, completedSteps, lastUpdated) after every step throughout the workflow.

---

## Phase 1 · Discovery

**Goal:** Understand the codebase deeply and define the feature before designing anything.
**Hard gate:** No code, no scaffolding, no implementation action until Step 1.6 completes with explicit design approval.

---

### Step 1.1 · `superpowers:using-superpowers`

**Tool:** Skill
**Goal:** Check for applicable skills at the start of this session — non-negotiable, runs before any other action
**Inputs:** None
**Outputs:** Active skill list confirmed
**Failure:** Cannot fail; if skill unavailable, proceed and note the gap
**State update:** step → 1.2

---

### Step 1.2 · `claude-code-setup:claude-automation-recommender`

**Tool:** Skill
**Goal:** Verify the Claude Code setup (hooks, MCPs, plugins) is optimal for this monorepo; identify any automation gaps
**Inputs:** Current `.claude/settings.json`
**Outputs:** Recommendation report — gaps noted for Post-ship Step 7.2 if any skills are missing
**Failure:** Cannot fail; if tool unavailable, proceed
**State update:** step → 1.3

---

### Step 1.3 · `feature-dev:code-explorer` (subagent)

**Tool:** Task (subagent_type: `feature-dev:code-explorer`)
**Goal:** Deep-trace the existing codebase — produce a structured dependency map
**Prompt to subagent:**

> "Explore the codebase to understand the current package structure, all exports from packages/, existing hooks, Zod schemas, TypeScript types, shared utilities, and anything relevant to: [description from state]. Produce a structured dependency map showing: which packages exist, what they export, which packages depend on which, and which existing code could be reused for this feature."

**Outputs:** Structured dependency map (in-session artifact referenced by Phase 3 code-architect)
**Failure:** If subagent fails, invoke directly using Glob + Grep; do not skip
**State update:** step → 1.4

---

### Step 1.4 · `greptile` MCP

**Tool:** MCP direct
**Goal:** Search the codebase for existing utilities, patterns, and abstractions that overlap with the feature domain; find what already exists before designing
**Operations:**

- `search_custom_context` — query for patterns related to the feature description
- `list_merge_requests` — review recent PRs to understand what patterns were recently established

**Outputs:** List of reusable code found; any of this becomes first-class citizen in Phase 3 boundary map
**Failure:** If greptile unavailable, use Grep + Glob to approximate; note the gap
**State update:** step → 1.5

---

### Step 1.5 · `context7` MCP

**Tool:** MCP direct
**Goal:** Pull current, version-accurate documentation for every library the feature will touch; prevent implementing against outdated API shapes
**Operations:**

- `resolve-library-id` for each relevant library (Hono, Zod, React, Vite, etc.)
- `query-docs` scoped to the specific methods or APIs the feature will use

**Outputs:** Current API documentation loaded into context for Phases 3 and 4
**Failure:** If context7 unavailable, note which library docs could not be fetched; proceed
**State update:** step → 1.6

---

### Step 1.6 · `superpowers:brainstorming` ← HARD GATE

**Tool:** Skill
**Goal:** Collaborative design exploration — clarifying questions one at a time, 2–3 approaches with trade-offs, design approval before proceeding
**Process enforced by skill:** Questions → Approaches → Design sections → Explicit approval
**Hard gate rule:** Do NOT proceed to Phase 2 until the user explicitly approves the design. If the user requests revisions, re-invoke this step. Loop here until approval is given.
**Outputs:**

- Approved feature design (written to `docs/plans/[date]-[feature]-design.md`)
- Design doc path stored in state `artifacts.designDoc`

**State update:** step → 2.1; `artifacts.designDoc` → path of design document

**Phase 1 complete banner:**

```
════════════════════════════════════════════════════════════════
✅ PHASE 1 · DISCOVERY COMPLETE
════════════════════════════════════════════════════════════════
  1.1 using-superpowers ✅
  1.2 claude-automation-recommender ✅
  1.3 code-explorer ✅
  1.4 greptile-search ✅
  1.5 context7-docs ✅
  1.6 brainstorming-approved ✅
Proceeding to Phase 2 · Isolation...
════════════════════════════════════════════════════════════════
```

---

## Phase 2 · Isolation

**Goal:** Create a safe, reproducible working environment isolated from main.
**Exit gate:** Worktree exists AND baseline tests pass. Do not proceed to Phase 3 if baseline tests fail — fix them first.

---

### Step 2.1 · `superpowers:using-git-worktrees`

**Tool:** Skill
**Goal:** Create an isolated git worktree for the feature branch; verify the worktree directory is `.gitignore`'d; run `pnpm install` and baseline tests to confirm a clean starting state
**Outputs:**

- Worktree created at `../[feature-slug]-worktree/` (or appropriate path)
- Feature branch created
- `pnpm turbo test` passes in the fresh worktree (baseline gate)

**Hard exit condition:** If baseline tests fail, stop. Fix the failing tests on `main` before creating the feature branch. Do not carry broken tests into the feature worktree.

**State update:** step → 2.2; `branch` → branch name; `worktreeDir` → worktree path

---

### Step 2.2 · `turborepo:turborepo`

**Tool:** Skill
**Goal:** Configure Turborepo pipeline tasks for any new packages the feature will introduce; ensure `build`, `test`, `typecheck`, and `lint` tasks will be wired in `turbo.json` for new packages from day one
**When to invoke:** Always, but only make changes to `turbo.json` if the Phase 3 boundary map (not yet produced) will introduce new packages. At this step, prepare the pipeline configuration based on the design doc from Step 1.6.
**Outputs:** `turbo.json` updated if new packages anticipated; pipeline confirmed for existing packages
**State update:** step → 2.3

---

### Step 2.3 · `vercel:setup` (conditional)

**Smart pause trigger:** "First-time Vercel deployment — irreversible if done incorrectly"

Ask: "Is this the first time deploying this project to Vercel?"

- Yes → invoke `vercel:setup`; store project reference in `artifacts.vercelProject`
- No → skip; project already linked

**State update:** step → 3.1

**Phase 2 complete banner:**

```
════════════════════════════════════════════════════════════════
✅ PHASE 2 · ISOLATION COMPLETE
════════════════════════════════════════════════════════════════
  2.1 using-git-worktrees ✅  (baseline tests: PASS)
  2.2 turborepo ✅
  2.3 vercel:setup (conditional) ✅
Branch: [branch from state]
Proceeding to Phase 3 · Design...
════════════════════════════════════════════════════════════════
```

---

## Phase 3 · Design

**Goal:** Produce a concrete architecture with explicit package ownership before any implementation starts.
**Hard gate:** No implementation task may be assigned to a file that was not declared in the package boundary map produced at Step 3.1.

---

### Step 3.1 · `feature-dev:code-architect` (subagent)

**Tool:** Task (subagent_type: `feature-dev:code-architect`)
**Goal:** Produce the package boundary map — which package owns each piece of new logic, what gets exported, how packages depend on each other, and what the TypeScript module graph looks like
**Prompt to subagent:**

> "Design the package boundary map for this feature: [description]. Reference the approved design doc at [artifacts.designDoc]. Reference the dependency map produced by code-explorer in Phase 1. Produce: (1) a table showing which package/app owns each new piece of logic; (2) what each package exports; (3) the TypeScript module graph between packages; (4) any new packages that need to be created. Enforce these rules: packages/utils has zero framework deps, apps/ do not import from each other, shared logic goes to packages/ not apps/."

**Output artifact:**

```
packages/types     → new Zod schemas + inferred TS types
packages/utils     → shared helper functions (zero framework deps)
packages/ui        → React components (imports ONLY from packages/types within monorepo)
apps/api           → Hono route handlers (imports from packages/types)
apps/web           → React pages (imports from packages/ui, packages/types)
```

**State update:** step → 3.2; `artifacts.boundaryMap` → inline reference to the map

---

### Step 3.2 · `frontend-design:frontend-design` (conditional)

**Smart pause trigger:** "Does this feature include UI components (apps/web or packages/ui)?"

Ask: "Does this feature touch apps/web or packages/ui?"

- Yes → invoke `frontend-design:frontend-design`
  - Constraint passed to skill: components must reference `packages/ui` and `packages/types`, never app-internal code
  - Produces production-grade component designs with precise prop types
- No → skip

**State update:** step → 3.3

---

### Step 3.3 · `superpowers:writing-plans` ← HARD GATE

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

**Hard gate rule:** Display the plan to the user. Ask for approval before proceeding to Phase 4. If revisions are needed, re-invoke this step with the revision guidance. Loop here until the plan is approved.

**State update after approval:** step → 3.4; `artifacts.planFile` → plan file path

---

### Step 3.4 · `claude-md-management:claude-md-improver`

**Tool:** Skill
**Goal:** Update `CLAUDE.md` (root + affected packages) with the architectural patterns decided in this phase **before** implementation starts, so all Phase 4 subagents operate with the correct constraints
**What to record:**

- Package boundary rules reinforced by this feature's design
- Naming conventions established by the boundary map
- Any new shared abstractions identified
- New packages and their ownership rules

**State update:** step → 4.0

**Phase 3 complete banner:**

```
════════════════════════════════════════════════════════════════
✅ PHASE 3 · DESIGN COMPLETE
════════════════════════════════════════════════════════════════
  3.1 code-architect (boundary map) ✅
  3.2 frontend-design (conditional) ✅
  3.3 writing-plans (approved) ✅
  3.4 claude-md-improver ✅
Plan file: [artifacts.planFile]
Proceeding to Phase 4 · Implementation...
════════════════════════════════════════════════════════════════
```

---

## Phase 4 · Implementation

**Goal:** Iteratively implement the plan with continuous quality gates.
**Model:** No automated looping. Tasks advance only when the user explicitly confirms continuation. Each task is dispatched to a fresh subagent that follows the per-task inner cycle.

---

### Step 4.0 · `superpowers:executing-plans` — Plan Execution Setup

**Tool:** Skill
**Goal:** Initialize the plan execution framework — read the plan file, enumerate all tasks, establish the execution approach, set up checkpoints
**Inputs:** `artifacts.planFile` from state
**Outputs:** Task list enumerated; execution approach confirmed; checkpoint protocol established
**Why this runs first:** Ensures the plan is loaded and parsed correctly before any task dispatch. Establishes the review checkpoint cadence for the session.
**State update:** step → 4.sub

---

### Step 4.sub · `superpowers:subagent-driven-development` — Subagent Dispatch Framework

**Tool:** Skill
**Goal:** Establish the subagent dispatch framework for per-task execution — each task runs in a fresh subagent with full context injection
**What this step establishes:**

- Each task will be dispatched as a fresh subagent
- The fresh subagent receives: task spec, package boundary map, approved design doc, current git SHA
- The subagent follows the per-task inner cycle (Steps 4a–4g)
- The main session collects results, updates state, and handles user confirmation

**State update:** step → first task (phase 4, task 1 of N)

---

### Per-Task Inner Cycle (Steps 4a–4g)

**Executed for each task in `artifacts.planFile` by a fresh subagent.**

At the start of every task, display:

```
════════════════════════════════════════════════════════════════
▶ PHASE 4 · IMPLEMENTATION — Task [N] of [total]
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

#### Step 4a · `context7` MCP — Task-specific docs

**Goal:** Pull current documentation for the specific library or API this task touches, scoped to the exact methods or types being implemented
**Operations:** `resolve-library-id` + `query-docs` scoped to this task's library
**Rule:** Do not skip. Even if library was fetched in Step 1.5, re-fetch scoped to the specific method being implemented.

---

#### Step 4b · `superpowers:test-driven-development`

**Tool:** Skill
**Goal:** Strict Red → Green → Refactor cycle
**Enforced sequence:**

1. Write the failing test in the correct package test directory
2. Run the test — confirm it is RED (fails). If it passes immediately, the test is wrong; rewrite it.
3. Write the minimal implementation that makes the test pass — no more than the test requires
4. `typescript-lsp` passively confirms no cross-package import leaks during every edit
5. Run the test — confirm it is GREEN
6. Refactor with tests remaining green

**Hard rule:** Green must be earned. Red before green is not optional.

---

#### Step 4c · `superpowers:systematic-debugging` (conditional — only if stuck)

**Trigger:** 3 or more consecutive fix attempts have failed for this task

**Smart pause trigger:**

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Architecture Issue Detected
Reason: 3+ consecutive fix attempts failed
═══════════════════════════════════════════════════════════════
This is an architecture problem, not an implementation problem.
Invoking systematic-debugging. If debugging also fails to resolve
the issue, escalate: return to Phase 3 Step 3.1 (code-architect
redesign of the package boundary map).
═══════════════════════════════════════════════════════════════
```

**Tool:** Skill — 4-phase root cause investigation before any fix attempt
**Escalation rule:** If `systematic-debugging` also fails, stop Phase 4. Return to Phase 3 Step 3.1. Redesign the package boundaries. Do not attempt more fixes.

---

#### Step 4d · `code-simplifier:code-simplifier`

**Tool:** Task (subagent_type: `code-simplifier:code-simplifier`)
**Trigger:** Only after tests are GREEN
**Goal:** Post-green cleanup — remove duplication, enforce single-responsibility, ensure the new code fits naturally into its declared package without creating implicit coupling
**Rule:** Simplification must not break tests. Run tests again after this step.

---

#### Step 4e · `superpowers:requesting-code-review`

**Tool:** Skill
**Goal:** Dispatch `feature-dev:code-reviewer` with the task spec, SHA range, and package boundary map
**Context provided to review:**

- Task title and spec from the plan
- Git SHA range since the task started
- Package boundary map from `artifacts.boundaryMap`
- Expected exports from the plan

**Rule:** Critical issues from code review must be resolved or explicitly accepted before proceeding to the next task.

---

#### Step 4f · `superpowers:receiving-code-review`

**Tool:** Skill
**Goal:** Evaluate review feedback technically — not performatively
**Required evaluation criteria:**

- Does this suggestion violate YAGNI?
- Does it break the declared package boundaries?
- Does it introduce unnecessary complexity?
- Is the suggestion technically correct given the current library version (reference context7 docs from Step 4a)?

**Rule:** Never implement feedback blindly. Push back with reasoning if suggestions violate the above criteria. Accept valid criticisms.

---

#### Step 4g · `agent-sdk-dev:agent-sdk-verifier-ts` (conditional — SDK features only)

**Trigger:** The task being implemented is part of a Claude Agent SDK application

**Smart pause trigger:** "This task builds a Claude Agent SDK component — invoking SDK verifier"

**Tool:** Task (subagent_type: `agent-sdk-dev:agent-sdk-verifier-ts`)
**Goal:** Verify SDK configuration follows official documentation; catch misconfigured agents, incorrect tool schemas, or missing SDK patterns before they propagate
**Skip condition:** If the task does not involve Agent SDK code, skip this step entirely.

---

#### After each task: State update and user confirmation

Update state file: mark task as completed, update step index, record timestamp.

Display:

```
════════════════════════════════════════════════════════════════
✅ Task [N] of [total] complete — [task title]
════════════════════════════════════════════════════════════════
Tests: PASS
Review: resolved / accepted
Progress: [N] of [total] tasks complete
State saved.
════════════════════════════════════════════════════════════════
```

Ask: "Continue to Task [N+1] — [next task title], or stop here for this session?"

- Continue → begin next task inner cycle
- Stop → display session-end banner and exit

Session-end banner:

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
✅ PHASE 4 · IMPLEMENTATION COMPLETE
════════════════════════════════════════════════════════════════
All [total] tasks complete. State saved.
Proceeding to Phase 5 · Validation...
════════════════════════════════════════════════════════════════
```

---

## Phase 5 · Validation

**Goal:** Prove correctness with evidence before making any completion claim.
**Rule:** All 4 steps must pass. No completion claim without explicit evidence from all steps.

---

### Step 5.1 · `superpowers:dispatching-parallel-agents` — 3 simultaneous branches

**Tool:** Skill
**Goal:** Run three independent validation branches in parallel; collect all results before proceeding

```
Branch A — Type + Build
  pnpm turbo build
  pnpm turbo typecheck
  typescript-lsp full diagnostics across all packages

Branch B — E2E Testing
  playwright MCP:
    → navigate to the feature's entry point
    → take accessibility snapshot to verify UI rendered correctly
    → interact with critical user paths end-to-end
    → assert expected outcomes
  puppeteer MCP:
    → take visual screenshots at key states for human review

Branch C — Boundary Audit
  greptile MCP:
    → verify no app-specific logic leaked into packages/
    → verify no utility duplicated across apps/
    → verify packages/ui imports only from packages/types (within monorepo)
```

**Failure handling — Smart pause per branch:**

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Validation Branch [A/B/C] Failed
═══════════════════════════════════════════════════════════════
Branch A type/build failure → fix type errors or build errors, re-run Branch A only
Branch B E2E failure        → debug the specific flow, re-run Branch B only
Branch C boundary violation → return to Phase 3 Step 3.1 (code-architect)
═══════════════════════════════════════════════════════════════
```

Re-run only the failing branch after fixing. Do not re-run passing branches.

**State update:** step → 5.2

---

### Step 5.2 · `superpowers:code-reviewer` (focused full-diff review)

**Tool:** Task (subagent_type: `superpowers:code-reviewer`)
**Goal:** A focused, single-agent code review of the complete feature diff — distinct from the automated multi-agent `/code-review`
**Context provided:**

- Full git diff from the start of the feature branch to HEAD
- The package boundary map from `artifacts.boundaryMap`
- The implementation plan from `artifacts.planFile`
- CLAUDE.md (root + affected packages)

**What this review checks:**

- Adherence to CLAUDE.md rules
- Correctness of the full feature across all tasks together (not just per-task)
- Any cross-task coupling that individual per-task reviews may have missed
- Completeness against the approved design doc

**Rule:** Critical and high-confidence issues block progression to Step 5.3. Medium issues are noted but do not block. Low-confidence issues are recorded for Post-ship consideration.

**State update:** step → 5.3

---

### Step 5.3 · `superpowers:verification-before-completion`

**Tool:** Skill
**Goal:** Run fresh verification commands, read their full output, present explicit evidence — no completion claim without this evidence
**Commands run fresh (not from cache):**

```bash
pnpm turbo build
pnpm turbo typecheck
pnpm turbo test
pnpm turbo lint
```

**Rule:** All commands must exit 0. Any failure stops progression. Evidence must be presented explicitly in the session output.

**State update:** step → 5.4

---

### Step 5.4 · `/code-review` (`code-review:code-review`)

**Tool:** Skill (invokes 5 parallel agents)
**Goal:** Automated multi-dimensional PR review
**What the 5 agents check:** CLAUDE.md compliance, bugs, git history, prior PR patterns, inline code comments
**Confidence threshold:** Issues below 80% confidence are filtered out
**Rule:** Only high-confidence findings (≥80%) block progression to Phase 6.

**State update:** step → 6.1

**Phase 5 complete banner:**

```
════════════════════════════════════════════════════════════════
✅ PHASE 5 · VALIDATION COMPLETE
════════════════════════════════════════════════════════════════
  5.1 parallel validation (all 3 branches) ✅
  5.2 superpowers:code-reviewer (full-diff) ✅
  5.3 verification-before-completion ✅
  5.4 /code-review (automated) ✅
Proceeding to Phase 6 · Ship...
════════════════════════════════════════════════════════════════
```

---

## Phase 6 · Ship

**Goal:** Deploy to preview, smoke test, open PR, decide on merge strategy.

---

### Step 6.1 · `vercel:deploy`

**Tool:** Skill
**Goal:** Deploy the feature branch to a Vercel preview URL
**Output:** Preview URL captured into `artifacts.deployUrl`
**State update:** step → 6.2

---

### Step 6.2 · `vercel:logs`

**Tool:** Skill
**Goal:** Confirm no runtime errors in the preview deployment
**Rule:** A build that passes locally but fails at runtime is not complete.

**Failure smart pause:**

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Runtime Errors in Preview Deployment
Reason: A build passing locally but failing at runtime is
        not complete — must fix before proceeding to smoke test
═══════════════════════════════════════════════════════════════
```

**State update:** step → 6.3

---

### Step 6.3 · `playwright` + `puppeteer` MCPs — Smoke Test

**Tool:** MCP direct (both)
**Goal:** Smoke test the deployed preview URL against the live deployment
**Operations:**

- playwright MCP: navigate to the feature's entry point at `artifacts.deployUrl`
- playwright MCP: take accessibility snapshot to verify the UI rendered correctly
- playwright MCP: exercise the critical user path end-to-end against the live preview; assert expected outcomes
- puppeteer MCP: take a visual screenshot of the final state for human review

**Scope:** This is a smoke test, not a full E2E suite. Cover the primary happy path only.
**State update:** step → 6.4

---

### Step 6.4 · `github` MCP — Open PR

**Tool:** MCP / `gh pr create`
**Goal:** Open a pull request with all relevant context for reviewers
**PR body must include:**

- Link to Vercel preview (`artifacts.deployUrl`)
- Summary of package boundary decisions made in Phase 3
- Reference to the implementation plan (`artifacts.planFile`)
- greptile context attached for reviewers

**Output:** PR URL captured into `artifacts.prUrl`
**State update:** step → 6.5

---

### Step 6.5 · `superpowers:finishing-a-development-branch`

**Tool:** Skill
**Goal:** Present the 4 merge options; execute the chosen option; clean up the feature worktree created in Phase 2
**Options presented:** Merge locally / Create PR / Keep as-is / Discard
**Cleanup:** Remove the git worktree at `state.worktreeDir`

**State update:** step → 7.1

**Phase 6 complete banner:**

```
════════════════════════════════════════════════════════════════
✅ PHASE 6 · SHIP COMPLETE
════════════════════════════════════════════════════════════════
  6.1 vercel:deploy ✅
  6.2 vercel:logs ✅
  6.3 playwright + puppeteer smoke test ✅
  6.4 PR opened: [artifacts.prUrl] ✅
  6.5 finishing-a-development-branch ✅
Proceeding to Post-ship Maintenance...
════════════════════════════════════════════════════════════════
```

---

## Post-Ship · Maintenance

---

### Step 7.1 · `claude-md-management:claude-md-improver`

**Tool:** Skill
**Goal:** Update `CLAUDE.md` files (root + all packages touched in this feature) with:

- New shared abstractions added this session
- Package boundary rules reinforced or newly discovered
- Patterns that worked well and should be repeated
- Constraints that prevented bugs (record as rules, not stories)

**State update:** step → 7.2

---

### Step 7.2 · `superpowers:writing-skills` (conditional)

**Smart pause trigger:** "Did any phase of this workflow reveal a situation where no skill applied but one should have?"

Ask: "Were there any workflow gaps?"

- Yes → invoke `superpowers:writing-skills`
  - Apply TDD to writing the skill: create failing test scenarios first, then write minimal skill content
- No → skip

**State update:** workflow complete

**Workflow complete banner:**

```
════════════════════════════════════════════════════════════════
🎉 COLLOQUIUM DISPATCH — WORKFLOW COMPLETE
════════════════════════════════════════════════════════════════
Feature:          [feature from state]
Phases completed: 6 phases + post-ship maintenance
PR:               [artifacts.prUrl]
Deploy:           [artifacts.deployUrl]

State file preserved at .claude/dispatch-state.json
To start a new feature: /colloquium:feature "new description"
════════════════════════════════════════════════════════════════
```

---

## State File Schema (v1)

`.claude/dispatch-state.json` — written after every step, gitignored.

```json
{
  "version": 1,
  "feature": "2-3 word feature name",
  "description": "full feature description",
  "phase": 4,
  "step": "4c",
  "currentTaskIndex": 2,
  "totalTasks": 7,
  "branch": "feature/001-user-auth",
  "worktreeDir": "../colloquium-feat-user-auth",
  "completedSteps": [
    { "phase": 1, "step": "1.1", "name": "using-superpowers", "ts": "2026-02-21T10:30:00Z" },
    { "phase": 1, "step": "1.2", "name": "automation-recommender", "ts": "2026-02-21T10:33:00Z" },
    { "phase": 1, "step": "1.3", "name": "code-explorer", "ts": "2026-02-21T10:41:00Z" },
    { "phase": 1, "step": "1.4", "name": "greptile-search", "ts": "2026-02-21T10:44:00Z" },
    { "phase": 1, "step": "1.5", "name": "context7-docs", "ts": "2026-02-21T10:47:00Z" },
    { "phase": 1, "step": "1.6", "name": "brainstorming-approved", "ts": "2026-02-21T11:02:00Z" },
    { "phase": 2, "step": "2.1", "name": "git-worktrees", "ts": "2026-02-21T11:08:00Z" },
    { "phase": 2, "step": "2.2", "name": "turborepo", "ts": "2026-02-21T11:12:00Z" },
    { "phase": 2, "step": "2.3", "name": "vercel-setup-skipped", "ts": "2026-02-21T11:12:00Z" },
    { "phase": 3, "step": "3.1", "name": "code-architect", "ts": "2026-02-21T11:25:00Z" },
    { "phase": 3, "step": "3.2", "name": "frontend-design", "ts": "2026-02-21T11:40:00Z" },
    { "phase": 3, "step": "3.3", "name": "writing-plans-approved", "ts": "2026-02-21T12:05:00Z" },
    { "phase": 3, "step": "3.4", "name": "claude-md-improver", "ts": "2026-02-21T12:10:00Z" },
    { "phase": 4, "step": "4.0", "name": "executing-plans", "ts": "2026-02-21T12:12:00Z" },
    {
      "phase": 4,
      "step": "4.sub",
      "name": "subagent-driven-development",
      "ts": "2026-02-21T12:13:00Z"
    },
    {
      "phase": 4,
      "step": "task-1",
      "name": "Zod schemas in packages/types",
      "ts": "2026-02-21T12:35:00Z"
    },
    { "phase": 4, "step": "task-2", "name": "Hono route handler", "ts": "2026-02-21T13:00:00Z" }
  ],
  "artifacts": {
    "designDoc": "docs/plans/2026-02-21-user-auth-design.md",
    "boundaryMap": "inline — recorded in session context at step 3.1",
    "planFile": "docs/plans/2026-02-21-user-auth-impl.md",
    "vercelProject": "colloquium-preview",
    "deployUrl": null,
    "prUrl": null
  },
  "lastUpdated": "2026-02-21T13:00:00Z"
}
```

---

## Smart Pause Protocol

Every decision point that requires human judgment is announced with this exact format before asking:

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — [specific reason, one sentence]
═══════════════════════════════════════════════════════════════
Context: [Why this decision matters — what goes wrong if we choose incorrectly]
Current position: Phase [N] · Step [N.N] · [step name]
═══════════════════════════════════════════════════════════════
[AskUserQuestion call]
═══════════════════════════════════════════════════════════════
```

### When smart pauses trigger

| Situation                       | Step            | Type                    |
| ------------------------------- | --------------- | ----------------------- |
| Design approval required        | 1.6             | Hard gate               |
| Plan approval required          | 3.3             | Hard gate               |
| Vercel setup: first deployment? | 2.3             | Conditional             |
| UI components: frontend-design? | 3.2             | Conditional             |
| SDK task: agent-sdk-verifier?   | 4g              | Conditional             |
| 3+ failed fix attempts          | 4c              | Architecture escalation |
| Validation branch failed        | 5.1             | Failure diagnosis       |
| Runtime errors in preview       | 6.2             | Failure diagnosis       |
| Workflow gaps found?            | 7.2             | Conditional             |
| Continue to next task?          | After each task | Session management      |

---

## Phase Transition Gates

| Transition          | Gate condition                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1 → Phase 2   | `superpowers:brainstorming` completes with explicit design approval                                                                                    |
| Phase 2 → Phase 3   | Worktree created AND `pnpm turbo test` passes in the worktree                                                                                          |
| Phase 3 → Phase 4   | Package boundary map approved AND `CLAUDE.md` updated AND plan approved                                                                                |
| Task N → Task N+1   | Tests GREEN + review resolved/accepted + user confirms continuation                                                                                    |
| Phase 4 → Phase 5   | All plan tasks marked complete                                                                                                                         |
| Phase 5 → Phase 6   | All 3 validation branches pass + code-reviewer issues resolved + verification-before-completion cleared + /code-review high-confidence issues resolved |
| Phase 6 → Post-ship | Worktree cleaned up, branch merged or PR open                                                                                                          |

---

## Emergency Exits

| Situation                                            | Action                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 3+ failed fixes in a row                             | Stop Phase 4. Return to Phase 3 Step 3.1. Redesign package boundaries.                         |
| Review feedback suggests bad architectural direction | `superpowers:receiving-code-review` — push back with technical rigor. Never implement blindly. |
| Test passes immediately on first write               | Test is wrong — red must come before green. Rewrite the test.                                  |
| Validation branch C (boundary audit) fails           | Return to Phase 3 Step 3.1 — the boundary was violated, not just implemented incorrectly.      |
| State file exists but branch is gone                 | Smart pause: explain mismatch, ask whether to recover the branch or start fresh.               |
| Plan file missing at Phase 4 entry                   | Hard stop: "Plan file not found — complete Phase 3 first."                                     |

---

## Package Ownership Rules (Hard Rules — Not Guidelines)

These rules are enforced in Phase 3 by `code-architect` and in Phase 5 Branch C by `greptile`.

| Package             | Owns                                    | Hard constraint                                                                 |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/types`    | Zod schemas + inferred TypeScript types | No runtime logic. Only schemas, types, enums.                                   |
| `packages/utils`    | Pure utility functions                  | Zero runtime framework dependencies. No React, no Hono, no Zod.                 |
| `packages/ui`       | React components                        | Imports ONLY from `packages/types` within the monorepo. No `apps/` imports.     |
| `packages/config`   | Shared ESLint, Prettier configs         | No runtime code.                                                                |
| `packages/tsconfig` | Shared TypeScript base configs          | No runtime code.                                                                |
| `apps/api`          | Hono route handlers                     | Depends on `packages/types`. Does not import from `apps/web`.                   |
| `apps/web`          | React pages, app shell                  | Depends on `packages/ui` and `packages/types`. Does not import from `apps/api`. |

**Hard rules:**

- New shared logic goes to `packages/` first — never start in `apps/`
- `apps/` directories must NOT import from each other — ever
- `packages/utils` must have zero runtime framework dependencies — enforced by `pnpm turbo typecheck`
- Run `pnpm turbo typecheck` to catch cross-package import leaks at any time

---

## V2 Notes — Ralph-Loop Integration

When ralph-loop is integrated in v2, Phase 4 changes as follows:

**Replace Steps 4.0 + 4.sub + manual per-task loop with:**

```bash
/ralph-loop "implement per plan in docs/plans/[planFile]" \
  --completion-promise "ALL TASKS COMPLETE" \
  --max-iterations 20
```

The per-task inner cycle (Steps 4a–4g) becomes the ralph-loop body, executed automatically per iteration. The completion signal is `<promise>ALL TASKS COMPLETE</promise>` — not `DONE` (the string used in WORKFLOW.md is incorrect; the design doc value is authoritative).

Manual session resumption in v2 works via `/cancel-ralph` to stop the loop, followed by state file inspection to resume from the correct task.

**v2 pre-conditions before this change:**

- State file must track which task ralph-loop was executing when interrupted
- Smart pauses (conditional steps like 4g, 4c) must be handleable within the loop body
- Session resumption must be tested with a broken session before deploying to production workflow
