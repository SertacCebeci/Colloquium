# colloquium:slice-model — Aggregate Commitment (B2 → B3)

**Purpose:** Derive aggregates from the event storm, define their state machines and invariants, and draft cross-context integration schemas. User must explicitly approve each aggregate before the model is written.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `activeSlice.state = "B2"`. If not, display:

   ```
   ❌ Requires activeSlice.state = "B2".
   Current state: <activeSlice.state>. Run /colloquium:slice-storm first.
   ```

   Then stop.

2. **Invariant quality gate:** Vague invariants ("should be safe", "must be valid", "data is correct") are rejected. Every invariant must be a testable statement — something that can be asserted in a unit test. If a vague invariant is provided, rewrite it via Q&A before proceeding.

3. **Hard gate:** Every aggregate's state machine and invariant list must receive explicit user approval before `model.md` is written. Unapproved aggregates loop back to Q&A.

---

## Execution

### Step 1: Read event storm

Read `docs/slices/<activeSlice.id>/event-storm.md` in full. Extract:

- Domain events → clue about aggregate states
- Commands → methods the aggregate accepts
- Policies → automated state transitions

### Step 2: Identify aggregates

Group commands and events by the domain concept they operate on. Each group is an aggregate candidate. Name each aggregate (PascalCase) and assign it to its owning bounded context (cross-reference `docs/domain/bounded-contexts.md`).

### Step 3: Model each aggregate

For each aggregate, derive:

**State machine:**

- Named states — discrete positions the aggregate can be in (e.g., `Draft`, `Published`, `Archived`)
- Valid transitions — from which state, via which command, to which state
- Invalid transitions are implicitly forbidden — don't list them

**Invariants:**

- Bullet list of "must always hold" conditions
- Each must be testable — expressible as an assertion: "Given X, then Y must be true"
- Examples of acceptable invariants:
  - "A `Published` video must have a non-null `publishedAt` timestamp"
  - "An `Order` total must equal the sum of all line item prices"
  - "A user cannot transition from `Banned` to `Active` without admin approval"
- Examples of UNACCEPTABLE invariants (reject and rewrite):
  - "Data should be valid"
  - "The system must be safe"
  - "Fields must be correct"

**Commands:**

- Methods the aggregate accepts (mapped from event storm commands)
- Format: `CommandName(param: Type, ...)` — include parameter types

**Events emitted:**

- What the aggregate publishes after command execution (mapped from domain events)

### Step 4: Model cross-context integrations

For every integration point identified in the event storm (External Systems section + Policies that span BCs):

- **Event name** and version (`v1`)
- **Full payload schema** — field names with types
- **Semantics** — what does this event mean to a consumer? What invariants hold about its fields?
- **Versioning rule** — new optional fields only; breaking changes require a new version (v2)

### Step 5: Present each aggregate for approval (HARD GATE)

For each aggregate, display its complete state machine + invariant list to the user via AskUserQuestion:

> "Here is the proposed aggregate `<Name>` in `<BC>`:
> States: [list]
> Transitions: [list]
> Invariants: [list]
> Do you approve this model, or do you want to adjust?"

- If approved: proceed to next aggregate.
- If not approved: take feedback, revise, present again. Do not write model.md until ALL aggregates are approved.

### Step 6: Write `docs/slices/<activeSlice.id>/model.md`

Write only after all aggregates are approved.

```markdown
# Model — <SL-n>

## Aggregate: <Name> (<BoundedContext>)

### States

| State   | Description |
| ------- | ----------- |
| <State> | <meaning>   |

### Transitions

| From    | Command       | To      |
| ------- | ------------- | ------- |
| <State> | <CommandName> | <State> |

### Invariants

- <testable statement>

### Commands

- `<CommandName>(<param>: <Type>)` — <what it does>

### Events Emitted

- `<EventName>` — <payload summary>

## Cross-Context Integrations

### <EventName> (v1)

**Schema:** `{ <field>: <type>, <field>: <type> }`
**Semantics:** <what this event means to a consumer>
**Versioning:** backward-compatible fields only; breaking changes require v2
```

### Step 7: Write `.claude/sdlc/state.json`

Update `activeSlice.state = "B3"`. Preserve all other fields.

```json
{
  "activeSlice": {
    "state": "B3"
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:slice-model"
}
```

### Step 8: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Aggregates committed — B2 → B3
════════════════════════════════════════════════════════════════
Aggregates: <N> — <names>
Integrations: <N> cross-context schemas

Next: /colloquium:slice-contracts
════════════════════════════════════════════════════════════════
```
