# colloquium:domain-contexts — Bounded Context Boundaries (A2 → A3)

**Purpose:** Define bounded context boundaries — each context's language, commands, events, and integration points.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. Resolve `currentVersion = state.versions[state.activeVersion]`. Require `currentVersion.domain.state = "A2"`. If not, display:

   ```
   ❌ Requires domain.state = "A2". Current state: <currentVersion.domain.state>.
   Run /colloquium:domain-subdomains first.
   ```

   Then stop.

2. **Hard gate:** Present the draft bounded context map to the user and wait for explicit approval before writing `bounded-contexts.md`. Writing to disk without approval is not permitted.

3. If any BC boundary is unclear, run targeted Q&A before proceeding — this is not skippable.

---

## Execution

### Step 1: Read inputs

Read both input files in full:

- `docs/domain/subdomains.md` — for capability clusters (especially Core subdomains)
- `docs/domain/glossary.md` — for existing terminology

### Step 2: Generate draft bounded contexts

For each major capability cluster (one BC per cluster, starting from Core subdomains):

- **Name** — PascalCase (e.g., `Publishing`, `Playback`, `UserIdentity`)
- **Business capability** — one sentence: what this context is responsible for
- **Language boundary** — key terms and their meaning _within this context_. These may differ from the glossary — that is expected and correct. If a term means something different here than in the global glossary, write the local definition.
- **Commands accepted** — what the external world can ask this context to do (imperative, e.g., `PublishContent`, `RegisterUser`)
- **Events emitted** — what this context announces when something happens (past-tense, e.g., `ContentPublished`, `UserRegistered`)
- **Inputs from other contexts** — which events or data this context consumes from other BCs
- **Outputs to other contexts** — which events or data this context produces for other BCs

### Step 3: Boundary clarity check

Before presenting the draft, review each BC pair for:

- Overlapping commands (same command assigned to two BCs)
- Overlapping terms with different meanings (potential confusion zones)
- Missing integration points (BC needs data from another but no input listed)

For each issue found, ask a targeted clarifying question. Do not proceed until all boundary issues are resolved.

### Step 4: Present draft to user for approval (HARD GATE)

Display the complete draft using AskUserQuestion. Present the full list of bounded contexts, their language boundaries, commands, and events. Ask:

> "These are the proposed bounded contexts. Do you approve them, or do you want to adjust any boundaries?"

- If approved: proceed to Step 5.
- If not approved: take feedback, revise, present again. Do not write to disk until approval is given.

### Step 5: Write `docs/domain/bounded-contexts.md`

Write only after explicit user approval.

```markdown
# Bounded Contexts

## <BCName>

**Business capability:** <one sentence>

**Language (within this context):**

- <term>: <local definition — may differ from global glossary>

**Commands:**

- `<CommandName>` — <description>

**Events emitted:**

- `<EventName>` — <description>

**Inputs from other contexts:**

- `<ContextName>`: `<EventName>` — <why this BC needs it>

**Outputs to other contexts:**

- `<ContextName>`: `<EventName>` — <what it signals>
```

Repeat the section for every bounded context.

### Step 6: Write `.claude/sdlc/state.json`

Update — set `domain.state = "A3"`, append `"A2"` to `domain.completed`. Preserve all other fields.

```json
{
  "versions": {
    "<activeVersion>": {
      "domain": {
        "state": "A3",
        "completed": ["A0", "A1", "A2"]
      }
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:domain-contexts"
}
```

Merge into versions tree. Do not overwrite other fields.

### Step 7: Display completion banner

Count the bounded contexts.

```
════════════════════════════════════════════════════════════════
✅ Bounded contexts defined — A2 → A3
════════════════════════════════════════════════════════════════
<N> bounded contexts: <comma-separated names>

Next: /colloquium:domain-map
════════════════════════════════════════════════════════════════
```
