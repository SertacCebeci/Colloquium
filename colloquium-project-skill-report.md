# `colloquium:project` Skill — How It Works

**Version:** v3 · File: `.claude/skills/colloquium:project.md`

---

## Governing Principles (Enforcement Rules)

Six hard rules govern every invocation, regardless of phase:

| Rule                                   | Description                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Always ask first**                   | Every invocation begins at Phase 0 — no silent assumption of new vs. continue                                  |
| **State after every step**             | `project-state.json` is written after **every individual step**, not per-phase                                 |
| **Banners are mandatory**              | Every phase and step must display a start and completion banner                                                |
| **Hard gates block**                   | Steps marked HARD GATE loop until their condition is met; execution cannot proceed past them                   |
| **`feature_list.json` is append-only** | Only the `"passes"` field may change; descriptions, steps, and order are permanently frozen at generation time |
| **AI never touches git**               | No branch creation, push, or PR — with one explicit exception: the initial scaffold commit in Phase B3         |

---

## Phase 0: Entrypoint (always runs first)

Every invocation — new or continuing — passes through Phase 0.

**Step 0.1 — Scan**
Runs `ls .claude/projects/` and collects all subdirectories containing a `project-state.json` into a `known_projects` list.

**Step 0.2 — Migration check**
If `.claude/dispatch-state.json` exists (legacy v2 format), offers to migrate it to the new per-project path structure. Corrupt or v1 files are deleted silently.

**Step 0.3 — Route to flow**
Decision tree:

```
known_projects empty?  → Flow 1 (Bootstrap) immediately, no prompt
known_projects exists? → display numbered list with progress summaries → ask user
  user picks number    → Flow 2 (Develop) with that project
  user picks "new"     → Flow 1 (Bootstrap)
  slug passed directly → skip question, go straight to Flow 2
```

Progress summaries in the list show passing test count and last session date.

---

## Flow 1: Bootstrap (new project)

Five sequential phases that take a project from zero to a running monorepo scaffold.

---

### Phase B1 — Q&A (5 topic blocks)

Questions are presented **block by block** (not one at a time), using `AskUserQuestion` with grouped related questions. Each block is confirmed before moving on.

| Block           | Captures                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| 1 · Identity    | `slug`, `name`, `overview`, `users`                                       |
| 2 · Tech Stack  | `frontend`, `styling`, `state`, `backend`, `database`, `auth`, `realtime` |
| 3 · Features    | array of `{ name, priority (mvp/nice-to-have), description }`             |
| 4 · Design      | `layout`, `colorMode`, `reference`                                        |
| 5 · Constraints | ports, secret management, scale/deployment                                |

After all five blocks, a review banner is displayed. The loop repeats until the user explicitly confirms correctness.

---

### Phase B2 — Spec Generation (HARD GATE)

Three artifacts are generated **atomically** from the Q&A answers. This phase is a HARD GATE — Phase B3 cannot start until all three files are confirmed to exist on disk via `ls`.

#### Artifact 1: `app_spec.txt`

A structured XML document written to `.claude/projects/<slug>/app_spec.txt`. Required sections:

- `<overview>`, `<technology_stack>`, `<prerequisites>`
- `<core_features>` — one element per feature; MVP features get detailed sub-bullets
- `<database_schema>` — all tables with column types
- `<api_endpoints_summary>` — grouped by domain, method + path + description
- `<ui_layout>`, `<design_system>` (palette, typography, components, animations)
- `<key_interactions>` — 2–4 named flows as numbered step sequences
- `<implementation_steps>` — 8–10 priority-ordered steps
- `<success_criteria>` — functionality, UX, technical quality, design polish

#### Artifact 2: `feature_list.json`

Written to `.claude/projects/<slug>/feature_list.json`. Hard constraints:

- Exactly **200 test cases** — 100 `"functional"` + 100 `"style"`
- Ordered by priority: infrastructure first, UI polish last
- All start with `"passes": false`
- At least 25 tests must have 10+ steps
- Every feature area from `app_spec.txt` must be covered — no omissions
- Steps must be concrete enough for a browser-automation agent to execute literally
- **Permanently immutable** after creation except for the `"passes"` field

#### Artifact 3: `claude-progress.txt`

Written to `.claude/projects/<slug>/claude-progress.txt`. Initialized with Session 1 bootstrap summary and a `NEXT SESSION` section with resume instructions. Future sessions append entries to this file.

After writing, a verification banner confirms all three files exist. If any is missing, it must be written before proceeding.

---

### Phase B3 — Monorepo Scaffold (7 steps)

| Step | Action                                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B3.1 | `mkdir -p apps/<slug>/src` (+ `apps/<slug>-api/src` and `packages/<slug>-types/src` if applicable)                                                                                        |
| B3.2 | Write minimum config files: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` (frontend); equivalent for backend/types |
| B3.3 | `pnpm install` — must complete without errors                                                                                                                                             |
| B3.4 | `pnpm turbo build --filter=<slug>...` — must succeed before proceeding                                                                                                                    |
| B3.5 | Write `project-state.json` with v1 schema (slug, dirs, file paths, `totalTests: 200`, `passingTests: 0`, `currentTestIndex: 0`, `phase: "develop"`, `sessionCount: 1`)                    |
| B3.6 | Fill in the `PROJECT STRUCTURE` section of `claude-progress.txt`                                                                                                                          |
| B3.7 | **Only git commit in the entire skill**: `git add` + `git commit -m "feat(<slug>): scaffold monorepo structure — bootstrap complete"`                                                     |

Bootstrap ends with a completion banner showing all directories and the resume command.

---

## Flow 2: Develop (continue existing project)

A repeating session loop that implements one test at a time using a strict TDD inner cycle.

---

### Session Start

1. Reads `project-state.json`
2. Counts passing tests with `grep -c '"passes": true'`
3. Displays session banner with progress + next test description + session number
4. Runs `pnpm turbo dev` and waits for all apps to report "ready"

---

### Regression Verification

Before any new work, picks 1–2 of the most recently-passing tests and verifies them through the live browser via Playwright MCP. If a regression is found:

- Sets `"passes": false` for that test in `feature_list.json`
- Fixes the regression before touching any new feature
- Commits the fix: `fix(<slug>): restore [description]`
- Re-verifies before continuing

---

### Per-Test Inner Cycle

For each test at `currentTestIndex`:

**Step 3a — context7 doc pull**
Calls `mcp__plugin_context7_context7__resolve-library-id` + `mcp__plugin_context7_context7__query-docs` for the specific library the test exercises. This runs every session, even if the library was fetched before.

**Step 3b — TDD: Red → Loop → Green**
Invokes `superpowers:test-driven-development`. Enforced sequence:

1. Write the failing test
2. Run it — confirm RED (if it passes immediately, the test is wrong → rewrite)
3. Write minimal implementation
4. Run again: RED → adjust → repeat; GREEN → continue; **stuck 3+ attempts → Step 3c**
5. Refactor with tests green

**Step 3c — Systematic debugging (only if stuck 3+ consecutive times)**
Invokes `superpowers:systematic-debugging`. If this also fails, execution stops and returns to Phase B2 spec review — the feature may be under-specified.

**Step 3d — Code simplifier (post-green only)**
Launches a `code-simplifier:code-simplifier` subagent. Tests must remain GREEN after simplification.

**Step 3e — Request code review**
Invokes `superpowers:requesting-code-review`. Critical issues must be resolved or explicitly accepted before proceeding.

**Step 3f — Receive code review**
Invokes `superpowers:receiving-code-review`. Feedback must be evaluated technically — blind implementation is prohibited; YAGNI and monorepo boundary violations are valid grounds to push back.

---

### Post-Test State Update (after every passing test)

All six steps are required in order:

1. **Browser verification** via Playwright MCP — executes every step in `"steps"` array literally, takes screenshots at key states. `"passes": true` is only written after this passes.
2. Set `"passes": true` in `feature_list.json`
3. `git commit -m "feat(<slug>): implement [description] — test #[index] passing"`
4. Append entry to `claude-progress.txt`
5. Update `project-state.json` — increment `currentTestIndex`, `passingTests`, update `lastUpdated`
6. Ask user: "Continue to test N+1 or stop here?"

On stop: session-pause banner with progress count and resume command.

---

### Project Completion

When `passingTests === 200`, a completion banner fires. All git/merge/deployment work is explicitly delegated to the human — the skill does not push or open PRs.

---

## State Machine Overview

```
project-state.json.phase
  "bootstrap" → Flow 1 only
  "develop"   → Flow 2 only

currentTestIndex  → pointer into feature_list.json
passingTests      → count of "passes": true entries
sessionCount      → increments each Flow 2 session
lastUpdated       → ISO timestamp, written after every step
```

The three state files form a complete resume point:

| File                  | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `project-state.json`  | Machine-readable cursor and counters                                   |
| `feature_list.json`   | Source of truth for what is done vs. pending                           |
| `claude-progress.txt` | Human-readable session log for context continuity across conversations |

---

## File Layout (per project)

```
.claude/projects/<slug>/
  project-state.json     ← live state (written after every step)
  app_spec.txt           ← XML spec generated in Phase B2
  feature_list.json      ← 200 tests, append-only except "passes"
  claude-progress.txt    ← session log, appended each session

apps/<slug>/             ← frontend app
apps/<slug>-api/         ← backend app (if applicable)
packages/<slug>-types/   ← shared types package (if applicable)
```
