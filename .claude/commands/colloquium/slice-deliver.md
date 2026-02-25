# colloquium:slice-deliver — Slice Decomposition (B4 → B5)

**Purpose:** Decompose the approved slice into an ordered feature queue — one feature per aggregate, one per contract, one per read model. Writes NO code. Produces only documents and state.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `activeSlice.state = "B4"`. If not, display:

   ```
   ❌ Requires activeSlice.state = "B4".
   Current state: <activeSlice.state>. Run /colloquium:slice-contracts first.
   ```

   Then stop.

2. **This skill writes NO code.** It generates planning documents and state entries only. If any step seems to require writing implementation code, stop and re-read this rule.

3. **Dependency ordering must be respected.** Foundation aggregates (those with no dependencies on other features) go first. Features that depend on other features (e.g., a read model that depends on an aggregate being persisted) go last.

---

## Execution

### Step 1: Read all slice documents

Read the following files:

- `docs/slices/<activeSlice.id>/slice.md` — user journey + BCs + success metric
- `docs/slices/<activeSlice.id>/model.md` — aggregates, commands, events, cross-context integrations
- `docs/slices/<activeSlice.id>/event-storm.md` — read models, external systems

Also read the contract file list from `activeSlice.contracts[]` in state.json.

### Step 2: Determine existing feature IDs

Check if `activeSlice.featureQueue` already has entries in state.json. If it does and any features have state > C0, this skill was partially run — display the existing queue and ask: "Resume with existing queue or recompute from scratch?"

If recomputing: the queue is rebuilt from the model. If resuming: skip to Step 6.

For new queues: feature IDs are `feat-001`, `feat-002`, etc., scoped per slice.

### Step 3: Decompose aggregates

For each aggregate in model.md, create one feature entry:

- **Type:** `aggregate`
- **Name:** kebab-case of the aggregate name (e.g., `video-upload-aggregate`)
- **Owning BC:** the BC from the model
- **Dependencies:** if this aggregate depends on another aggregate being available (e.g., consumes its events), list those feat-IDs here. Otherwise: `[]`

Order aggregates so that those with no dependencies come first. If two aggregates are independent, order by complexity (simpler first).

### Step 4: Decompose contracts

For each contract in `activeSlice.contracts[]`, create one feature entry:

- **Type:** `contract`
- **Name:** kebab-case of the contract name (e.g., `video-published-event-wiring`)
- **Owning BC:** the producer BC from the CT-NNN file
- **Dependencies:** list the feat-IDs of the aggregates on both sides (producer aggregate + consumer aggregate must exist first)

### Step 5: Decompose read models

For each Read Model from the event storm, create one feature entry:

- **Type:** `read-model`
- **Name:** kebab-case of the read model name (e.g., `user-dashboard-view`)
- **Owning BC:** the BC that owns the query side (typically the consuming BC or the BC closest to the UI)
- **Dependencies:** list the feat-IDs of the aggregates that feed this read model

### Step 6: Write `docs/releases/<activeSlice.id>-internal.md`

Create `docs/releases/` if it does not exist.

```markdown
# <activeSlice.id> Internal Release Note

**Status:** In progress
**Slice:** <activeSlice.id> — <activeSlice.name>
**Features:** <count>

## Feature Queue

| ID       | Name   | Type       | Owning BC | Dependencies |
| -------- | ------ | ---------- | --------- | ------------ |
| feat-001 | <name> | aggregate  | <BC>      | —            |
| feat-002 | <name> | aggregate  | <BC>      | feat-001     |
| feat-003 | <name> | contract   | <BC>      | feat-001     |
| feat-004 | <name> | read-model | <BC>      | feat-001     |

## What Ships

[to be filled when slice-validate runs]

## Known Issues

[to be filled]
```

### Step 7: Write `.claude/sdlc/state.json`

Update `activeSlice.state = "B5"`. Add the full feature queue. Set `activeFeature` to the first feature in the queue. Preserve all other fields.

```json
{
  "activeSlice": {
    "state": "B5",
    "featureQueue": [
      {
        "id": "feat-001",
        "name": "<kebab-name>",
        "bc": "<BoundedContext>",
        "type": "aggregate",
        "dependencies": [],
        "state": "C0"
      },
      {
        "id": "feat-002",
        "name": "<kebab-name>",
        "bc": "<BoundedContext>",
        "type": "contract",
        "dependencies": ["feat-001"],
        "state": "C0"
      }
    ]
  },
  "activeFeature": {
    "id": "feat-001",
    "name": "<kebab-name>",
    "state": "C0",
    "sliceId": "<activeSlice.id>"
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-deliver"
}
```

### Step 8: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Slice decomposed — B4 → B5
════════════════════════════════════════════════════════════════
Features queued: <count>
  feat-001 — <name> (aggregate, <BC>)
  feat-002 — <name> (contract, <BC>)
  feat-003 — <name> (read-model, <BC>)

First feature: feat-001 — <name> (<type>)

Next: /colloquium:feature-spec
════════════════════════════════════════════════════════════════
```
