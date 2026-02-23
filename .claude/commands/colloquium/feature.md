# Colloquium Feature Dispatch

Orchestrate the full Colloquium development workflow from a single command.
Invoke as: /colloquium:feature "description of what to build"
Or: /colloquium:feature (to resume an in-progress workflow)

**Canonical reference:** `docs/WORKFLOW-DISTILLATION.md`
**Version:** v1 — no automated looping, manual task progression

---

## ENFORCEMENT RULES (read before executing any step)

1. **No silent skipping.** Every step MUST either execute OR display an explicit skip notice:

   ```
   ⏭ Step [N.N] SKIPPED — [tool name]
   Reason: [one-sentence justification]
   State saved.
   ```

   The state file MUST be updated even for skipped steps (add to completedSteps with name suffixed `-skipped`). Jumping past a step without announcing it is a workflow violation.

2. **State after every step.** The state file is updated after EVERY step — not after phases, not in batches. If the session crashes between steps, the state file must reflect the last completed step exactly.

3. **Banners are mandatory.** Every step displays its start banner before executing and its completion banner after. This is not optional formatting — it is the developer's only way to know where in the workflow they are.

4. **Hard gates block.** Steps marked HARD GATE loop until the gate condition is met. No proceeding, no skipping, no workarounds.

5. **Conditional steps still announce.** Even when a conditional step is skipped (e.g., vercel:setup, frontend-design, agent-sdk-verifier), it must display the smart pause, ask the question, and record the decision.

---

## Phase 0: State Management (always runs first)

### Step 0.1 — Check for existing state

Use Bash to check:

```bash
cat .claude/dispatch-state.json 2>/dev/null || echo "NO_STATE_FILE"
```

### Step 0.2 — If state file exists: display resume banner and ask

Display in chat:

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

Then use AskUserQuestion tool:

```json
{
  "questions": [
    {
      "question": "Resume from where you left off, or start fresh?",
      "header": "Resume?",
      "options": [
        {
          "label": "Resume (recommended)",
          "description": "Continue from Phase [phase] · Step [step] · [step name]"
        },
        {
          "label": "Start fresh",
          "description": "Delete state file and start from Phase 1 with a new feature description"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

- If "Start fresh": delete `.claude/dispatch-state.json` and proceed to Step 0.3
- If "Resume": jump to the phase/step stored in state

**Emergency check:** If state file exists but the branch recorded in it no longer exists:

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — State/Branch Mismatch
═══════════════════════════════════════════════════════════════
Context: State file references branch [branch] but that branch
no longer exists. This may indicate manual cleanup or a failed
worktree removal.
Current position: Phase 0 · Step 0.2 · resume check
═══════════════════════════════════════════════════════════════
```

Ask whether to recover the branch or start fresh.

### Step 0.3 — If no state file: capture feature description

- If the command was invoked with an argument (text after `/colloquium:feature`): use that as the description
- If invoked with no argument: display prompt box and wait for input:

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

Wait for user input.

### Step 0.4 — Create initial state file

Use Write tool to create `.claude/dispatch-state.json`:

```json
{
  "version": 1,
  "feature": "[derived 2-3 word name from description]",
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

Workflow: 7 phases · 26 fixed steps + per-task inner cycle
State file:  .claude/dispatch-state.json (updated after EVERY step)

Starting Phase 1 · Discovery...
════════════════════════════════════════════════════════════════
```

---

## Phase 1: Discovery

**Goal:** Understand the codebase deeply and define the feature before designing anything.
**Hard gate:** No code, no scaffolding, no implementation action until Step 1.6 completes with explicit design approval.

---

### Step 1.1: superpowers:using-superpowers

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVERY — Step 1.1
Tool: superpowers:using-superpowers
Goal: Check for applicable skills at the start of this session
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:using-superpowers`
- **Failure:** Cannot fail; if skill unavailable, proceed and note the gap
- After completion: update state file (step → "1.2", add `{"phase": 1, "step": "1.1", "name": "using-superpowers", "ts": "[ISO]"}` to completedSteps)

```
✅ Step 1.1 complete — using-superpowers done. State saved.
```

---

### Step 1.2: claude-code-setup:claude-automation-recommender

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVERY — Step 1.2
Tool: claude-code-setup:claude-automation-recommender
Goal: Verify Claude Code setup (hooks, MCPs, plugins) is optimal
      for this monorepo; identify any automation gaps
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `claude-code-setup:claude-automation-recommender`
- **Inputs:** Current `.claude/settings.json`
- **Outputs:** Recommendation report — gaps noted for Post-ship Step 7.2
- **Failure:** Cannot fail; if tool unavailable, proceed and note gap
- After completion: update state file (step → "1.3", add to completedSteps)

```
✅ Step 1.2 complete — automation recommender done. State saved.
```

---

### Step 1.3: feature-dev:code-explorer (subagent)

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVERY — Step 1.3
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
▶ PHASE 1 · DISCOVERY — Step 1.4
Tool: greptile MCP
Goal: Search codebase for existing utilities, patterns, and
      abstractions that overlap with the feature domain
════════════════════════════════════════════════════════════════
```

- Use `mcp__plugin_greptile_greptile__search_custom_context` — query for patterns related to the feature description
- Use `mcp__plugin_greptile_greptile__list_merge_requests` — review recent PRs to understand recently established patterns
- **Outputs:** List of reusable code found; feeds into Phase 3 boundary map
- **Failure:** If greptile unavailable, use Grep + Glob to approximate; note the gap
- After completion: update state file (step → "1.5", add to completedSteps)

```
✅ Step 1.4 complete — greptile search done. State saved.
```

---

### Step 1.5: context7 MCP — Pull library docs

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVERY — Step 1.5
Tool: context7 MCP
Goal: Pull current, version-accurate documentation for every
      library the feature will touch
════════════════════════════════════════════════════════════════
```

- Identify libraries relevant to this feature (from codebase exploration above)
- Use `mcp__plugin_context7_context7__resolve-library-id` for each relevant library
- Use `mcp__plugin_context7_context7__query-docs` scoped to the specific methods or APIs the feature will use
- **Failure:** If context7 unavailable, note which library docs could not be fetched; proceed
- After completion: update state file (step → "1.6", add to completedSteps)

```
✅ Step 1.5 complete — context7 docs loaded. State saved.
```

---

### Step 1.6: superpowers:brainstorming — HARD GATE

```
════════════════════════════════════════════════════════════════
▶ PHASE 1 · DISCOVERY — Step 1.6
Tool: superpowers:brainstorming
Goal: Collaborative design exploration with approved design
      required before proceeding to Phase 2
⚠️  HARD GATE: Do NOT proceed until design is explicitly approved
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:brainstorming`
- This skill runs its full process: clarifying questions one at a time → 2-3 approaches with trade-offs → design sections → explicit approval
- **Hard gate rule:** Do NOT proceed to Phase 2 until the user explicitly approves the design. If revisions requested, re-invoke this step. Loop here until approval.
- After approved: write design doc to `docs/plans/[date]-[feature]-design.md`
- Update state file (step → "2.1", `artifacts.designDoc` → path, add to completedSteps)

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

## Phase 2: Isolation

**Goal:** Create a safe, reproducible working environment isolated from main.
**Exit gate:** Worktree exists AND baseline tests pass. Do not proceed to Phase 3 if baseline tests fail — fix them first.

---

### Step 2.1: superpowers:using-git-worktrees

```
════════════════════════════════════════════════════════════════
▶ PHASE 2 · ISOLATION — Step 2.1
Tool: superpowers:using-git-worktrees
Goal: Create isolated git worktree for the feature branch;
      run pnpm install and baseline tests
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:using-git-worktrees`
- After worktree created: extract branch name and worktreeDir
- Run `pnpm install` in the worktree
- Run `pnpm turbo test` as baseline gate — ALL tests must pass
- **Hard exit condition:** If baseline tests fail, STOP. Fix the failing tests on `main` before creating the feature branch. Do not carry broken tests into the feature worktree.
- Update state file: `branch` → branch name, `worktreeDir` → worktree path, step → "2.2", add to completedSteps

```
✅ Step 2.1 complete — worktree created. Branch: [branch]. Baseline tests: PASS. State saved.
```

---

### Step 2.2: turborepo:turborepo

```
════════════════════════════════════════════════════════════════
▶ PHASE 2 · ISOLATION — Step 2.2
Tool: turborepo:turborepo
Goal: Configure Turborepo pipeline tasks for any new packages
      the feature will introduce
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `turborepo:turborepo`
- Ensure `build`, `test`, `typecheck`, `lint` tasks are wired in `turbo.json` for all packages
- After completion: update state file (step → "2.3", add to completedSteps)

```
✅ Step 2.2 complete — turborepo configured. State saved.
```

---

### Step 2.3: vercel:setup (conditional)

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — First-time Vercel deployment check
═══════════════════════════════════════════════════════════════
Context: vercel:setup links the project to Vercel and configures
preview deployments. This only needs to run once per project.
If already configured, running it again may cause conflicts.
Current position: Phase 2 · Step 2.3 · vercel:setup
═══════════════════════════════════════════════════════════════
```

Use AskUserQuestion tool:

```json
{
  "questions": [
    {
      "question": "Is this the first time deploying this project to Vercel?",
      "header": "Vercel setup?",
      "options": [
        {
          "label": "Yes, first time",
          "description": "Run vercel:setup to link the project and configure preview deployments"
        },
        {
          "label": "No, already configured",
          "description": "Skip vercel:setup — project is already linked to Vercel"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

- If "Yes, first time": Use Skill tool `vercel:setup`; store project reference in `artifacts.vercelProject`
- If "No, already configured": display skip notice
- After completion: update state file (step → "3.1", add to completedSteps — name "vercel-setup" or "vercel-setup-skipped")

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

## Phase 3: Design

**Goal:** Produce a concrete architecture with explicit package ownership before any implementation starts.
**Hard gate:** No implementation task may be assigned to a file that was not declared in the package boundary map from Step 3.1.

---

### Step 3.1: feature-dev:code-architect (subagent)

```
════════════════════════════════════════════════════════════════
▶ PHASE 3 · DESIGN — Step 3.1
Tool: feature-dev:code-architect (Task subagent)
Goal: Produce the package boundary map — which package owns
      each piece of new logic, exports, and dependencies
════════════════════════════════════════════════════════════════
```

- Use Task tool with subagent_type `feature-dev:code-architect`
- Prompt: "Design the package boundary map for this feature: [description]. Reference the approved design doc at [artifacts.designDoc]. Reference the dependency map produced by code-explorer in Phase 1. Produce: (1) a table showing which package/app owns each new piece of logic; (2) what each package exports; (3) the TypeScript module graph between packages; (4) any new packages that need to be created. Enforce these rules: packages/utils has zero framework deps, apps/ do not import from each other, shared logic goes to packages/ not apps/, packages/ui imports ONLY from packages/types within the monorepo."
- After completion: capture boundary map output, update state file (step → "3.2", `artifacts.boundaryMap` → inline reference, add to completedSteps)

```
✅ Step 3.1 complete — package boundary map produced. State saved.
```

---

### Step 3.2: frontend-design:frontend-design (conditional)

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — UI component design check
═══════════════════════════════════════════════════════════════
Context: frontend-design produces production-grade UI component
designs. It should run if and only if this feature touches
apps/web or packages/ui. Running it for API-only features
wastes context.
Current position: Phase 3 · Step 3.2 · frontend-design
═══════════════════════════════════════════════════════════════
```

Use AskUserQuestion tool:

```json
{
  "questions": [
    {
      "question": "Does this feature include UI components (touching apps/web or packages/ui)?",
      "header": "UI needed?",
      "options": [
        {
          "label": "Yes, includes UI",
          "description": "Run frontend-design:frontend-design to produce component designs"
        },
        {
          "label": "No, API/backend only",
          "description": "Skip frontend-design — no UI components needed"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

- If "Yes, includes UI": Use Skill tool `frontend-design:frontend-design`
  - Constraint: components must reference `packages/ui` and `packages/types`, never app-internal code
- If "No, API/backend only": display skip notice
- After decision: update state file (step → "3.3", add to completedSteps — name "frontend-design" or "frontend-design-skipped")

```
✅ Step 3.2 complete — frontend design [done / skipped]. State saved.
```

---

### Step 3.3: superpowers:writing-plans — HARD GATE

```
════════════════════════════════════════════════════════════════
▶ PHASE 3 · DESIGN — Step 3.3
Tool: superpowers:writing-plans
Goal: Translate the approved design + package boundary map
      into bite-sized implementation tasks
⚠️  HARD GATE: Do NOT proceed to Phase 4 until plan is reviewed
      and approved by the user
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
- Display plan summary to user
- Ask for plan approval:

```json
{
  "questions": [
    {
      "question": "Does the implementation plan look correct? Approve to proceed to Phase 4.",
      "header": "Plan approved?",
      "options": [
        {
          "label": "Yes, proceed to implementation",
          "description": "Plan is approved — begin Phase 4 Implementation"
        },
        {
          "label": "Revise the plan",
          "description": "The plan needs changes before I start implementing"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

- If "Revise": stay in Step 3.3, re-invoke writing-plans with revision guidance. Loop until approved.
- If "Yes": update state file (`artifacts.planFile` → plan path, step → "3.4", add to completedSteps)

```
✅ Step 3.3 complete — implementation plan approved. State saved.
Plan file: [planFile path]
```

---

### Step 3.4: claude-md-management:claude-md-improver

```
════════════════════════════════════════════════════════════════
▶ PHASE 3 · DESIGN — Step 3.4
Tool: claude-md-management:claude-md-improver
Goal: Update CLAUDE.md (root + affected packages) with
      architectural patterns decided in this phase BEFORE
      implementation starts
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `claude-md-management:claude-md-improver`
- **What to record:** Package boundary rules, naming conventions, new shared abstractions, new package ownership rules
- After completion: update state file (step → "4.0", add to completedSteps)

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

## Phase 4: Implementation

**Goal:** Iteratively implement the plan with continuous quality gates.
**Model:** No automated looping (v1). Tasks advance only when the user explicitly confirms continuation. Each task follows the per-task inner cycle (Steps 4a–4g).

---

### Step 4.0: superpowers:executing-plans — Plan Execution Setup

```
════════════════════════════════════════════════════════════════
▶ PHASE 4 · IMPLEMENTATION — Step 4.0
Tool: superpowers:executing-plans
Goal: Initialize plan execution framework — read plan file,
      enumerate all tasks, establish execution approach
════════════════════════════════════════════════════════════════
```

- **Emergency check:** If `artifacts.planFile` is null or the file does not exist:

  ```
  ❌ HARD STOP — Plan file not found
  Complete Phase 3 before entering Phase 4.
  ```

  Return to Phase 3 Step 3.3.

- Use Skill tool: `superpowers:executing-plans`
- **Inputs:** `artifacts.planFile` from state
- **Outputs:** Task list enumerated; execution approach confirmed; checkpoint protocol established
- Update state file (step → "4.sub", `totalTasks` → count of tasks, add to completedSteps)

```
✅ Step 4.0 complete — plan execution initialized. [totalTasks] tasks enumerated. State saved.
```

---

### Step 4.sub: superpowers:subagent-driven-development — Dispatch Framework

```
════════════════════════════════════════════════════════════════
▶ PHASE 4 · IMPLEMENTATION — Step 4.sub
Tool: superpowers:subagent-driven-development
Goal: Establish subagent dispatch framework for per-task execution
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:subagent-driven-development`
- **What this step establishes:**
  - Each task is dispatched as a fresh subagent
  - Each subagent receives: task spec, package boundary map, approved design doc, current git SHA
  - The subagent follows the per-task inner cycle (Steps 4a–4g)
  - The main session collects results, updates state, handles user confirmation
- Update state file (step → "task-1", `currentTaskIndex` → 1, add to completedSteps)

```
✅ Step 4.sub complete — subagent dispatch framework established. State saved.
```

---

### Per-Task Inner Cycle (Steps 4a–4g)

**Executed for each task in `artifacts.planFile`.**

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

#### Step 4a: context7 MCP — Task-specific docs

```
════════════════════════════════════════════════════════════════
▶ Step 4a — context7 MCP
Goal: Pull current docs for the specific library/API this task touches
════════════════════════════════════════════════════════════════
```

- Identify the specific library or API being used in this task
- Use `mcp__plugin_context7_context7__resolve-library-id` + `mcp__plugin_context7_context7__query-docs` scoped to this task's library
- **Rule:** Do not skip. Even if library was fetched in Step 1.5, re-fetch scoped to the specific method being implemented.

---

#### Step 4b: superpowers:test-driven-development

```
════════════════════════════════════════════════════════════════
▶ Step 4b — superpowers:test-driven-development
Goal: Strict Red → Green → Refactor cycle for this task
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:test-driven-development`
- **Enforced sequence:**
  1. Write the failing test in the correct package test directory
  2. Run the test — confirm it is RED (fails). If it passes immediately, the test is wrong; rewrite it.
  3. Write the minimal implementation that makes the test pass — no more than the test requires
  4. `typescript-lsp` passively confirms no cross-package import leaks during every edit; `pyright-lsp` is active when Python interop is involved
  5. Run the test — confirm it is GREEN
  6. Refactor with tests remaining green
- **Hard rule:** Red before green is not optional. If the test passes immediately on first write, the test is wrong — rewrite it.

---

#### Step 4c: superpowers:systematic-debugging (conditional — only if stuck)

**Trigger:** 3 or more consecutive fix attempts have failed for this task.

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Architecture Issue Detected
Reason: 3+ consecutive fix attempts failed — this is an
        architecture problem, not an implementation problem
═══════════════════════════════════════════════════════════════
Context: The systematic-debugging skill is about to run. If
it also fails to resolve the issue, escalate: return to
Phase 3 Step 3.1 (code-architect redesign).
Current position: Phase 4 · Step 4c · systematic-debugging
═══════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:systematic-debugging`
- 4-phase root cause investigation before any fix attempt
- **Escalation rule:** If systematic-debugging also fails, STOP Phase 4. Return to Phase 3 Step 3.1. Redesign the package boundaries. Do not attempt more fixes.

---

#### Step 4d: code-simplifier:code-simplifier

```
════════════════════════════════════════════════════════════════
▶ Step 4d — code-simplifier:code-simplifier
Goal: Post-green cleanup — remove duplication, enforce
      single-responsibility, fit code into declared package
════════════════════════════════════════════════════════════════
```

- Use Task tool with subagent_type `code-simplifier:code-simplifier`
- **Trigger:** Only after tests are GREEN
- **Rule:** Simplification must not break tests. Run tests again after this step.

---

#### Step 4e: superpowers:requesting-code-review

```
════════════════════════════════════════════════════════════════
▶ Step 4e — superpowers:requesting-code-review
Goal: Dispatch feature-dev:code-reviewer with task spec
      and package boundary map
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:requesting-code-review`
- **Context provided to review:**
  - Task title and spec from the plan
  - Git SHA range since the task started
  - Package boundary map from `artifacts.boundaryMap`
  - Expected exports from the plan
- **Rule:** Critical issues from code review must be resolved or explicitly accepted before proceeding to the next task.

---

#### Step 4f: superpowers:receiving-code-review

```
════════════════════════════════════════════════════════════════
▶ Step 4f — superpowers:receiving-code-review
Goal: Evaluate feedback technically — push back on YAGNI
      violations or unnecessary complexity
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:receiving-code-review`
- **Required evaluation criteria:**
  - Does this suggestion violate YAGNI?
  - Does it break the declared package boundaries?
  - Does it introduce unnecessary complexity?
  - Is the suggestion technically correct given the current library version (reference context7 docs from Step 4a)?
- **Rule:** Never implement feedback blindly. Push back with reasoning if suggestions violate the above criteria. Accept valid criticisms.

---

#### Step 4g: agent-sdk-dev:agent-sdk-verifier-ts (conditional — SDK features only)

**Trigger:** The task being implemented is part of a Claude Agent SDK application.

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — SDK Component Detection
Reason: This task builds a Claude Agent SDK component —
        invoking SDK verifier
═══════════════════════════════════════════════════════════════
Context: agent-sdk-verifier-ts verifies SDK configuration
follows official documentation. Catches misconfigured agents,
incorrect tool schemas, or missing SDK patterns.
Current position: Phase 4 · Step 4g · agent-sdk-verifier-ts
═══════════════════════════════════════════════════════════════
```

- Use Task tool with subagent_type `agent-sdk-dev:agent-sdk-verifier-ts`
- **Skip condition:** If the task does not involve Agent SDK code, skip this step entirely (with skip notice).

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

Use AskUserQuestion tool:

```json
{
  "questions": [
    {
      "question": "Task [N] complete. Continue to Task [N+1] or stop here?",
      "header": "Continue?",
      "options": [
        {
          "label": "Continue to next task",
          "description": "Proceed with Task [N+1]: [next task title]"
        },
        {
          "label": "Stop here for now",
          "description": "End session. Resume by running /colloquium:feature — state is saved."
        }
      ],
      "multiSelect": false
    }
  ]
}
```

- If "Stop": display session-end banner and exit:

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

## Phase 5: Validation

**Goal:** Prove correctness with evidence before making any completion claim.
**Rule:** All 4 steps must pass. No completion claim without explicit evidence from all steps.

---

### Step 5.1: superpowers:dispatching-parallel-agents — 3 simultaneous branches

```
════════════════════════════════════════════════════════════════
▶ PHASE 5 · VALIDATION — Step 5.1
Tool: superpowers:dispatching-parallel-agents
Goal: Run 3 simultaneous validation branches
════════════════════════════════════════════════════════════════

Branch A — Type + Build:
  pnpm turbo build
  pnpm turbo typecheck
  typescript-lsp full diagnostics across all packages
  pyright-lsp diagnostics (if Python interop present)

Branch B — E2E Testing:
  playwright MCP:
    → navigate to the feature's entry point
    → take accessibility snapshot
    → interact with critical user paths end-to-end
    → assert expected outcomes
  puppeteer MCP:
    → take visual screenshots at key states for human review

Branch C — Boundary Audit:
  greptile MCP:
    → verify no app-specific logic leaked into packages/
    → verify no utility duplicated across apps/
    → verify packages/ui imports only from packages/types (within monorepo)

════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:dispatching-parallel-agents`
- ALL 3 branches must pass before proceeding
- **Failure handling — Smart pause per branch:**

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Validation Branch [A/B/C] Failed
═══════════════════════════════════════════════════════════════
Branch A type/build failure → fix type errors or build errors, re-run Branch A only
Branch B E2E failure        → debug the specific flow, re-run Branch B only
Branch C boundary violation → return to Phase 3 Step 3.1 (code-architect)
═══════════════════════════════════════════════════════════════
```

- Re-run only the failing branch after fixing. Do not re-run passing branches.
- Update state file (step → "5.2", add to completedSteps)

---

### Step 5.2: superpowers:code-reviewer — Focused full-diff review

```
════════════════════════════════════════════════════════════════
▶ PHASE 5 · VALIDATION — Step 5.2
Tool: superpowers:code-reviewer (Task subagent)
Goal: Single-agent focused code review of the complete feature
      diff — distinct from the automated multi-agent /code-review
════════════════════════════════════════════════════════════════
```

- Use Task tool with subagent_type `superpowers:code-reviewer`
- **Context provided:**
  - Full git diff from the start of the feature branch to HEAD
  - The package boundary map from `artifacts.boundaryMap`
  - The implementation plan from `artifacts.planFile`
  - CLAUDE.md (root + affected packages)
- **What this review checks:**
  - Adherence to CLAUDE.md rules
  - Correctness of the full feature across all tasks together (not just per-task)
  - Any cross-task coupling that individual per-task reviews may have missed
  - Completeness against the approved design doc
- **Rule:** Critical and high-confidence issues block progression to Step 5.3. Medium issues noted but do not block. Low-confidence issues recorded for Post-ship.
- Update state file (step → "5.3", add to completedSteps)

```
✅ Step 5.2 complete — full-diff code review done. State saved.
```

---

### Step 5.3: superpowers:verification-before-completion

```
════════════════════════════════════════════════════════════════
▶ PHASE 5 · VALIDATION — Step 5.3
Tool: superpowers:verification-before-completion
Goal: Run fresh verification commands, read full output,
      present explicit evidence — no completion claim without this
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
- **Rule:** All commands must exit 0. Any failure stops progression. Evidence must be presented explicitly in the session output.
- Update state file (step → "5.4", add to completedSteps)

```
✅ Step 5.3 complete — verification evidence presented. State saved.
```

---

### Step 5.4: /code-review (code-review:code-review)

```
════════════════════════════════════════════════════════════════
▶ PHASE 5 · VALIDATION — Step 5.4
Tool: code-review:code-review (5 parallel agents)
Goal: Automated multi-dimensional PR review — CLAUDE.md compliance,
      bugs, git history, prior PR patterns, inline code comments
      (only issues ≥80% confidence reported)
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `code-review:code-review`
- **Confidence threshold:** Issues below 80% confidence are filtered out
- **Rule:** Only high-confidence findings (≥80%) block progression to Phase 6.
- Update state file (step → "6.1", add to completedSteps)

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

## Phase 6: Ship

**Goal:** Deploy to preview, smoke test, open PR, decide on merge strategy.

---

### Step 6.1: vercel:deploy

```
════════════════════════════════════════════════════════════════
▶ PHASE 6 · SHIP — Step 6.1
Tool: vercel:deploy
Goal: Deploy feature branch to Vercel preview URL
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `vercel:deploy`
- Capture deploy URL from output
- Update state file (`artifacts.deployUrl` → URL, step → "6.2", add to completedSteps)

---

### Step 6.2: vercel:logs

```
════════════════════════════════════════════════════════════════
▶ PHASE 6 · SHIP — Step 6.2
Tool: vercel:logs
Goal: Confirm no runtime errors in preview deployment
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `vercel:logs`
- If runtime errors found: SMART PAUSE

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Runtime Errors in Preview Deployment
Reason: A build passing locally but failing at runtime is
        not complete — must fix before proceeding to smoke test
═══════════════════════════════════════════════════════════════
Context: [error summary from vercel:logs]
Current position: Phase 6 · Step 6.2 · vercel:logs
═══════════════════════════════════════════════════════════════
```

- Update state file (step → "6.3", add to completedSteps)

---

### Step 6.3: playwright + puppeteer MCPs — Smoke test

```
════════════════════════════════════════════════════════════════
▶ PHASE 6 · SHIP — Step 6.3
Tool: playwright MCP + puppeteer MCP
Goal: Smoke test the deployed preview URL
════════════════════════════════════════════════════════════════
Deploy URL: [artifacts.deployUrl from state]
════════════════════════════════════════════════════════════════
```

- Use `mcp__plugin_playwright_playwright__browser_navigate` to the deploy URL
- Take accessibility snapshot (playwright) to verify UI rendered correctly
- Exercise the critical user path end-to-end against the live preview; assert expected outcomes
- Use puppeteer MCP `mcp__puppeteer__puppeteer_screenshot` to capture a visual screenshot of the final state for human review
- **Scope:** Smoke test only — cover the primary happy path
- Update state file (step → "6.4", add to completedSteps)

---

### Step 6.4: github MCP — Open PR

```
════════════════════════════════════════════════════════════════
▶ PHASE 6 · SHIP — Step 6.4
Tool: github MCP (Bash: gh pr create)
Goal: Open pull request with preview link and boundary decisions
════════════════════════════════════════════════════════════════
```

- Use Bash to run `gh pr create` with:
  - Title derived from feature name
  - Body including:
    - Link to Vercel preview (`artifacts.deployUrl`)
    - Summary of package boundary decisions from Phase 3
    - Reference to the implementation plan (`artifacts.planFile`)
    - greptile context attached for reviewers
- Capture PR URL from output
- Update state file (`artifacts.prUrl` → URL, step → "6.5", add to completedSteps)

---

### Step 6.5: superpowers:finishing-a-development-branch

```
════════════════════════════════════════════════════════════════
▶ PHASE 6 · SHIP — Step 6.5
Tool: superpowers:finishing-a-development-branch
Goal: Present merge options — merge locally / create PR /
      keep as-is / discard — clean up worktree
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `superpowers:finishing-a-development-branch`
- **Options presented:** Merge locally / Create PR / Keep as-is / Discard
- **Cleanup:** Remove the git worktree at `state.worktreeDir`
- After completion: update state file (step → "7.1", add to completedSteps)

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

## Post-ship Maintenance

---

### Step 7.1: claude-md-management:claude-md-improver

```
════════════════════════════════════════════════════════════════
▶ POST-SHIP · MAINTENANCE — Step 7.1
Tool: claude-md-management:claude-md-improver
Goal: Update CLAUDE.md files (root + all packages touched)
      with new abstractions, boundary rules, and patterns
════════════════════════════════════════════════════════════════
```

- Use Skill tool: `claude-md-management:claude-md-improver`
- **What to record:**
  - New shared abstractions added this session
  - Package boundary rules reinforced or newly discovered
  - Patterns that worked well and should be repeated
  - Constraints that prevented bugs (record as rules, not stories)
- Update state file (step → "7.2", add to completedSteps)

---

### Step 7.2: superpowers:writing-skills (conditional)

```
═══════════════════════════════════════════════════════════════
🔶 SMART PAUSE — Workflow gap check
Reason: Checking if any phase of this workflow revealed a
        situation where no skill applied but one should have
═══════════════════════════════════════════════════════════════
Context: If any phase lacked a skill that should have existed,
writing-skills should capture it now to prevent future gaps.
Current position: Post-ship · Step 7.2 · writing-skills
═══════════════════════════════════════════════════════════════
```

Use AskUserQuestion tool:

```json
{
  "questions": [
    {
      "question": "Were there any workflow gaps — situations where no skill applied but one should have?",
      "header": "Gaps found?",
      "options": [
        {
          "label": "Yes, write a new skill",
          "description": "Invoke superpowers:writing-skills to document the gap"
        },
        {
          "label": "No gaps found",
          "description": "Workflow was complete — no new skills needed"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

- If "Yes": Use Skill tool `superpowers:writing-skills`
- Update state file (workflow complete, add to completedSteps)

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

## Phase Transition Gates (Reference)

| Transition        | Gate condition                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Phase 1 → Phase 2 | `superpowers:brainstorming` completes with explicit design approval                                                    |
| Phase 2 → Phase 3 | Worktree created AND `pnpm turbo test` passes in the worktree                                                          |
| Phase 3 → Phase 4 | Package boundary map produced AND CLAUDE.md updated AND plan approved                                                  |
| Task N → Task N+1 | Tests GREEN + review resolved/accepted + user confirms continuation                                                    |
| Phase 4 → Phase 5 | All plan tasks marked complete                                                                                         |
| Phase 5 → Phase 6 | All 3 validation branches pass + code-reviewer resolved + verification cleared + /code-review high-confidence resolved |
| Phase 6 → Post    | Worktree cleaned up, branch merged or PR open                                                                          |

---

## Emergency Exits (Reference)

| Situation                                   | Action                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| 3+ failed fixes in a row                    | Stop Phase 4. Return to Phase 3 Step 3.1. Redesign package boundaries.   |
| Review suggests bad architectural direction | `receiving-code-review` — push back with technical rigor. Never blindly. |
| Test passes immediately on first write      | Test is wrong. Red must come before green. Rewrite.                      |
| Validation Branch C (boundary audit) fails  | Return to Phase 3 Step 3.1 — boundary violated.                          |
| State file exists but branch is gone        | Smart pause: explain mismatch, ask to recover or start fresh.            |
| Plan file missing at Phase 4 entry          | Hard stop: "Plan file not found — complete Phase 3 first."               |

---

## V2 Notes — Ralph-Loop Integration

When ralph-loop is integrated in v2, Phase 4 changes:

**Replace Steps 4.0 + 4.sub + manual per-task loop with:**

```bash
/ralph-loop "implement per plan in docs/plans/[planFile]" \
  --completion-promise "ALL TASKS COMPLETE" \
  --max-iterations 20
```

The per-task inner cycle (Steps 4a–4g) becomes the ralph-loop body. The completion signal is `ALL TASKS COMPLETE` (not `DONE`).
