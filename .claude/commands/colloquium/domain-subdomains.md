# colloquium:domain-subdomains — Subdomain Classification (A1 → A2)

**Purpose:** Classify every major domain area as Core, Supporting, or Generic. Derived automatically from framing — no Q&A unless framing is unclear.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `domain.state = "A1"`. If not, display:

   ```
   ❌ Requires domain.state = "A1". Current state: <state>.
   Run /colloquium:domain-frame first.
   ```

   Then stop.

2. **Gate:** At least one subdomain must be classified as Core before writing state.json. A domain with zero Core subdomains cannot proceed.

---

## Execution

### Step 1: Read framing

Read `docs/domain/framing.md` in full. Extract:

- Core business outcome
- Primary users
- Out-of-scope list
- Top risks/unknowns

No Q&A at this step. Everything is derived from the framing document.

### Step 2: Identify major domain areas

From the framing content, identify every major capability area. For each, ask: "Is this something Colloquium must be distinctively good at, or is it commodity work?"

Classify each area using these rules:

| Label          | Meaning                                                        | Investment decision              |
| -------------- | -------------------------------------------------------------- | -------------------------------- |
| **Core**       | Differentiates the product — where competitive advantage lives | Model deeply                     |
| **Supporting** | Necessary but not differentiating — enables Core               | Use off-the-shelf where possible |
| **Generic**    | Commodity infrastructure — every product needs this            | Ignore / buy / outsource         |

### Step 3: Write `docs/domain/subdomains.md`

For each subdomain, include all three fields. Vague success metrics (e.g., "users are happy") are not acceptable — reject and rewrite.

```markdown
# Subdomains

## Core

### <Name>

**Purpose:** <one sentence — what business capability does this deliver>
**Success metric:** <measurable outcome — e.g., "95% of sessions resolved without human escalation">
**Investment:** Model deeply

## Supporting

### <Name>

**Purpose:** ...
**Success metric:** ...
**Investment:** Use off-the-shelf where possible

## Generic

### <Name>

**Purpose:** ...
**Success metric:** ...
**Investment:** Ignore / buy / outsource
```

### Step 4: Gate check

Count the number of Core subdomains. If zero, stop and display:

```
❌ No Core subdomains found. Every project needs at least one differentiating core.
Review docs/domain/framing.md — what is Colloquium distinctively good at?
```

Do not write state.json. Ask the user to revise the framing or classify at least one subdomain as Core.

### Step 5: Write `.claude/sdlc/state.json`

Update state.json — set `domain.state = "A2"` and append `"A1"` to `domain.completed`. Preserve all other fields.

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

### Step 6: Display completion banner

Count subdomains per category.

```
════════════════════════════════════════════════════════════════
✅ Subdomains classified — A1 → A2
════════════════════════════════════════════════════════════════
Core:       <N> subdomains — <names>
Supporting: <N> subdomains — <names>
Generic:    <N> subdomains — <names>

Next: /colloquium:domain-contexts
════════════════════════════════════════════════════════════════
```
