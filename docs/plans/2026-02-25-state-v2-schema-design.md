# State v2 Schema Design — Versioned, Append-Only SDLC State

**Date:** 2026-02-25
**Status:** Approved — ready for implementation planning

---

## Problem

The current `.claude/sdlc/state.json` is a _live session cursor only_. It has no history:

- When `activeSlice` completes, `completedSlices` stores only the slice ID — all feature detail is discarded.
- `completedFeatures` stores only feature IDs — no names, types, dependencies, or states.
- There is no concept of product versioning (milestones, patches).
- Feature descriptions and names cannot be corrected without in-place mutation (no trace).
- Features cannot be removed without hard deletion.
- There is no way to model a bug fix against a shipped feature.

---

## Design Goals

1. **Append-only** — no field is ever overwritten. Mutations are expressed as new records.
2. **Traceable** — every feature's full lifecycle (creation → mutations → removal → completion) is preserved.
3. **Versioned** — the project tracks product milestones (v1.0, v1.1) and patches (v1.0.1).
4. **Resumable** — the existing in-progress state (feat-006 at C7, SL-001) must continue without disruption.
5. **Domain-per-version** — each version can evolve the domain model independently.

---

## Schema Version 2

### Top-Level Structure

```json
{
  "schemaVersion": 2,
  "activeVersion": "v1",
  "activeSlice": "v1/SL-001",
  "activeFeature": "v1/SL-001/feat-006",
  "lastUpdated": "ISO-8601",
  "lastSkill": "colloquium:feature-implement",
  "versions": { ... }
}
```

**Cursor fields** (`activeVersion`, `activeSlice`, `activeFeature`) are slash-delimited path strings that dereference into the `versions` tree.

Resolution pattern (used by all skills):

```
activeSlice = "v1/SL-001"
→ versionId = "v1", sliceId = "SL-001"
→ currentSlice = state.versions["v1"].slices["SL-001"]

activeFeature = "v1/SL-001/feat-006"
→ featureId = "feat-006"
→ currentFeature = state.versions["v1"].slices["SL-001"].features["feat-006"]
```

`schemaVersion: 2` allows skills to detect the format and fail gracefully on v1 files.

---

### Version Structure

```json
{
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
      "slices": { ... }
    },
    "v1.0.1": {
      "id": "v1.0.1",
      "label": "Fix: message ordering regression",
      "type": "patch",
      "state": "active",
      "semver": "1.0.1",
      "parentVersion": "v1",
      "domain": { "inherits": "v1" },
      "completedSlices": [],
      "completedFeatures": [],
      "slices": { "FIX-001": { ... } }
    }
  }
}
```

**Version type values:**

- `"milestone"` — major or minor product release; has its own domain definition
- `"patch"` — bug fix against a shipped milestone; inherits domain from `parentVersion`
- `"hotfix"` — critical emergency fix; same mechanics as patch

**Domain inheritance:**
Patch and hotfix versions set `domain: { "inherits": "parentVersionId" }`. Skills resolve inherited domains by walking `parentVersion` until they find an inline domain.

**Version state values:**

- `"active"` — currently being worked
- `"released"` — shipped; content is immutable
- `"abandoned"` — cancelled; content preserved for audit

---

### Slice Structure

Slices live inside `versions[versionId].slices`.

```json
{
  "SL-001": {
    "id": "SL-001",
    "name": "channel-message-delivery",
    "state": "B5",
    "contracts": ["CT-001", "CT-002", "CT-003"],
    "featureOrder": [
      "feat-001", "feat-002", "feat-003", "feat-004", "feat-005",
      "feat-006", "feat-007", "feat-008", "feat-009"
    ],
    "features": {
      "feat-001": { ... },
      "feat-006": { ... },
      ...
    }
  }
}
```

- `featureOrder` — ordered array of feature IDs; preserves queue semantics
- `features` — dictionary keyed by feature ID; enables O(1) lookup by ID

Skills that iterate the queue use `featureOrder.map(id => features[id])`.

Slice IDs for patch versions use a `FIX-NNN` prefix to distinguish them from milestone slices.

---

### Feature Structure

```json
{
  "feat-006": {
    "id": "feat-006",
    "name": "channel-sequence-head",
    "bc": "Messaging",
    "type": "read-model",
    "dependencies": ["feat-001"],
    "state": "C7",
    "history": []
  }
}
```

**Feature is visible/active** when `history` does not contain any entry with `type: "removed"`.
Skills that build the feature queue must filter out removed features.

---

### History / Mutation Model

All mutations to a feature are appended to its `history` array. Live fields (`name`, `state`, etc.) reflect the current values — `history` records what changed.

**Rename entry:**

```json
{
  "type": "rename",
  "from": "channel-agg",
  "to": "channel-aggregate",
  "at": "2026-02-25T10:00:00Z",
  "by": "colloquium:feature-spec"
}
```

**Description change entry:**

```json
{
  "type": "description-change",
  "from": "Creates channels",
  "to": "Creates, restores, and manages Channel aggregates",
  "at": "2026-02-25T11:30:00Z",
  "by": "manual"
}
```

**Tombstone (removal) entry:**

```json
{
  "type": "removed",
  "reason": "Superseded by unified ACL feature in v1.1",
  "at": "2026-02-26T09:00:00Z",
  "by": "manual"
}
```

The `by` field is either a skill name (auto-set by the writing skill) or `"manual"` (user-driven edit outside a skill).

Features with a `removed` tombstone are retained in the tree but invisible to routing, status display, and queue advancement.

---

### Patch Version Pattern

When a bug is found in a shipped feature:

1. Create a new patch version: `"v1.0.1"` with `type: "patch"`, `parentVersion: "v1"`
2. Set `activeVersion = "v1.0.1"`, `activeSlice = null`, `activeFeature = null`
3. Run `colloquium:slice-select` to define the fix slice (gets ID `FIX-001`)
4. The fix slice goes through the normal B/C state machine (lighter weight, fewer steps for patches)
5. The original feat-001 in v1 is never touched

The v1 version's state remains `"released"`. The v1.0.1 version is `"active"` during the fix.

---

## Migration from Schema v1

The existing `state.json` (feat-006 at C7, SL-001 at B5) migrates mechanically:

| v1 field                 | v2 location                                         |
| ------------------------ | --------------------------------------------------- |
| `version: 1`             | `schemaVersion: 2`                                  |
| `domain.*`               | `versions.v1.domain.*`                              |
| `domainLocked`           | `versions.v1.domain.locked`                         |
| `activeSlice` (object)   | `versions.v1.slices["SL-001"]` (features dict)      |
| `activeSlice.id`         | `activeSlice = "v1/SL-001"`                         |
| `activeFeature` (object) | `versions.v1.slices["SL-001"].features["feat-006"]` |
| `activeFeature.id`       | `activeFeature = "v1/SL-001/feat-006"`              |
| `completedSlices`        | `versions.v1.completedSlices`                       |
| `completedFeatures`      | `versions.v1.completedFeatures`                     |
| `featureQueue: [...]`    | `featureOrder: [ids]` + `features: { id: entry }`   |

All in-progress state (feat-006 at C7) is preserved exactly. The cursor just points to the new location in the tree.

**Migration is a one-time manual or scripted transformation.** The implementation plan will produce the migrated `state.json` as a concrete output.

---

## Skill Changes Required

### All skills — resolution pattern change

Replace direct field reads with resolution via cursor:

```
Before: state.activeSlice.name
After:  resolve(state.activeSlice).name
        → state.versions[vId].slices[sId].name
```

### All skills — write pattern change

Replace top-level writes with writes into the version tree:

```
Before: state.completedFeatures.push(id)
After:  state.versions[activeVersionId].completedFeatures.push(id)
```

### feature-integrate — queue advancement

Feature advancement now updates `activeFeature` cursor string rather than setting a top-level `activeFeature` object.

### slice-validate — slice completion

When a slice completes: move slice ID into `currentVersion.completedSlices`. Set `activeSlice = null`. Do NOT delete the slice entry from `versions[vId].slices`.

### colloquium:status — display update

Banner must show:

- Active version: `v1.0.0 — Messaging Core (active)`
- Completed versions above active (if any)

### New skill: colloquium:version

Creates a new version entry in the tree. Arguments: type (milestone / patch / hotfix), label, parent version (for patches).

Sets `activeVersion` pointer. Resets `activeSlice = null`, `activeFeature = null`.

---

## Implementation Scope

1. Migrate existing `state.json` to v2 schema
2. Update all 17 existing skills to use the resolution pattern and write into the version tree
3. Add `colloquium:version` skill
4. Update `colloquium:status` to show version history
5. Update `colloquium:sdlc` dispatcher (routing logic unchanged; resolution pattern changes)

---

## Non-Goals

- Multiple parallel active slices (one `activeSlice` per session, unchanged)
- Real-time collaboration / conflict resolution
- External tooling integration (GitHub Issues, Jira, etc.)
