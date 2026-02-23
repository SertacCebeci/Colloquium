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
