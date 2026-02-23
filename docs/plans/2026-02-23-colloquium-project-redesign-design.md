# colloquium:project Redesign — Design Document

**Date:** 2026-02-23
**Status:** Approved
**Scope:** Redesign `.claude/commands/colloquium/project.md` to support full standalone-project bootstrapping inside the Colloquium monorepo, with per-project state management replacing `dispatch-state.json`.

---

## Problem Statement

The current `colloquium:project` skill is wired for adding features to the existing Colloquium codebase. There is no way to use it to bootstrap a brand-new standalone application (e.g., a Claude.ai clone) as a proper monorepo member under `apps/`. Additionally, there is a known pattern (from `initial-prompts/`) for long-running autonomous agent development using `app_spec.txt`, `feature_list.json`, and `claude-progress.txt` — but this pattern is disconnected from the Colloquium workflow tooling.

This redesign unifies those two concerns: the skill becomes the single entry point for both **bootstrapping new projects** and **continuing development on existing ones**, with all state under `.claude/projects/`.

---

## Decision

**Option B — Full redesign with two top-level flows** under one unified skill entry point.

- `dispatch-state.json` is retired entirely.
- All project state lives under `.claude/projects/<slug>/`.
- The skill always starts by asking: new project or continue?

---

## Architecture

### Entry Point

```
/colloquium:project [optional: project-name]
```

On every invocation:

1. Scan `.claude/projects/` for existing projects.
2. Ask the user: **"Start a new project or continue an existing one?"**
   - If projects exist: offer the list with progress summaries.
   - If no projects exist: go directly to Flow 1 (Bootstrap).
3. Route to the appropriate flow.

### State Storage

`dispatch-state.json` is **removed**. All state lives here:

```
.claude/
  projects/
    <slug>/
      project-state.json     # phase/step/task tracking
      app_spec.txt           # generated XML specification
      feature_list.json      # 200 end-to-end test cases
      claude-progress.txt    # session-by-session log
```

### Monorepo Placement

New projects create proper monorepo members:

```
apps/
  <slug>/                    # main frontend app
  <slug>-api/                # backend service (if applicable)
packages/
  <slug>-types/              # Zod schemas (if applicable)
  <slug>-ui/                 # shared components (if applicable)
```

Turborepo picks up new entries automatically. `pnpm dev` at the root starts all registered apps including the new one.

---

## Flow 1: Bootstrap (New Project)

### Phase B1 — Q&A (5 topic blocks, ~17–22 questions total)

Questions are grouped into blocks and presented block-by-block, not as 22 individual interruptions.

**Block 1 — Identity** (3 questions)

- App name and slug (used for folder names)
- One-sentence purpose / elevator pitch
- Primary user personas

**Block 2 — Tech Stack** (5–7 questions)

- Frontend framework (React/Vite, Next.js, other?)
- Styling approach (Tailwind, CSS modules, other?)
- State management preference
- Backend runtime (Node/Express, Hono, none?)
- Database (SQLite, Postgres, none?)
- Auth needed? (none, simple single-user, JWT, OAuth?)
- Real-time requirements? (SSE, WebSockets, none?)

**Block 3 — Features** (4–6 questions)

- List the 5–10 main feature areas (freeform)
- MVP vs. nice-to-have classification for each area
- Content-rendering requirements? (Markdown, code highlighting, LaTeX, etc.)
- Mobile/responsive requirements?
- Third-party integrations?

**Block 4 — Design** (3 questions)

- Layout pattern (sidebar+main, full-width, dashboard, other?)
- Light/dark mode needed?
- Design reference or color palette?

**Block 5 — Constraints** (2–3 questions)

- Hard port requirements?
- API keys / secrets — how are they stored?
- Known performance or scale constraints?

### Phase B2 — Spec Generation

From Q&A answers + Claude inference for gaps, generate atomically:

1. **`app_spec.txt`** — full XML specification covering:
   - `<project_name>`, `<overview>`
   - `<technology_stack>` with all sub-elements
   - `<prerequisites>`
   - `<core_features>` with one section per feature area
   - `<database_schema>` with all tables and fields
   - `<api_endpoints_summary>` grouped by domain
   - `<ui_layout>` covering all panels and modals
   - `<design_system>` with color palette, typography, components, animations
   - `<key_interactions>` with numbered flows
   - `<implementation_steps>` ordered by priority
   - `<success_criteria>` covering functionality, UX, technical quality, design

2. **`feature_list.json`** — 200 test cases derived from the spec:
   - 100 functional + 100 style categories
   - Ordered by priority (fundamental features first)
   - All start with `"passes": false`
   - Mix of narrow (2–5 steps) and comprehensive (10+ steps) tests
   - At least 25 tests with 10+ steps
   - Fields: `category`, `description`, `steps[]`, `passes`

3. **`project-state.json`** — initial state (see schema below)

4. **`claude-progress.txt`** — initialized with session 1 header (bootstrap session)

### Phase B3 — Monorepo Scaffold

1. Create `apps/<slug>/` with correct config files for the chosen tech stack (package.json, tsconfig.json, vite.config/next.config, tailwind.config if applicable)
2. Create `apps/<slug>-api/` if a backend was requested
3. Create any needed `packages/<slug>-*` directories
4. Run `pnpm install` to wire the workspace
5. Commit: `feat(<slug>): scaffold monorepo structure`
6. Write `project-state.json` with `phase: "develop"`, `currentTestIndex: 0`, `passingTests: 0`

---

## Flow 2: Develop (Continue Existing Project)

### Session Start

1. List projects from `.claude/projects/` with progress:
   ```
   1. claude-ai-clone     — 34/200 tests passing  (last: 2026-02-20)
   2. my-dashboard        — 12/200 tests passing  (last: 2026-02-19)
   ```
2. User selects a project (or it is inferred from the optional argument).
3. Read `project-state.json` → load `currentTestIndex`, `passingTests`, saved phase/step.
4. Display session start banner with progress.

### Session Loop

```
Read project-state.json + claude-progress.txt
Count passing/failing in feature_list.json
pnpm turbo dev (start all apps in turborepo)
    │
    ▼
Verify 1–2 previously-passing tests still pass
If regression found → fix BEFORE new work
    │
    ▼
Pick highest-priority failing test (by index)
    │
    ┌──────── Per-test inner cycle ────────┐
    │  3a. context7 — pull docs            │
    │  3b. TDD — Red → Loop → Green        │
    │  3c. systematic-debugging (if stuck) │
    │  3d. code-simplifier (post-green)    │
    │  3e. requesting-code-review          │
    │  3f. receiving-code-review           │
    └──────────────────────────────────────┘
    │
    ▼
Mark test "passes": true in feature_list.json
git commit: feat(<slug>): implement [test description]
Update claude-progress.txt
Update project-state.json (increment currentTestIndex, passingTests)
    │
    ▼
"Test N complete (N/200 passing). Continue or stop?"
```

When all 200 tests pass, display a project-complete banner.

---

## project-state.json Schema (v1)

```json
{
  "version": 1,
  "slug": "claude-ai-clone",
  "name": "Claude.ai Clone",
  "appDir": "apps/claude-ai-clone",
  "apiDir": "apps/claude-ai-clone-api",
  "packages": ["packages/claude-ai-clone-types"],
  "specFile": ".claude/projects/claude-ai-clone/app_spec.txt",
  "featureListFile": ".claude/projects/claude-ai-clone/feature_list.json",
  "progressFile": ".claude/projects/claude-ai-clone/claude-progress.txt",
  "totalTests": 200,
  "passingTests": 34,
  "currentTestIndex": 35,
  "phase": "develop",
  "lastUpdated": "2026-02-20T14:32:00Z",
  "sessionCount": 3
}
```

---

## Migration

On first invocation after this redesign:

- If `.claude/dispatch-state.json` exists with `version >= 2`:
  - Offer to migrate it to `.claude/projects/<feature>/project-state.json`
  - Delete `dispatch-state.json` after migration
- If `dispatch-state.json` is v1 or corrupt: discard it silently

---

## Files Changed

| File                                     | Action                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| `.claude/commands/colloquium/project.md` | **Full rewrite**                                       |
| `.claude/dispatch-state.json`            | **Deleted** (migrated to `.claude/projects/`)          |
| `.claude/projects/`                      | **Created** (new directory, gitignored or tracked TBD) |
| `initial-prompts/`                       | No change — kept as reference/documentation            |
| `example-intermediates/`                 | No change — kept as reference/documentation            |

---

## Enforcement Rules (carried over from existing skill)

1. **No silent skipping.** Every step announces itself or shows an explicit skip notice.
2. **State updated after every step**, not in batches.
3. **Banners mandatory** at step start and completion.
4. **Hard gates block** — Q&A must complete before spec is generated; scaffold must complete before develop loop starts.
5. **AI never touches git** beyond reading status. No branch creation, no push, no PR.
6. **feature_list.json is append-only** — only the `"passes"` field may be changed; descriptions and steps are never modified.

---

## Success Criteria

- `/colloquium:project` always prompts new-or-continue at the start
- New project flow produces a well-formed `app_spec.txt`, `feature_list.json`, and scaffolded monorepo app that builds with `pnpm turbo build`
- Continue flow picks up exactly where the last session left off (correct test index)
- `dispatch-state.json` is gone; no references to it remain in the skill
- Multiple projects can coexist under `.claude/projects/` independently
