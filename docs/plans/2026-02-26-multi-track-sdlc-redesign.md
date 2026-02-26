# Multi-Track SDLC Redesign — Deferred Implementation Brief

**Status:** Approved design, awaiting evidence from SL-002 completion.
**Do not implement until SL-002 is fully done (all features at `done` state).**
**Authored:** 2026-02-26, brainstormed with ruthless mentor review.

---

## What You Are Doing

You are redesigning the Colloquium SDLC skill system from a single DDD-centric pipeline into a
multi-track product pipeline that supports backend (DDD) and frontend (FSD) in parallel, with
proper PM and Design phases at the front.

The Colloquium Slack clone is a **test harness**. The skill system is the **real product**.
Everything below must be evaluated through that lens: does this skill reliably automate complex
TypeScript monorepo development, or does it just feel good on paper?

---

## Your First Task (Before Touching Any Skill)

**Gather evidence from SL-002.** Do not design anything. Do not implement anything. First answer
every question in the Evidence Collection section below by reading files, commits, and state.

If you skip this step, you are redesigning from theory. That is exactly the mistake this brief
exists to prevent.

---

## Evidence Collection

Read the following and produce a written summary before proceeding:

### 1. SL-002 Frontend Friction Points

Read every spec in `docs/features/Messaging/` that belongs to SL-002. For each read-model
feature (feat-002 through feat-009), answer:

- Did the C-loop sub-steps (domain tests RED/GREEN, contract tests, adapters) make sense for this
  feature, or did they feel forced?
- Which sub-step caused the most friction or was skipped entirely?
- What did the spec ask for that wasn't appropriate for a React component?
- What did the spec NOT ask for that would have been useful (e.g., visual states, component
  hierarchy, interaction model)?

### 2. State Schema Pain Points

Read `.claude/sdlc/state.json` and `new-state.json`. Answer:

- What triggered the new-state.json draft? What was wrong with v2?
- Does the `completedFeatures` flat array at the version level cause any ID collision between
  SL-001 and SL-002 feat IDs? (Both slices have feat-001 through feat-009.)
- Is the `enabled` flag concept in new-state.json a feature flag or something else? What problem
  was it solving?

### 3. Expert Skills Validity

Run the backend-expert skill and look at what it actually references. Check:

- Does `vault/skills/backend-expert/skill-description.md` exist? If not, the skill has a broken
  pointer. Document it.
- Is the content in `.claude/context/backend-expert.md` still accurate for the current stack
  (Hono version, Prisma version, etc.)?
- Which expert skills were actually invoked during SL-002 vs. which were never used?

### 4. Plugin Relevance Audit

For each enabled plugin in `.claude/settings.json`, answer: was it used during SL-002?
Specifically check: `pyright-lsp`, `agent-sdk-dev`, `vercel`, `ralph-loop`. If any were never
used, they are candidates for removal (they add token overhead every session for zero benefit).

### 5. The Known Workflow Gap

The CLAUDE.md documents: "Phase 3 code review has no blocking mechanism." During SL-002, did this
gap cause any real problem? Was code review feedback ignored or dismissed? If yes, document the
specific instance. If no, the gap may be acceptable as-is.

---

## Evidence Summary Template

After completing the evidence collection above, write a `docs/retro/SL-002-evidence.md` file with
this structure:

```
# SL-002 Evidence Summary

## Frontend C-loop friction
[For each read-model feature: which sub-steps were forced/skipped, what was missing]

## State schema issues confirmed
[ID collision? Enabled flag purpose? What v3 needs to fix from v2]

## Expert skills: broken/stale/unused
[vault pointer broken? Which skills unused?]

## Plugin bloat confirmed
[Which plugins to remove]

## Code review gap: real impact or theoretical?
[Evidence from SL-002]

## Unexpected findings
[Anything not anticipated in this brief]
```

This file is your design input. Everything in the implementation below is contingent on what it
contains.

---

## Approved Design (From Brainstorming Session, 2026-02-26)

This design was approved after a full brainstorming session. Do not re-litigate the high-level
decisions. Use the evidence to refine, not to restart.

### The Pipeline

```
P-track  PM ──────────── PRD locked
                         │
D-track                  Design ─────────── Design locked
                         │                  │
B-track                  Backend (DDD) ─────────────────── BE done
                                            │
F-track                                     Frontend (FSD) ─ FE done
                                                             │
I-track                                                      Integration ──► Release
```

**Rules:**

- PM is a gate. Nothing starts until PM produces a locked PRD.
- Design starts after PM. Backend starts during Design (D0). Frontend starts after Design locks (D4).
- Frontend and Backend run in parallel on separate branches.
- Integration is the final gate. Both tracks must be done before Integration starts.

### Track Responsibilities

**PM Track (new)**

- Research the problem space using web search
- Conduct structured Q&A with the user
- Produce `docs/prd.md`: problem statement, user personas, feature pool, MVP scope, non-goals
- PRD must use domain-coherent noun vocabulary (not "users send messages" — "Members post Messages
  to Channels") so that Backend domain framing can start from it without translation
- Gate: P3 — user reviews and approves PRD

**Design Track (new)**

- Read PRD and derive user journeys (critical paths only, not edge cases)
- Create screen flows showing component hierarchy
- Make design system decisions: tokens, shadcn extensions, breakpoints
- Scaffold Storybook with first stories
- Fill PRD gaps discovered during journey mapping (feed back into docs/prd.md)
- Gate: D4 — design locked, user journeys doc and Storybook scaffold committed

**Backend Track (existing — unchanged)**

- Current A→B→C→F SDLC stays exactly as-is
- Starts at D0 (when Design begins) instead of being the first step
- Uses the PRD for domain vocabulary during domain framing
- Produces: real domain aggregates, repositories, API handlers
- Gate: all features done and integrated per current SDLC

**Frontend Track (new — FSD-based)**

- FSD architecture: app / pages / widgets / features / entities / shared
- Monorepo mapping:
  - `shared/ui` → `packages/ui`
  - `shared/types` → `packages/types`
  - `entities/` → app-local frontend domain models (mirrors DDD aggregates in shape, not code)
- Mocking strategy: MSW (Mock Service Worker) intercepts all API calls with fixture data
- Frontend UI works completely without the backend running
- Gate: all features mocked, Storybook stories written, E2E with mocked backend passing

**Integration Track (new)**

1. Contract negotiation — compare MSW handler shapes vs actual API responses; resolve gaps
2. Mock replacement — MSW handlers replaced with real API calls one at a time
3. Integration tests — real backend, test database
4. E2E — Playwright against real stack
5. Architecture/Reuse audit (see below)
6. Release

**Architecture/Reuse Agent (new — runs at gates, not continuously)**

- Runs at: end of Design, end of both BE and FE tracks (before Integration), end of Integration
- Checks for: diverged types between FE entity layer and BE value objects, duplicated Zod schemas,
  utilities reinvented in both tracks, FSD layer violations, monorepo boundary violations
- Produces: a reuse report with specific files and line numbers
- Does NOT auto-fix — flags for human review unless the fix is unambiguously safe (e.g., moving
  a pure utility to packages/utils)

### New Feature Types

The current types are: `aggregate`, `contract`, `read-model`

Add: `ui-component` — a React component or page that goes through the FSD-based Frontend loop
instead of the DDD-based C-loop. The spec for a ui-component must include:

- Component hierarchy (what renders what)
- Visual states (empty / loading / error / populated)
- Interaction model (user actions and their effects)
- Props interface
- Accessibility requirements
- Test strategy (RTL unit, Storybook story, E2E if critical path)

The current `read-model` type should be audited: backend projections remain `read-model`, React
components should be reclassified as `ui-component`. This split is the core fix for the C-loop
frontend friction.

### State Schema v3

The state.json needs a `tracks` top-level concept. Do NOT design the exact schema until after
reading the evidence — the evidence may reveal additional v2 pain points that the v3 schema must
also fix. The known requirements are:

- Must track PM, Design, Frontend, and Integration phases independently from the existing
  Backend (versions/slices/features) structure
- Must fix the `completedFeatures` flat array ID collision problem
- Must resolve whatever motivated new-state.json (investigate before assuming)
- `activeTrack` or equivalent to drive the dispatcher (sdlc.md) routing

The dispatcher (colloquium:sdlc) must be updated to understand the multi-track model and route
correctly based on which track is active.

---

## Implementation Order

Once evidence is collected and `docs/retro/SL-002-evidence.md` is written:

1. **Fix confirmed bugs first** — ID collision, broken vault pointer, stale expert skills. These
   are independent of the redesign and can be fixed immediately.

2. **Remove unused plugins** — Whatever the plugin audit reveals as unused, remove them from
   settings.json. This reduces token overhead for every future session.

3. **Design and implement state schema v3** — Use the writing-plans skill to plan this. The schema
   is the foundation everything else depends on. Do not write a single skill before the schema is
   stable.

4. **Write the PM track skills** — `colloquium:pm-kickoff`, `colloquium:pm-prd`. Validate on a
   small test domain (not Colloquium) before considering them done.

5. **Write the Design track skills** — `colloquium:design-journeys`, `colloquium:design-system`.
   These will require significant iteration. Accept that the first version will be weak.

6. **Write the Frontend FSD skills** — `colloquium:fe-architecture`, `colloquium:fe-mock`,
   `colloquium:fe-assemble`. FSD rules must be explicitly documented in the skill; do not assume
   Claude knows FSD conventions correctly.

7. **Update the Backend track** — Minimal changes. The A→B→C→F chain is unchanged. Only update:
   the dispatcher routing, the `read-model` → `ui-component` reclassification logic, the start
   trigger (starts at D0 instead of being first).

8. **Write the Integration track skills** — `colloquium:integration-contracts`,
   `colloquium:integration-replace`, `colloquium:integration-e2e`.

9. **Write the Architecture/Reuse agent skill** — `colloquium:arch-reuse`. Define the three
   specific gates it runs at. Define what "reuse report" means concretely.

10. **Update the dispatcher** — `colloquium:sdlc` must route across all tracks. Test manually
    against a constructed state.json before trusting it.

11. **Validate on Colloquium v2** — Run the full new pipeline on the next version of the
    Colloquium project (not SL-002 — that used the old pipeline). This is the battle-test.

---

## Hard Gates — Do Not Skip These

These are the lessons from the current SDLC applied to the redesign itself:

- **Do not write FSD skills before running FSD manually on one Colloquium feature.** You need
  evidence that your FSD interpretation is correct for this monorepo before encoding it.

- **Do not implement state schema v3 without a migration skill.** Whatever you write for v3,
  write the migration from v2 before going live.

- **Do not start Implementation step 4 (PM skills) before the state schema is stable.** Skills
  that write state against a schema that changes will corrupt state.

- **Do not remove the `colloquium:project` deprecated skill until you confirm nothing references
  it.** Search commits and docs before deleting.

---

## What This Brief Does NOT Decide

These were explicitly left open pending evidence:

- **Exact state schema v3 structure** — depends on evidence from SL-002 and new-state.json audit
- **Whether to keep `ralph-loop`** — depends on whether it was used during SL-002
- **How the Architecture/Reuse agent makes decisions** — needs a concrete prototype before the
  skill can be written; false positives here are worse than no agent at all
- **Whether the Design track needs a human-in-the-loop checkpoint mid-journey** — depends on how
  automated the design-system skill turns out to be in practice

---

## The Test For Success

After the redesign is implemented and validated on Colloquium v2, the success criteria are:

1. Given "I want to build X" as input, the PM skill produces a PRD that a domain expert would
   find credible — not just user stories, but domain vocabulary.
2. The Design skill produces a Storybook scaffold that the Frontend developer skill can actually
   consume without rewriting everything.
3. Frontend and Backend tracks can run simultaneously on separate git branches with no
   coordination required until Integration.
4. The Integration track resolves all MSW-vs-real-API gaps without manual debugging.
5. The Architecture/Reuse agent catches at least one real duplication per project that would have
   been missed otherwise.
6. The full pipeline completes a non-trivial TypeScript monorepo feature without the user having
   to intervene to unblock a stuck agent.

If any of these criteria fail, the pipeline is not done. Document the failure and iterate.
