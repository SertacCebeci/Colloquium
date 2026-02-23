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
