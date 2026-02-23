# Simple Workflow Rewrite — Design

**Date:** 2026-02-23
**Status:** Approved
**Scope:** Replace the 7-phase Maximum Skill Workflow with a 4-phase local-only workflow

---

## Problem

The current `/colloquium:feature` workflow (7 phases, 26+ steps) was designed for a
"maximum capability" model: git worktrees for isolation, Vercel preview deployments,
smoke tests against deployed URLs, PR creation, and post-ship maintenance. This level
of automation exceeds what is wanted day-to-day.

The desired workflow is simple:

- AI discovers, plans, implements, and tests
- All execution is local — no external services, no branch management
- Human controls all git operations (branching, committing, merging)

---

## Design

### Four phases

| Phase | Name      | Role                                                                            |
| ----- | --------- | ------------------------------------------------------------------------------- |
| 0     | State     | Check for existing session; resume or start fresh                               |
| 1     | Discover  | Understand codebase, pull library docs, brainstorm + get design approval        |
| 2     | Plan      | Package boundary map, optional UI design, implementation plan, CLAUDE.md update |
| 3     | Implement | Per-task TDD loop with self-review after each task                              |
| 4     | Test      | Local validation (unit + type + build + lint) + E2E against local dev server    |

After Phase 4 passes — done. AI stops. Human handles merge.

---

### Phase 1 · Discover (unchanged from original)

Steps:

1. `superpowers:using-superpowers` — check skills
2. `claude-code-setup:claude-automation-recommender` — verify setup
3. `feature-dev:code-explorer` (subagent) — codebase dependency map
4. `greptile` MCP — search for reusable patterns
5. `context7` MCP — pull version-accurate library docs
6. `superpowers:brainstorming` — HARD GATE: approved design required before Phase 2

---

### Phase 2 · Plan (unchanged from original Phase 3)

Steps:

1. `feature-dev:code-architect` (subagent) — package boundary map
2. `frontend-design:frontend-design` (conditional) — UI components only
3. `superpowers:writing-plans` — HARD GATE: approved plan required before Phase 3
4. `claude-md-management:claude-md-improver` — update CLAUDE.md before implementation

---

### Phase 3 · Implement

**Per-task inner loop** (for each task in the plan):

```
1. context7 MCP — pull docs scoped to this task's library
2. Write failing test → confirm RED (if passes immediately, test is wrong → rewrite)
3. Write minimal implementation
4. Run tests
   → if RED: adjust implementation and go back to step 3
   → if stuck 3+ times: invoke superpowers:systematic-debugging before escalating
   → if GREEN: continue
5. code-simplifier:code-simplifier (post-green cleanup)
6. superpowers:requesting-code-review + superpowers:receiving-code-review
7. User confirms: continue to next task or pause session
```

**What does NOT happen during implementation:**

- No git branching, no commits by AI, no push
- No deployment
- No external service calls

---

### Phase 4 · Test

Two parallel branches, all local:

**Branch A — Local quality gates**

```bash
pnpm turbo test
pnpm turbo typecheck
pnpm turbo build
pnpm turbo lint
```

All must exit 0.

**Branch B — E2E (local dev server)**

- Start local dev server
- playwright MCP: navigate to feature entry point
- playwright MCP: take accessibility snapshot
- playwright MCP: exercise critical user path end-to-end; assert expected outcomes
- puppeteer MCP: screenshot key states for human review

**Failure handling:**

- Branch A fail → fix, re-run Branch A only
- Branch B fail → debug the flow, re-run Branch B only
- Both must pass before Phase 4 is complete

After Phase 4 passes — workflow complete. AI outputs a summary. Human handles git.

---

### State file changes

Remove from `.claude/dispatch-state.json`:

- `branch` (no branch management by AI)
- `worktreeDir` (no worktrees)
- `artifacts.vercelProject` (no Vercel)
- `artifacts.deployUrl` (no deployment)
- `artifacts.prUrl` (no PR creation)

Retained fields: `feature`, `description`, `phase`, `step`, `currentTaskIndex`,
`totalTasks`, `completedSteps`, `artifacts.designDoc`, `artifacts.boundaryMap`,
`artifacts.planFile`, `lastUpdated`.

---

### CLAUDE.md changes

Remove the "Known Workflow Gaps" entry that mentions Phase 2 (Isolation) having no
enforcement gate — that phase no longer exists.

---

## Files to rewrite

| File                                       | Action                                   |
| ------------------------------------------ | ---------------------------------------- |
| `.claude/commands/colloquium/feature.md`   | Full rewrite — 4 phases                  |
| `.claude/context/WORKFLOW-DISTILLATION.md` | Full rewrite — 4 phases                  |
| `CLAUDE.md`                                | Remove stale Phase 2 isolation gap entry |

---

## What is explicitly NOT in scope

- Git worktrees
- Vercel (setup, deploy, logs)
- Supabase or any external service checks
- PR creation
- Branch creation or management
- Post-ship maintenance steps (7.1, 7.2)
