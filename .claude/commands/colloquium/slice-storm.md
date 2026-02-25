# colloquium:slice-storm — Event Storming (B1 → B2)

**Purpose:** Run a solo Event Storming pass over the active slice — generate all five swimlanes and surface hot spots that require user decisions.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `activeSlice.state = "B1"`. If not, display:

   ```
   ❌ Requires activeSlice.state = "B1".
   Current state: <activeSlice.state>. Run /colloquium:slice-select first.
   ```

   Then stop.

2. **Hot spots are not skippable.** Every hot spot must be resolved or explicitly deferred before writing state.json. Deferred hot spots must be marked as such in the output document.

3. **Gate:** The storm must yield ≥ 10 candidate domain events and a non-empty command list. If fewer than 10 events are found, the storm is incomplete — expand scope before proceeding.

---

## Execution

### Step 1: Read slice

Read `docs/slices/<activeSlice.id>/slice.md` in full. Extract the user journey, bounded contexts, and success metric.

### Step 2: Generate all five swimlanes

Run a solo Event Storming pass. Derive each swimlane from the user journey and bounded context definitions in `docs/domain/bounded-contexts.md`:

**1. Domain Events (orange — what happened)**
Past-tense facts the domain cares about. Examples: `VideoUploaded`, `UserRegistered`, `OrderPlaced`. Minimum 10. Think through the full user journey from start to success — every state change is a candidate event.

**2. Commands (blue — what was asked)**
Imperative triggers that cause domain events. Examples: `UploadVideo`, `RegisterUser`, `PlaceOrder`. Every domain event should trace back to a command.

**3. Policies (purple — when X then Y)**
Automated reactions: "When `<EventName>` [and `<condition>`] then `<CommandName>`". These represent business rules that fire automatically.

**4. Read Models (green — what the UI needs)**
Projections or query-side data structures needed to display information to users. Examples: `UserDashboardView`, `OrderSummary`. Derived from what users need to see at each step of the journey.

**5. External Systems (pink — outside the slice boundary)**
Third-party services, other microservices, or systems outside the slice's bounded contexts. Examples: `PaymentGateway`, `EmailService`, `CDN`.

### Step 3: Identify Hot Spots

Review the generated swimlanes for:

- Ambiguous business rules (could go either way)
- Unclear ownership (which BC handles this?)
- Missing transitions (event appears but no command produces it)
- Conflicting policies

List every hot spot found.

### Step 4: Resolve Hot Spots via Q&A (NOT SKIPPABLE)

For each hot spot, ask the user to resolve it using AskUserQuestion. Frame each as a specific decision:

> "Hot spot: [description]. Which approach is correct: [option A] or [option B]?"

Hot spots may NOT be silently dropped. Each must be either:

- **Resolved** — user provides a decision, update the relevant swimlane
- **Explicitly deferred** — user says "defer this", mark as `[DEFERRED]` in the document with a note on why

Do not proceed to Step 5 until every hot spot is addressed.

### Step 5: Gate check

Count domain events. If fewer than 10, display:

```
❌ Only <N> domain events found — storm is incomplete.
A thin slice should have at least 10 events. Review the user journey in slice.md and expand.
```

Do not proceed. Ask: "Should we expand the slice scope, or refine the user journey?"

### Step 6: Write `docs/slices/<activeSlice.id>/event-storm.md`

```markdown
# Event Storm — <SL-n>

## Domain Events

- `<EventName>` — <description of what this fact records>

## Commands

- `<CommandName>` — <description of what this command does>

## Policies

- When `<EventName>` [and <condition>] → `<CommandName>` — <business rule explanation>

## Read Models

- `<ReadModelName>` — <what data it exposes and when it's needed>

## External Systems

- `<SystemName>` — <role in this slice>

## Hot Spots (resolved)

- <hot spot description> → <resolution OR [DEFERRED: reason]>
```

### Step 7: Write `.claude/sdlc/state.json`

Update `activeSlice.state = "B2"`. Preserve all other fields.

```json
{
  "activeSlice": {
    "state": "B2"
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-storm"
}
```

### Step 8: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Event storm complete — B1 → B2
════════════════════════════════════════════════════════════════
Domain events:    <N>
Commands:         <N>
Policies:         <N>
Read models:      <N>
External systems: <N>
Hot spots:        <N resolved>, <N deferred>

Next: /colloquium:slice-model
════════════════════════════════════════════════════════════════
```
