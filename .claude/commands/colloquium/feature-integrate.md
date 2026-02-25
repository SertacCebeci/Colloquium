# colloquium:feature-integrate — Integration + Flag Lifecycle (F4 → done)

**Purpose:** Wire the verified feature into the broader slice — check upstream/downstream event connections, create policy docs for any newly discovered cross-cutting behavior, manage feature flag lifecycle, and advance the feature queue to the next item.

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
   - Split state.activeSlice ("v1/SL-001") on "/" → [versionId, sliceId]
   - currentSlice = currentVersion.slices[sliceId]
   - Split state.activeFeature ("v1/SL-001/feat-006") on "/" → [versionId, sliceId, featureId]
   - currentFeature = currentSlice.features[featureId]

   Require `currentFeature.state = "F4"`. If not, display:

   ```
   ❌ Requires activeFeature.state = "F4".
   Current state: <currentFeature.state>.

   Feature must pass UAT (feature-verify) before integration.
   ```

   Then stop.

2. **All four checklist items must be addressed.** Even if the answer is "N/A — no upstream", that must be explicitly stated. Skipping a checklist item is not allowed.

3. **New cross-cutting behavior discovered during implementation must become a policy document.** Use the same format as `colloquium:policy` output — do not invoke that skill, generate the document inline here.

---

## Execution

### Step 1: Load context

Resolve cursor: split `state.activeFeature` ("v1/SL-001/feat-006") on "/" → [versionId, sliceId, featureId].

Read `currentFeature = state.versions[versionId].slices[sliceId].features[featureId]`.
Read `currentSlice = state.versions[versionId].slices[sliceId]`.

Read:

- `docs/features/<bc>/<aggregate>/spec.md` — External Contracts section (bc and aggregate from `currentFeature.bc` and `currentFeature.name`)
- `docs/features/<bc>/<aggregate>/uat.md` — to understand what was actually built
- `docs/slices/<sliceId>/model.md` — full event model for wiring context
- Active features list: `currentSlice.featureOrder.map(id => currentSlice.features[id])` — to find upstream and downstream features. Filter out entries where `history` contains `{ type: "removed" }`.

### Step 2: Integration checklist — item 1: Upstream wiring

Check whether events from upstream features in the queue are consumed correctly by this feature.

Find all features that this feature depends on (check `dependencies` in `currentFeature`). For each dependency:

- Read its spec to see what events it emits
- Verify that this feature's implementation (per the uat.md) correctly consumes those events
- If a consumed event is not wired: document the gap and report it

**Result:** Either "✅ Upstream wiring confirmed" or list of gaps.

If this feature has no dependencies: write "N/A — no upstream dependencies."

### Step 3: Integration checklist — item 2: Downstream wiring

Check whether events emitted by this feature are consumed by downstream features in the queue.

Scan `currentSlice.featureOrder` for features that list this feature in their `dependencies`. For each downstream feature (looking up each via `currentSlice.features[id]`, skipping tombstoned entries):

- Check if it is already implemented (state > C0): if yes, confirm its implementation consumes this feature's events
- If not yet implemented (state = C0): document it as "pending wiring" — the downstream feature's spec should account for this

**Result:** Either "✅ Downstream wiring confirmed" or "Pending wiring: [list of downstream features that will consume events from this feature]."

If no features depend on this feature: write "N/A — no downstream dependents."

### Step 4: Integration checklist — item 3: Policy documents for new interactions

Review the uat.md and implementation. Did the implementation introduce any cross-cutting behavior that was NOT in the original model.md?

Examples of new cross-cutting behavior:

- A domain event from this feature triggers behavior in another BC that was not planned
- An async side effect was discovered that needs to be made explicit
- A consistency guarantee between two BCs emerged from implementation

For each new interaction:

Generate a policy document inline at `docs/policies/PL-<n>-<kebab-name>.md` using this format:

```markdown
# PL-<n>: <Name>

**Trigger event:** <event>
**Condition:** <condition>
**Command issued:** <command>
**Owning context:** <BC name>
**Consistency:** <eventually consistent / synchronous>
**Idempotency key:** <key>
**Test plan:**

- <unit test description>
- <integration test description>
```

Auto-assign PL-NNN by scanning `docs/policies/` for the highest existing number.

If no new interactions were discovered: write "N/A — no new cross-cutting behavior observed."

### Step 5: Integration checklist — item 4: Feature flag lifecycle

Did this feature introduce any feature flags during implementation? (Check the uat.md or spec for any flag references.)

For each feature flag:

Document the lifecycle criteria:

| Stage             | Criteria                                                                                |
| ----------------- | --------------------------------------------------------------------------------------- |
| Internal → Beta   | <condition — e.g., "passes 5 days of monitoring in staging with <1% error rate">        |
| Beta → Default-on | <condition — e.g., "adopted by >80% of users with no reported regressions for 14 days"> |
| Cleanup           | Remove flag `<name>` after it has been default-on for 30 days                           |

If no feature flags were introduced: write "N/A — no feature flags in this feature."

### Step 6: Write `.claude/sdlc/state.json`

- Set this feature's state to `"done"` in the versions tree
- Clear `activeFeature` (set to null)
- Append this feat-ID to `currentVersion.completedFeatures`
- Merge into versions tree; preserve all other fields

```json
{
  "activeFeature": null,
  "versions": {
    "<versionId>": {
      "completedFeatures": ["<all previous>", "<featureId>"],
      "slices": {
        "<sliceId>": {
          "features": {
            "<featureId>": { "state": "done" }
          }
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:feature-integrate"
}
```

### Step 7: Advance the feature queue

After state is written, scan `currentSlice.featureOrder` in order. For each candidate featureId:

1. Check `currentSlice.features[featureId].state` — if not `"C0"`, skip.
2. Check `currentSlice.features[featureId].history` — if contains `{ type: "removed" }`, skip (tombstoned).
3. Check all `dependencies` are in `currentVersion.completedFeatures` — if not all done, skip.
4. First feature passing all three checks: set `state.activeFeature = "<versionId>/<sliceId>/<featureId>"`. Write to state.json.

**If no feature passes (queue exhausted):**

All non-removed features are done. Display:

```
════════════════════════════════════════════════════════════════
✅ All features complete for <sliceId>
════════════════════════════════════════════════════════════════
Completed features: feat-001, feat-002, ...

Next: /colloquium:slice-validate
════════════════════════════════════════════════════════════════
```

Stop.

### Step 8: Display completion banner (when next feature exists)

```
════════════════════════════════════════════════════════════════
✅ Feature integrated — <feat-id> done
════════════════════════════════════════════════════════════════
Integration checklist:
  1. Upstream wiring:   ✅ (or: gaps listed)
  2. Downstream wiring: ✅ (or: pending wiring listed)
  3. New policies:      ✅ (or: N/A)
  4. Flag lifecycle:    ✅ (or: N/A)

Next feature: <next-feat-id> — <name> (<type>)
Run: /colloquium:feature-spec
════════════════════════════════════════════════════════════════
```
