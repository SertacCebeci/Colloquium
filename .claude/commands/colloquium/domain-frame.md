# colloquium:domain-frame — Domain Framing (A0 → A1)

**Purpose:** Seed the ubiquitous language by producing a glossary and framing document. First step of domain discovery.

---

## Enforcement Rules

1. **Re-run guard:** Read `.claude/sdlc/state.json`. If `domain.state` exists and is not `"A0"` (i.e., the domain has already been framed or is further along), display:

   ```
   ❌ Domain framing already completed (domain.state = "<current state>").
   To redo framing, manually reset domain.state to "A0" in .claude/sdlc/state.json.
   ```

   Then stop. Do not proceed.

2. **File-first rule:** Both output files MUST exist on disk before `state.json` is written. Verify with a directory listing after writing each file.

3. **State write order:** Write `glossary.md` → write `framing.md` → verify both exist → THEN write `state.json`. Never reverse this order.

---

## Execution

### Step 1: Ask 4 questions (use AskUserQuestion, two blocks of 2)

**Block 1:**

1. What is Colloquium's core business outcome in one sentence?
2. Who are the primary users and what do they achieve?

**Block 2:**

3. What are the top 3–5 unknowns that could derail the project?
4. What is explicitly out of scope?

### Step 2: Write `docs/domain/glossary.md`

Create `docs/domain/` if it does not exist.

Produce 10–30 domain terms derived from the answers. For each term:

- **Term** — the word or phrase
- **Definition** — what it means in this domain (not a dictionary definition)
- **Bounded Context** — which context owns this term (write "TBD" if not yet known)
- **Example usage** — one sentence showing the term in a realistic domain sentence

Template:

```markdown
# Domain Glossary

| Term   | Definition   | Bounded Context | Example Usage |
| ------ | ------------ | --------------- | ------------- |
| <Term> | <definition> | <BC or TBD>     | <sentence>    |
```

Minimum: 10 terms. Stop at 30. Prioritize terms from the user's own answers.

### Step 3: Write `docs/domain/framing.md`

Write exactly four sections:

```markdown
# Domain Framing

## Core Outcome

<one-paragraph description of what the system must achieve to be considered successful>

## Primary Users

<who uses the system and what they accomplish — use concrete role names, not abstract personas>

## Out of Scope

<explicit list of things this system will NOT do — at least 3 items>

## Top Risks / Unknowns

<numbered list of 3–5 unknowns that could derail the project, with a brief note on how each might be mitigated>
```

### Step 4: Verify both files exist

Confirm `docs/domain/glossary.md` and `docs/domain/framing.md` both exist on disk. If either is missing, write it again before proceeding. Do not write state.json until both are confirmed.

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
```

If `state.json` already exists with other fields (e.g., from a partial session), merge — do not overwrite unrelated fields.

### Step 6: Display completion banner

Count the number of terms in glossary.md and report it.

```
════════════════════════════════════════════════════════════════
✅ Domain framed — A0 → A1
════════════════════════════════════════════════════════════════
docs/domain/glossary.md    ✅  (<N> terms)
docs/domain/framing.md     ✅
state.json                 ✅  domain.state = "A1"

Next: /colloquium:domain-subdomains
════════════════════════════════════════════════════════════════
```
