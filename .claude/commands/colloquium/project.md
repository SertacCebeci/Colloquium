# Colloquium Project

Manage standalone projects inside the Colloquium monorepo.

This skill is a **dispatcher** — it routes you to the right sub-skill based on what you need to do.

---

## Two Sub-Skills

### `/colloquium:project-initiate` — Bootstrap a new project

Use when you want to start a **brand-new** app from scratch.

What it does:

- Runs Q&A across 5 topic blocks (identity, tech stack, features, design, constraints)
- Generates `app_spec.txt`, `feature_list.json` (200 tests), and `claude-progress.txt`
- Scaffolds the monorepo directory structure and wires into Turborepo
- Makes the initial git commit

---

### `/colloquium:project-implement <slug>` — Implement an existing project

Use when you have an already-bootstrapped project and want to make tests pass.

What it does:

- Runs a TDD session: one test at a time from `feature_list.json`
- Pulls library docs via context7, runs the Red→Green cycle, runs code review
- Verifies each test via Playwright browser automation before marking it passing
- Persists state after every step; resumes cleanly across sessions

---

## Quick Reference

| Situation                              | Command                                |
| -------------------------------------- | -------------------------------------- |
| Starting a project for the first time  | `/colloquium:project-initiate`         |
| Continuing work on an existing project | `/colloquium:project-implement`        |
| Continuing a specific project by name  | `/colloquium:project-implement <slug>` |

---

## State Files (per project)

All state lives under `.claude/projects/<slug>/`:

| File                  | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `project-state.json`  | Machine-readable cursor and counters — written after every step |
| `feature_list.json`   | 200 test cases, append-only except for `"passes"` field         |
| `app_spec.txt`        | Full XML specification generated at bootstrap time              |
| `claude-progress.txt` | Human-readable session log — appended each session              |
