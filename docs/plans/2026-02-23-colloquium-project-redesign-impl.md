# colloquium:project Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fully rewrite `.claude/commands/colloquium/project.md` to support two flows — Bootstrap (new project) and Develop (continue) — with all state under `.claude/projects/<slug>/` and `dispatch-state.json` retired.

**Architecture:** Single skill file with a mandatory entrypoint that always asks "new or continue". Flow 1 (Bootstrap) runs a deep Q&A → generates `app_spec.txt` + `feature_list.json` → scaffolds monorepo app dirs → commits skeleton. Flow 2 (Develop) reads `project-state.json`, verifies regressions, picks next failing test, runs per-test TDD cycle, updates state.

**Tech Stack:** Markdown skill file (`.claude/commands/colloquium/project.md`), JSON state files, shell commands via Bash tool, existing superpowers skills (TDD, systematic-debugging, code-simplifier, code-reviewer), turborepo / pnpm workspace.

**Design doc:** `docs/plans/2026-02-23-colloquium-project-redesign-design.md`

---

## Task 1: Create `.claude/projects/` directory

**Files:**

- Create: `.claude/projects/.gitkeep`

**Step 1: Create the directory placeholder**

```bash
mkdir -p .claude/projects && touch .claude/projects/.gitkeep
```

**Step 2: Verify**

```bash
ls -la .claude/projects/
```

Expected: `.gitkeep` file present.

**Step 3: Commit**

```bash
git add .claude/projects/.gitkeep
git commit -m "chore: create .claude/projects/ directory for per-project state"
```

---

## Task 2: Write the new `project.md` — skeleton + enforcement rules

**Files:**

- Rewrite: `.claude/commands/colloquium/project.md`

**Step 1: Read the current file to understand its length and structure**

Read `.claude/commands/colloquium/project.md` in full. Note the existing enforcement rules block — keep the spirit, update the wording.

**Step 2: Write the new file from scratch**

Replace the entire file with the following content (Tasks 3–8 will append each section in order):

```markdown
# Colloquium Project

Manage standalone projects inside the Colloquium monorepo — bootstrap new ones or continue development on existing ones.

Invoke as:
/colloquium:project → prompts new or continue
/colloquium:project <slug> → continue the named project directly

**Version:** v3 — Bootstrap + Develop flows, per-project state under .claude/projects/

---

## ENFORCEMENT RULES (read before executing any step)

1. **Always ask first.** Every invocation starts at Phase 0. No silent assumptions about new vs. continue.
2. **State after every step.** Write `project-state.json` after EVERY step — not after phases, not in batches.
3. **Banners are mandatory.** Every phase and step displays its start and completion banner.
4. **Hard gates block.** Steps marked HARD GATE loop until the gate condition is met — do NOT proceed without it.
5. **feature_list.json is append-only.** Only the `"passes"` field may be changed. Descriptions, steps, and ordering are NEVER modified.
6. **AI never touches git beyond reading status.** No branch creation, no push, no PR — the human controls all git operations. The ONE exception: the initial scaffold commit in Phase B3 (explicitly described below).

---
```

**Step 3: Verify the file was written**

Read back `.claude/commands/colloquium/project.md` and confirm header + enforcement rules are present.

**Step 4: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(colloquium): begin project.md rewrite — skeleton + enforcement rules"
```

---

## Task 3: Append Phase 0 — Entrypoint, migration, and routing

**Files:**

- Modify: `.claude/commands/colloquium/project.md` (append)

**Step 1: Append Phase 0 to the file**

````markdown
## Phase 0: Entrypoint (always runs first)

---

### Step 0.1 — Scan for existing projects

```bash
ls .claude/projects/ 2>/dev/null
```
````

Collect all subdirectories that contain a `project-state.json`. Build a list: `known_projects`.

---

### Step 0.2 — Migration check

If `.claude/dispatch-state.json` exists:

```
⚠️  Legacy dispatch-state.json detected.
```

- If it contains `"version": 2` and a `"feature"` field: offer to migrate it.
  - Ask: "Migrate dispatch-state.json to .claude/projects/<feature>/project-state.json and delete it?"
  - If yes: create `.claude/projects/<feature>/project-state.json` with the legacy data mapped to v1 schema, then delete `.claude/dispatch-state.json`.
  - If no: leave it; it will not affect this workflow.
- If it is v1 or corrupt: display "Discarding malformed dispatch-state.json" and delete it.

---

### Step 0.3 — Ask: new or continue?

Display:

```
════════════════════════════════════════════════════════════════
🚀 COLLOQUIUM PROJECT
════════════════════════════════════════════════════════════════
```

**If `known_projects` is empty:** Skip directly to Flow 1 (Bootstrap). No need to ask.

**If `known_projects` has entries:** Display list with progress summaries:

```
Known projects:
  1. claude-ai-clone     — 34/200 tests passing  (last session: 2026-02-20)
  2. my-dashboard        — 12/200 tests passing  (last session: 2026-02-19)

  n. Start a new project

Choose:
```

Wait for user input.

- If user picks an existing project number → **Flow 2: Develop** with that project.
- If user picks "new" → **Flow 1: Bootstrap**.
- If `/colloquium:project <slug>` was invoked with a slug that matches a known project → skip this question and go directly to Flow 2.

---

````

**Step 2: Verify the section reads coherently**

Re-read the file. Confirm: entry always routes to Flow 1 or Flow 2. No path exits without a route.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(colloquium): add Phase 0 — entrypoint, migration, routing"
````

---

## Task 4: Append Flow 1 Phase B1 — Q&A blocks

**Files:**

- Modify: `.claude/commands/colloquium/project.md` (append)

**Step 1: Append the Q&A phase**

```markdown
---
## Flow 1: Bootstrap (new project)

### Phase B1: Q&A — 5 topic blocks

Present questions **block by block** (not one at a time for every individual question). Use `AskUserQuestion` tool with multiple related questions per block where possible, or ask as a grouped freeform question.

After each block, confirm understanding before moving to the next.
---

#### Block 1 — Identity

Ask:

1. What is the app's name? (This becomes the slug for folder names — use kebab-case, e.g. `claude-ai-clone`)
2. Describe the app in one sentence. What does it do?
3. Who are the primary users?

Record: `slug`, `name`, `overview`, `users`.

---

#### Block 2 — Tech Stack

Ask:

1. Frontend framework? (React/Vite, Next.js, other — or none)
2. Styling approach? (Tailwind CSS, CSS Modules, other)
3. State management? (React context, Zustand, Redux, none)
4. Backend runtime? (Node.js/Express, Hono, none — pure frontend)
5. Database? (SQLite, PostgreSQL, none)
6. Authentication? (none/single default user, JWT, OAuth, other)
7. Real-time requirements? (SSE, WebSockets, polling, none)

Record: `techStack` object with all fields.

---

#### Block 3 — Features

Ask:

1. List the 5–10 main feature areas of the app (freeform — user can list them in any format).
2. For the list received: which are MVP (must-have for first version) vs. nice-to-have?
3. Any content-rendering requirements? (Markdown, code syntax highlighting, LaTeX, diagrams)
4. Mobile/responsive requirements? (mobile-first, desktop-only, both)
5. Any third-party API integrations? (list them)

Record: `features` array with `name`, `priority` (mvp/nice-to-have), `description` for each.

---

#### Block 4 — Design

Ask:

1. Layout pattern? (sidebar + main chat, dashboard with widgets, full-width content, other)
2. Light mode, dark mode, or both?
3. Any design reference, brand colors, or specific aesthetic to match?

Record: `design` object with `layout`, `colorMode`, `reference`.

---

#### Block 5 — Constraints

Ask:

1. Any hard port requirements? (e.g., "frontend must run on port 5173")
2. How are API keys/secrets provided? (environment variables in `.env`, from a file path like `/tmp/api-key`, other)
3. Any known performance, scale, or deployment constraints?

Record: `constraints` object.

---

#### Block 1–5 review banner

After all 5 blocks:
```

════════════════════════════════════════════════════════════════
📋 Q&A Complete — Review
════════════════════════════════════════════════════════════════
App: [name] ([slug])
Purpose: [overview]
Stack: [frontend] + [backend] + [database]
Auth: [auth]
Features: [count] areas — [count] MVP, [count] nice-to-have
Layout: [layout], [colorMode]
════════════════════════════════════════════════════════════════

```

Ask: "Does this look correct? Any corrections before I generate the spec?"

If corrections: update the relevant fields and re-display the banner. Loop until confirmed.

---
```

**Step 2: Verify block structure**

Re-read the section. Confirm: all 5 spec sections (overview, tech stack, features, design, constraints) are covered. Every question maps to a recorded field.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(colloquium): add Flow 1 Phase B1 — Q&A blocks"
```

---

## Task 5: Append Flow 1 Phase B2 — Spec generation

**Files:**

- Modify: `.claude/commands/colloquium/project.md` (append)

**Step 1: Append Phase B2**

````markdown
### Phase B2: Spec Generation — HARD GATE

> ⚠️ HARD GATE: Do NOT proceed to Phase B3 until all three artifacts are written to disk.

Generate all three artifacts atomically from the Q&A answers. For any field not explicitly answered, use sensible defaults that match the stated tech stack and feature set.

---

#### Artifact 1: `app_spec.txt`

Write to: `.claude/projects/<slug>/app_spec.txt`

The file MUST follow this XML structure exactly (all sections required):

```xml
<project_specification>
  <project_name>[name from Q&A]</project_name>

  <overview>
    [2–4 sentence description of the app, its purpose, and target users]
  </overview>

  <technology_stack>
    <frontend>
      <framework>[from Q&A]</framework>
      <styling>[from Q&A]</styling>
      <state_management>[from Q&A]</state_management>
      <routing>[inferred from framework choice]</routing>
      <port>Only launch on port [from constraints, or 5173 default]</port>
    </frontend>
    <backend>
      <runtime>[from Q&A, or NONE if frontend-only]</runtime>
      <database>[from Q&A, or NONE]</database>
      <port>[5001 default if backend exists]</port>
    </backend>
    <auth>[from Q&A]</auth>
    <realtime>[from Q&A]</realtime>
  </technology_stack>

  <prerequisites>
    <environment_setup>
      [List: what must exist before running the app — API keys, env vars, pre-installed deps]
    </environment_setup>
  </prerequisites>

  <core_features>
    [One XML element per feature area. For each MVP feature, include detailed sub-bullets.
     For nice-to-have features, include a shorter summary. Example:]
    <[feature_slug]>
      - [specific capability 1]
      - [specific capability 2]
      ...
    </[feature_slug]>
  </core_features>

  <database_schema>
    <tables>
      [One element per table. List all columns with types and purpose.]
    </tables>
  </database_schema>

  <api_endpoints_summary>
    [Group endpoints by domain. List method + path + one-line description for each.]
  </api_endpoints_summary>

  <ui_layout>
    <main_structure>[describe the top-level layout]</main_structure>
    [One element per major UI panel or section]
  </ui_layout>

  <design_system>
    <color_palette>[primary, background, surface, text, borders]</color_palette>
    <typography>[font stack, heading weights, body size]</typography>
    <components>
      [Key reusable components with their visual spec]
    </components>
    <animations>[transition timing, key animations]</animations>
  </design_system>

  <key_interactions>
    [2–4 named interaction flows, each as a numbered step sequence]
  </key_interactions>

  <implementation_steps>
    [8–10 numbered steps in priority order. Each step has a title and task list.]
  </implementation_steps>

  <success_criteria>
    <functionality>[list]</functionality>
    <user_experience>[list]</user_experience>
    <technical_quality>[list]</technical_quality>
    <design_polish>[list]</design_polish>
  </success_criteria>
</project_specification>
```
````

---

#### Artifact 2: `feature_list.json`

Write to: `.claude/projects/<slug>/feature_list.json`

Rules:

- **200 test cases total** — 100 `"functional"` + 100 `"style"`
- Ordered by priority: foundational/infrastructure first, UI polish last
- Every test starts with `"passes": false`
- At least 25 tests must have 10+ steps
- Cover every feature in `app_spec.txt` exhaustively — no feature area may be omitted
- `"steps"` must be concrete enough that a browser-automation agent can execute them literally

Format:

```json
[
  {
    "category": "functional",
    "description": "Backend server starts and health check endpoint responds with 200 OK",
    "steps": [
      "Step 1: Run init.sh or pnpm turbo dev to start the server",
      "Step 2: Send GET request to /api/health",
      "Step 3: Verify response status is 200",
      "Step 4: Verify response contains { status: 'ok' }"
    ],
    "passes": false
  }
]
```

**CRITICAL:** Once written, `feature_list.json` is immutable except for the `"passes"` field. Future sessions may ONLY change `false` → `true`. Never remove tests, never edit descriptions or steps.

---

#### Artifact 3: `claude-progress.txt`

Write to: `.claude/projects/<slug>/claude-progress.txt`

Initialize with:

```
================================================================================
CLAUDE SESSION PROGRESS - Session 1 (Bootstrap)
================================================================================

Date: [today's date]
Agent: BOOTSTRAP (Session 1 — project initialization)

================================================================================
COMPLETED TASKS
================================================================================

[x] Ran Q&A phase — gathered requirements across 5 blocks
[x] Generated app_spec.txt — full XML specification
[x] Generated feature_list.json — 200 test cases (all passes: false)
[x] Scaffolded monorepo structure (see below)

================================================================================
PROJECT STRUCTURE
================================================================================

[List the created dirs and key files here after Phase B3 completes]

================================================================================
NEXT SESSION
================================================================================

Run /colloquium:project and choose "continue" → [slug]
Start servers with: pnpm turbo dev
Pick first failing test from feature_list.json (index 0)
```

---

#### Hard gate check

After writing all three files, display:

```
════════════════════════════════════════════════════════════════
✅ Spec Generation Complete
════════════════════════════════════════════════════════════════
  app_spec.txt         ✅  (.claude/projects/<slug>/app_spec.txt)
  feature_list.json    ✅  200 tests  (0 passing)
  claude-progress.txt  ✅  Session 1 initialized
════════════════════════════════════════════════════════════════
```

Verify all three files exist on disk using Bash `ls`. If any file is missing, write it before proceeding.

---

````

**Step 2: Verify spec format coverage**

Re-read this section. Confirm the XML template covers: overview, tech stack, prerequisites, core features, DB schema, API endpoints, UI layout, design system, key interactions, implementation steps, success criteria. All present.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(colloquium): add Flow 1 Phase B2 — spec and feature_list generation"
````

---

## Task 6: Append Flow 1 Phase B3 — Monorepo scaffold

**Files:**

- Modify: `.claude/commands/colloquium/project.md` (append)

**Step 1: Append Phase B3**

````markdown
### Phase B3: Monorepo Scaffold

Create the actual app directories and wire them into the monorepo.

---

#### Step B3.1 — Create app directories

Based on the tech stack from Q&A, create the following structure:

**Always create:**

```bash
mkdir -p apps/<slug>/src
```
````

**If backend requested:**

```bash
mkdir -p apps/<slug>-api/src
```

**If shared types are needed (backend + frontend share schemas):**

```bash
mkdir -p packages/<slug>-types/src
```

---

#### Step B3.2 — Write config files

For each created directory, write the minimum required config files for the chosen tech stack. Use the framework's standard conventions.

**Frontend (React + Vite example):**

- `apps/<slug>/package.json` — name: `@colloquium/<slug>`, scripts: dev/build/preview/typecheck
- `apps/<slug>/tsconfig.json` — extends `@colloquium/tsconfig/base`
- `apps/<slug>/vite.config.ts` — standard Vite config with the chosen port
- `apps/<slug>/tailwind.config.ts` — if Tailwind selected
- `apps/<slug>/index.html` — Vite entry point
- `apps/<slug>/src/main.tsx` — React root
- `apps/<slug>/src/App.tsx` — placeholder root component

**Backend (Node/Express example):**

- `apps/<slug>-api/package.json` — name: `@colloquium/<slug>-api`, scripts: dev/build/start/typecheck
- `apps/<slug>-api/tsconfig.json` — extends `@colloquium/tsconfig/base`
- `apps/<slug>-api/src/index.ts` — Express server with a `/api/health` endpoint

**Types package (if created):**

- `packages/<slug>-types/package.json` — name: `@colloquium/<slug>-types`
- `packages/<slug>-types/src/index.ts` — placeholder exports
- `packages/<slug>-types/tsconfig.json`

---

#### Step B3.3 — Install dependencies

```bash
pnpm install
```

Verify it completes without errors. If errors occur, fix them before proceeding.

---

#### Step B3.4 — Verify turborepo picks up new packages

```bash
pnpm turbo build --filter=<slug>...
```

Expected: build completes (even if it's just an empty app). If it fails: fix config files before proceeding.

---

#### Step B3.5 — Write `project-state.json`

Write to: `.claude/projects/<slug>/project-state.json`

```json
{
  "version": 1,
  "slug": "<slug>",
  "name": "<name from Q&A>",
  "appDir": "apps/<slug>",
  "apiDir": "apps/<slug>-api",
  "packages": ["packages/<slug>-types"],
  "specFile": ".claude/projects/<slug>/app_spec.txt",
  "featureListFile": ".claude/projects/<slug>/feature_list.json",
  "progressFile": ".claude/projects/<slug>/claude-progress.txt",
  "totalTests": 200,
  "passingTests": 0,
  "currentTestIndex": 0,
  "phase": "develop",
  "lastUpdated": "<current ISO timestamp>",
  "sessionCount": 1
}
```

Omit `"apiDir"` if no backend was created. Omit empty `"packages"` array entries.

---

#### Step B3.6 — Update `claude-progress.txt`

Fill in the `PROJECT STRUCTURE` section with the actual directories and key files just created.

---

#### Step B3.7 — Initial git commit (EXCEPTION to the no-git rule)

This is the ONE place the skill touches git directly — to create the initial skeleton commit:

```bash
git add apps/<slug>/ apps/<slug>-api/ packages/<slug>-types/ .claude/projects/<slug>/
git commit -m "feat(<slug>): scaffold monorepo structure — bootstrap complete"
```

---

#### Bootstrap complete banner

```
════════════════════════════════════════════════════════════════
✅ BOOTSTRAP COMPLETE — [name]
════════════════════════════════════════════════════════════════
App dir:      apps/<slug>/
API dir:      apps/<slug>-api/        (if applicable)
State:        .claude/projects/<slug>/project-state.json
Tests:        0 / 200 passing
Next step:    /colloquium:project → continue → <slug>
              pnpm turbo dev  (to start all apps)
════════════════════════════════════════════════════════════════
```

---

````

**Step 2: Verify scaffold logic**

Re-read this section. Confirm: directory creation → config files → pnpm install → turbo build check → project-state.json → commit. No step skipped.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(colloquium): add Flow 1 Phase B3 — monorepo scaffold"
````

---

## Task 7: Append Flow 2 — Develop (continue)

**Files:**

- Modify: `.claude/commands/colloquium/project.md` (append)

**Step 1: Append Flow 2**

````markdown
---

## Flow 2: Develop (continue existing project)

### Session Start

1. Read `.claude/projects/<slug>/project-state.json`.
2. Count passing tests in `feature_list.json`:
   ```bash
   grep -c '"passes": true' .claude/projects/<slug>/feature_list.json
   ```
````

3. Display session start banner:

```
════════════════════════════════════════════════════════════════
▶ DEVELOP SESSION — [name]
════════════════════════════════════════════════════════════════
Progress:     [passingTests] / [totalTests] tests passing
Next test:    #[currentTestIndex] — [description]
Session:      #[sessionCount + 1]
════════════════════════════════════════════════════════════════
```

4. Run all apps in dev mode:
   ```bash
   pnpm turbo dev
   ```
   Wait for all apps to report "ready" before proceeding.

---

### Regression Verification (mandatory before new work)

Pick 1–2 of the most recently-passing tests from `feature_list.json`. Verify them via browser automation (Playwright MCP):

- Navigate to the app in a real browser
- Execute the test steps literally
- Take a screenshot at the final step

**If a regression is found:**

- Set that test's `"passes"` back to `false` in `feature_list.json`
- Fix the regression BEFORE implementing any new feature
- Commit the fix: `fix(<slug>): restore [description]`
- Re-verify before moving to new work

---

### Per-Test Inner Cycle

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

#### Step 3a — context7: pull library docs

Use `mcp__plugin_context7_context7__resolve-library-id` + `mcp__plugin_context7_context7__query-docs` for the specific library method this test will exercise.

Do not skip even if the library was fetched in a prior session.

---

#### Step 3b — TDD: Red → Loop → Green

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

#### Step 3c — systematic-debugging (only if stuck 3+ consecutive times)

Use Skill tool: `superpowers:systematic-debugging`

If this also fails to resolve: STOP. Return to Phase B2 spec review — the feature may be under-specified.

---

#### Step 3d — code-simplifier: post-green cleanup

Use Task tool with subagent_type `code-simplifier:code-simplifier`.

Only runs after tests are GREEN. Run tests again after simplification — they must remain GREEN.

---

#### Step 3e — code review: request

Use Skill tool: `superpowers:requesting-code-review`

Critical issues must be resolved or explicitly accepted before proceeding.

---

#### Step 3f — code review: receive

Use Skill tool: `superpowers:receiving-code-review`

Never implement feedback blindly. Push back with reasoning if suggestions violate YAGNI or monorepo package boundary rules.

---

### After each test: Browser verification + state update

**Browser verification (MANDATORY):**

Use Playwright MCP to execute the test steps literally through the UI:

- Navigate to the app
- Perform each step in `"steps"` array
- Take a screenshot at each key state
- Assert the expected outcome

Only after browser verification passes:

1. Set `"passes": true` for this test in `feature_list.json`
2. Commit:
   ```bash
   git add .
   git commit -m "feat(<slug>): implement [test description] — test #[index] passing"
   ```
3. Update `claude-progress.txt` — append a new entry for this session:
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
Resume with: /colloquium:project
════════════════════════════════════════════════════════════════
```

---

### Project Complete

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

---

````

**Step 2: Verify the develop loop is complete**

Re-read the section. Trace the path: session start → regression check → test selection → 3a–3f cycle → browser verify → state update → continue/stop prompt. Every branch handled.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(colloquium): add Flow 2 — Develop session loop"
````

---

## Task 8: Delete `dispatch-state.json` and clean up references

**Files:**

- Delete: `.claude/dispatch-state.json`
- Verify: no other file in `.claude/` references `dispatch-state.json` directly

**Step 1: Check for references**

```bash
grep -r "dispatch-state" .claude/ --include="*.md" --include="*.json"
```

**Step 2: Delete the file**

```bash
rm .claude/dispatch-state.json
```

**Step 3: Check CLAUDE.md for outdated references**

Read `CLAUDE.md`. If it mentions `dispatch-state.json` anywhere, remove those references. The file should still reference `/colloquium:project` as the workflow entry — just not the JSON filename directly.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: retire dispatch-state.json — state now lives under .claude/projects/"
```

---

## Task 9: Final end-to-end review

**Files:**

- Read: `.claude/commands/colloquium/project.md` (full)

**Step 1: Read the full rewritten skill file**

Read the entire `.claude/commands/colloquium/project.md` from top to bottom.

**Step 2: Trace Flow 1 (Bootstrap)**

Walk through the file as if you are an AI following it for the first time on a new project called "todo-app":

- Does Phase 0 correctly detect no existing projects and go to Bootstrap?
- Does Phase B1 cover all Q&A blocks?
- Does Phase B2 produce all 3 artifacts with the correct paths?
- Does Phase B3 create dirs, install, verify build, write state, commit?
- Is the bootstrap-complete banner shown?

**Step 3: Trace Flow 2 (Develop)**

Walk through as if continuing "todo-app" in session 2:

- Does Phase 0 detect `todo-app` in `.claude/projects/` and offer it?
- Does the session start banner show correct progress?
- Does the regression check run before new work?
- Does the test inner cycle (3a–3f) run in order?
- Is browser verification mandatory before marking passing?
- Does state update correctly after each test?
- Does the stop/continue prompt work?

**Step 4: Check enforcement rules are respected throughout**

Verify:

- Every phase/step has start and completion banners
- State is written after every step (not batched)
- feature_list.json is only ever modified in the `"passes"` field
- AI touches git ONLY in Step B3.7

**Step 5: Final commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "feat(colloquium): finalize project.md rewrite — Bootstrap + Develop flows complete"
```

---

## Verification Summary

After all tasks are complete, verify:

```bash
# 1. New skill file exists and is non-empty
wc -l .claude/commands/colloquium/project.md

# 2. dispatch-state.json is gone
ls .claude/dispatch-state.json 2>&1   # should say: No such file or directory

# 3. projects directory exists
ls .claude/projects/

# 4. No dangling references to dispatch-state.json
grep -r "dispatch-state" . --include="*.md" --include="*.json" --exclude-dir=node_modules --exclude-dir=docs

# 5. Git log shows clean incremental commits
git log --oneline -10
```
