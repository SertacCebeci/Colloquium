# Feature Skills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create two standalone skills — `colloquium:project-features` (feature list generator) and `colloquium:project-mvp` (MVP selector) — plus update the dispatcher.

**Architecture:** Each skill is a single markdown command file in `.claude/commands/colloquium/`. Skills are self-contained prompts with no shared state requirements. The dispatcher `project.md` is updated to document both new skills.

**Tech Stack:** Markdown skill files, JSON output artifacts, bash for directory creation and file writes.

---

### Task 1: Write `project-features.md`

**Files:**

- Create: `.claude/commands/colloquium/project-features.md`

**Step 1: Write the skill file**

````markdown
# Colloquium Project — Features

Generate an extensive feature list for a new project from a freeform description.

Invoke as:
`/colloquium:project-features` → runs Q&A then generates features.json

> This skill is standalone — it does not require `project-plan` or `project-state.json` to have run first.

---

## ENFORCEMENT RULES

1. **Ask questions in order.** Never skip or combine questions.
2. **Generate features atomically.** Write the full `features.json` in one operation.
3. **Aim for 30–60 features.** Cover every natural area of the app exhaustively.
4. **AI estimates effort and value.** Never ask the user to score features.
5. **Create the directory if absent.** Always run `mkdir -p .claude/projects/<slug>/` before writing.

---

## Step 1: Q&A — 5 Questions

Ask questions one at a time in this exact order. Wait for a response before asking the next.

---

**Question 1 — App name + slug**

"What's the app called? (This becomes the folder name — use kebab-case, e.g. `my-app`)"

Record: `name` and `slug` (convert to kebab-case if needed).

---

**Question 2 — One-sentence description**

"Describe it in one sentence. What does it do?"

Record: `description`.

---

**Question 3 — Target users**

"Who are the primary users?"

Record: `users`.

---

**Question 4 — Domain clarification**

Ask one or two targeted follow-up questions based on the description. Examples:

- For a chat app: "Is this real-time or async messaging?"
- For a marketplace: "Who lists items vs. who buys them?"
- For a productivity tool: "Is this individual use or team collaboration?"
- For a content platform: "Do users create content, consume it, or both?"

Record: `domainNotes`.

---

**Question 5 — Scope signal**

"What's explicitly out of scope — anything you don't want included?"

Record: `outOfScope`.

---

## Step 2: Generate `features.json`

Create the directory:

```bash
mkdir -p .claude/projects/<slug>/
```
````

Generate a JSON array of 30–60 features covering all natural areas of the app. For each feature:

- Assign a sequential `id` starting from `feat-001`
- Write a one-sentence concrete `description` (not vague — describe the specific behaviour)
- Assign a `category` based on the feature domain (e.g. `"auth"`, `"core"`, `"settings"`, `"ui"`, `"data"`, `"notifications"`, `"admin"`)
- Estimate `effort` (1–5): 1 = trivial config or single component, 5 = multi-week buildout involving multiple layers
- Estimate `value` (1–5): 1 = marginal nice-to-have, 5 = core to the product's value proposition
- List `dependencies` as `id` strings of features that must exist first

Cover these areas exhaustively (adapt to the specific app domain):

- Onboarding / authentication
- Core user loop (the primary action the app enables)
- Data creation and editing
- Data deletion with confirmation
- Data display, listing, and pagination
- Search and filtering
- User settings and preferences
- Notifications or in-app feedback
- Error states (network errors, validation errors, not-found states)
- Empty states (first-time user experience)
- Loading and skeleton states
- Accessibility basics (keyboard navigation, screen reader labels)
- Mobile/responsive behaviour
- Admin or moderation features (if applicable to the app)
- Third-party integrations (if applicable)

Write the full array to: `.claude/projects/<slug>/features.json`

Schema for each item:

```json
{
  "id": "feat-001",
  "name": "Short feature name",
  "description": "One concrete sentence describing the specific behaviour.",
  "category": "auth",
  "effort": 2,
  "value": 5,
  "dependencies": []
}
```

---

## Step 3: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Feature list generated — <slug>
════════════════════════════════════════════════════════════════
Features:  [count]  (saved to .claude/projects/<slug>/features.json)
Next step: /colloquium:project-mvp <slug>
════════════════════════════════════════════════════════════════
```

````

**Step 2: Verify the file was written**

Run:
```bash
ls .claude/commands/colloquium/
````

Expected: `project-features.md` appears in the listing.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project-features.md
git commit -m "feat(colloquium-skill): add project-features skill — feature list generator"
```

---

### Task 2: Write `project-mvp.md`

**Files:**

- Create: `.claude/commands/colloquium/project-mvp.md`

**Step 1: Write the skill file**

````markdown
# Colloquium Project — MVP

Select an MVP feature subset from an existing `features.json`.

Invoke as:
`/colloquium:project-mvp <slug>` → reads features.json and writes mvp.json

> This skill is standalone — it does not require `project-plan` or `project-state.json` to have run first.
> It requires `features.json` to exist — run `/colloquium:project-features` first.

---

## ENFORCEMENT RULES

1. **Read before writing.** Always read `features.json` fully before generating `mvp.json`.
2. **No questions.** Run automatically — do not ask the user anything.
3. **Honour dependencies.** Never include a feature whose dependencies are excluded.
4. **Target 30–40%.** Select roughly 30–40% of features unless dependency chains require more.
5. **Write `mvp_description` in prose.** 2–4 sentences describing what a real user can actually _do_ — not a feature list.

---

## Step 1: Read `features.json`

```bash
cat .claude/projects/<slug>/features.json
```
````

If the file does not exist, display:

```
════════════════════════════════════════════════════════════════
❌ features.json not found — <slug>
════════════════════════════════════════════════════════════════
Run /colloquium:project-features first to generate the feature list.
════════════════════════════════════════════════════════════════
```

Then stop.

---

## Step 2: Score and select features

Apply this algorithm:

1. Compute base score for each feature: `value / effort`
2. Boost (`+0.5`) features with no dependencies, or whose dependencies all have base score ≥ 3.0
3. Penalise (`−1.0`) features whose dependencies have base score < 2.0
4. Sort all features by final score descending
5. Walk the sorted list: select each feature if and only if all its `dependencies` are also already selected
6. Stop when approximately 30–40% of total features are selected — or when the next candidate's dependencies would require including too many low-scoring features

---

## Step 3: Write `mvp.json`

Write to: `.claude/projects/<slug>/mvp.json`

```json
{
  "slug": "<slug>",
  "selected": ["feat-001", "feat-003", "..."],
  "excluded": ["feat-002", "feat-004", "..."],
  "reasoning": "<one paragraph explaining the selection rationale — reference specific effort/value trade-offs>",
  "mvp_description": "<2-4 sentences in prose describing what a real user can actually do with the MVP — not a bullet list>"
}
```

`mvp_description` example: "A working MVP lets a user sign up and create a workspace. They can add team members, create projects, and assign tasks with due dates. The focus is on the core collaboration loop — billing, analytics, and third-party integrations are out of scope for the first version."

---

## Step 4: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ MVP selected — <slug>
════════════════════════════════════════════════════════════════
Selected:  [selected count] / [total count] features
Excluded:  [excluded count] features

MVP: [first sentence of mvp_description]...

Saved to: .claude/projects/<slug>/mvp.json
════════════════════════════════════════════════════════════════
```

````

**Step 2: Verify the file was written**

Run:
```bash
ls .claude/commands/colloquium/
````

Expected: `project-mvp.md` appears in the listing alongside `project-features.md`.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project-mvp.md
git commit -m "feat(colloquium-skill): add project-mvp skill — MVP feature selector"
```

---

### Task 3: Update `project.md` dispatcher

**Files:**

- Modify: `.claude/commands/colloquium/project.md`

**Step 1: Add the two new skills to the dispatcher**

The current `project.md` has two sub-skills documented. Add entries for `project-features` and `project-mvp`.

Replace the `## Two Sub-Skills` section with `## Four Sub-Skills` and add:

```markdown
### `/colloquium:project-features` — Generate a feature list

Use when you want to turn a freeform app description into a comprehensive, scored feature list.

What it does:

- Runs a 5-question interview (name, description, users, domain, scope)
- Generates `features.json` with 30–60 features, each scored for effort and value
- Saves to `.claude/projects/<slug>/features.json`

---

### `/colloquium:project-mvp <slug>` — Select an MVP subset

Use when you have a `features.json` and want to identify the smallest valuable shippable set.

What it does:

- Reads `features.json` and scores features by value/effort ratio
- Selects ~30–40% of features that form a coherent, dependency-safe MVP
- Writes `mvp.json` with selected IDs, reasoning, and a prose MVP description
```

Also update the Quick Reference table to add the new rows:

```markdown
| Generating a feature list for a new idea | `/colloquium:project-features` |
| Selecting an MVP from an existing list | `/colloquium:project-mvp <slug>` |
```

**Step 2: Verify the dispatcher reads correctly**

Run:

```bash
cat .claude/commands/colloquium/project.md
```

Expected: Four sub-skills documented, Quick Reference table has four rows.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project.md
git commit -m "docs(colloquium-skill): update project dispatcher — add project-features and project-mvp"
```

---

### Task 4: Fix stale internal reference in `project-plan.md`

**Files:**

- Modify: `.claude/commands/colloquium/project-plan.md` lines 6–7

**Step 1: Fix the invoke line**

The file still says `/colloquium:project-initiate` in its own invoke description. Update to the new name:

Old:

```
Invoke as:
`/colloquium:project-initiate` → starts Q&A for a new project
```

New:

```
Invoke as:
`/colloquium:project-plan` → starts Q&A for a new project
```

**Step 2: Verify**

Run:

```bash
grep "project-initiate" .claude/commands/colloquium/project-plan.md
```

Expected: no output (all references updated).

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/project-plan.md
git commit -m "fix(colloquium-skill): update stale project-initiate reference in project-plan"
```
