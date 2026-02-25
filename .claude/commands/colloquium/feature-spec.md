# colloquium:feature-spec — Feature Specification (C0 → C2)

**Purpose:** Generate a complete, testable feature specification from the active feature's model entry. Simple aggregate features generate automatically; features touching new aggregates or cross-context boundaries trigger targeted Q&A.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `activeFeature` to exist and `activeFeature.state = "C0"`. If not, display:

   ```
   ❌ Requires activeFeature.state = "C0".
   Current activeFeature.state: <state>.

   If no activeFeature is set, run /colloquium:slice-deliver to decompose the slice first.
   If the feature is already in progress, run /colloquium:feature-implement to resume.
   ```

   Then stop.

2. **Invariant quality gate:** Vague invariants ("should be valid", "data must be correct", "must be safe") are rejected — rewrite them as testable assertions before adding to the spec.

3. **Failure modes must be real scenarios, not placeholders.** Generic entries like "invalid input → error" are not acceptable. Each failure mode must describe a specific trigger condition and a specific expected system response.

---

## Execution

### Step 1: Load feature context

From state.json, read:

- `activeFeature.id` — e.g., `feat-001`
- `activeFeature.name` — kebab-case name
- `activeFeature.sliceId` — which slice this belongs to

Find the matching entry in `activeSlice.featureQueue`:

```json
{
  "id": "feat-001",
  "name": "video-upload-aggregate",
  "bc": "VideoManagement",
  "type": "aggregate",
  "dependencies": []
}
```

### Step 2: Read the model

Read `docs/slices/<activeFeature.sliceId>/model.md`. Find the section for this feature's aggregate (match by name and BC). Extract:

- State machine (states + transitions)
- Invariants
- Commands + events emitted
- Any cross-context integrations involving this aggregate

### Step 3: Determine generation mode

**For `type: "aggregate"` features with no new state machines** (aggregate is fully described in model.md):
→ Generate spec automatically from model.md. No Q&A needed. Skip to Step 5.

**For `type: "aggregate"` features where the aggregate spans multiple BCs or introduces new behavior not in model.md:**
→ Ask 2–3 targeted clarifying questions before generating. Examples:

- "The model shows command `X` but does not specify what happens when condition Y occurs. What is the expected behavior?"
- "This aggregate depends on `feat-002` which is not yet done. Should this spec include stub behavior for the integration, or wait for feat-002 to be complete first?"

**For `type: "contract"` features:**
→ Read the CT-NNN file from `docs/contracts/`. Generate spec from the contract's consumer expectations and producer guarantees. Ask: "Does this contract feature need any adapter logic beyond what the contract file specifies?"

**For `type: "read-model"` features:**
→ Read the Read Models section from the event storm. Ask: "What is the query entry point for this read model — HTTP endpoint, subscription, or server-sent events?"

### Step 4: Clarifying Q&A (if triggered in Step 3)

Ask clarifying questions using AskUserQuestion. Maximum 3 questions. Incorporate answers into the spec generation.

### Step 5: Write `docs/features/<bc>/<aggregate>/spec.md`

Derive the path from the feature's BC and name:

- BC `VideoManagement`, feature `video-upload-aggregate` → `docs/features/VideoManagement/VideoUpload/spec.md`
- For contract features: `docs/features/<producerBC>/<contractName>/spec.md`
- For read-model features: `docs/features/<owningBC>/<readModelName>/spec.md`

Create the directory if it does not exist.

```markdown
# Feature Spec: <name> (<feat-id>)

**Owning BC:** <BoundedContext>
**Type:** aggregate | contract | read-model
**Slice:** <activeFeature.sliceId>

## Entities

<Aggregate state machine, copied from model.md and refined for this feature's scope>

| State   | Description |
| ------- | ----------- |
| <State> | <meaning>   |

**Transitions:**

| From    | Command       | To      |
| ------- | ------------- | ------- |
| <State> | <CommandName> | <State> |

## Invariants

- <testable statement — e.g., "A Published video must have a non-null publishedAt timestamp">
- <testable statement>

## Failure Modes

| Trigger              | Expected behavior          |
| -------------------- | -------------------------- |
| <specific condition> | <specific system response> |
| <specific condition> | <specific system response> |

## External Contracts

- CT-<n>: <name> (consumed | produced)

_(If no external contracts: "None — this feature is bounded within <BC>")_

## Test Strategy

- [ ] Domain unit: <what pure aggregate/invariant tests cover>
- [ ] Contract: <what contract tests verify> _(omit if no contracts)_
- [ ] Integration: <what adapter/persistence tests cover>
- [ ] E2E: <what critical path E2E steps cover> _(omit if not a critical path node)_
```

### Step 6: Write `.claude/sdlc/state.json`

Update `activeFeature.state = "C2"`. Preserve all other fields.

```json
{
  "activeFeature": {
    "state": "C2"
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:feature-spec"
}
```

### Step 7: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Feature spec complete — C0 → C2
════════════════════════════════════════════════════════════════
Feature:  <feat-id> — <name> (<type>)
Spec:     docs/features/<BC>/<Aggregate>/spec.md ✅

Test strategy:
  Domain unit:  <yes/no — what>
  Contract:     <yes/no — what>
  Integration:  <yes/no — what>
  E2E:          <yes/no — what>

Next: /colloquium:feature-implement
════════════════════════════════════════════════════════════════
```
