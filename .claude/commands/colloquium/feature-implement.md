# colloquium:feature-implement — TDD DDD Delivery Loop (C2 → C7)

**Purpose:** Implement the active feature using a strict TDD + DDD loop across five sub-steps. Each sub-step has its own state write for crash recovery. This skill resumes from whatever C-state the feature is currently at.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Require `activeFeature.state` to be one of: `C2`, `C3`, `C4`, `C5`, `C6`. If not:
   - State `C0` or `C1`: run `/colloquium:feature-spec` first
   - State `C7`: feature implementation is already done — run `/colloquium:feature-verify`
   - State `done` or `F4`: feature is past implementation — run `/colloquium:feature-integrate` or `/colloquium:feature-verify`
   - No `activeFeature`: run `/colloquium:slice-deliver` to set up the feature queue

2. **Read the spec at session start.** Always read `docs/features/<bc>/<aggregate>/spec.md` before doing any work. Every implementation decision must be traceable to a spec section.

3. **Stuck handling.** If stuck on any sub-step for 3 or more consecutive attempts (test won't pass, code won't compile, behavior won't match spec): invoke `superpowers:systematic-debugging`. If debugging also fails, stop and ask the user to review the spec — the feature may be under-specified.

---

## Session Start

On every invocation, display the current position:

```
════════════════════════════════════════════════════════════════
▶ FEATURE IMPLEMENT — <feat-id>: <name>
════════════════════════════════════════════════════════════════
Current state: <C-state>
Resuming at:   <sub-step name>

Spec: docs/features/<BC>/<Aggregate>/spec.md
════════════════════════════════════════════════════════════════
```

Then jump directly to the sub-step corresponding to the current state.

---

## Sub-step C2 → C3: Domain Tests RED

**Goal:** Write pure domain tests that FAIL. If any test passes without implementation, the test is wrong.

**Actions:**

1. Use `superpowers:test-driven-development` — follow that skill's guidance for writing RED tests.

2. Write tests for every invariant in the spec's "Invariants" section. Each invariant gets at least one test that would fail if the invariant were violated.

3. Write tests for each command + transition in the spec's state machine. Test that:
   - Valid transitions succeed
   - Invalid transitions are rejected (aggregate raises an error or returns failure)

4. Tests must be pure — no database, no HTTP, no framework imports. Pure TypeScript/JavaScript functions only.

5. Confirm RED: run tests. If any test passes immediately, that test is not asserting enough — revise it until it fails for the right reason.

6. **State write:** Update `activeFeature.state = "C3"` in state.json after RED is confirmed.

---

## Sub-step C3 → C4: Domain GREEN + Code Review

**Goal:** Implement the aggregate (domain class, value objects, domain events) until all domain tests pass.

**Actions:**

1. Implement the aggregate class with:
   - State machine as modeled in the spec
   - All invariant checks in the appropriate command methods
   - Domain event emission on state transitions
   - Value objects for any type-safe parameters (e.g., `VideoId`, `UserId`)

2. Run domain tests — all must be GREEN.

3. Refactor: with tests green, simplify and clean up without breaking tests. Use `code-simplifier:code-simplifier` for a post-green cleanup pass.

4. Code review: invoke `superpowers:requesting-code-review`, then handle feedback with `superpowers:receiving-code-review`.

5. **State write:** Update `activeFeature.state = "C4"` in state.json after tests are green and review is resolved.

---

## Sub-step C4 → C5: Contract Tests

**Goal:** If the feature has external contracts, write consumer-driven contract tests. If no contracts, skip directly to C5.

**Check:**

Read the spec's "External Contracts" section. If it says "None", skip:

```
ℹ️  No external contracts for this feature. Skipping contract tests.
```

Write `activeFeature.state = "C5"` immediately and proceed to sub-step C5.

**If contracts exist:**

1. For each CT-NNN in the spec's External Contracts section, read `docs/contracts/CT-<n>-<kebab-name>.md`.

2. Write consumer-driven contract tests:
   - For Event contracts (consumed): write a test that verifies the consumed event's schema matches the CT-NNN payload schema. The test should fail if any required field is missing.
   - For Event contracts (produced): write a test that verifies the aggregate produces an event matching the CT-NNN schema when the triggering command is executed.
   - For API contracts (consumed): write a test that verifies the consumer adapter correctly handles the success and error responses defined in the CT-NNN file.

3. Even working solo, define both the producer side and consumer side expectations in the test.

4. Run contract tests — all must pass.

5. Code review: invoke `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

6. **State write:** Update `activeFeature.state = "C5"` in state.json.

---

## Sub-step C5 → C6: Adapters + Read Model

**Goal:** Implement the persistence layer (repositories), HTTP handlers or controllers, and any projections or read models.

**Actions:**

1. **Repository / persistence:** Implement the repository interface that persists the aggregate. Write integration tests using a test database (or in-memory adapter). All integration tests must pass.

2. **HTTP handler / controller:** If the feature exposes an HTTP endpoint (check the spec's External Contracts or the event storm for HTTP read models):
   - Implement the route handler
   - Write HTTP-level integration tests (request → handler → response) — these may use a test server or mock
   - All HTTP tests must pass

3. **Projection / read model:** If `feature.type = "read-model"` or the spec includes a read model projection:
   - Implement the projection that builds the read model from domain events
   - Write a test that verifies the projection produces the correct read model given a sequence of events

4. Run all integration tests — all must pass.

5. **Stuck rule:** If stuck for 3+ consecutive attempts on any integration test: invoke `superpowers:systematic-debugging`.

6. Code review: invoke `superpowers:requesting-code-review` + `superpowers:receiving-code-review`.

7. **State write:** Update `activeFeature.state = "C6"` in state.json.

---

## Sub-step C6 → C7: Journey Check (Minimal E2E)

**Goal:** Verify the feature works end-to-end from the user's perspective.

**Check — is E2E automation appropriate?**

Read the spec's "Test Strategy" section. If it includes an E2E item, proceed. If the E2E test strategy says "N/A" or the UI is highly complex:

- Document why E2E automation is not appropriate in `docs/features/<BC>/<Aggregate>/spec.md` under Test Strategy
- Add a UAT step instead: describe the manual check a human should perform
- Write `activeFeature.state = "C7"` and display: "E2E automation skipped — UAT step added to spec."

**If E2E automation is appropriate:**

1. Use Playwright MCP to navigate the critical path for this feature.

2. One E2E test per "critical path node" listed in the spec's Test Strategy E2E section.

3. For each E2E test:
   - Navigate to the starting point
   - Perform the user action
   - Assert the expected outcome is visible in the UI
   - If assertion fails: identify the layer responsible (domain? adapter? UI?) and route back to the appropriate sub-step

4. All E2E tests must pass.

5. **State write:** Update `activeFeature.state = "C7"` in state.json.

---

## Completion

After C7 state is written, display:

```
════════════════════════════════════════════════════════════════
✅ Feature implementation complete — C2 → C7
════════════════════════════════════════════════════════════════
Feature: <feat-id> — <name>

Sub-steps completed:
  C2 → C3: Domain tests RED    ✅
  C3 → C4: Domain GREEN        ✅
  C4 → C5: Contract tests      ✅ (or: skipped — no contracts)
  C5 → C6: Adapters built      ✅
  C6 → C7: Journey check       ✅

Next: /colloquium:feature-verify
════════════════════════════════════════════════════════════════
```
