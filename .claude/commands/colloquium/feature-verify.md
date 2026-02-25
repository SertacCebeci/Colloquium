# colloquium:feature-verify — UAT Hard Gate (C7 → F4)

**Purpose:** Run UAT for the active feature via Playwright MCP, take screenshots at each key state, check logs for new errors, run regression on all previously verified features, and write the uat.md file. No uat.md without a UAT pass.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. If not 2, display:

   ```
   ❌ state.json is schema v1. Run /colloquium:version --migrate first.
   ```

   Then stop.

   Resolve current context:
   - versionId = state.activeVersion
   - currentVersion = state.versions[versionId]
   - Split state.activeFeature ("v1/SL-001/feat-006") on "/" → [versionId, sliceId, featureId]
   - currentFeature = currentVersion.slices[sliceId].features[featureId]

   Require `currentFeature.state = "C7"`. If not, display:

   ```
   ❌ Requires activeFeature.state = "C7".
   Current state: <currentFeature.state>.

   If the feature is still being implemented, run /colloquium:feature-implement first.
   ```

   Then stop.

2. **Hard gate: no uat.md without a UAT pass.** If any UAT step fails, `uat.md` is NOT written. The feature state is set back to `"C6"` and this skill stops. Do not work around this rule.

3. **UAT failure is not an error — it is a routing signal.** A failed UAT step routes the feature back to `feature-implement` at sub-step C5→C6 (adapter/read model layer), because E2E failures usually indicate an adapter, wiring, or projection issue rather than a domain issue.

---

## Execution

### Step 1: Load feature context

Resolve cursor: split `state.activeFeature` ("v1/SL-001/feat-006") on "/" → [versionId, sliceId, featureId].

Read `currentFeature = state.versions[versionId].slices[sliceId].features[featureId]`.

From `currentFeature`, read: `id`, `name`, `bc`.

Read the feature spec at `docs/features/<bc>/<aggregate>/spec.md`. Extract the "Test Strategy" section — specifically the E2E items (or UAT steps added during `feature-implement` for complex UIs).

### Step 2: UAT via Playwright MCP

Navigate the feature's critical path using Playwright MCP. For each step in the test strategy's E2E or UAT section:

1. Perform the action described in the step
2. Take a screenshot immediately after, named `<feat-id>-step-<n>.png` (e.g., `feat-001-step-1.png`)
3. Assert the expected outcome is visible or present
4. Record the result (observed state vs. expected state)

**If any step fails:**

```
❌ UAT failed at step <n>

Feature: <feat-id> — <name>
Action:   <what was attempted>
Expected: <what should have happened>
Observed: <what actually happened>
```

Then:

- Do NOT write `uat.md`
- Write to state.json (merge into versions tree):
  ```json
  {
    "versions": {
      "<versionId>": {
        "slices": {
          "<sliceId>": {
            "features": { "<featureId>": { "state": "C6" } }
          }
        }
      }
    }
  }
  ```
- Display: "Routing back to feature-implement at sub-step C5→C6 (adapters). Run /colloquium:feature-implement to resume."
- Stop.

### Step 3: Log check for new high-severity errors

After all UAT steps pass, open browser console logs via Playwright MCP.

Scan for `ERROR` or `FATAL` level log entries. Compare against any previously known errors (if this is not the first feature verified, errors from previous sessions are considered "known").

If new high-severity errors are found:

```
⚠️  New high-severity errors observed during UAT:
  - [ERROR] <message>
  - [ERROR] <message>

Are these acceptable for this feature? (yes → document in Known Issues / no → fix and re-run)
```

Ask via AskUserQuestion. If the user says no: stop and route back to `feature-implement`. If yes: proceed and add the errors to the uat.md Known Issues section.

### Step 4: Regression on all previously verified features

Read `currentVersion.completedFeatures` from state.json (set by `feature-integrate`). For each previously completed feature:

1. Read its `docs/features/<bc>/<aggregate>/uat.md` to find its golden path steps
2. Re-run the first (most critical) step of that feature's UAT via Playwright MCP
3. Confirm it still passes

If any regression is detected:

```
❌ Regression detected in <feat-id>: <name>

Step that failed: <description>
Expected: <expected>
Observed: <observed>

This regression must be fixed before the current feature can be verified.
```

Stop. Identify the feature responsible and route to `feature-implement`.

### Step 5: Write `docs/features/<bc>/<aggregate>/uat.md`

Write only after UAT pass + log check + regression check all succeed.

```markdown
# UAT — <feature name> (<feat-id>)

**Result:** PASS
**Date:** <today's date>
**Feature:** <feat-id> — <name>
**Slice:** <sliceId>

## Steps Executed

| Step | Action   | Expected | Observed | Result |
| ---- | -------- | -------- | -------- | ------ |
| 1    | <action> | <text>   | <text>   | ✅     |
| 2    | <action> | <text>   | <text>   | ✅     |

## Screenshots

- <feat-id>-step-1.png
- <feat-id>-step-2.png

## Regressions Checked

- <prev-feat-id> (<name>): ✅

_(If no previous features: "First feature — no regressions to check")_

## Known Issues

- <any errors documented during log check, or write "None">
```

### Step 6: Write `.claude/sdlc/state.json`

Merge into the versions tree. Do not overwrite other fields.

```json
{
  "versions": {
    "<versionId>": {
      "slices": {
        "<sliceId>": {
          "features": { "<featureId>": { "state": "F4" } }
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:feature-verify"
}
```

### Step 7: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Feature verified — C7 → F4
════════════════════════════════════════════════════════════════
Feature:     <feat-id> — <name>
UAT:         PASS (<N> steps)
Screenshots: <N> captured
Log check:   PASS (or: <N> issues documented in uat.md)
Regressions: PASS (<N> features checked)

UAT report: docs/features/<BC>/<Aggregate>/uat.md ✅

Next: /colloquium:feature-integrate
════════════════════════════════════════════════════════════════
```
