# colloquium:slice-contracts — Contract Stabilization (B3 → B4)

**Purpose:** Extract every cross-context integration point from the approved model and generate explicit contract documents for each one. Every integration point must be covered before the slice can proceed to decomposition.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. If not 2, display:

   ```
   ❌ state.json is schema v1. Run /colloquium:version --migrate first.
   ```

   Then stop.

   Resolve cursor: `versionId = state.activeVersion`, `currentVersion = state.versions[versionId]`. Split `state.activeSlice` on "/" → `[versionId, sliceId]`. `currentSlice = currentVersion.slices[sliceId]`.

   Require `currentSlice.state = "B3"`. If not, display:

   ```
   ❌ Requires activeSlice.state = "B3".
   Current state: <currentSlice.state>. Run /colloquium:slice-model first.
   ```

   Then stop.

2. **Hard gate:** Every integration point listed in the model's "Cross-Context Integrations" section must have a corresponding CT-NNN contract file. A missing contract is a hard stop — this skill will not write state.json until all integration points are covered.

3. **Contract type correctness:** Each integration must be classified as either API (request/response) or Event (schema + semantics). The skill must derive the correct type from how the integration is described in model.md — do not guess.

---

## Execution

### Step 1: Read the model

Extract `sliceId` from `state.activeSlice` (split on "/", take index 1). Read `docs/slices/<sliceId>/model.md` in full. Extract the "Cross-Context Integrations" section. Build a list of every named integration:

- Integration name (event name or API endpoint)
- Direction: produced by which BC, consumed by which BC
- Type hint from context: events (past tense names like `VideoPublished`) → Event type; request/response patterns → API type

### Step 2: Determine existing CT-NNN IDs

Scan `docs/contracts/` for existing `CT-*.md` files. Find the highest existing CT number. New contracts will increment from there.

Create `docs/contracts/` if it does not exist.

### Step 3: Generate each contract file

For each integration point, write `docs/contracts/CT-<n>-<kebab-name>.md`.

**For Event contracts:**

````markdown
# CT-<n>: <EventName> (v1)

**Type:** Event
**Producer:** <BoundedContext>
**Consumer:** <BoundedContext>
**Slice:** <sliceId>

## Payload Schema

```json
{
  "<field>": "<type>",
  "<field>": "<type>"
}
```
````

## Semantics

<What this event means to a consumer. What invariants hold about its fields. When it fires.>

## Consumer Expectations

<What the consuming BC assumes about this event's fields — e.g., "eventId is always non-null and globally unique", "occurredAt is always in UTC">

## Producer Guarantees

<What the publishing BC commits to — e.g., "will always include all required fields", "will never change the meaning of existing fields">

## Backward Compatibility Rule

New optional fields only. Breaking changes (removing fields, changing types, altering semantics) require a new version (v2). A v2 event is a distinct contract with its own CT-NNN ID.

## Contract Test Plan

<One sentence: e.g., "Pact test between <ProducerBC> and <ConsumerBC> verifying that <EventName> v1 schema is satisfied on both sides">

````

**For API contracts:**

```markdown
# CT-<n>: <EndpointName>

**Type:** API
**Provider:** <BoundedContext>
**Consumer:** <BoundedContext>
**Slice:** <sliceId>

## Endpoint

**Method:** <GET | POST | PUT | PATCH | DELETE>
**Path:** <path with :params>

## Request Schema

```json
{
  "<field>": "<type>"
}
````

## Response Schema (success)

```json
{
  "<field>": "<type>"
}
```

## Error Codes

| Code | Meaning       |
| ---- | ------------- |
| 400  | <description> |
| 404  | <description> |
| 422  | <description> |

## Consumer Expectations

<What the consuming BC assumes about this endpoint's behavior>

## Producer Guarantees

<What the providing BC commits to — response shape, error semantics, idempotency if applicable>

## Backward Compatibility Rule

Additive changes only (new optional fields, new endpoints). Breaking changes require a versioned path (e.g., `/v2/`).

## Contract Test Plan

<One sentence: e.g., "Integration test verifying <ConsumerBC> adapter correctly handles <EndpointName> success and error responses">

```

### Step 4: Gate check — every integration point covered

After generating all contract files, cross-reference against the integration list from Step 1.

For each integration point:

- ✅ CT-NNN file exists for it
- ❌ No file → hard stop

If any integration point has no contract file, display:

```

❌ Missing contracts for the following integration points:

- <integration name>

Cannot proceed to B4 until all integration points have contract files.
Create the missing contracts and re-run.

````

Do not write state.json.

### Step 5: Write `.claude/sdlc/state.json`

Only after all contracts are confirmed. Merge into the versions tree. Preserve all other fields.

```json
{
  "versions": {
    "<activeVersion>": {
      "slices": {
        "<sliceId>": {
          "state": "B4",
          "contracts": ["CT-001", "CT-002"]
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-contracts"
}
````

### Step 6: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Contracts stabilized — B3 → B4
════════════════════════════════════════════════════════════════
Contracts created:
  <CT-n>: <name> (<type>) — <producer> → <consumer>
  <CT-n>: <name> (<type>) — <producer> → <consumer>

All integration points covered. ✅

Next: /colloquium:slice-deliver
════════════════════════════════════════════════════════════════
```
