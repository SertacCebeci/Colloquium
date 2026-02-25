# colloquium:status — SDLC Dashboard (Read-Only)

**Purpose:** Display a read-only snapshot of the current SDLC session. Safe to run at any time. Makes zero writes.

---

## Enforcement Rules

1. **NEVER write to any file under any condition.** This skill is read-only.
2. If `.claude/sdlc/state.json` does not exist, display the "no session" message and stop.

---

## Execution

### Step 1: Check for state file

Attempt to read `.claude/sdlc/state.json`.

If the file does not exist or cannot be parsed, display:

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC STATUS
════════════════════════════════════════════════════════════════
No SDLC session started.

Run /colloquium:sdlc to begin.
════════════════════════════════════════════════════════════════
```

Then stop. Do not proceed.

Verify `schemaVersion = 2`. If not 2, display:

```
❌ state.json is schema v1. Run /colloquium:version --migrate first.
```

Then stop.

### Step 2: Resolve cursor

Resolve current context from the v2 schema:

- `versionId` = `state.activeVersion`
- `currentVersion` = `state.versions[versionId]`
- If `state.activeSlice` is set (non-null):
  - Split `"v1/SL-001"` on `"/"` → `[versionId, sliceId]`
  - `currentSlice` = `currentVersion.slices[sliceId]`
- If `state.activeFeature` is set (non-null):
  - Split `"v1/SL-001/feat-006"` on `"/"` → `[versionId, sliceId, featureId]`
  - `currentFeature` = `currentSlice.features[featureId]`

### Step 3: Read supporting artifacts

Read the following files (if they exist — skip gracefully if missing):

- `docs/domain/bounded-contexts.md` — for BC names and count
- `docs/policies/` directory listing — for policy count

### Step 4: Build and display the status banner

Construct the banner with all sections below, in order. For any section where data is missing, display `—` rather than erroring.

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC STATUS
════════════════════════════════════════════════════════════════
Version:   <versionId> (<currentVersion.semver>) — <currentVersion.label> [<currentVersion.state>]
           <for each version in state.versions with state "released", list: ✓ <id> (<semver>) — <label>>

Domain:    <currentVersion.domain.state> — <one-line description of what that state means>
           <N> bounded contexts: <comma-separated BC names from bounded-contexts.md>

Slices:    <list completed slices from currentVersion.completedSlices with ✓ prefix>
           <currentSlice.id> "<currentSlice.name>" ► active — <currentSlice.state> (<N> features queued)

Features:  <build list: currentSlice.featureOrder.map(id => currentSlice.features[id])
            filtered for non-removed (skip any feature whose history contains { type: "removed" })>
             ✓ <feat-id> <name>   (state = "done")
             ► <feat-id> <name>   (state matches currentFeature — currently active)
             ○ <feat-id> <name>   (state = "C0" — queued)

Policies:  <count of .md files in docs/policies/>

Flags:     <scan docs/ for any mention of feature flags — list names + promotion status if found, else "none">

Next:  /colloquium:sdlc
════════════════════════════════════════════════════════════════
```

**"Non-removed" filter:** A feature is removed if its `history` array contains any entry with `type: "removed"`. Always filter these out before building the Features list and before counting "features queued".

**Domain state descriptions:**

- A0 = "not started"
- A1 = "framed — glossary + framing complete"
- A2 = "subdomains classified"
- A3 = "bounded contexts defined"
- A4 = "domain locked — context map complete"

**Slice B-state descriptions:**

- B1 = "slice selected"
- B2 = "event storm complete"
- B3 = "aggregates modelled"
- B4 = "contracts stabilized"
- B5 = "decomposed — feature queue ready"

**Feature C/F-state descriptions:**

- C0 = "queued"
- C2 = "spec written"
- C3 = "tests red"
- C4 = "domain green"
- C5 = "contracts tested"
- C6 = "adapters complete"
- C7 = "journey checked"
- F4 = "UAT passed"
- done = "integrated"

### Step 5: Zero writes confirmed

Do not write to any file. The skill is now complete.
