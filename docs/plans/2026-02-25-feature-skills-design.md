# Feature Skills Design

**Date:** 2026-02-25
**Skills:** `colloquium:project-features`, `colloquium:project-mvp`

## Overview

Two standalone skills for generating an extensive feature list from a project description and selecting an MVP subset from that list. Both are fully independent — neither requires `project-plan` or `project-state.json` to have run first.

---

## Skill 1: `colloquium:project-features`

### Purpose

Given a freeform app description, generate a comprehensive JSON feature list covering every natural area of the product.

### Invocation

```
/colloquium:project-features
```

No arguments. The skill runs a short Q&A then generates the file automatically.

### Conversation Flow

Questions asked in order:

1. **App name + slug** — "What's the app called? (This becomes the folder name, e.g. `my-app`)"
2. **One-sentence description** — "Describe it in one sentence."
3. **Target users** — "Who uses it?"
4. **Domain clarification** — one or two targeted follow-up questions based on the description
5. **Scope signal** — "What's out of scope — anything you explicitly don't want?"

After the last answer the skill generates `features.json` without further prompting.

### Output

Saved to: `.claude/projects/<slug>/features.json`

Target size: **30–60 features**, exhaustive across all natural areas (onboarding, core loop, data management, settings, errors, etc.). Effort and value scores are AI-estimated.

#### Schema

```json
[
  {
    "id": "feat-001",
    "name": "User authentication",
    "description": "Users can sign up, log in, and log out with email + password.",
    "category": "auth",
    "effort": 2,
    "value": 5,
    "dependencies": []
  }
]
```

| Field          | Type     | Description                                                  |
| -------------- | -------- | ------------------------------------------------------------ |
| `id`           | string   | Stable kebab-prefixed identifier (`feat-001`, `feat-002`, …) |
| `name`         | string   | Short display name                                           |
| `description`  | string   | One concrete sentence                                        |
| `category`     | string   | Freeform grouping label (e.g. `"auth"`, `"ui"`, `"data"`)    |
| `effort`       | 1–5      | 1 = trivial, 5 = weeks of work (AI-estimated)                |
| `value`        | 1–5      | 1 = marginal, 5 = core to the product (AI-estimated)         |
| `dependencies` | string[] | Array of `id` strings this feature requires first            |

### Completion Banner

```
════════════════════════════════════════════════════════════════
✅ Feature list generated — <slug>
════════════════════════════════════════════════════════════════
Features:  42  (saved to .claude/projects/<slug>/features.json)
Next step: /colloquium:project-mvp <slug>
════════════════════════════════════════════════════════════════
```

---

## Skill 2: `colloquium:project-mvp`

### Purpose

Read an existing `features.json` and automatically select the MVP subset using value/effort scoring and dependency analysis.

### Invocation

```
/colloquium:project-mvp <slug>
```

No questions asked — runs fully automatically.

### Algorithm

1. Read `.claude/projects/<slug>/features.json` — error if missing (direct to `project-features` first)
2. Score each feature: base score = `value / effort`
3. Boost features whose dependencies are all also high-scoring (or have none)
4. Penalise features with unmet high-effort dependencies
5. Select top-scoring features forming a coherent, shippable product — target ~30–40% of features, adjusted for dependency chains
6. Write `mvp.json`

### Output

Saved to: `.claude/projects/<slug>/mvp.json`

#### Schema

```json
{
  "slug": "my-app",
  "selected": ["feat-001", "feat-003", "feat-007"],
  "excluded": ["feat-002", "feat-004"],
  "reasoning": "Selected features cover the critical user journey with low total effort. Excluded features are high-effort with low immediate user value or depend on features not yet in scope.",
  "mvp_description": "A working MVP lets a user sign up, create a project, and invite one collaborator. They can add tasks, mark them complete, and see a simple activity feed. No payment, no notifications, no admin panel — just the core loop that proves the product is useful."
}
```

| Field             | Type     | Description                                                          |
| ----------------- | -------- | -------------------------------------------------------------------- |
| `selected`        | string[] | `id` values of included features                                     |
| `excluded`        | string[] | `id` values of excluded features                                     |
| `reasoning`       | string   | One paragraph explaining the selection logic                         |
| `mvp_description` | string   | 2–4 sentence prose narrative of what a real user can do with the MVP |

### Completion Banner

```
════════════════════════════════════════════════════════════════
✅ MVP selected — <slug>
════════════════════════════════════════════════════════════════
Selected:  14 / 42 features
Excluded:  28 features

<slug> MVP: [first sentence of mvp_description]...

Saved to: .claude/projects/<slug>/mvp.json
════════════════════════════════════════════════════════════════
```

---

## File Locations Summary

| File                                    | Written by         |
| --------------------------------------- | ------------------ |
| `.claude/projects/<slug>/features.json` | `project-features` |
| `.claude/projects/<slug>/mvp.json`      | `project-mvp`      |

Both skills create `.claude/projects/<slug>/` if it does not exist.

---

## Relationship to Other Skills

- **Independent of `project-plan`** — neither skill reads or writes `project-state.json` or `feature_list.json`
- **Composable** — `project-mvp` reads whatever `features.json` exists; the generator and selector can be re-run independently
- **Optional integration** — a future version of `project-plan` could read `features.json`/`mvp.json` if present and skip Block 3, but this is not required
