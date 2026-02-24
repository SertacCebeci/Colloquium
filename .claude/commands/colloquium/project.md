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

## Phase 0: Entrypoint (always runs first)

---

### Step 0.1 — Scan for existing projects

```bash
ls .claude/projects/ 2>/dev/null
```

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

## Flow 1: Bootstrap (new project)

### Phase B1: Q&A — 5 topic blocks

Present questions **block by block** (not one at a time for every individual question). Use `AskUserQuestion` tool with multiple related questions per block where possible, or ask as a grouped freeform question.

After each block, **summarize what you understood** before moving to the next — do not move on silently.

---

#### Block 1 — Vision

Goal: understand the product and who it's for before touching anything technical.

Ask:

1. What is the app's name? (This becomes the slug — use kebab-case, e.g. `claude-ai-clone`)
2. Describe it in one sentence: what does it do and who is it for?
3. What specific pain does it solve? What does the user currently do instead?
4. What makes it different from existing alternatives?

Record: `slug`, `name`, `overview`, `problem`, `differentiator`, `users`.

---

#### Block 2 — Core User Journey

Goal: understand what users actually do in the app, screen by screen, before making any feature list.

Ask:

1. Walk me through what a user does the moment they open the app — step by step from first load to their first win.
2. What are the 3–5 most important actions a user takes? (e.g. "create a project", "send a message")
3. What screens or pages does the app have? List them. (e.g. "Login, Dashboard, Settings, Detail view")
4. For each screen: what's the main content and what can the user do there?
5. What does "success" look like — what would make a user think "this is exactly what I needed"?

Record: `coreJourney` (step-by-step narrative), `keyActions`, `screens` array where each entry has `name`, `route`, `purpose`, `elements` (list of UI elements on that screen).

---

#### Block 3 — Features & Content

Goal: turn the journey into a prioritized feature list; surface content and integration complexity.

Based on the screens from Block 2, ask:

1. Which features are MVP (must ship in v1) vs. nice-to-have? (Reference the specific screens they mentioned)
2. Any content-rendering needs? (Markdown, code highlighting, LaTeX, file uploads, image display, diagrams)
3. Notifications? (in-app, email, push — or none)
4. Any third-party API integrations? (list them and how each is used)
5. Mobile/responsive requirements? (mobile-first, desktop-only, both)

Record: `features` array — each entry has `name`, `priority` (mvp/nice-to-have), `description`, `screens` (which screens it touches). Also record `content`, `notifications`, `integrations`, `responsive`.

---

#### Block 4 — Tech Stack

Ask AFTER understanding the product — stack choices should follow from the requirements uncovered above.

1. Frontend framework? (React/Vite, Next.js, other — or none)
2. Styling? (Tailwind CSS, CSS Modules, other)
3. State management? (Zustand, React context, none)
4. Backend runtime? (Hono, Node.js/Express, none — pure frontend)
5. Database? (SQLite + Prisma, PostgreSQL + Prisma, none)
6. Authentication? (none/single default user, JWT + HTTP-only cookies, OAuth, other)
7. Real-time? (SSE, WebSockets, polling, none)

Record: `techStack` object with all fields.

---

#### Block 5 — Design & Constraints

Ask:

1. Layout pattern? (sidebar + main, top nav + content, dashboard with panels, full-width, other)
2. Light mode, dark mode, or both?
3. Any design reference, brand colors, or specific aesthetic? (e.g. "minimal like Linear", "dark and dense like Raycast", "clean like Vercel dashboard")
4. Hard port requirements? (e.g. "frontend must be on port 5173")
5. How are API keys/secrets provided? (`.env` file, a path like `/tmp/api-key`, hardcoded in dev, other)
6. Any performance, scale, or deployment constraints worth noting?

Record: `design` object with `layout`, `colorMode`, `reference`, `aesthetic`. Record `constraints` object.

---

#### Block 1–5 review banner

After all 5 blocks:

```
════════════════════════════════════════════════════════════════
📋 Q&A Complete — Review
════════════════════════════════════════════════════════════════
App:      [name] ([slug])
Purpose:  [overview]
Problem:  [problem statement]
Users:    [who they are]
Screens:  [count] — [list them by name]
Features: [count] — [count] MVP, [count] nice-to-have
Stack:    [frontend] + [backend] + [database]
Auth:     [auth approach]
Layout:   [layout], [colorMode]
════════════════════════════════════════════════════════════════
```

Ask: "Does this look correct? Any corrections before I generate the spec?"

If corrections: update the relevant fields and re-display the banner. Loop until confirmed.

---

### Phase B2: Spec Generation — HARD GATE

> ⚠️ HARD GATE: Do NOT proceed to Phase B3 until all three artifacts are written to disk.

Generate all three artifacts atomically from the Q&A answers. For any field not explicitly answered, use sensible defaults that match the stated tech stack and feature set.

---

#### Artifact 1: `app_spec.txt`

Write to: `.claude/projects/<slug>/app_spec.txt`

The file MUST follow this XML structure exactly (all sections required). Be exhaustive — vague specs produce vague tests.

```xml
<project_specification>
  <project_name>[name from Q&A]</project_name>
  <slug>[slug]</slug>

  <overview>
    [2–4 sentences: what the app does, who it's for, what problem it solves]
  </overview>

  <problem_statement>
    [1–2 sentences: the specific pain this app addresses and what users do without it]
  </problem_statement>

  <users>
    <primary>[Who they are, their goals, their frustrations]</primary>
  </users>

  <technology_stack>
    <frontend>
      <framework>[from Q&A]</framework>
      <styling>[from Q&A]</styling>
      <state_management>[from Q&A]</state_management>
      <routing>[inferred from framework — e.g. React Router v6, TanStack Router, Next.js App Router]</routing>
      <port>Only launch on port [from constraints, or 5173 default]</port>
    </frontend>
    <backend>
      <runtime>[from Q&A, or NONE if frontend-only]</runtime>
      <database>[from Q&A, or NONE]</database>
      <port>[5001 default if backend exists, or NONE]</port>
    </backend>
    <auth>[from Q&A — e.g. JWT with HTTP-only cookies, or none]</auth>
    <realtime>[from Q&A — e.g. SSE, WebSockets, or none]</realtime>
  </technology_stack>

  <prerequisites>
    <environment_setup>
      [Enumerate everything that must exist before `pnpm turbo dev` works:
       - Required .env variables and what they contain
       - External services that must be running
       - Pre-installed system dependencies]
    </environment_setup>
  </prerequisites>

  <screens>
    [One element per screen/page from the Q&A journey. Cover ALL screens — Claude will generate
     test cases for each one. Omitting a screen = no tests for it.]

    <screen name="[Screen Name]" route="[/path]">
      <purpose>[What this screen is for — one sentence]</purpose>
      <elements>
        - [UI element and its behavior — be specific, e.g. "Search input: filters list on keystroke"]
        - [UI element and its behavior]
      </elements>
      <empty_state>[What the user sees when there is no data yet]</empty_state>
      <error_state>[What the user sees if an operation fails]</error_state>
      <loading_state>[Skeleton, spinner, or placeholder shown while data loads]</loading_state>
    </screen>
  </screens>

  <user_flows>
    [2–5 named flows that cross screen boundaries. Each describes a complete user goal
     from start to finish, including the error path. These become multi-step test cases.]

    <flow name="[Flow Name — e.g. 'User registers and sends first message']">
      1. [User action]
      2. [System response / UI change]
      3. [User action]
      ...
      Success: [What the completed state looks like]
      Error path: [What happens if a step fails — what the user sees and can do]
    </flow>
  </user_flows>

  <core_features>
    [One element per feature. MVP features get full detail. Nice-to-have features get a summary.
     Include validation rules and edge cases — these feed directly into test step assertions.]

    <feature name="[Feature Name]" priority="mvp|nice-to-have" screens="[comma-separated screen names]">
      <description>[What this feature does and why it matters]</description>
      <capabilities>
        - [Specific thing the feature can do]
        - [Specific thing the feature can do]
      </capabilities>
      <validation_rules>
        - [e.g. "Email must be a valid email format"]
        - [e.g. "Password minimum 8 characters"]
      </validation_rules>
      <edge_cases>
        - [e.g. "Submitting form while request is in flight: button disabled, spinner shown"]
        - [e.g. "Session expires mid-action: redirect to login with 'Session expired' toast"]
      </edge_cases>
    </feature>
  </core_features>

  <database_schema>
    <tables>
      [One element per table. Write full column definitions — type, nullable, default, purpose.
       Include all foreign keys and the indexes that matter for performance.]

      <table name="[table_name]">
        id           INTEGER  PRIMARY KEY AUTOINCREMENT
        [col]        TEXT     NOT NULL                          -- [purpose]
        [col]        TEXT     REFERENCES [table](id)           -- [purpose]
        [col]        BOOLEAN  NOT NULL DEFAULT false           -- [purpose]
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

        Indexes:
          - [column]: [reason — e.g. "user_id: frequent filter by owner"]

        Relationships:
          - [e.g. "belongs to User via user_id"]
          - [e.g. "has many Messages"]
      </table>
    </tables>
  </database_schema>

  <api_endpoints>
    [Group by domain. For each endpoint: method, path, one-line purpose, key request fields,
     key response fields. Also list which auth level is required (public/authenticated).]

    <group name="[Domain — e.g. Auth, Workspaces, Messages]">
      POST   /api/[resource]          [public|auth]  — [purpose]
                                        Body:     { [required fields with types] }
                                        Response: { [key fields] }

      GET    /api/[resource]          [auth]         — [purpose]
                                        Response: { [key fields] }

      GET    /api/[resource]/:id      [auth]         — [purpose]
      PUT    /api/[resource]/:id      [auth]         — [purpose]
      DELETE /api/[resource]/:id      [auth]         — [purpose]

      Error responses: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 500 server error
    </group>
  </api_endpoints>

  <ui_layout>
    <main_structure>[Top-level layout description — e.g. "Fixed sidebar (240px) + scrollable main content area"]</main_structure>
    <[panel_name]>
      [Contents, scroll behavior, dimensions, responsive behavior, z-index if relevant]
    </[panel_name]>
  </ui_layout>

  <design_system>
    <color_palette>
      Primary:     [hex] — buttons, links, active states
      Background:  [hex] — page background
      Surface:     [hex] — cards, panels, inputs
      Text:        [hex] — body copy
      Text muted:  [hex] — secondary labels, placeholders
      Border:      [hex] — dividers, input borders
      Accent:      [hex] — highlights, badges
      Error:       [hex] — error states, destructive actions
      Success:     [hex] — confirmation, success toasts
    </color_palette>
    <typography>
      Font family:  [stack — e.g. Inter, system-ui, sans-serif]
      Heading (h1): [size / weight — e.g. 24px / 700]
      Heading (h2): [size / weight]
      Body:         [size / weight — e.g. 14px / 400]
      Small:        [size / weight — e.g. 12px / 400]
      Code:         [monospace stack — e.g. JetBrains Mono, monospace]
    </typography>
    <components>
      [Key reusable components with variants, states, and behavioral notes.
       Enough detail that an implementation agent can build them without guessing.]

      <Component name="[ComponentName]">
        Variants: [e.g. primary, secondary, ghost, destructive]
        States:   [default, hover, focus, active, disabled, loading]
        Notes:    [Any behavioral or visual detail worth calling out]
      </Component>
    </components>
    <animations>
      Micro (hover/focus):  [duration — e.g. 100ms ease-out]
      Transitions (panels): [duration — e.g. 200ms ease-in-out]
      Page entries:         [e.g. fade-up 150ms]
      Key animations:       [list the specific elements that animate and how]
    </animations>
  </design_system>

  <auth_flow>
    [Only include if auth was selected. Cover every state a user can be in.]
    <registration>[Step-by-step registration flow with field list and validation]</registration>
    <login>[Step-by-step login flow]</login>
    <session_persistence>[How session is stored and for how long — e.g. HTTP-only cookie, 7 days]</session_persistence>
    <protected_routes>[List routes that require auth]</protected_routes>
    <redirect_behavior>[Where unauthenticated users land; where users go after login]</redirect_behavior>
    <logout>[What logout does — clears cookie, redirects to]</logout>
  </auth_flow>

  <error_handling>
    <client_side>
      Form validation:  [Inline on blur, or batch on submit]
      Network errors:   [Toast, inline banner, or retry dialog]
      Auth errors:      [Redirect to login, or inline "session expired"]
    </client_side>
    <server_side>
      400: [How the client surfaces validation errors — inline field errors or toast]
      401: [Client redirects to login; clears local session]
      403: [Shown as "Access denied" — no redirect]
      404: [Shown as not-found state within the current view]
      500: [Generic error toast; no sensitive details exposed]
    </server_side>
  </error_handling>

  <implementation_steps>
    [10–12 numbered steps in build order — each step must be independently deployable.
     Each step has a concrete task checklist and a "done when" criterion a test can assert.]

    1. [Step Title — e.g. "Backend: health check + database connection"]
       Dependencies: [what must exist first — e.g. "none"]
       Tasks:
         - [ ] [Specific task]
         - [ ] [Specific task]
       Done when: [Concrete assertion — e.g. "GET /api/health returns 200 { status: 'ok' }"]

    2. [Step Title]
       Dependencies: [step numbers]
       Tasks:
         - [ ] [Specific task]
       Done when: [Concrete assertion]
  </implementation_steps>

  <success_criteria>
    <functionality>
      [Concrete behaviors that must work — specific enough to write a browser test for each]
    </functionality>
    <user_experience>
      [UX quality bar: max response latency, error recovery, feedback on every action]
    </user_experience>
    <technical_quality>
      [TypeScript strict mode, no runtime errors in console, all API endpoints typed]
    </technical_quality>
    <design_polish>
      [Visual consistency, empty states present, animations smooth, no layout shifts]
    </design_polish>
  </success_criteria>
</project_specification>
```

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

### Phase B3: Monorepo Scaffold

Create the actual app directories and wire them into the monorepo.

---

#### Step B3.1 — Create app directories

Based on the tech stack from Q&A, create the following structure:

**Always create:**

```bash
mkdir -p apps/<slug>/src
```

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

## Flow 2: Develop (continue existing project)

### Session Start

1. Read `.claude/projects/<slug>/project-state.json`.
2. Count passing tests in `feature_list.json`:
   ```bash
   grep -c '"passes": true' .claude/projects/<slug>/feature_list.json
   ```
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
