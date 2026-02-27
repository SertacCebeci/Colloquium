# `colloquium:project-implement` Gap Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three gaps in the `project-implement` skill: broken turbo filter syntax, unreliable Playwright regression verification, and stale resume command references.

**Architecture:** Three targeted edits — migrate `project-state.json` to store package names and port, rewrite the Session Start section of `project-implement.md`, and expand Step B3.5 in `project-initiate.md`. No source code changes.

**Tech Stack:** Markdown skill files, JSON state files. No dependencies.

---

## Task 1: Migrate `colloquium-chat/project-state.json`

Add the three new fields to the existing state file for the only project that currently exists.

**Files:**

- Modify: `.claude/projects/colloquium-chat/project-state.json`

---

**Step 1: Read the current file**

Run:

```bash
cat .claude/projects/colloquium-chat/project-state.json
```

Expected: JSON object with 13 fields, no `frontendPackage`, `apiPackage`, or `frontendPort`.

---

**Step 2: Confirm the package names to add**

Run:

```bash
cat apps/colloquium-chat/package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('frontend:', d['name'])"
cat apps/colloquium-chat-api/package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('api:', d['name'])"
cat apps/colloquium-chat/package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('dev script:', d['scripts']['dev'])"
```

Expected output:

```
frontend: @colloquium/colloquium-chat
api: @colloquium/colloquium-chat-api
dev script: vite --port 5173
```

---

**Step 3: Add the three new fields to `project-state.json`**

Using the Edit tool, replace the closing `}` at the end of the file with the three new fields followed by the closing `}`. The final file should look exactly like this:

```json
{
  "version": 1,
  "slug": "colloquium-chat",
  "name": "Colloquium Chat",
  "appDir": "apps/colloquium-chat",
  "apiDir": "apps/colloquium-chat-api",
  "packages": ["packages/colloquium-chat-types"],
  "specFile": ".claude/projects/colloquium-chat/app_spec.txt",
  "featureListFile": ".claude/projects/colloquium-chat/feature_list.json",
  "progressFile": ".claude/projects/colloquium-chat/claude-progress.txt",
  "totalTests": 200,
  "passingTests": 17,
  "currentTestIndex": 17,
  "phase": "develop",
  "lastUpdated": "2026-02-25T00:00:00.000000+00:00",
  "sessionCount": 12,
  "techStackNote": "Frontend expanded: TanStack Query v5, React Hook Form v7 + Zod, TanStack Table v8, nuqs v2 added 2026-02-23",
  "frontendPackage": "@colloquium/colloquium-chat",
  "apiPackage": "@colloquium/colloquium-chat-api",
  "frontendPort": 5173
}
```

---

**Step 4: Verify the file is valid JSON**

Run:

```bash
python3 -c "import json; json.load(open('.claude/projects/colloquium-chat/project-state.json')); print('valid JSON')"
```

Expected: `valid JSON`

---

**Step 5: Commit**

```bash
git add .claude/projects/colloquium-chat/project-state.json
git commit -m "chore(colloquium-chat): add frontendPackage, apiPackage, frontendPort to project-state"
```

---

## Task 2: Update `project-initiate.md` — Phase B3.5

Expand the `project-state.json` template and add instructions for deriving the three new fields. This ensures all future bootstrapped projects have the fields from day one.

**Files:**

- Modify: `.claude/commands/colloquium/project-initiate.md`

---

**Step 1: Read the current Step B3.5 section**

Find the section starting with `### Step B3.5 — Write \`project-state.json\``— it contains a JSON template with 13 fields and ends with`Omit "apiDir" if no backend was created.`

---

**Step 2: Replace the Step B3.5 section**

Using the Edit tool, replace this exact old text:

````
### Step B3.5 — Write `project-state.json`

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
````

Omit `"apiDir"` if no backend was created. Omit empty `"packages"` array entries.

```

With this new text:

```

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

````

---

**Step 3: Verify the edit looks correct**

Run:
```bash
grep -A 35 "Step B3.5" .claude/commands/colloquium/project-initiate.md | head -40
````

Expected: the new section with the 3-step derivation instructions and the expanded JSON template with `frontendPackage`, `apiPackage`, `frontendPort` fields.

---

**Step 4: Commit**

```bash
git add .claude/commands/colloquium/project-initiate.md
git commit -m "feat(colloquium-skill): project-initiate stores frontendPackage, apiPackage, frontendPort in state"
```

---

## Task 3: Rewrite `project-implement.md` — Session Start and Regression Verification

This is the main fix. Replace the entire Session Start section and the Regression Verification section with the new hybrid approach: state migration check → correct turbo filters → Vitest regression gate → browser smoke check.

**Files:**

- Modify: `.claude/commands/colloquium/project-implement.md`

---

**Step 1: Read the current Session Start and Regression Verification sections**

These are the two sections being replaced. They span from `## Session Start` through the end of `## Regression Verification (mandatory before new work)` — ending just before `## Per-Test Inner Cycle`.

Current Session Start (lines 65–88):

````markdown
## Session Start

1. Read `.claude/projects/<slug>/project-state.json`.
2. Count passing tests:
   ```bash
   grep -c '"passes": true' .claude/projects/<slug>/feature_list.json
   ```
````

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

````

Current Regression Verification (lines 92–106):
```markdown
## Regression Verification (mandatory before new work)

Pick 1–2 of the most recently-passing tests from `feature_list.json`. Verify them via Playwright MCP:

- Navigate to the app in a real browser
- Execute the test steps literally
- Take a screenshot at the final step

**If a regression is found:**

- Set that test's `"passes"` back to `false` in `feature_list.json`
- Fix the regression BEFORE implementing any new feature
- Commit the fix: `fix(<slug>): restore [description]`
- Re-verify before moving to new work
````

---

**Step 2: Replace both sections with the new content**

Using the Edit tool, replace the old `## Session Start` section (the 4-numbered-step block) with:

````markdown
## Session Start

### Step 1 — Read state and migration check

Read `.claude/projects/<slug>/project-state.json`.

> **Note:** If `claude-progress.txt` contains `Run /colloquium:project` (without `-implement`), treat it as `Run /colloquium:project-implement <slug>`. This is the pre-split command — functionally identical, just renamed.

If `frontendPackage`, `apiPackage`, or `frontendPort` are **missing** from `project-state.json`, run this one-time migration before continuing:

1. Run: `cat apps/<slug>/package.json` → read the `"name"` field → this is `frontendPackage`
2. Run: `cat apps/<slug>-api/package.json` → read the `"name"` field → this is `apiPackage`
3. Run: `cat apps/<slug>/package.json` → read the `"dev"` script → extract `--port NNNN` → this is `frontendPort` (default `5173` if no explicit flag)
4. Write all three values into `project-state.json`

This migration runs once per existing project, never again once the fields exist.

---

### Step 2 — Count passing tests and display session banner

```bash
grep -c '"passes": true' .claude/projects/<slug>/feature_list.json
```
````

Display:

```
════════════════════════════════════════════════════════════════
▶ DEVELOP SESSION — [name]
════════════════════════════════════════════════════════════════
Progress:     [passingTests] / [totalTests] tests passing
Next test:    #[currentTestIndex] — [description]
Session:      #[sessionCount + 1]
════════════════════════════════════════════════════════════════
```

---

### Step 3 — Start dev servers

```bash
pnpm turbo dev --filter=<frontendPackage> --filter=<apiPackage>
```

Wait for both apps to report "ready" in log output before proceeding.

---

### Step 4 — Regression gate

**4a — Vitest suite:**

```bash
pnpm turbo test --filter=<apiPackage>
```

- All green → proceed to 4b
- Any red → **STOP.** Fix the failing test, commit the fix (`fix(<slug>): restore [description]`), re-run until all green. Only then proceed to 4b.

**4b — Browser smoke check:**

Use Playwright MCP to navigate to `http://localhost:<frontendPort>`. Take one screenshot.

- Page loads with any content visible → proceed to Per-Test Inner Cycle
- Blank page or unhandled error boundary → treat as a regression, fix before new work

````

---

**Step 3: Delete the old Regression Verification section entirely**

Using the Edit tool, remove this entire block (it is now replaced by Step 4 in the new Session Start above):

```markdown
## Regression Verification (mandatory before new work)

Pick 1–2 of the most recently-passing tests from `feature_list.json`. Verify them via Playwright MCP:

- Navigate to the app in a real browser
- Execute the test steps literally
- Take a screenshot at the final step

**If a regression is found:**

- Set that test's `"passes"` back to `false` in `feature_list.json`
- Fix the regression BEFORE implementing any new feature
- Commit the fix: `fix(<slug>): restore [description]`
- Re-verify before moving to new work
````

---

**Step 4: Verify the final structure of `project-implement.md`**

Run:

```bash
grep "^##" .claude/commands/colloquium/project-implement.md
```

Expected output (section headings in order):

```
## ENFORCEMENT RULES (read before executing any step)
## Entrypoint: Project Selection
## Session Start
## Per-Test Inner Cycle
## After Each Test: Browser Verification + State Update
## Project Complete
```

The `## Regression Verification` heading must NOT appear in this list — it has been absorbed into `## Session Start` as Step 4.

---

**Step 5: Verify the new Session Start content is complete**

Run:

```bash
grep -A 60 "^## Session Start" .claude/commands/colloquium/project-implement.md | head -65
```

Check that it contains:

- "migration check" text
- `pnpm turbo dev --filter=<frontendPackage> --filter=<apiPackage>`
- `pnpm turbo test --filter=<apiPackage>`
- "Browser smoke check"
- No mention of "Pick 1–2 of the most recently-passing tests"

---

**Step 6: Commit**

```bash
git add .claude/commands/colloquium/project-implement.md
git commit -m "feat(colloquium-skill): project-implement hybrid regression gate — Vitest + smoke check"
```

---

## Verification: Full end-to-end check

After all three tasks are committed, do a final sanity check:

**Step 1: Confirm `colloquium-chat` state has all new fields**

```bash
python3 -c "
import json
s = json.load(open('.claude/projects/colloquium-chat/project-state.json'))
for f in ['frontendPackage', 'apiPackage', 'frontendPort']:
    print(f, '->', s.get(f, 'MISSING'))
"
```

Expected:

```
frontendPackage -> @colloquium/colloquium-chat
apiPackage -> @colloquium/colloquium-chat-api
frontendPort -> 5173
```

**Step 2: Confirm `project-initiate.md` has the new fields in B3.5**

```bash
grep -c "frontendPackage\|apiPackage\|frontendPort" .claude/commands/colloquium/project-initiate.md
```

Expected: `6` (each field appears in instructions + JSON template)

**Step 3: Confirm `project-implement.md` has the correct turbo filter syntax**

```bash
grep "turbo dev\|turbo test" .claude/commands/colloquium/project-implement.md
```

Expected:

```
pnpm turbo dev --filter=<frontendPackage> --filter=<apiPackage>
pnpm turbo test --filter=<apiPackage>
```
