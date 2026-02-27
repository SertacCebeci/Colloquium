# `colloquium:project-implement` Gap Fixes — Design

**Date:** 2026-02-25
**Status:** Approved
**Author:** Session brainstorm — gaps identified during first live run of the split skill

---

## Background

During the first live test of `colloquium:project-implement` (with the `colloquium-chat` project), three gaps were discovered:

1. **Turbo filter syntax** — the skill used `--filter=<slug>` but turbo requires the scoped package name (e.g. `--filter=@colloquium/colloquium-chat`)
2. **Regression verification** — the Playwright replay of the 2 most-recently-passing tests was unworkable: the live SQLite DB has accumulated state from prior sessions, making deterministic setup impossible; multi-user tests (SSE, two browser contexts) are especially fragile
3. **Stale resume command** — existing `claude-progress.txt` entries say `Run /colloquium:project` (the old pre-split command); the new command is `/colloquium:project-implement <slug>`

---

## Decisions

| Gap                     | Chosen Approach                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Turbo filter syntax     | Store `frontendPackage` + `apiPackage` in `project-state.json` at bootstrap time; implement reads from state                          |
| Regression verification | Replace Playwright regression replay with: (1) Vitest full suite run, (2) Playwright browser smoke check (navigate + screenshot only) |
| Stale resume command    | Add one detection note in `project-implement.md`; no file rewrites                                                                    |

---

## Design

### 1. Data shape change — `project-state.json`

Two new fields added to the schema:

```json
{
  "frontendPackage": "@colloquium/<slug>",
  "apiPackage": "@colloquium/<slug>-api"
}
```

**Written by:** `project-initiate` during Phase B3.5 — derived from `apps/<slug>/package.json` and `apps/<slug>-api/package.json`.

**Migration for existing projects:** On session start, `project-implement` checks for the presence of these fields. If missing, it reads them from the respective `package.json` files, writes them into `project-state.json`, and proceeds. This runs once per existing project, never again.

---

### 2. Session Start — new sequence

**Old sequence:**

1. Read state → display banner
2. `pnpm turbo dev` (with broken filter)
3. Playwright: pick 2 recent passing tests → replay steps → assert outcome (fragile, often fails)

**New sequence:**

**Step 1 — Read state + migration check**
Read `project-state.json`. If `frontendPackage` or `apiPackage` are missing, read them from `apps/<slug>/package.json` and write them into state before continuing.

**Step 2 — Display session banner** _(unchanged)_

**Step 3 — Start dev servers**

```bash
pnpm turbo dev --filter=<frontendPackage> --filter=<apiPackage>
```

Wait for both apps to report "ready" in log output.

**Step 4 — Regression gate (replaces old Playwright regression step)**

_4a. Vitest suite:_

```bash
pnpm turbo test --filter=<apiPackage>
```

- All green → proceed to 4b
- Any red → STOP. Fix the failing test, commit the fix, re-run until all green. Only then proceed.

_4b. Browser smoke check:_
Navigate to `http://localhost:<frontendPort>` via Playwright. Take one screenshot.

- Page loads (any content visible) → proceed to Per-Test Inner Cycle
- Blank page or error boundary → treat as regression, fix before new work

**Why this is reliable:**

- Vitest runs against in-memory DB — zero state drift between sessions
- Covers all 43 existing API tests (auth, workspaces, invites, channels) deterministically
- Smoke check catches Vite build failures and React crash-on-load within 3 seconds
- Total regression check time: ~8 seconds vs. multi-step live-API replay that fails on stale DB state

---

### 3. Stale resume command — one-line note

Added to Session Start section of `project-implement.md`, under the state-reading step:

> **Note:** If `claude-progress.txt` contains `Run /colloquium:project` (without `-implement`), treat it as `Run /colloquium:project-implement <slug>`. This is the pre-split command — functionally identical, just renamed.

---

## Files Changed

| File                                                  | Change                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/commands/colloquium/project-implement.md`    | Session Start rewritten: package name fields from state, turbo filter fixed, regression replaced with Vitest + smoke check, stale command note added |
| `.claude/commands/colloquium/project-initiate.md`     | Phase B3.5 expanded: writes `frontendPackage` and `apiPackage` into `project-state.json`                                                             |
| `.claude/projects/colloquium-chat/project-state.json` | Add `frontendPackage` and `apiPackage` fields (one-time migration)                                                                                   |

---

## Out of Scope

- The per-test inner cycle (steps 3a–3f) is unchanged
- The post-test browser verification hard gate is unchanged
- No seed script — Vitest's in-memory DB is the regression mechanism
- No changes to `feature_list.json` format or the 200-test list
