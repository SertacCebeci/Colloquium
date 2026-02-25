# colloquium:slice-select — Slice Narrative (B0 → B1)

**Purpose:** Define the next thin vertical slice: its user journey, bounded contexts involved, success metric, and explicit out-of-scope boundary.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. Resolve `currentVersion = state.versions[state.activeVersion]`. Require `currentVersion.domain.state = "A4"` AND `currentVersion.domain.locked = true`. If not, display:

   ```
   ❌ Requires domain.state = "A4" (domain complete and locked).
   Finish domain discovery first with /colloquium:domain-frame → /colloquium:domain-map.
   ```

   Then stop.

2. **Active slice guard:** If `state.activeSlice` is non-null, resolve `currentSlice = currentVersion.slices[sliceId]`. Display:

   ```
   ⚠️  Active slice already exists: <currentSlice.id> "<currentSlice.name>" (state: <currentSlice.state>)
   ```

   Then ask via AskUserQuestion: "Complete the active slice first, or abandon it and start a new one?"
   - If "complete first": stop and say "Resume with /colloquium:sdlc"
   - If "abandon": set `state.activeSlice = null` and `state.activeFeature = null` in state.json. Do NOT delete the slice entry from `versions[versionId].slices` — it is preserved for audit. Then proceed.

3. **Metric vagueness check:** Success metrics that are vague (e.g., "feels fast", "works well", "users are happy", "it's good enough") are rejected. Re-ask until a measurable metric is provided.

---

## Execution

### Step 1: Auto-assign slice ID

Scan `currentVersion.slices` for existing keys matching `SL-NNN`. Extract the highest existing N. Assign N+1. If `slices` is empty or has no SL-NNN keys, start at SL-001.

Create the directory `docs/slices/SL-<n>/` now.

### Step 2: Ask 4 questions (use AskUserQuestion, two blocks of 2)

**Block 1:**

1. What user journey does this slice deliver end-to-end? (Describe what a user can do from start to finish after this slice ships.)
2. Which bounded contexts does this slice touch? (Display the available BCs from `docs/domain/bounded-contexts.md`. Recommend choosing ≤ 2 — if the user selects 3 or more, display: "⚠️ Selecting 3+ bounded contexts increases slice complexity significantly. Consider narrowing the scope.")

**Block 2:**

3. What is the success metric — how will you know this slice worked? (Must be measurable. Examples: "User can complete checkout in < 3 clicks", "95% of uploads process within 10s." Reject vague answers and re-ask.)
4. What is explicitly NOT in this slice? (At least one item required.)

### Step 3: Write `docs/slices/SL-<n>/slice.md`

```markdown
# SL-<n>: <Name>

**User journey:** <full description of what the user can do end-to-end>

**Bounded contexts involved:** <BC1>, <BC2>

**Success metric:** <measurable outcome>

**Not in this slice:** <explicit list of at least one item>
```

Derive `<Name>` as a kebab-case slug from the user journey description (e.g., `user-auth-flow`, `content-publish-pipeline`).

### Step 4: Gate check

Verify:

- User journey narrative is present (non-empty)
- At least one BC is listed
- Success metric is measurable (re-check against vagueness rule)
- At least one out-of-scope item listed

If any check fails, re-ask the relevant question before proceeding.

### Step 5: Write `.claude/sdlc/state.json`

Set `activeSlice` cursor and add slice entry to version tree. Merge — preserve all other fields.

```json
{
  "activeSlice": "<activeVersion>/SL-<n>",
  "versions": {
    "<activeVersion>": {
      "slices": {
        "SL-<n>": {
          "id": "SL-<n>",
          "name": "<kebab-name>",
          "state": "B1",
          "contracts": [],
          "featureOrder": [],
          "features": {}
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-select"
}
```

### Step 6: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Slice selected — <SL-n>: <Name>
════════════════════════════════════════════════════════════════
Contexts:  <BC1>, <BC2>
Metric:    <success metric>

Next: /colloquium:slice-storm
════════════════════════════════════════════════════════════════
```
