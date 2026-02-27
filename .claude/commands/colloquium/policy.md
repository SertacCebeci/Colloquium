# colloquium:policy — Cross-Cutting Policy Document Generator

**Purpose:** Generate a structured domain policy document. Additive — does not modify `state.json`. Can be run at any time during the SDLC.

---

## Enforcement Rules

1. Does NOT read or write `.claude/sdlc/state.json`.
2. Creates `docs/policies/` if it does not exist.
3. Auto-assigns the next available PL-NNN ID by scanning `docs/policies/` for existing files.

---

## Execution

### Step 1: Auto-assign PL-NNN ID

Scan `docs/policies/` for files matching `PL-*.md`. Extract the highest existing N. Assign N+1 as the new ID. If no files exist, start at PL-001.

If `docs/policies/` does not exist, create it now and assign PL-001.

### Step 2: Ask 5 questions (use AskUserQuestion)

Ask all 5 questions in a single block:

1. What domain event triggers this policy?
2. What condition must hold when that event fires?
3. What command does the policy issue?
4. Which bounded context owns this policy?
5. Is this policy eventually consistent or synchronous?

### Step 3: Derive remaining fields

From the answers, derive:

- **Idempotency key:** identify a unique field in the triggering event that can serve as the idempotency key (e.g., `correlationId`, `orderId`, `userId`). If unclear, ask: "What field in `<EventName>` uniquely identifies this occurrence?"
- **Policy name:** kebab-case name derived from the event + command (e.g., `order-placed-notify-warehouse`)

### Step 4: Write the policy file

Write to `docs/policies/PL-<n>-<kebab-name>.md`:

```markdown
# PL-<n>: <Policy Name>

**Trigger event:** <event>
**Condition:** <condition>
**Command issued:** <command>
**Owning context:** <BC name>
**Consistency:** <eventually consistent / synchronous>
**Idempotency key:** <key field>

## Test Plan

- <unit test description — describe what pure domain logic to assert>
- <integration test description — describe the cross-context integration scenario to test>
```

### Step 5: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Policy created — PL-<n>: <Policy Name>
════════════════════════════════════════════════════════════════
File: docs/policies/PL-<n>-<kebab-name>.md

Next: /colloquium:sdlc  (to resume the SDLC at the current step)
════════════════════════════════════════════════════════════════
```
