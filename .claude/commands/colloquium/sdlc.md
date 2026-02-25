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

### Step 3: Display current position banner

Display the current position based on state.json contents:

```
════════════════════════════════════════════════════════════════
▶ COLLOQUIUM SDLC — Current Position
════════════════════════════════════════════════════════════════
Domain:         <domain.state> — <one-line summary of what A-state means>
Active Slice:   <activeSlice.id> "<activeSlice.name>" — <activeSlice.state> (<B-state description>)
                (or: "None — no active slice")
Active Feature: <activeFeature.id> "<activeFeature.name>" — <activeFeature.state> (<C-state description>)
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

| Condition                                                            | Route to            | Announce                                                     |
| -------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------ |
| `domain.state` missing or `"A0"`                                     | `domain-frame`      | "Domain framing not started — beginning discovery"           |
| `domain.state = "A1"` AND no `activeSlice`                           | `domain-subdomains` | "Domain framed — classifying subdomains"                     |
| `domain.state = "A2"` AND no `activeSlice`                           | `domain-contexts`   | "Subdomains classified — drawing bounded contexts"           |
| `domain.state = "A3"` AND no `activeSlice`                           | `domain-map`        | "Bounded contexts drawn — finalizing context map"            |
| `domain.state = "A4"` AND no `activeSlice`                           | `slice-select`      | "Domain locked — select next slice"                          |
| `domain.state = "A3"` AND `activeSlice` exists                       | `domain-map`        | "Context map in progress — resuming"                         |
| `activeSlice.state = "B1"` AND no `activeFeature`                    | `slice-storm`       | "Slice selected — running event storm"                       |
| `activeSlice.state = "B2"` AND no `activeFeature`                    | `slice-model`       | "Event storm complete — committing aggregate model"          |
| `activeSlice.state = "B3"` AND no `activeFeature`                    | `slice-contracts`   | "Aggregate model approved — stabilizing contracts"           |
| `activeSlice.state = "B4"` AND no `activeFeature`                    | `slice-deliver`     | "Contracts stable — decomposing slice"                       |
| `activeSlice.state = "B5"` AND no `activeFeature`                    | `feature-spec`      | "Slice decomposed — specifying first feature"                |
| `activeSlice.state = "B5"` AND all featureQueue states = `"done"`    | `slice-validate`    | "All features complete — running slice UAT"                  |
| `activeFeature.state = "C0"`                                         | `feature-spec`      | "Feature queued — writing spec"                              |
| `activeFeature.state = "C2"` OR `"C3"` OR `"C4"` OR `"C5"` OR `"C6"` | `feature-implement` | "Feature in progress at <C-state> — resuming implementation" |
| `activeFeature.state = "C7"`                                         | `feature-verify`    | "Implementation complete — running UAT"                      |
| `activeFeature.state = "F4"`                                         | `feature-integrate` | "UAT passed — integrating feature"                           |

**Edge case:** If `activeSlice.state = "B5"` AND `activeFeature` is set AND its state is not "done":
→ Check `activeFeature.state` against the feature routing rows above.

### Step 5: Invoke the target skill

After displaying the banner and the routing announcement, immediately invoke the target skill using the Skill tool. Do not ask the user to run it — invoke it directly.
