# Colloquium Project — Initiate

Bootstrap a brand-new standalone project inside the Colloquium monorepo.

Invoke as:
`/colloquium:project-initiate` → starts Q&A for a new project

**Version:** v1 — Bootstrap-only skill (split from colloquium:project v3)

> **For continuing an existing project,** use `/colloquium:project-implement` instead.

---

## ENFORCEMENT RULES (read before executing any step)

1. **Always ask first.** Always begin with a scan for existing projects to prevent accidentally re-bootstrapping an active project.
2. **State after every step.** Write `project-state.json` after EVERY step — not after phases, not in batches.
3. **Banners are mandatory.** Every phase and step displays its start and completion banner.
4. **Hard gates block.** Steps marked HARD GATE loop until the gate condition is met — do NOT proceed without it.
5. **`feature_list.json` is append-only.** Once written, only the `"passes"` field may ever change. Descriptions, steps, and ordering are permanently frozen.
6. **AI never touches git beyond reading status.** No branch creation, no push, no PR — the human controls all git operations. The ONE exception: the initial scaffold commit in Phase B3 (explicitly described below).

---

## Entrypoint: Safety Check

Before starting Q&A, run:

```bash
ls .claude/projects/ 2>/dev/null
```

Collect all subdirectories that contain a `project-state.json` into `known_projects`.

**If `known_projects` is non-empty**, display a warning:

```
════════════════════════════════════════════════════════════════
⚠️  EXISTING PROJECTS DETECTED
════════════════════════════════════════════════════════════════
Found existing projects:
  [list them with their passing test counts]

Are you sure you want to bootstrap a NEW project?
To continue an existing project, run /colloquium:project-implement
════════════════════════════════════════════════════════════════
```

Wait for explicit confirmation before proceeding. On confirm → Phase B1.

---

## Phase B1: Q&A — 5 Topic Blocks

Present questions **block by block** (not one at a time). Use `AskUserQuestion` tool with multiple related questions per block where possible. After each block, confirm understanding before moving to the next.

---

### Block 1 — Identity

Ask:

1. What is the app's name? (This becomes the slug for folder names — use kebab-case, e.g. `claude-ai-clone`)
2. Describe the app in one sentence. What does it do?
3. Who are the primary users?

Record: `slug`, `name`, `overview`, `users`.

---

### Block 2 — Tech Stack

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

### Block 3 — Features

Ask:

1. List the 5–10 main feature areas of the app (freeform — user can list them in any format).
2. For the list received: which are MVP (must-have for first version) vs. nice-to-have?
3. Any content-rendering requirements? (Markdown, code syntax highlighting, LaTeX, diagrams)
4. Mobile/responsive requirements? (mobile-first, desktop-only, both)
5. Any third-party API integrations? (list them)

Record: `features` array with `name`, `priority` (mvp/nice-to-have), `description` for each.

---

### Block 4 — Design

Ask:

1. Layout pattern? (sidebar + main chat, dashboard with widgets, full-width content, other)
2. Light mode, dark mode, or both?
3. Any design reference, brand colors, or specific aesthetic to match?

Record: `design` object with `layout`, `colorMode`, `reference`.

---

### Block 5 — Constraints

Ask:

1. Any hard port requirements? (e.g., "frontend must run on port 5173")
2. How are API keys/secrets provided? (environment variables in `.env`, from a file path like `/tmp/api-key`, other)
3. Any known performance, scale, or deployment constraints?

Record: `constraints` object.

---

### Blocks 1–5 Review Banner

After all 5 blocks:

```
════════════════════════════════════════════════════════════════
📋 Q&A Complete — Review
════════════════════════════════════════════════════════════════
App:      [name] ([slug])
Purpose:  [overview]
Stack:    [frontend] + [backend] + [database]
Auth:     [auth]
Features: [count] areas — [count] MVP, [count] nice-to-have
Layout:   [layout], [colorMode]
════════════════════════════════════════════════════════════════
```

Ask: "Does this look correct? Any corrections before I generate the spec?"

If corrections: update the relevant fields and re-display the banner. Loop until the user explicitly confirms.

---

## Phase B2: Spec Generation — HARD GATE

> ⚠️ HARD GATE: Do NOT proceed to Phase B3 until all three artifacts are confirmed to exist on disk via `ls`.

Generate all three artifacts atomically from the Q&A answers. For any field not explicitly answered, use sensible defaults that match the stated tech stack and feature set.

---

### Artifact 1: `app_spec.txt`

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

---

### Artifact 2: `feature_list.json`

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

### Artifact 3: `claude-progress.txt`

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

Run /colloquium:project-implement <slug>
Start servers with: pnpm turbo dev
Pick first failing test from feature_list.json (index 0)
```

---

### Hard Gate Check

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

## Phase B3: Monorepo Scaffold

Create the actual app directories and wire them into the monorepo.

---

### Step B3.1 — Create app directories

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

### Step B3.2 — Write config files

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

### Step B3.3 — Install dependencies

```bash
pnpm install
```

Verify it completes without errors. If errors occur, fix them before proceeding.

---

### Step B3.4 — Verify turborepo picks up new packages

```bash
pnpm turbo build --filter=<slug>...
```

Expected: build completes (even if it's just an empty app). If it fails: fix config files before proceeding.

---

### Step B3.5 — Write `project-state.json`

Before writing, derive the three package/port values:

1. Read `apps/<slug>/package.json` → `"name"` field → this is `frontendPackage`
2. Read `apps/<slug>-api/package.json` → `"name"` field → this is `apiPackage` (omit if no backend)
3. Read the `"dev"` script in `apps/<slug>/package.json` → extract the `--port NNNN` number → this is `frontendPort` (default: `5173` if no explicit port flag found)

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
  "sessionCount": 1,
  "frontendPackage": "<name from apps/<slug>/package.json>",
  "apiPackage": "<name from apps/<slug>-api/package.json>",
  "frontendPort": <port number from dev script>
}
```

Omit `"apiDir"` and `"apiPackage"` if no backend was created. Omit empty `"packages"` array entries.

---

### Step B3.6 — Update `claude-progress.txt`

Fill in the `PROJECT STRUCTURE` section with the actual directories and key files just created.

---

### Step B3.7 — Initial git commit (EXCEPTION to the no-git rule)

This is the ONE place the skill touches git directly — to create the initial skeleton commit:

```bash
git add apps/<slug>/ apps/<slug>-api/ packages/<slug>-types/ .claude/projects/<slug>/
git commit -m "feat(<slug>): scaffold monorepo structure — bootstrap complete"
```

---

### Bootstrap Complete Banner

```
════════════════════════════════════════════════════════════════
✅ BOOTSTRAP COMPLETE — [name]
════════════════════════════════════════════════════════════════
App dir:      apps/<slug>/
API dir:      apps/<slug>-api/        (if applicable)
State:        .claude/projects/<slug>/project-state.json
Tests:        0 / 200 passing
Next step:    /colloquium:project-implement <slug>
              pnpm turbo dev  (to start all apps)
════════════════════════════════════════════════════════════════
```
