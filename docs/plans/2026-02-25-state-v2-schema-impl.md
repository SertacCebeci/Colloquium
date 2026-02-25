# State v2 Schema — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate `.claude/sdlc/state.json` to the v2 versioned, append-only schema and update all 18 colloquium skills to read/write via the new cursor + version tree structure.

**Architecture:** The v2 schema stores all state inside a `versions` tree. Three top-level cursor fields (`activeVersion`, `activeSlice`, `activeFeature`) hold slash-delimited path strings that dereference into the tree. Skills never mutate past entries; feature mutations append to a `history` array; feature removals append a tombstone record.

**Tech Stack:** Markdown skill files in `.claude/commands/colloquium/`. JSON state file at `.claude/sdlc/state.json`. No runtime code — these are prompt instruction files.

**Key constraint:** The current in-progress work (feat-006 at state C7, SL-001 at B5) must be resumable after migration without re-running any prior steps.

---

## Resolution Helper — Reference

Every skill uses this pattern to resolve current state. Paste this block near the top of each skill's Enforcement Rules. Skills should fail loudly if schemaVersion is not 2.

```
### State Resolution (v2)

1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. If not 2, display:
   ❌ state.json is schema v1. Run /colloquium:version --migrate first.
   Then stop.

2. Resolve current context:
   - versionId      = state.activeVersion
   - currentVersion = state.versions[versionId]
   - If state.activeSlice is set (non-null):
     - Split "v1/SL-001" on "/" → [versionId, sliceId]
     - currentSlice = currentVersion.slices[sliceId]
   - If state.activeFeature is set (non-null):
     - Split "v1/SL-001/feat-006" on "/" → [versionId, sliceId, featureId]
     - currentFeature = currentSlice.features[featureId]
```

Write pattern (example — feature state update):

```json
// BEFORE (v1):
{ "activeFeature": { "state": "C4" }, "lastUpdated": "...", "lastSkill": "..." }

// AFTER (v2) — write into the tree, update cursor if needed:
{
  "versions": { "v1": { "slices": { "SL-001": { "features": {
    "feat-006": { "state": "C4" }
  }}}}},
  "lastUpdated": "...",
  "lastSkill": "..."
}
```

---

## Task 1: Produce the Migrated state.json

**Files:**

- Overwrite: `.claude/sdlc/state.json`

**Step 1: Verify current content**

Read `.claude/sdlc/state.json`. Confirm it matches:

```json
{
  "version": 1,
  "domain": { "state": "A4", "completed": ["A0","A1","A2","A3"] },
  "domainLocked": true,
  "activeSlice": { "id": "SL-001", "name": "channel-message-delivery", "state": "B5", ... },
  "activeFeature": { "id": "feat-006", "name": "channel-sequence-head", "state": "C7", "sliceId": "SL-001" },
  "completedSlices": [],
  "completedFeatures": ["feat-001","feat-002","feat-003","feat-004","feat-005"]
}
```

**Step 2: Write the migrated state.json**

Write `.claude/sdlc/state.json` with this exact content:

```json
{
  "schemaVersion": 2,
  "activeVersion": "v1",
  "activeSlice": "v1/SL-001",
  "activeFeature": "v1/SL-001/feat-006",
  "lastUpdated": "2026-02-25T18:50:00.000Z",
  "lastSkill": "colloquium:feature-implement",
  "versions": {
    "v1": {
      "id": "v1",
      "label": "Messaging Core",
      "type": "milestone",
      "state": "active",
      "semver": "1.0.0",
      "parentVersion": null,
      "domain": {
        "state": "A4",
        "completed": ["A0", "A1", "A2", "A3"],
        "locked": true
      },
      "completedSlices": [],
      "completedFeatures": ["feat-001", "feat-002", "feat-003", "feat-004", "feat-005"],
      "slices": {
        "SL-001": {
          "id": "SL-001",
          "name": "channel-message-delivery",
          "state": "B5",
          "contracts": ["CT-001", "CT-002", "CT-003"],
          "featureOrder": [
            "feat-001",
            "feat-002",
            "feat-003",
            "feat-004",
            "feat-005",
            "feat-006",
            "feat-007",
            "feat-008",
            "feat-009"
          ],
          "features": {
            "feat-001": {
              "id": "feat-001",
              "name": "channel-aggregate",
              "bc": "Messaging",
              "type": "aggregate",
              "dependencies": [],
              "state": "done",
              "history": []
            },
            "feat-002": {
              "id": "feat-002",
              "name": "channel-created-acl-wiring",
              "bc": "Messaging",
              "type": "contract",
              "dependencies": ["feat-001"],
              "state": "done",
              "history": []
            },
            "feat-003": {
              "id": "feat-003",
              "name": "member-added-to-channel-acl-wiring",
              "bc": "Messaging",
              "type": "contract",
              "dependencies": ["feat-001"],
              "state": "done",
              "history": []
            },
            "feat-004": {
              "id": "feat-004",
              "name": "channel-message-posted-event-emission",
              "bc": "Messaging",
              "type": "contract",
              "dependencies": ["feat-001"],
              "state": "done",
              "history": []
            },
            "feat-005": {
              "id": "feat-005",
              "name": "channel-feed-view",
              "bc": "Messaging",
              "type": "read-model",
              "dependencies": ["feat-001"],
              "state": "done",
              "history": []
            },
            "feat-006": {
              "id": "feat-006",
              "name": "channel-sequence-head",
              "bc": "Messaging",
              "type": "read-model",
              "dependencies": ["feat-001"],
              "state": "C7",
              "history": []
            },
            "feat-007": {
              "id": "feat-007",
              "name": "messages-since-seq",
              "bc": "Messaging",
              "type": "read-model",
              "dependencies": ["feat-001", "feat-006"],
              "state": "C0",
              "history": []
            },
            "feat-008": {
              "id": "feat-008",
              "name": "websocket-session-aggregate",
              "bc": "Messaging",
              "type": "aggregate",
              "dependencies": ["feat-001", "feat-006", "feat-007"],
              "state": "C0",
              "history": []
            },
            "feat-009": {
              "id": "feat-009",
              "name": "active-sessions-for-channel",
              "bc": "Messaging",
              "type": "read-model",
              "dependencies": ["feat-008"],
              "state": "C0",
              "history": []
            }
          }
        }
      }
    }
  }
}
```

**Step 3: Verify write**

Re-read `.claude/sdlc/state.json`. Confirm:

- `schemaVersion` = 2
- `activeVersion` = "v1"
- `activeSlice` = "v1/SL-001"
- `activeFeature` = "v1/SL-001/feat-006"
- `versions.v1.slices.SL-001.features.feat-006.state` = "C7"
- `versions.v1.slices.SL-001.features.feat-001.state` = "done"

**Step 4: Commit**

```bash
git add .claude/sdlc/state.json
git commit -m "feat(sdlc): migrate state.json to v2 versioned schema"
```

Expected: commit succeeds.

---

## Task 2: Update colloquium:domain-frame (A0 → A1)

**Files:**

- Modify: `.claude/commands/colloquium/domain-frame.md`

**Step 1: Read current file**

Read `.claude/commands/colloquium/domain-frame.md`. Note these two locations that must change:

1. Enforcement Rule 1 re-run guard: currently reads `domain.state`
2. Step 5 state.json write: currently writes `version: 1, domain.{state,completed}, completedSlices, completedFeatures`

**Step 2: Replace the re-run guard (Enforcement Rule 1)**

Find:

```
1. **Re-run guard:** Read `.claude/sdlc/state.json`. If `domain.state` exists and is not `"A0"` (i.e., the domain has already been framed or is further along), display:

```

❌ Domain framing already completed (domain.state = "<current state>").
To redo framing, manually reset domain.state to "A0" in .claude/sdlc/state.json.

```

```

Replace with:

```
1. **Re-run guard:** Read `.claude/sdlc/state.json`.

   If the file does not exist or `schemaVersion` is missing → this is a fresh project. Proceed to Step 1 (will create v2 state.json).

   If `schemaVersion = 2`: resolve `currentVersion = state.versions[state.activeVersion]`. If `currentVersion.domain.state` exists and is not `"A0"`, display:
```

❌ Domain framing already completed (domain.state = "<currentVersion.domain.state>").
To redo framing, manually reset versions.<activeVersion>.domain.state to "A0" in .claude/sdlc/state.json.

```
Then stop.
```

**Step 3: Replace the state.json write (Step 5)**

Find the entire Step 5 block:

````
### Step 5: Write `.claude/sdlc/state.json`

Create `.claude/sdlc/` if it does not exist.

Write (or update) `.claude/sdlc/state.json`:

```json
{
  "version": 1,
  "domain": {
    "state": "A1",
    "completed": ["A0"]
  },
  "completedSlices": [],
  "completedFeatures": [],
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-frame"
}
````

If `state.json` already exists with other fields (e.g., from a partial session), merge — do not overwrite unrelated fields.

```

Replace with:
```

### Step 5: Write `.claude/sdlc/state.json`

Create `.claude/sdlc/` if it does not exist.

**If state.json does not exist (fresh project):** Write the full v2 structure:

```json
{
  "schemaVersion": 2,
  "activeVersion": "v1",
  "activeSlice": null,
  "activeFeature": null,
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-frame",
  "versions": {
    "v1": {
      "id": "v1",
      "label": "",
      "type": "milestone",
      "state": "active",
      "semver": "1.0.0",
      "parentVersion": null,
      "domain": {
        "state": "A1",
        "completed": ["A0"],
        "locked": false
      },
      "completedSlices": [],
      "completedFeatures": [],
      "slices": {}
    }
  }
}
```

**If state.json already exists (schemaVersion 2):** Merge — update only:

```json
{
  "versions": {
    "<activeVersion>": {
      "domain": {
        "state": "A1",
        "completed": ["A0"]
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-frame"
}
```

Preserve all other fields. Do not overwrite the versions tree — merge into it.

````

**Step 4: Verify**

Read the updated file. Confirm:
- Re-run guard now references `versions[activeVersion].domain.state`
- Step 5 creates full v2 structure for fresh projects
- Step 5 merges into version tree for existing projects

**Step 5: Commit**

```bash
git add .claude/commands/colloquium/domain-frame.md
git commit -m "feat(sdlc): update domain-frame for v2 schema"
````

---

## Task 3: Update colloquium:domain-subdomains (A1 → A2)

**Files:**

- Modify: `.claude/commands/colloquium/domain-subdomains.md`

**Step 1: Read current file**

Read `.claude/commands/colloquium/domain-subdomains.md`. Two locations change:

1. Enforcement Rule 1: reads `domain.state`
2. Step 5: writes `domain.{state, completed}` (merge)

**Step 2: Replace Enforcement Rule 1**

Find:

```
1. Read `.claude/sdlc/state.json`. Require `domain.state = "A1"`. If not, display:

```

❌ Requires domain.state = "A1". Current state: <state>.
Run /colloquium:domain-frame first.

```

```

Replace with:

```
1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. Resolve `currentVersion = state.versions[state.activeVersion]`. Require `currentVersion.domain.state = "A1"`. If not, display:

```

❌ Requires domain.state = "A1". Current state: <currentVersion.domain.state>.
Run /colloquium:domain-frame first.

```

```

**Step 3: Replace Step 5 state write**

Find:

```json
{
  "domain": {
    "state": "A2",
    "completed": ["A0", "A1"]
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-subdomains"
}
```

Replace with:

```json
{
  "versions": {
    "<activeVersion>": {
      "domain": {
        "state": "A2",
        "completed": ["A0", "A1"]
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-subdomains"
}
```

Add note: "Merge into versions tree. Do not overwrite other fields."

**Step 4: Commit**

```bash
git add .claude/commands/colloquium/domain-subdomains.md
git commit -m "feat(sdlc): update domain-subdomains for v2 schema"
```

---

## Task 4: Update colloquium:domain-contexts (A2 → A3)

**Files:**

- Modify: `.claude/commands/colloquium/domain-contexts.md`

**Step 1: Apply identical pattern as Task 3**

Same two change locations:

1. Enforcement Rule 1: `domain.state = "A2"` → resolve via `currentVersion.domain.state`
2. Step 6 write: `domain.{state:"A3", completed:[...]}` → merge into `versions[activeVersion].domain`

**Step 2: Update Enforcement Rule 1 check**

Change: `domain.state = "A2"` → `currentVersion.domain.state = "A2"` (after resolving cursor).

**Step 3: Update Step 6 write**

```json
{
  "versions": {
    "<activeVersion>": {
      "domain": {
        "state": "A3",
        "completed": ["A0", "A1", "A2"]
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-contexts"
}
```

**Step 4: Commit**

```bash
git add .claude/commands/colloquium/domain-contexts.md
git commit -m "feat(sdlc): update domain-contexts for v2 schema"
```

---

## Task 5: Update colloquium:domain-map (A3 → A4)

**Files:**

- Modify: `.claude/commands/colloquium/domain-map.md`

**Step 1: Read current file**

Three locations change:

1. Enforcement Rule 1: reads `domain.state`
2. Enforcement Rule 3 lock guard: reads/sets `domainLocked` (top-level)
3. Step 6: writes `domain.{state, completed}, domainLocked: true`

**Step 2: Update Enforcement Rule 1**

Same pattern as Tasks 3-4. Check `currentVersion.domain.state = "A3"`.

**Step 3: Update Enforcement Rule 3 (domain lock)**

Find:

```
3. **Final lock:** After writing A4, set `domainLocked: true` in state.json. Any subsequent attempt to run any A-layer skill (`domain-frame`, `domain-subdomains`, `domain-contexts`, `domain-map`) must display:
```

❌ Domain discovery is permanently closed (domainLocked: true).
To override, manually delete the domainLocked field from .claude/sdlc/state.json.

```

```

Replace with:

```
3. **Final lock:** After writing A4, set `versions.<activeVersion>.domain.locked = true` in state.json. Any subsequent attempt to run any A-layer skill must resolve the current version's domain and check `locked`. If `true`, display:
```

❌ Domain discovery is permanently closed (domain.locked = true in version <activeVersion>).
To override, manually set versions.<activeVersion>.domain.locked to false in .claude/sdlc/state.json.

```
Then stop. All A-layer skills must add this check at top (after schemaVersion check): if `currentVersion.domain.locked = true`, display the error and stop.
```

**Step 4: Update Step 6 write**

Find:

```json
{
  "domain": {
    "state": "A4",
    "completed": ["A0", "A1", "A2", "A3"]
  },
  "domainLocked": true,
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-map"
}
```

Replace with:

```json
{
  "versions": {
    "<activeVersion>": {
      "domain": {
        "state": "A4",
        "completed": ["A0", "A1", "A2", "A3"],
        "locked": true
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-map"
}
```

**Step 5: Add domain-locked check to all 4 A-layer skills**

For each of: `domain-frame.md`, `domain-subdomains.md`, `domain-contexts.md`, `domain-map.md`:

Add this check in Enforcement Rules (after schemaVersion check):

```
N. **Domain lock guard:** After resolving `currentVersion`, check `currentVersion.domain.locked`. If `true`, display:
```

❌ Domain discovery is permanently closed (domain.locked = true in version <activeVersion>).
To override, manually set versions.<activeVersion>.domain.locked to false in .claude/sdlc/state.json.

```
Then stop. (Exception: domain-frame when creating a fresh project with no state.json.)
```

**Step 6: Commit**

```bash
git add .claude/commands/colloquium/domain-map.md .claude/commands/colloquium/domain-frame.md .claude/commands/colloquium/domain-subdomains.md .claude/commands/colloquium/domain-contexts.md
git commit -m "feat(sdlc): update domain-map and add lock guard to all A-layer skills for v2"
```

---

## Task 6: Update colloquium:slice-select (B0 → B1)

**Files:**

- Modify: `.claude/commands/colloquium/slice-select.md`

**Step 1: Read current file**

Five locations change:

1. Enforcement Rule 1: reads `domain.state`
2. Enforcement Rule 2 (active slice guard): reads `activeSlice` as object
3. Step 1 (auto-assign slice ID): scans `docs/slices/` for SL-NNN
4. Step 5: writes `activeSlice` as an object at top level
5. Does NOT check `domainLocked` currently — add the lock check here too

**Step 2: Update Enforcement Rule 1**

Find: `Require \`domain.state = "A4"\``Replace with: resolve cursor; check`currentVersion.domain.state = "A4"`. Also check `currentVersion.domain.locked = true` (domain must be locked before slicing).

**Step 3: Update Enforcement Rule 2 (active slice guard)**

Find:

```
2. **Active slice guard:** If `activeSlice` already exists in state.json, display:

```

⚠️ Active slice already exists: <activeSlice.id> "<activeSlice.name>" (state: <activeSlice.state>)

```

```

Replace with:

```
2. **Active slice guard:** If `state.activeSlice` is non-null, resolve `currentSlice`. Display:

```

⚠️ Active slice already exists: <currentSlice.id> "<currentSlice.name>" (state: <currentSlice.state>)

```

```

Same routing (complete first vs abandon), but when abandoning: set `state.activeSlice = null`, `state.activeFeature = null` — do NOT delete the slice entry from the versions tree.

**Step 4: Update Step 1 (auto-assign slice ID)**

Find: `Scan \`docs/slices/\` for existing directories matching \`SL-NNN\``

Replace with:

```
Scan `currentVersion.slices` for existing keys matching `SL-NNN`. Extract the highest existing N. Assign N+1. If `slices` is empty or has no SL-NNN keys, start at SL-001.

Create the directory `docs/slices/SL-<n>/` now.
```

**Step 5: Update Step 5 state write**

Find:

```json
{
  "activeSlice": {
    "id": "SL-<n>",
    "name": "<kebab-name>",
    "state": "B1",
    "contracts": [],
    "featureQueue": []
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-select"
}
```

Replace with:

```json
{
  "activeSlice": "v1/SL-<n>",
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

**Step 6: Commit**

```bash
git add .claude/commands/colloquium/slice-select.md
git commit -m "feat(sdlc): update slice-select for v2 schema"
```

---

## Task 7: Update colloquium:slice-storm (B1 → B2)

**Files:**

- Modify: `.claude/commands/colloquium/slice-storm.md`

**Step 1: Three changes**

1. Enforcement Rule 1: reads `activeSlice.state`
2. Step 1 (read slice): reads `activeSlice.id`
3. Step 7 state write: writes `activeSlice.state = "B2"`

**Step 2: Update Enforcement Rule 1**

Find: `Require \`activeSlice.state = "B1"\``Replace with: resolve cursor; check`currentSlice.state = "B1"`.

Error message: replace `<activeSlice.state>` with `<currentSlice.state>`.

**Step 3: Update Step 1 (read slice)**

Find: `Read \`docs/slices/<activeSlice.id>/slice.md\``Replace with: extract`sliceId`from`state.activeSlice`path (split on "/", take index 1). Read`docs/slices/<sliceId>/slice.md`.

**Step 4: Update Step 7 state write**

Find:

```json
{
  "activeSlice": {
    "state": "B2"
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-storm"
}
```

Replace with:

```json
{
  "versions": {
    "<activeVersion>": {
      "slices": {
        "<sliceId>": {
          "state": "B2"
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-storm"
}
```

**Step 5: Commit**

```bash
git add .claude/commands/colloquium/slice-storm.md
git commit -m "feat(sdlc): update slice-storm for v2 schema"
```

---

## Task 8: Update colloquium:slice-model (B2 → B3)

**Files:**

- Modify: `.claude/commands/colloquium/slice-model.md`

**Step 1: Apply identical pattern as Task 7**

Same three change locations:

1. Rule 1 guard: `currentSlice.state = "B2"`
2. Step 1 read: resolve `sliceId` from cursor
3. Step 7 write: merge `slices[sliceId].state = "B3"` into versions tree

**Step 2: Write state write block**

```json
{
  "versions": {
    "<activeVersion>": {
      "slices": {
        "<sliceId>": { "state": "B3" }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-model"
}
```

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-model.md
git commit -m "feat(sdlc): update slice-model for v2 schema"
```

---

## Task 9: Update colloquium:slice-contracts (B3 → B4)

**Files:**

- Modify: `.claude/commands/colloquium/slice-contracts.md`

**Step 1: Three changes**

1. Rule 1 guard: `currentSlice.state = "B3"`
2. Step 1 (read model): resolve sliceId from cursor
3. Step 5 write: updates `slices[sliceId].state = "B4"` AND `slices[sliceId].contracts = [...]`

**Step 2: Update Step 5 write**

Find:

```json
{
  "activeSlice": {
    "state": "B4",
    "contracts": ["CT-001", "CT-002"]
  },
  ...
}
```

Replace with:

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
```

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/slice-contracts.md
git commit -m "feat(sdlc): update slice-contracts for v2 schema"
```

---

## Task 10: Update colloquium:slice-deliver (B4 → B5)

**Files:**

- Modify: `.claude/commands/colloquium/slice-deliver.md`

**Step 1: This is the most complex slice skill — five changes**

1. Rule 1 guard: `currentSlice.state = "B4"`
2. Step 1 reads: `activeSlice.contracts[]` → `currentSlice.contracts`
3. Step 2 resume check: reads `activeSlice.featureQueue` → reads `currentSlice.featureOrder` + `currentSlice.features`
4. Step 7 write: `activeSlice.featureQueue` (array) → `featureOrder` + `features` dict; `activeFeature` (object) → cursor string
5. Step 8 completion banner: references `activeSlice.id` → references sliceId from cursor

**Step 2: Update Step 2 (resume check)**

Find: `Check if \`activeSlice.featureQueue\` already has entries`

Replace with:

```
Check if `currentSlice.featureOrder` is non-empty in state.json. If it is, and any feature in `currentSlice.features` has `state > "C0"`, this skill was partially run — display the existing queue and ask: "Resume with existing queue or recompute from scratch?"

If recomputing: clear `currentSlice.featureOrder = []` and `currentSlice.features = {}` in state. If resuming: skip to Step 6.

Feature IDs are `feat-001`, `feat-002`, etc. (scoped per slice — a new slice starts at feat-001 again).
```

**Step 3: Update Step 7 state write**

Find:

```json
{
  "activeSlice": {
    "state": "B5",
    "featureQueue": [
      { "id": "feat-001", "name": "<kebab-name>", "bc": "<BC>", "type": "aggregate", "dependencies": [], "state": "C0" },
      { "id": "feat-002", ... }
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

Replace with:

```json
{
  "activeFeature": "<activeVersion>/<sliceId>/feat-001",
  "versions": {
    "<activeVersion>": {
      "slices": {
        "<sliceId>": {
          "state": "B5",
          "featureOrder": ["feat-001", "feat-002", "feat-003"],
          "features": {
            "feat-001": {
              "id": "feat-001",
              "name": "<kebab-name>",
              "bc": "<BC>",
              "type": "aggregate",
              "dependencies": [],
              "state": "C0",
              "history": []
            },
            "feat-002": {
              "id": "feat-002",
              "name": "<kebab-name>",
              "bc": "<BC>",
              "type": "contract",
              "dependencies": ["feat-001"],
              "state": "C0",
              "history": []
            }
          }
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-deliver"
}
```

Add note: "Set `activeFeature` to the cursor path of the first feature with no dependencies. Merge into versions tree."

**Step 4: Commit**

```bash
git add .claude/commands/colloquium/slice-deliver.md
git commit -m "feat(sdlc): update slice-deliver for v2 schema"
```

---

## Task 11: Update colloquium:feature-spec (C0 → C2)

**Files:**

- Modify: `.claude/commands/colloquium/feature-spec.md`

**Step 1: Four changes**

1. Rule 1 guard: reads `activeFeature.state`
2. Step 1 (load feature context): reads `activeFeature.id`, `activeFeature.sliceId`; finds entry in `activeSlice.featureQueue`
3. Step 2 (read model): reads `activeFeature.sliceId`
4. Step 6 state write: updates `activeFeature.state = "C2"`

**Step 2: Update Rule 1**

Find: `Require \`activeFeature\` to exist and \`activeFeature.state = "C0"\``

Replace with: resolve cursor; require `state.activeFeature` to be non-null and `currentFeature.state = "C0"`.

Error messages: replace `<state>` references with `<currentFeature.state>`.

**Step 3: Update Step 1 (load feature context)**

Find:

```
From state.json, read:
- `activeFeature.id` — e.g., `feat-001`
- `activeFeature.name` — kebab-case name
- `activeFeature.sliceId` — which slice this belongs to

Find the matching entry in `activeSlice.featureQueue`:
```

Replace with:

```
Resolve cursor: split `state.activeFeature` ("v1/SL-001/feat-006") → versionId, sliceId, featureId.

Read:
- featureId — e.g., `feat-006`
- currentFeature = `state.versions[versionId].slices[sliceId].features[featureId]`

From `currentFeature`, read:
- `id` — e.g., `feat-006`
- `name` — kebab-case name
- `bc`, `type`, `dependencies`
```

**Step 4: Update Step 2 (read model path)**

Find: `Read \`docs/slices/<activeFeature.sliceId>/model.md\``Replace with:`Read \`docs/slices/<sliceId>/model.md\`` (sliceId resolved from cursor)

**Step 5: Update Step 6 state write**

Find:

```json
{
  "activeFeature": {
    "state": "C2"
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:feature-spec"
}
```

Replace with:

```json
{
  "versions": {
    "<versionId>": {
      "slices": {
        "<sliceId>": {
          "features": {
            "<featureId>": { "state": "C2" }
          }
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:feature-spec"
}
```

**Step 6: Commit**

```bash
git add .claude/commands/colloquium/feature-spec.md
git commit -m "feat(sdlc): update feature-spec for v2 schema"
```

---

## Task 12: Update colloquium:feature-implement (C2 → C7)

**Files:**

- Modify: `.claude/commands/colloquium/feature-implement.md`

**Step 1: Three change types**

1. Rule 1 guard: reads `activeFeature.state`
2. Session Start banner: reads `activeFeature.state`, derives spec path from `activeFeature`
3. Five state writes (one per sub-step: C3, C4, C5, C6, C7): all write `activeFeature.state`

**Step 2: Update Rule 1**

Find: `Require \`activeFeature.state\` to be one of: \`C2\`, \`C3\`, \`C4\`, \`C5\`, \`C6\``

Replace with: resolve cursor; check `currentFeature.state` against the list.

Error routing messages: reference `currentFeature.state` instead of `activeFeature.state`.

**Step 3: Update Session Start banner**

Find: `"Current state: <C-state>"`
Replace with: resolve cursor; display `currentFeature.state`.

Find: `"Spec: docs/features/<BC>/<Aggregate>/spec.md"`
Replace with: use `currentFeature.bc` and `currentFeature.name` to derive path.

**Step 4: Update all five state writes**

Pattern: Every `"State write: Update \`activeFeature.state = "CX"\`"` instruction.

Replace all five with the v2 merge pattern. Example for C3:

```json
{
  "versions": {
    "<versionId>": {
      "slices": {
        "<sliceId>": {
          "features": { "<featureId>": { "state": "C3" } }
        }
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:feature-implement"
}
```

Apply same pattern for C4, C5, C6, C7.

**Step 5: Commit**

```bash
git add .claude/commands/colloquium/feature-implement.md
git commit -m "feat(sdlc): update feature-implement for v2 schema"
```

---

## Task 13: Update colloquium:feature-verify (C7 → F4)

**Files:**

- Modify: `.claude/commands/colloquium/feature-verify.md`

**Step 1: Four changes**

1. Rule 1 guard: reads `activeFeature.state`
2. Step 1 (load context): reads `activeFeature.id`, `activeFeature.name`, `activeFeature.sliceId`
3. Step 4 (regression): reads `completedFeatures[]` from top-level
4. Two state writes (fail → C6, pass → F4)

**Step 2: Update Rule 1**

Resolve cursor; check `currentFeature.state = "C7"`.

**Step 3: Update Step 1**

Resolve cursor. Read `currentFeature.{id, name, bc}`. Derive sliceId from cursor path.

**Step 4: Update Step 4 (regression check)**

Find: `Read \`completedFeatures[]\` from state.json`Replace with:`Read \`currentVersion.completedFeatures\` from state.json`

**Step 5: Update state writes**

Fail write (route back to C6):

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

Pass write (F4):

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

**Step 6: Commit**

```bash
git add .claude/commands/colloquium/feature-verify.md
git commit -m "feat(sdlc): update feature-verify for v2 schema"
```

---

## Task 14: Update colloquium:feature-integrate (F4 → done)

**Files:**

- Modify: `.claude/commands/colloquium/feature-integrate.md`

**Step 1: This is the most complex feature skill — six changes**

1. Rule 1 guard: reads `activeFeature.state`
2. Step 1 (load context): reads `activeFeature`, `activeSlice`
3. Steps 2-3 (wiring checks): iterate `activeSlice.featureQueue` looking up features by ID
4. Step 6 state write: sets feature to "done", clears `activeFeature`, appends to `completedFeatures`
5. Step 7 (advance queue): find next C0 feature; skip removed (tombstoned) features; set new `activeFeature` cursor
6. Completion banner: references feature and queue

**Step 2: Update Rule 1**

Resolve cursor; check `currentFeature.state = "F4"`.

**Step 3: Update Step 1**

Resolve cursor. Access `currentFeature` and `currentSlice` via resolution pattern.

**Step 4: Update Steps 2-3 (wiring checks)**

Find all: `activeSlice.featureQueue` references and feature lookups.

Replace with: iterate `currentSlice.featureOrder.map(id => currentSlice.features[id])`. Filter out features where `history` contains `{ type: "removed" }`.

**Step 5: Update Step 6 state write**

Find:

```json
{
  "activeSlice": {
    "featureQueue": [{ "id": "feat-001", "state": "done" }]
  },
  "activeFeature": null,
  "completedFeatures": ["feat-001"],
  ...
}
```

Replace with:

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

**Step 6: Update Step 7 (advance queue)**

Find: `Check \`activeSlice.featureQueue\` for features with \`state: "C0"\``

Replace with:

```
Scan `currentSlice.featureOrder` in order. For each featureId:
1. Check `currentSlice.features[featureId].state` — if not "C0", skip.
2. Check `currentSlice.features[featureId].history` — if contains `{ type: "removed" }`, skip.
3. Check all `dependencies` are in `currentVersion.completedFeatures` — if not all done, skip.
4. First feature passing all checks: set `state.activeFeature = "<versionId>/<sliceId>/<featureId>"`.

If no feature passes: all features complete — display the queue-exhausted banner.
```

**Step 7: Commit**

```bash
git add .claude/commands/colloquium/feature-integrate.md
git commit -m "feat(sdlc): update feature-integrate for v2 schema"
```

---

## Task 15: Update colloquium:slice-validate (B5 → done)

**Files:**

- Modify: `.claude/commands/colloquium/slice-validate.md`

**Step 1: Four changes**

1. Rule 1 guard: reads `activeSlice.state`
2. Rule 2 pre-check: reads `activeSlice.featureQueue`
3. Step 4 regression: reads `completedSlices[]`
4. Step 7 state write: removes `activeSlice`, adds to `completedSlices`

**Step 2: Update Rule 1**

Resolve cursor; check `currentSlice.state = "B5"`.

**Step 3: Update Rule 2 pre-check**

Find: `Read \`activeSlice.featureQueue\` from state.json. Every feature must have \`state: "done"\`.`

Replace with:

```
Resolve cursor. Get the ordered feature list: `currentSlice.featureOrder.map(id => currentSlice.features[id])`.
Filter out features with a `removed` tombstone in `history`.
Every remaining feature must have `state: "done"`.
```

**Step 4: Update Step 4 regression**

Find: `Read \`completedSlices[]\` from state.json`Replace with:`Read \`currentVersion.completedSlices\` from state.json`

**Step 5: Update Step 7 state write**

Find:

```json
{
  "completedSlices": ["<previous-ids>", "<activeSlice.id>"],
  "activeSlice": null,
  "activeFeature": null,
  ...
}
```

Replace with:

```json
{
  "activeSlice": null,
  "activeFeature": null,
  "versions": {
    "<versionId>": {
      "completedSlices": ["<previous-ids>", "<sliceId>"]
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-validate"
}
```

Add note: "Do NOT remove the slice entry from `versions[versionId].slices`. The slice data is permanently archived in the tree."

**Step 6: Commit**

```bash
git add .claude/commands/colloquium/slice-validate.md
git commit -m "feat(sdlc): update slice-validate for v2 schema"
```

---

## Task 16: Update colloquium:status (read-only display)

**Files:**

- Modify: `.claude/commands/colloquium/status.md`

**Step 1: Add version header to the banner**

After the `No SDLC session started` check, update the banner template to show version info at the top:

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC STATUS
════════════════════════════════════════════════════════════════
Version:   <activeVersion> (<semver>) — <label> [<state>]
           <list completed versions above active if any>

Domain:    <currentVersion.domain.state> — <description>
           <N> bounded contexts: <names>
...
```

**Step 2: Update Domain section**

Change: reads `domain.state` → reads `currentVersion.domain.state`.

**Step 3: Update Slices section**

Change: reads `completedSlices[]` → reads `currentVersion.completedSlices`.

Change: reads `activeSlice.*` → resolves cursor, reads `currentSlice.*`.

**Step 4: Update Features section**

Change: reads `activeSlice.featureQueue` → reads `currentSlice.featureOrder.map(id => features[id])` filtered for non-removed.

Feature display rules (✓, ►, ○) remain identical.

**Step 5: Commit**

```bash
git add .claude/commands/colloquium/status.md
git commit -m "feat(sdlc): update status for v2 schema with version header"
```

---

## Task 17: Update colloquium:sdlc dispatcher

**Files:**

- Modify: `.claude/commands/colloquium/sdlc.md`

**Step 1: Update Step 2 (read state)**

After reading state.json, add schemaVersion check:

```
If `schemaVersion` is not 2 (or is missing):
→ Display "No SDLC session found" and invoke `colloquium:domain-frame`. Stop.
```

**Step 2: Update Step 3 (current position banner)**

Change all `domain.*` references → `currentVersion.domain.*`.
Change all `activeSlice.*` references → resolve cursor, read `currentSlice.*`.
Change all `activeFeature.*` references → resolve cursor, read `currentFeature.*`.

**Step 3: Update Step 4 routing table**

Every condition that reads `domain.state` → reads `currentVersion.domain.state`.
Every condition that reads `domainLocked` → reads `currentVersion.domain.locked`.
Every condition that reads `activeSlice` (as object) → checks `state.activeSlice` (non-null).
Every condition that reads `activeSlice.state` → resolves `currentSlice.state`.
Every condition that reads `activeFeature.state` → resolves `currentFeature.state`.
`activeSlice.featureQueue` all-done check → check all entries in `currentSlice.features` (non-removed) have `state = "done"`.

**Step 4: Commit**

```bash
git add .claude/commands/colloquium/sdlc.md
git commit -m "feat(sdlc): update sdlc dispatcher for v2 schema"
```

---

## Task 18: Create colloquium:version skill

**Files:**

- Create: `.claude/commands/colloquium/version.md`

**Step 1: Write the new skill**

Write `.claude/commands/colloquium/version.md` with this content:

```markdown
# colloquium:version — Version Management

**Purpose:** Create a new product version (milestone, patch, or hotfix) in the SDLC state. Use this to start a new development milestone after releasing the current one, or to start a patch/hotfix against a released version.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. If not, stop.

2. **Release guard:** Cannot create a new version while `state.activeSlice` or `state.activeFeature` is non-null. Display:
```

❌ Cannot create a new version while work is in progress.
Active slice: <state.activeSlice>
Active feature: <state.activeFeature>

Complete or abandon the active slice first.

````
Then stop.

---

## Execution

### Step 1: Ask version type

Use AskUserQuestion:

1. What type of version are you creating?
- Milestone (major/minor feature release — new domain work allowed)
- Patch (bug fix against a released milestone — inherits domain)
- Hotfix (critical emergency fix — inherits domain)

2. What is the version label? (e.g., "User Authentication", "Fix: login regression")

3. What is the semver? (e.g., "1.1.0" for a minor milestone, "1.0.1" for a patch)

4. Which version does this derive from? (for Patch/Hotfix: required; for Milestone: optional parent)

### Step 2: Determine new version ID

The version ID is derived from the semver: `"v1.1.0"` → `"v1.1.0"`, or simpler: `"v2"`, `"v1.0.1"`.

Use the semver as the key directly (e.g., `"v1.0.1"`). If the user provides a simple label without semver dots, use `"v<N>"` format.

### Step 3: Write to state.json

Add the new version to the versions tree. For Milestone:

```json
{
"activeVersion": "<new-version-id>",
"activeSlice": null,
"activeFeature": null,
"versions": {
 "<new-version-id>": {
   "id": "<new-version-id>",
   "label": "<label>",
   "type": "milestone",
   "state": "active",
   "semver": "<semver>",
   "parentVersion": "<parent-id or null>",
   "domain": {
     "state": "A0",
     "completed": [],
     "locked": false
   },
   "completedSlices": [],
   "completedFeatures": [],
   "slices": {}
 }
},
"lastUpdated": "<ISO timestamp>",
"lastSkill": "colloquium:version"
}
````

For Patch/Hotfix: same structure but `type: "patch"` (or `"hotfix"`) and `domain: { "inherits": "<parentVersionId>" }`.

Also mark the previous active version as `state: "released"`:

```json
{
  "versions": {
    "<previous-active-version-id>": { "state": "released" }
  }
}
```

### Step 4: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Version created — <new-version-id>
════════════════════════════════════════════════════════════════
Version:  <new-version-id> (<semver>) — <label>
Type:     <milestone | patch | hotfix>
Parent:   <parentVersionId or "none">
Domain:   <"fresh — run /colloquium:domain-frame" | "inherited from <parent>">

Previous version <old-id>: marked as released.

Next: /colloquium:sdlc
════════════════════════════════════════════════════════════════
```

````

**Step 2: Register in settings.json**

Read `.claude/settings.json`. Add `colloquium:version` to the skills list if a skills list exists.

**Step 3: Commit**

```bash
git add .claude/commands/colloquium/version.md
git commit -m "feat(sdlc): add colloquium:version skill for version management"
````

---

## Task 19: Final Smoke Test (Verification)

**Files:** Read-only checks.

**Step 1: Verify state.json is well-formed**

Read `.claude/sdlc/state.json`. Confirm:

- `schemaVersion = 2`
- `activeVersion = "v1"`
- `activeSlice = "v1/SL-001"` (non-null)
- `activeFeature = "v1/SL-001/feat-006"` (non-null)
- `versions.v1.slices.SL-001.features.feat-006.state = "C7"` (the in-progress feature)
- `versions.v1.domain.locked = true`
- `versions.v1.completedFeatures` has 5 entries

**Step 2: Trace through sdlc routing for current state**

Mentally execute the routing table in `sdlc.md` with the current state:

- `currentVersion.domain.state = "A4"` AND `state.activeSlice` is non-null
- `currentSlice.state = "B5"` AND `state.activeFeature` is non-null
- `currentFeature.state = "C7"`
- Expected route: `feature-verify` — "Journey check passed — UAT to run" ✅

**Step 3: Trace through status display**

Mentally execute `status.md` with current state. Confirm:

- Version line: `v1 (1.0.0) — Messaging Core [active]`
- Domain line: `A4 — domain locked — context map complete`
- Slice: `SL-001 "channel-message-delivery" ► active — B5 (9 features queued)`
- Feature list: feat-001 through feat-005 ✓, feat-006 ► (active), feat-007/008/009 ○

**Step 4: Verify no skill was missed**

Check all `.claude/commands/colloquium/*.md` files. Every file that previously wrote `activeFeature`, `activeSlice`, `domain.state`, `completedFeatures`, or `completedSlices` should now reference the version tree. Policy skill (`policy.md`) is excluded — it never reads/writes state.json.

Skills to confirm updated:

- [x] domain-frame
- [x] domain-subdomains
- [x] domain-contexts
- [x] domain-map
- [x] slice-select
- [x] slice-storm
- [x] slice-model
- [x] slice-contracts
- [x] slice-deliver
- [x] feature-spec
- [x] feature-implement
- [x] feature-verify
- [x] feature-integrate
- [x] slice-validate
- [x] status
- [x] sdlc
- [x] version (new)
- [ ] policy — no state.json access, skip
- [ ] project.md / project-plan.md / project-implement.md — deprecated skills, skip

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(sdlc): complete v2 schema migration — all skills updated"
```

---

## Summary of All Commits (in order)

1. `feat(sdlc): migrate state.json to v2 versioned schema`
2. `feat(sdlc): update domain-frame for v2 schema`
3. `feat(sdlc): update domain-subdomains for v2 schema`
4. `feat(sdlc): update domain-contexts for v2 schema`
5. `feat(sdlc): update domain-map and add lock guard to all A-layer skills for v2`
6. `feat(sdlc): update slice-select for v2 schema`
7. `feat(sdlc): update slice-storm for v2 schema`
8. `feat(sdlc): update slice-model for v2 schema`
9. `feat(sdlc): update slice-contracts for v2 schema`
10. `feat(sdlc): update slice-deliver for v2 schema`
11. `feat(sdlc): update feature-spec for v2 schema`
12. `feat(sdlc): update feature-implement for v2 schema`
13. `feat(sdlc): update feature-verify for v2 schema`
14. `feat(sdlc): update feature-integrate for v2 schema`
15. `feat(sdlc): update slice-validate for v2 schema`
16. `feat(sdlc): update status for v2 schema with version header`
17. `feat(sdlc): update sdlc dispatcher for v2 schema`
18. `feat(sdlc): add colloquium:version skill for version management`
19. `feat(sdlc): complete v2 schema migration — all skills updated`
