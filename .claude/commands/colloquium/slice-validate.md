# colloquium:slice-validate — Slice UAT + Release Note (B5 → done)

**Purpose:** Run full UAT via Playwright MCP, regression-check all previous slices, write the public release note, and close the slice. Every feature in the queue must be done before UAT begins.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `activeSlice.state = "B5"`. If not, display:

   ```
   ❌ Requires activeSlice.state = "B5".
   Current state: <activeSlice.state>. Complete slice decomposition first.
   ```

   Then stop.

2. **Hard gate (pre-check):** Read `activeSlice.featureQueue` from state.json. Every feature must have `state: "done"`. If any feature is not done, display:

   ```
   ❌ Not all features are complete. Cannot run UAT.

   Incomplete features:
     feat-<n>: <name> — state: <state>

   Complete all features and re-run /colloquium:slice-validate.
   ```

   Then stop. Do NOT proceed to UAT until all features are done.

3. **No uat.md without a UAT pass.** If any UAT step fails, this skill does NOT write any release note, does NOT clear the slice from state.json. Instead, it routes the relevant feature back to C6.

---

## Execution

### Step 1: Pre-check feature queue

Read `activeSlice.featureQueue` from state.json. Confirm every entry has `state: "done"`. If not, display the hard gate error from Enforcement Rule 2.

### Step 2: Read the slice user journey

Read `docs/slices/<activeSlice.id>/slice.md`. Extract the complete user journey — this is the UAT script.

### Step 3: UAT via Playwright MCP

Navigate the complete user journey described in slice.md using Playwright MCP. For each step in the journey:

1. Perform the action
2. Take a screenshot named `<activeSlice.id>-step-<n>.png`
3. Verify the expected outcome matches what is observed
4. If observed ≠ expected: **stop immediately** — do not continue to the next step

**UAT failure handling:**

When a UAT step fails, display:

```
❌ UAT failed at step <n>

Action:   <what was attempted>
Expected: <what should have happened>
Observed: <what actually happened>

Routing back to feature-implement for the relevant feature.
```

Identify which feature owns the failing behavior (cross-reference with featureQueue types and names). Set that feature's state back to `"C6"` in state.json. Update `activeFeature` to point to that feature. Then stop — do not proceed.

### Step 4: Regression check

After UAT passes for the current slice, re-run the golden paths for all previously completed slices.

Read `completedSlices[]` from state.json. For each completed slice ID:

1. Read `docs/releases/<slice-id>-public.md` to find its "What Ships" description
2. Navigate the golden path for that slice using Playwright MCP
3. Confirm it still works

If any regression is detected:

```
❌ Regression detected in <slice-id>

Step that failed: <description>
Expected: <expected>
Observed: <observed>

This regression must be fixed before <activeSlice.id> can be released.
```

Stop. Identify the feature responsible and route back to `feature-implement`.

### Step 5: Log check

After regression check passes, check for new high-severity errors:

- Open browser console logs via Playwright MCP
- Look for any `ERROR` or `FATAL` level entries not observed in previous sessions
- If new high-severity errors are found, list them and ask: "These high-severity errors appeared during UAT. Are they acceptable or must they be fixed?"
- If user confirms they are acceptable: document them in Known Issues. Proceed.
- If user says fix them: identify the responsible feature, route back to `feature-implement`.

### Step 6: Write `docs/releases/<activeSlice.id>-public.md`

Write only after all three checks (UAT, regression, log check) pass.

Create `docs/releases/` if it does not exist.

```markdown
# <activeSlice.id> Release Note

**Released:** <today's date>
**Slice:** <activeSlice.name>

## What Ships

<Prose description of the complete user journey this slice delivers — 2–4 sentences describing what users can now do>

## Features

- feat-001: <name> ✅
- feat-002: <name> ✅
- feat-003: <name> ✅

## Flags Promoted

- <flag-name>: internal → beta (criteria: <promotion criteria>)

_(If no flags were used in this slice, write: "No feature flags.")_

## Known Issues

- <any known issues — or write "None">

## Cleanup Tasks

- Remove flag <name> after beta validation
  _(If no flags, write: "None")_
```

Also update `docs/releases/<activeSlice.id>-internal.md`: change `**Status:** In progress` to `**Status:** Released`.

### Step 7: Write `.claude/sdlc/state.json`

Remove `activeSlice` from state.json. Append the slice ID to `completedSlices[]`. Clear `activeFeature`. Preserve all other fields.

```json
{
  "completedSlices": ["<previous-ids>", "<activeSlice.id>"],
  "activeSlice": null,
  "activeFeature": null,
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-validate"
}
```

### Step 8: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Slice complete — <activeSlice.id>
════════════════════════════════════════════════════════════════
UAT:         PASS (<N> steps)
Regressions: PASS (<N> previous slices checked)
Logs:        PASS (or: <N> known issues documented)

Release note: docs/releases/<id>-public.md ✅

Slice complete. Start next slice with /colloquium:slice-select
or run /colloquium:status to review the full project state.
════════════════════════════════════════════════════════════════
```
