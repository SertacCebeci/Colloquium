# colloquium:sdlc — SDLC Dispatcher

**Purpose:** Read the current SDLC state and route immediately to the correct next skill. This is the single entry point for the entire Colloquium SDLC. Run it any time you want to resume where you left off.

Accepts an optional `--status` flag to show the dashboard without routing.

---

## Execution

### Step 1: Check for --status flag

If the user invoked this skill with `--status` (e.g., `/colloquium:sdlc --status`):
→ Invoke `colloquium:status` and stop. Do not route to any other skill.

### Step 2: Read state

Read `.claude/sdlc/state.json`.

If the file does not exist or is empty:

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC — Starting fresh
════════════════════════════════════════════════════════════════
No SDLC session found.

Starting domain discovery — the first step for any project.
Routing you to colloquium:domain-frame now...
════════════════════════════════════════════════════════════════
```

→ Invoke `colloquium:domain-frame`. Stop.

If `schemaVersion` is not `2` (or is missing):

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC — Starting fresh
════════════════════════════════════════════════════════════════
No SDLC session found.

Starting domain discovery — the first step for any project.
Routing you to colloquium:domain-frame now...
════════════════════════════════════════════════════════════════
```

→ Invoke `colloquium:domain-frame`. Stop.

Resolve current context:

- `versionId` = `state.activeVersion`
- `currentVersion` = `state.versions[versionId]`
- If `state.activeSlice` is set (non-null):
  - Split `"v1/SL-001"` on `"/"` → `[versionId, sliceId]`
  - `currentSlice` = `currentVersion.slices[sliceId]`
- If `state.activeFeature` is set (non-null):
  - Split `"v1/SL-001/feat-006"` on `"/"` → `[versionId, sliceId, featureId]`
  - `currentFeature` = `currentSlice.features[featureId]`

### Step 3: Display current position banner

Display the current position based on resolved state:

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC — Current Position
════════════════════════════════════════════════════════════════
Version:        <versionId> (<currentVersion.semver>) — <currentVersion.label> [<currentVersion.state>]
Domain:         <currentVersion.domain.state> — <one-line summary of what A-state means>
Active Slice:   <currentSlice.id> "<currentSlice.name>" — <currentSlice.state> (<B-state description>)
                (or: "None — no active slice")
Active Feature: <currentFeature.id> "<currentFeature.name>" — <currentFeature.state> (<C-state description>)
                (or: "None — no active feature")
════════════════════════════════════════════════════════════════
Next step: <skill name>
Routing you there now...
════════════════════════════════════════════════════════════════
```

**State descriptions (for the banner):**

| State | Description                                      |
| ----- | ------------------------------------------------ |
| A0    | Domain framing not started                       |
| A1    | Domain framed — subdomains to classify           |
| A2    | Subdomains classified — bounded contexts to draw |
| A3    | Bounded contexts drawn — context map to finalize |
| A4    | Domain locked — ready for slices                 |
| B1    | Slice selected — event storm to run              |
| B2    | Event storm complete — aggregate model to commit |
| B3    | Aggregate model approved — contracts to write    |
| B4    | Contracts stable — slice to decompose            |
| B5    | Slice decomposed — features to implement         |
| C0    | Feature queued — spec to write                   |
| C2    | Feature spec ready — implementation to start     |
| C3    | Domain tests RED — domain GREEN to achieve       |
| C4    | Domain GREEN — contract tests to write           |
| C5    | Contract tests done — adapters to build          |
| C6    | Adapters built — journey check to run            |
| C7    | Journey check passed — UAT to run                |
| F4    | UAT passed — integration to complete             |

### Step 4: Route to the correct skill

Evaluate the routing table in order (first matching condition wins):

| Condition                                                                                               | Route to            | Announce                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------ |
| `currentVersion.domain.state` missing or `"A0"`                                                         | `domain-frame`      | "Domain framing not started — beginning discovery"           |
| `currentVersion.domain.state = "A1"` AND `state.activeSlice` is null                                    | `domain-subdomains` | "Domain framed — classifying subdomains"                     |
| `currentVersion.domain.state = "A2"` AND `state.activeSlice` is null                                    | `domain-contexts`   | "Subdomains classified — drawing bounded contexts"           |
| `currentVersion.domain.state = "A3"` AND `state.activeSlice` is null                                    | `domain-map`        | "Bounded contexts drawn — finalizing context map"            |
| `currentVersion.domain.state = "A4"` AND `state.activeSlice` is null                                    | `slice-select`      | "Domain locked — select next slice"                          |
| `currentVersion.domain.state = "A3"` AND `state.activeSlice` is non-null                                | `domain-map`        | "Context map in progress — resuming"                         |
| `currentSlice.state = "B1"` AND `state.activeFeature` is null                                           | `slice-storm`       | "Slice selected — running event storm"                       |
| `currentSlice.state = "B2"` AND `state.activeFeature` is null                                           | `slice-model`       | "Event storm complete — committing aggregate model"          |
| `currentSlice.state = "B3"` AND `state.activeFeature` is null                                           | `slice-contracts`   | "Aggregate model approved — stabilizing contracts"           |
| `currentSlice.state = "B4"` AND `state.activeFeature` is null                                           | `slice-deliver`     | "Contracts stable — decomposing slice"                       |
| `currentSlice.state = "B5"` AND `state.activeFeature` is null                                           | `feature-spec`      | "Slice decomposed — specifying first feature"                |
| `currentSlice.state = "B5"` AND all non-removed features in `currentSlice.features` have state `"done"` | `slice-validate`    | "All features complete — running slice UAT"                  |
| `currentFeature.state = "C0"`                                                                           | `feature-spec`      | "Feature queued — writing spec"                              |
| `currentFeature.state = "C2"` OR `"C3"` OR `"C4"` OR `"C5"` OR `"C6"`                                   | `feature-implement` | "Feature in progress at <C-state> — resuming implementation" |
| `currentFeature.state = "C7"`                                                                           | `feature-verify`    | "Implementation complete — running UAT"                      |
| `currentFeature.state = "F4"`                                                                           | `feature-integrate` | "UAT passed — integrating feature"                           |

**"All non-removed" check:** Build the feature list via `currentSlice.featureOrder.map(id => currentSlice.features[id])`. Filter out any feature whose `history` contains an entry with `type: "removed"`. All remaining features must have `state = "done"` to route to `slice-validate`.

**Edge case:** If `currentSlice.state = "B5"` AND `state.activeFeature` is non-null AND `currentFeature.state` is not `"done"`:
→ Check `currentFeature.state` against the feature routing rows above.

### Step 5: Invoke the target skill

After displaying the banner and the routing announcement, immediately invoke the target skill using the Skill tool. Do not ask the user to run it — invoke it directly.
