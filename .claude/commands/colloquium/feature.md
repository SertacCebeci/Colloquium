# Colloquium Feature Dispatch

Orchestrate the full Colloquium development workflow from a single command.
Invoke as: /colloquium:feature "description of what to build"
Or: /colloquium:feature (to resume an in-progress workflow)

**Canonical reference:** `.claude/context/WORKFLOW-DISTILLATION.md`
**Version:** v2 — 4-phase simple workflow (Discover → Plan → Implement → Test)

---

## ENFORCEMENT RULES (read before executing any step)

1. **No silent skipping.** Every step MUST either execute OR display an explicit skip notice:

```
⏭ Step [N.N] SKIPPED — [tool name]
Reason: [one-sentence justification]
State saved.
```

2. **State after every step.** The state file is updated after EVERY step — not after phases, not in batches.

3. **Banners are mandatory.** Every step displays its start banner before executing and its completion banner after.

4. **Hard gates block.** Steps marked HARD GATE loop until the gate condition is met.

5. **Conditional steps still announce.** Even when a conditional step is skipped, it must display the smart pause, ask the question, and record the decision.

6. **AI never touches git** (beyond reading the current branch). No branch creation, no push, no PR. Human controls all git operations.

---

## Phase 0: State Management (always runs first)

### Step 0.1 — Check for existing state

```bash
cat .claude/dispatch-state.json 2>/dev/null || echo "NO_STATE_FILE"
```

### Step 0.2 — If state file exists: check schema version

- If `version` field is missing or `< 2`:

  ```
  ⚠️  State file schema v1 detected — this is from the old 7-phase workflow.
  Discarding old state. Starting fresh with the 4-phase workflow.
  ```

  Delete `.claude/dispatch-state.json` and proceed to Step 0.3.

- If `version === 2`: display resume banner:

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

- If argument provided: use as description
- If no argument: display prompt box and wait for user input:

  ```
  ════════════════════════════════════════════════════════════════
  🚀 COLLOQUIUM DISPATCH — New Feature
  ════════════════════════════════════════════════════════════════

  Describe the feature you want to build.

  Examples:
    "Add JWT authentication with login and signup flows"
    "Build a real-time notification system using WebSockets"
    "Implement CSV export for the analytics dashboard"

  ════════════════════════════════════════════════════════════════
  ```

### Step 0.4 — Create initial state file (v2 schema)

Use Write tool to create `.claude/dispatch-state.json`:

```json
{
  "version": 2,
  "feature": "[derived 2-3 word name from description]",
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
  "lastUpdated": "[current ISO timestamp]"
}
```

### Step 0.5 — Display workflow start banner

```
════════════════════════════════════════════════════════════════
🚀 COLLOQUIUM DISPATCH — Starting Workflow
════════════════════════════════════════════════════════════════
Feature:     [feature name]
Description: [description]

Workflow: 4 phases · 14 fixed steps + per-task inner cycle
State file:  .claude/dispatch-state.json (updated after EVERY step)

Starting Phase 1 · Discover...
════════════════════════════════════════════════════════════════
```

---

## Phase 1: Discover

**Goal:** Understand the codebase deeply and define the feature before designing anything.
**Hard gate:** No code, no scaffolding, no implementation action until Step 1.6 completes with explicit design approval.

---

### Step 1.1: superpowers:using-superpowers

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVER — Step 1.1
Tool: superpowers:using-superpowers
Goal: Check for applicable skills at the start of this session
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:using-superpowers`
- **Failure:** Cannot fail; if skill unavailable, proceed and note the gap
- After completion: update state file (step → "1.2", add to completedSteps)

```
✅ Step 1.1 complete — using-superpowers done. State saved.
```

---

### Step 1.2: claude-code-setup:claude-automation-recommender

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVER — Step 1.2
Tool: claude-code-setup:claude-automation-recommender
Goal: Verify Claude Code setup is optimal for this monorepo
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `claude-code-setup:claude-automation-recommender`
- **Failure:** Cannot fail; if unavailable, proceed and note gap
- After completion: update state file (step → "1.3", add to completedSteps)

```
✅ Step 1.2 complete — automation recommender done. State saved.
```

---

### Step 1.3: feature-dev:code-explorer (subagent)

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVER — Step 1.3
Tool: feature-dev:code-explorer (Task subagent)
Goal: Deep-trace codebase — map package boundaries, exports,
      hooks, schemas, types, and shared utilities
════════════════════════════════════════════════════════════════
```

- Use Task tool with subagent_type `feature-dev:code-explorer`
- Prompt: "Explore the codebase to understand the current package structure, all exports from packages/, existing hooks, Zod schemas, TypeScript types, shared utilities, and anything relevant to: [description from state]. Produce a structured dependency map showing: which packages exist, what they export, which packages depend on which, and which existing code could be reused for this feature."
- **Failure:** If subagent fails, invoke directly using Glob + Grep; do not skip
- After completion: update state file (step → "1.4", add to completedSteps)

```
✅ Step 1.3 complete — code-explorer done. State saved.
```

---

### Step 1.4: greptile MCP — Find reusable code

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVER — Step 1.4
Tool: greptile MCP
Goal: Search codebase for existing utilities, patterns, and
      abstractions that overlap with the feature domain
════════════════════════════════════════════════════════════════
```

- Use `mcp__plugin_greptile_greptile__search_custom_context` — query for patterns related to the feature description
- Use `mcp__plugin_greptile_greptile__list_merge_requests` — review recent PRs to understand recently established patterns
- **Failure:** If greptile unavailable, use Grep + Glob to approximate; note the gap
- After completion: update state file (step → "1.5", add to completedSteps)

```
✅ Step 1.4 complete — greptile search done. State saved.
```

---

### Step 1.5: context7 MCP — Pull library docs

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVER — Step 1.5
Tool: context7 MCP
Goal: Pull current, version-accurate documentation for every
      library the feature will touch
════════════════════════════════════════════════════════════════
```

- Use `mcp__plugin_context7_context7__resolve-library-id` for each relevant library
- Use `mcp__plugin_context7_context7__query-docs` scoped to the specific methods the feature will use
- **Failure:** If context7 unavailable, note which library docs could not be fetched; proceed
- After completion: update state file (step → "1.6", add to completedSteps)

```
✅ Step 1.5 complete — context7 docs loaded. State saved.
```

---

### Step 1.6: superpowers:brainstorming — HARD GATE

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVER — Step 1.6
Tool: superpowers:brainstorming
Goal: Collaborative design exploration with approved design
      required before proceeding to Phase 2
⚠️  HARD GATE: Do NOT proceed until design is explicitly approved
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:brainstorming`
- **Hard gate rule:** Do NOT proceed to Phase 2 until the user explicitly approves the design.
- After approved: write design doc to `docs/plans/[date]-[feature]-design.md`
- Update state file (step → "2.1", `artifacts.designDoc` → path, add to completedSteps)

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

## Phase 2: Plan

**Goal:** Produce a concrete architecture with explicit package ownership before any implementation starts.
**Hard gate:** No implementation task may be assigned to a file not declared in the package boundary map from Step 2.1.

---

### Step 2.1: feature-dev:code-architect (subagent)

```
════════════════════════════════════════════════════════════════
▶ PHASE 2 · PLAN — Step 2.1
Tool: feature-dev:code-architect (Task subagent)
Goal: Produce the package boundary map
════════════════════════════════════════════════════════════════
```

- Use Task tool with subagent_type `feature-dev:code-architect`
- Prompt: "Design the package boundary map for this feature: [description]. Reference the approved design doc at [artifacts.designDoc]. Reference the dependency map produced by code-explorer in Phase 1. Produce: (1) a table showing which package/app owns each new piece of logic; (2) what each package exports; (3) the TypeScript module graph between packages; (4) any new packages that need to be created. Enforce these rules: packages/utils has zero framework deps, apps/ do not import from each other, shared logic goes to packages/ not apps/, packages/ui imports ONLY from packages/types within the monorepo."
- After completion: update state file (step → "2.2", `artifacts.boundaryMap` → inline reference, add to completedSteps)

```
✅ Step 2.1 complete — package boundary map produced. State saved.
```

---

### Step 2.2: frontend-design:frontend-design (conditional)

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — UI component design check
═══════════════════════════════════════════════════════════════
Context: frontend-design produces production-grade UI component
designs. It should run if and only if this feature touches
packages/ui or any apps/ UI layer.
Current position: Phase 2 · Step 2.2 · frontend-design
═══════════════════════════════════════════════════════════════
```

Ask: "Does this feature include UI components (touching packages/ui or apps/)?"

- If Yes: Use Skill tool `frontend-design:frontend-design`
  - Constraint: components must reference `packages/ui` and `packages/types`, never app-internal code
- If No: display skip notice

- After decision: update state file (step → "2.3", add to completedSteps — name "frontend-design" or "frontend-design-skipped")

```
✅ Step 2.2 complete — frontend design [done / skipped]. State saved.
```

---

### Step 2.3: superpowers:writing-plans — HARD GATE

```
════════════════════════════════════════════════════════════════
▶ PHASE 2 · PLAN — Step 2.3
Tool: superpowers:writing-plans
Goal: Translate the approved design + package boundary map
      into bite-sized implementation tasks
⚠️  HARD GATE: Do NOT proceed to Phase 3 until plan is approved
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:writing-plans`
- **Each task in the produced plan MUST specify:**
  - Exact file path including package directory
  - Which package it belongs to
  - Expected exports from that file
  - Test file location
  - Verification command (`pnpm turbo test --filter [package]`)
  - Dependencies on prior tasks
- Plan file location: `docs/plans/[date]-[feature]-impl.md`
- Display plan summary to user; ask for approval
- If revisions requested: re-invoke this step. Loop until approved.
- Update state file (`artifacts.planFile` → plan path, step → "2.4", add to completedSteps)

```
✅ Step 2.3 complete — implementation plan approved. State saved.
Plan file: [planFile path]
```

---

### Step 2.4: claude-md-management:claude-md-improver

```
════════════════════════════════════════════════════════════════
▶ PHASE 2 · PLAN — Step 2.4
Tool: claude-md-management:claude-md-improver
Goal: Update CLAUDE.md (root + affected packages) with
      architectural patterns decided in this phase BEFORE
      implementation starts
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `claude-md-management:claude-md-improver`
- **What to record:** Package boundary rules, naming conventions, new shared abstractions, new package ownership rules
- After completion: update state file (step → "3.0", add to completedSteps)

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

## Phase 3: Implement

**Goal:** Iteratively implement the plan with continuous quality gates.
**Model:** No automated looping. Tasks advance only when the user explicitly confirms continuation.

---

### Step 3.0: superpowers:executing-plans — Plan Execution Setup

```
════════════════════════════════════════════════════════════════
▶ PHASE 3 · IMPLEMENT — Step 3.0
Tool: superpowers:executing-plans
Goal: Initialize plan execution framework
════════════════════════════════════════════════════════════════
```

- **Emergency check:** If `artifacts.planFile` is null or the file does not exist:

  ```
  ❌ HARD STOP — Plan file not found
  Complete Phase 2 before entering Phase 3.
  ```

  Return to Phase 2 Step 2.3.

- Use Skill tool: `superpowers:executing-plans`
- Update state file (step → "3.sub", `totalTasks` → count of tasks, add to completedSteps)

```
✅ Step 3.0 complete — plan execution initialized. [totalTasks] tasks enumerated. State saved.
```

---

### Step 3.sub: superpowers:subagent-driven-development — Dispatch Framework

```
════════════════════════════════════════════════════════════════
▶ PHASE 3 · IMPLEMENT — Step 3.sub
Tool: superpowers:subagent-driven-development
Goal: Establish subagent dispatch framework for per-task execution
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:subagent-driven-development`
- Update state file (step → "task-1", `currentTaskIndex` → 1, add to completedSteps)

```
✅ Step 3.sub complete — subagent dispatch framework established. State saved.
```

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

#### Step 3a: context7 MCP — Task-specific docs

```
════════════════════════════════════════════════════════════════
▶ Step 3a — context7 MCP
Goal: Pull current docs for the specific library this task touches
════════════════════════════════════════════════════════════════
```

- Use `mcp__plugin_context7_context7__resolve-library-id` + `mcp__plugin_context7_context7__query-docs`
- **Rule:** Do not skip. Even if library was fetched in Step 1.5, re-fetch scoped to the specific method.

---

#### Step 3b: superpowers:test-driven-development — Red → Loop → Green

```
════════════════════════════════════════════════════════════════
▶ Step 3b — superpowers:test-driven-development
Goal: Strict Red → Loop → Green cycle for this task
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:test-driven-development`
- **Enforced sequence:**
  1. Write the failing test in the correct package test directory
  2. Run the test — confirm RED. If it passes immediately, the test is wrong; rewrite it.
  3. Write the minimal implementation that makes the test pass
  4. Run the test:
     - If RED: adjust implementation and return to step 3 (loop here)
     - If stuck 3+ consecutive attempts: trigger Step 3c before continuing
     - If GREEN: continue to step 5
  5. Refactor with tests remaining green
- **Hard rule:** Red before green is not optional.

---

#### Step 3c: superpowers:systematic-debugging (conditional — only if stuck)

**Trigger:** 3 or more consecutive fix attempts have failed for this task.

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Architecture Issue Detected
Reason: 3+ consecutive fix attempts failed — this is an
        architecture problem, not an implementation problem
═══════════════════════════════════════════════════════════════
Context: The systematic-debugging skill is about to run. If
it also fails to resolve the issue, escalate: return to
Phase 2 Step 2.1 (code-architect redesign).
Current position: Phase 3 · Step 3c · systematic-debugging
═══════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:systematic-debugging`
- **Escalation rule:** If systematic-debugging also fails, STOP Phase 3. Return to Phase 2 Step 2.1.

---

#### Step 3d: code-simplifier:code-simplifier

```
════════════════════════════════════════════════════════════════
▶ Step 3d — code-simplifier:code-simplifier
Goal: Post-green cleanup — remove duplication, enforce
      single-responsibility
════════════════════════════════════════════════════════════════
```

- Use Task tool with subagent_type `code-simplifier:code-simplifier`
- **Trigger:** Only after tests are GREEN
- **Rule:** Simplification must not break tests. Run tests again after this step.

---

#### Step 3e: superpowers:requesting-code-review

```
════════════════════════════════════════════════════════════════
▶ Step 3e — superpowers:requesting-code-review
Goal: Dispatch feature-dev:code-reviewer with task spec
      and package boundary map
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:requesting-code-review`
- **Rule:** Critical issues from code review must be resolved or explicitly accepted before proceeding.

---

#### Step 3f: superpowers:receiving-code-review

```
════════════════════════════════════════════════════════════════
▶ Step 3f — superpowers:receiving-code-review
Goal: Evaluate feedback technically — push back on YAGNI
      violations or unnecessary complexity
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:receiving-code-review`
- **Rule:** Never implement feedback blindly. Push back with reasoning if suggestions violate YAGNI or package boundaries.

---

#### After each task: State update and user confirmation

Update state file: mark task as completed, increment `currentTaskIndex`, record timestamp.

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

Ask: "Task [N] complete. Continue to Task [N+1] or stop here?"

- Continue: begin next task inner cycle
- Stop: display session-end banner and exit:

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

## Phase 4: Test

**Goal:** Prove correctness with evidence before claiming the feature is done.
**Rule:** Both steps must pass. No completion claim without explicit evidence.

---

### Step 4.1: superpowers:dispatching-parallel-agents — 2 branches

```
════════════════════════════════════════════════════════════════
▶ PHASE 4 · TEST — Step 4.1
Tool: superpowers:dispatching-parallel-agents
Goal: Run 2 simultaneous validation branches
════════════════════════════════════════════════════════════════

Branch A — Local quality gates:
  pnpm turbo test
  pnpm turbo typecheck
  pnpm turbo build
  pnpm turbo lint
  (All must exit 0)

Branch B — E2E (local dev server):
  playwright MCP:
    → start local dev server
    → navigate to the feature's entry point
    → take accessibility snapshot
    → interact with critical user paths end-to-end
    → assert expected outcomes
  puppeteer MCP:
    → take visual screenshots at key states for human review

════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:dispatching-parallel-agents`
- ALL branches must pass before proceeding
- **Failure handling:**

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Validation Branch [A/B] Failed
═══════════════════════════════════════════════════════════════
Branch A quality failure → fix, re-run Branch A only
Branch B E2E failure     → debug the specific flow, re-run Branch B only
═══════════════════════════════════════════════════════════════
```

Re-run only the failing branch after fixing.

- After completion: update state file (step → "4.2", add to completedSteps)

---

### Step 4.2: superpowers:verification-before-completion

```
════════════════════════════════════════════════════════════════
▶ PHASE 4 · TEST — Step 4.2
Tool: superpowers:verification-before-completion
Goal: Run fresh verification commands and present explicit
      evidence — no completion claim without this
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:verification-before-completion`
- **Commands run fresh (not from cache):**
  ```bash
  pnpm turbo build
  pnpm turbo typecheck
  pnpm turbo test
  pnpm turbo lint
  ```
- **Rule:** All commands must exit 0. Any failure stops progression. Evidence must be presented explicitly.
- After completion: update state file (workflow complete, add to completedSteps)

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

## Phase Transition Gates (Reference)

| Transition        | Gate condition                                                        |
| ----------------- | --------------------------------------------------------------------- |
| Phase 1 → Phase 2 | `superpowers:brainstorming` completes with explicit design approval   |
| Phase 2 → Phase 3 | Package boundary map produced AND CLAUDE.md updated AND plan approved |
| Task N → Task N+1 | Tests GREEN + review resolved/accepted + user confirms continuation   |
| Phase 3 → Phase 4 | All plan tasks marked complete                                        |
| Phase 4 complete  | Branch A + Branch B pass + verification-before-completion cleared     |

---

## Emergency Exits (Reference)

| Situation                              | Action                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| 3+ failed fixes in a row               | Stop Phase 3. Return to Phase 2 Step 2.1. Redesign package boundaries.   |
| Review suggests bad architectural dir  | `receiving-code-review` — push back with technical rigor. Never blindly. |
| Test passes immediately on first write | Test is wrong. Red must come before green. Rewrite.                      |
| State file has version < 2             | Discard. Start fresh with 4-phase workflow.                              |
| Plan file missing at Phase 3 entry     | Hard stop: "Plan file not found — complete Phase 2 first."               |
