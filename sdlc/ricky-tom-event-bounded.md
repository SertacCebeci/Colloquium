Got it. We’ll switch from **time-boxed** (weekly/6-week PI) to **event-bounded** (phase transitions happen when exit criteria are met). This is basically a **state machine SDLC**: every “phase” has **inputs, work, outputs, gates**, and you only move when the gate is green.

Below is a solo-friendly, big-company-aligned version (still outcome-driven + progressive delivery), but **purely event-driven**.

---

# Event-Bounded Solo SDLC (State Machine)

## Core idea

Your SDLC is a pipeline of **states**. Work items (epics/features) flow through states; you transition only when **explicit exit conditions** are satisfied.

You’ll run two parallel state machines:

1. **Initiative lifecycle** (big slice / epic)
2. **Feature lifecycle** (implementation unit)

---

## Artifacts (same as v2, still minimal)

- `/docs/intent.md` (mission, constraints, success metrics)
- `/docs/themes.md` (outcomes + guardrails)
- `/docs/portfolio/feature_catalog.json` (broad map)
- `/docs/initiatives/<id>/initiative.md` (epic-level plan)
- `/docs/features/<id>/` (entities/systems/components)
- `/docs/rules/*.md` (cross-cutting behaviors)
- `/docs/uat/*.md` (acceptance + regression)
- `/docs/releases/*.md` (what shipped, flags, metrics)

---

# 1) Initiative Lifecycle (Event-Bounded)

Think of an initiative as “MVP slice” or “capability chunk”.

### State I0 — **Selected**

**Entry event:** You pick an initiative from the portfolio backlog.

**Exit gate → I1 when:**

- Outcome is defined (1 success metric, 1 failure metric, 1 guardrail)
- Scope boundaries are defined (what’s in / out)
- Dependencies listed (features/contexts)

**Output:** `initiative.md` skeleton

---

### State I1 — **Modeled**

**Goal:** enough domain clarity to build without thrash.

**Must produce:**

- Ubiquitous language glossary (5–20 key terms)
- Domain events list (candidate events)
- Core state machines / invariants (high-level)

**Exit gate → I2 when:**

- You can write the **top 5 user journeys** as flows
- You can name the **top 10 domain events** confidently
- You can name the **bounded contexts/modules** touched (even if coarse)

---

### State I2 — **Decomposed**

**Goal:** turn initiative into implementable features.

**Must produce:**

- Feature list with dependencies
- “Thin slice order” (what must be built first)
- Flag plan at initiative level (how rollout will happen)

**Exit gate → I3 when:**

- Every feature has an ID + one-paragraph description
- Every dependency is explicit (no hidden “oh also need X”)
- There exists a “first shippable increment” (even behind a flag)

---

### State I3 — **Implemented (Flagged)**

**Entry event:** first feature enters implementation, and you start shipping increments.

**Exit gate → I4 when:**

- All initiative features are implemented behind flags
- UAT sheet for the initiative passes
- Metrics instrumentation exists for success/failure/guardrails

---

### State I4 — **Validated**

**Goal:** prove it works and is valuable.

**Exit gate → I5 when:**

- Acceptance tests + UAT pass
- No open P0 bugs
- Metrics show “not broken” (failure rate below threshold)
- At least one real user (even you) completed the full journey

---

### State I5 — **Rolled Out**

**Exit gate → I6 when:**

- Flags promoted to default-on (or rollout completed)
- Rollback plan tested once (even a simulated rollback)
- Release note written

---

### State I6 — **Hardened**

**Goal:** remove temporary scaffolding, pay down debt created intentionally.

**Exit gate → Done when:**

- Flags removed
- Docs updated
- Cleanup tasks complete (migrations finalized, dead code removed)
- Postmortem notes written (top 3 learnings + next improvements)

---

# 2) Feature Lifecycle (Event-Bounded)

This is your day-to-day loop.

### F0 — **Queued**

Feature exists in the initiative breakdown.

**Exit gate → F1 when:**

- Clear “definition of done”
- Owner context/module assigned
- Dependencies satisfied OR explicitly mocked

---

### F1 — **Specified**

**Goal:** write the minimum spec that prevents rework.

**Must produce (feature pack):**

- `entities.md`: state machine + invariants
- `systems.md`: flows + edge cases
- `components.md`: API/schema/events touched
- If cross-cutting: rule doc(s) added/updated

**Exit gate → F2 when:**

- Invariants are testable statements (not vague)
- External contracts are listed (API/event schemas)
- “Failure modes” are enumerated (top 3–5)

---

### F2 — **Tested (Red)**

Write tests _before_ implementation, but only the right layers:

**Required:**

- Unit tests for invariants
- Integration tests for boundaries (DB/API/job)
- E2E tests only for critical journey nodes
- UAT steps for UI nuance

**Exit gate → F3 when:**

- Tests exist and fail for the right reason (or are pending with placeholders)
- Test data/fixtures are ready

---

### F3 — **Implemented (Green)**

**Exit gate → F4 when:**

- All tests green
- Feature works behind a flag (if non-trivial)
- Telemetry hooks added (success/failure/guardrail)

---

### F4 — **Verified**

Verification is an event, not a schedule.

**Exit gate → F5 when:**

- UAT steps for this feature pass
- Regression on “golden paths” passes
- No new high-sev errors in logs/metrics

---

### F5 — **Integrated**

Feature is merged into the initiative flow.

**Exit gate → Done when:**

- Connected to upstream/downstream features
- Rule docs updated if new interactions discovered
- Flag lifecycle updated (promotion criteria + cleanup)

---

# 3) System-wide “Events” that trigger transitions

To make this truly event-bounded, define a small set of canonical SDLC events:

- **E1: Model stabilized** (language + state machines + events defined)
- **E2: Contract stabilized** (APIs/events are versioned and testable)
- **E3: First shippable increment exists** (flagged)
- **E4: Acceptance passed** (UAT + tests)
- **E5: Production safe** (metrics within guardrails)
- **E6: Rollout complete** (flag promoted)
- **E7: Cleanup complete** (flags removed, debt paid)

Your “phases” are just these events firing.

---

# 4) Progressive Delivery (still mandatory, now event-gated)

### Flag Promotion Gate (event-driven)

A feature flag moves through:

- **Off → Internal → Beta → Default-On → Removed**

Transitions happen when:

- UAT passed (internal)
- Guardrails stable (beta)
- Success metric hit + low failure (default-on)
- cleanup done (removed)

No dates required.

---

# 5) How you operate day-to-day (solo, sequential)

You always work on **one active feature** at a time (WIP limit = 1).

Your daily sequence:

1. Pick top “Ready” feature (F0 gate satisfied)
2. Drive it through F1 → F5 without switching
3. When feature hits Done, pick next

When enough features complete such that an **initiative gate** passes, the initiative advances (I3 → I4 → I5…).

This is basically Kanban with explicit gates and DDD-lite modeling.

---

# 6) Minimal board columns (event-bounded Kanban)

You can literally run this in a README or GitHub Projects:

**Initiatives**

- Selected → Modeled → Decomposed → Implemented(Flagged) → Validated → Rolled Out → Hardened

**Features**

- Queued → Specified → Tested(Red) → Implemented(Green) → Verified → Integrated → Done

No timeboxes.

---

## One important warning (so this doesn’t turn into “infinite modeling”)

Event-bounded flows can stall if gates are too strict.

So enforce this rule:

**Gate strictness rule:**
A gate must be satisfiable with “good enough” evidence. If you find yourself blocked, you loosen _documentation depth_, not correctness.

Examples:

- “Top 10 events confidently” can be “Top 10 candidate events, versioned”
- “Metrics stable” can be “error rate below X for Y sessions”

---

If you want, I can output:

- exact markdown templates for each state (initiative.md, feature pack, rule doc, UAT sheet, release note)
- and a worked example showing how “Video Upload → Processing → Publish → Watch” moves through these event gates.
