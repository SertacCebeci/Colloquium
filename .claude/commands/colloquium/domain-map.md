# colloquium:domain-map — Context Map + Domain Lock (A3 → A4)

**Purpose:** Map every BC-to-BC relationship using DDD integration patterns, confirm slice-readiness, and permanently lock the domain layer.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `domain.state = "A3"`. If not, display:

   ```
   ❌ Requires domain.state = "A3". Current state: <state>.
   Run /colloquium:domain-contexts first.
   ```

   Then stop.

2. **Hard gate:** Present the draft context map to the user and wait for explicit approval before writing either output file.

3. **Final lock:** After writing A4, set `domainLocked: true` in state.json. Any subsequent attempt to run any A-layer skill (`domain-frame`, `domain-subdomains`, `domain-contexts`, `domain-map`) must display:
   ```
   ❌ Domain discovery is permanently closed (domainLocked: true).
   To override, manually delete the domainLocked field from .claude/sdlc/state.json.
   ```

---

## Execution

### Step 1: Read bounded contexts

Read `docs/domain/bounded-contexts.md` in full. Extract every BC name and its inputs/outputs.

### Step 2: Enumerate BC-to-BC relationships

For every pair of BCs where one produces output that another consumes, identify the relationship. Assign exactly one DDD integration pattern:

| Pattern                         | When to use                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| **Customer/Supplier**           | One BC (Supplier) serves another (Customer) — the Supplier has upstream control              |
| **Conformist**                  | The consuming BC has no influence — it conforms fully to the upstream model                  |
| **ACL (Anti-Corruption Layer)** | Integration exists but the consuming BC must translate/shield itself from the upstream model |
| **Published Language**          | Both BCs share a well-defined, stable public contract (e.g., an event schema both agree on)  |
| **Shared Kernel**               | Two BCs share a small subset of the domain model — changes require coordination              |

For each relationship, document:

- **Pattern** — from the table above
- **Integration mechanism** — domain events OR synchronous API
- **Contract owner** — which BC publishes / which consumes
- **ACL plan** — if ACL is needed, describe the translation layer (what fields are mapped, what is rejected); if no ACL, write "none needed"

### Step 3: Draft and present to user (HARD GATE)

Display the full context map draft via AskUserQuestion. Ask:

> "This is the proposed context map. Do you approve the integration patterns and contract ownership, or do you want to adjust any relationships?"

- If approved: proceed to Step 4.
- If not approved: revise and present again. Do not write to disk without approval.

### Step 4: Write `docs/domain/context-map.md`

```markdown
# Context Map

## <SourceBC> → <TargetBC>

**Pattern:** <Customer/Supplier | Conformist | ACL | Published Language | Shared Kernel>
**Mechanism:** <Domain events | Synchronous API>
**Contract owner:** <BC name> (publishes) / <BC name> (consumes)
**ACL needed:** <yes — <translation description> | no>
```

Repeat for every BC-to-BC relationship.

### Step 5: Write `docs/domain/delivery-shape.md`

This document must answer the question: "Can a thin slice be implemented with one context's internal model protected and integration via explicit contract?"

The answer MUST be "yes" with justification, or list concrete blockers that must be resolved first.

```markdown
# Delivery Shape

## Slice-Readiness Assessment

**Verdict:** <Yes — thin slices are viable | No — blockers exist>

**Justification:** <explain why a single BC's aggregate can be developed in isolation, with
cross-context integration wired via the contracts from context-map.md>

## Blockers (if any)

- <blocker description + what must be resolved before slicing begins>
```

If blockers exist, display them to the user and wait for resolution before proceeding to Step 6.

### Step 6: Write `.claude/sdlc/state.json`

Set `domain.state = "A4"`, append `"A3"` to `domain.completed`, and set `domainLocked: true`. Preserve all other fields.

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

### Step 7: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Domain complete — A4
════════════════════════════════════════════════════════════════
docs/domain/context-map.md      ✅
docs/domain/delivery-shape.md   ✅
Domain locked (domainLocked: true)

Next: /colloquium:slice-select
════════════════════════════════════════════════════════════════
```
