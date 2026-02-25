# Colloquium Project — Implement

Run a TDD development session on an existing Colloquium project — implement tests one by one until all 200 pass.

Invoke as:
`/colloquium:project-implement` → lists available projects to continue
`/colloquium:project-implement <slug>` → continue the named project directly

**Version:** v1 — Develop-only skill (split from colloquium:project v3)

> **To bootstrap a new project from scratch,** use `/colloquium:project-initiate` instead.

---

## ENFORCEMENT RULES (read before executing any step)

1. **State after every step.** Write `project-state.json` after EVERY step — not after phases, not in batches.
2. **Banners are mandatory.** Every phase and step displays its start and completion banner.
3. **Hard gates block.** Browser verification is a HARD GATE — `"passes": true` is NEVER written before the browser test passes.
4. **`feature_list.json` is append-only.** Only the `"passes"` field may change. Descriptions, steps, and order are permanently frozen.
5. **AI never touches git beyond this skill's commits.** No branch creation, no push, no PR. Only the per-test implementation commits described below.
6. **Never skip the inner cycle.** All steps (3a through 3f) are mandatory per test. No step may be skipped even if it feels redundant.

---

## Entrypoint: Project Selection

If invoked without a slug, run:

```bash
ls .claude/projects/ 2>/dev/null
```

Collect all subdirectories containing `project-state.json`. For each, read `passingTests`, `totalTests`, and `lastUpdated`.

Display:

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM PROJECT — IMPLEMENT
════════════════════════════════════════════════════════════════
Known projects:
  1. claude-ai-clone     — 34/200 tests passing  (last: 2026-02-20)
  2. my-dashboard        — 12/200 tests passing  (last: 2026-02-19)

Choose a project number to continue:
════════════════════════════════════════════════════════════════
```

If no projects exist, display an error:

```
════════════════════════════════════════════════════════════════
❌ No projects found
════════════════════════════════════════════════════════════════
No project-state.json found in .claude/projects/
Run /colloquium:project-initiate to bootstrap a new project first.
════════════════════════════════════════════════════════════════
```

If a `<slug>` was passed directly: skip the question and proceed immediately.

---

## Session Start

### Step 1 — Read state and migration check

Read `.claude/projects/<slug>/project-state.json`.

> **Note:** If `claude-progress.txt` contains `Run /colloquium:project` (without `-implement`), treat it as `Run /colloquium:project-implement <slug>`. This is the pre-split command — functionally identical, just renamed.

If `frontendPackage`, `apiPackage`, or `frontendPort` are **missing** from `project-state.json`, run this one-time migration before continuing:

1. Run: `cat apps/<slug>/package.json` → read the `"name"` field → this is `frontendPackage`
2. Run: `cat apps/<slug>-api/package.json` → read the `"name"` field → this is `apiPackage`
3. Run: `cat apps/<slug>/package.json` → read the `"dev"` script → extract `--port NNNN` → this is `frontendPort` (default `5173` if no explicit flag)
4. Write all three values into `project-state.json`

This migration runs once per existing project, never again once the fields exist.

---

### Step 2 — Count passing tests and display session banner

```bash
grep -c '"passes": true' .claude/projects/<slug>/feature_list.json
```

Display:

```
════════════════════════════════════════════════════════════════
▶ DEVELOP SESSION — [name]
════════════════════════════════════════════════════════════════
Progress:     [passingTests] / [totalTests] tests passing
Next test:    #[currentTestIndex] — [description]
Session:      #[sessionCount + 1]
════════════════════════════════════════════════════════════════
```

---

### Step 3 — Start dev servers

```bash
pnpm turbo dev --filter=<frontendPackage> --filter=<apiPackage>
```

Wait for both apps to report "ready" in log output before proceeding.

---

### Step 4 — Regression gate

**4a — Vitest suite:**

```bash
pnpm turbo test --filter=<apiPackage>
```

- All green → proceed to 4b
- Any red → **STOP.** Fix the failing test, commit the fix (`fix(<slug>): restore [description]`), re-run until all green. Only then proceed to 4b.

**4b — Browser smoke check:**

Use Playwright MCP to navigate to `http://localhost:<frontendPort>`. Take one screenshot.

- Page loads with any content visible → proceed to Per-Test Inner Cycle
- Blank page or unhandled error boundary → treat as a regression, fix before new work

---

## Per-Test Inner Cycle

Pick the test at `currentTestIndex` from `feature_list.json` (the first one with `"passes": false`).

Display task banner:

```
════════════════════════════════════════════════════════════════
▶ TEST [currentTestIndex + 1] of [totalTests]
════════════════════════════════════════════════════════════════
Description:  [test description]
Category:     [functional | style]
Steps:        [count] steps
════════════════════════════════════════════════════════════════
```

---

### Step 3a — context7: pull library docs

Use `mcp__plugin_context7_context7__resolve-library-id` + `mcp__plugin_context7_context7__query-docs` for the specific library method this test will exercise.

Do not skip even if the library was fetched in a prior session.

---

### Step 3b — TDD: Red → Loop → Green

Use Skill tool: `superpowers:test-driven-development`

Enforced sequence:

1. Write the failing test in the correct test directory for the package being modified
2. Run the test — confirm RED. If it passes immediately, the test is wrong; rewrite it.
3. Write the minimal implementation
4. Run the test:
   - RED → adjust implementation, return to step 3
   - Stuck 3+ consecutive attempts → trigger Step 3c
   - GREEN → continue to step 4
5. Refactor with tests remaining green

---

### Step 3c — Systematic Debugging (only if stuck 3+ consecutive times)

Use Skill tool: `superpowers:systematic-debugging`

If this also fails to resolve: STOP. Return to the spec at `.claude/projects/<slug>/app_spec.txt` for review — the feature may be under-specified.

---

### Step 3d — Code Simplifier (post-green only)

Use Task tool with subagent_type `code-simplifier:code-simplifier`.

Only runs after tests are GREEN. Run tests again after simplification — they must remain GREEN.

---

### Step 3e — Request Code Review

Use Skill tool: `superpowers:requesting-code-review`

Critical issues must be resolved or explicitly accepted before proceeding.

---

### Step 3f — Receive Code Review

Use Skill tool: `superpowers:receiving-code-review`

Never implement feedback blindly. Push back with reasoning if suggestions violate YAGNI or monorepo package boundary rules.

---

## After Each Test: Browser Verification + State Update

### Browser Verification (HARD GATE)

Use Playwright MCP to execute the test steps literally through the UI:

- Navigate to the app
- Perform each step in the `"steps"` array
- Take a screenshot at each key state
- Assert the expected outcome

> ⚠️ HARD GATE: Do NOT set `"passes": true` until browser verification passes. No exceptions.

---

### State Update (6 steps, in order)

1. Set `"passes": true` for this test in `feature_list.json`
2. Commit:
   ```bash
   git add .
   git commit -m "feat(<slug>): implement [test description] — test #[index] passing"
   ```
3. Append to `claude-progress.txt`:
   ```
   [x] Test #[index]: [description] → PASSING
   ```
4. Update `project-state.json`:
   - Increment `currentTestIndex`
   - Increment `passingTests`
   - Update `lastUpdated`

5. Display:

```
════════════════════════════════════════════════════════════════
✅ Test [N] complete — [description]
════════════════════════════════════════════════════════════════
Progress:  [passingTests] / [totalTests] passing
State saved.
════════════════════════════════════════════════════════════════
```

6. Ask: "Continue to test [N+1] or stop here?"
   - Continue → next test inner cycle
   - Stop → display session-end banner:

```
════════════════════════════════════════════════════════════════
⏸ SESSION PAUSED — [name]
════════════════════════════════════════════════════════════════
Progress:  [passingTests] / [totalTests] tests passing
State saved: .claude/projects/<slug>/project-state.json
Resume with: /colloquium:project-implement <slug>
════════════════════════════════════════════════════════════════
```

---

## Project Complete

When `passingTests === totalTests`:

```
════════════════════════════════════════════════════════════════
🎉 PROJECT COMPLETE — [name]
════════════════════════════════════════════════════════════════
All 200 / 200 tests passing.
Sessions: [sessionCount]
State preserved at: .claude/projects/<slug>/project-state.json

Human handles merge / deployment.
════════════════════════════════════════════════════════════════
```
