Adversarial Review of v3 Feature Taxonomy
I'll organize this by severity: FATAL (will cause the system to fail), SERIOUS (will cause significant friction or bugs), DESIGN SMELL (not broken but likely to bite you later), and NITS.

FATAL-1: The Complexity Cure May Be Worse Than the Disease
You went from 3 types + 1 loop to 12 types + 12 loops + 1 dispatcher. The design document itself admits this is a problem:

"12 sub-skill files contain duplicated boilerplate... This trades one kind of maintenance burden for another"

And then pre-builds a v4 escape hatch. When your design doc is already planning its own replacement, that's a red flag that you over-corrected.

The real question you didn't ask: Could you get 80% of the benefit with 5-6 types?

core (aggregate keeps its full C-loop; value-object and domain-service share a lightweight write→test→implement pattern)
backend:schema (migration)
backend:handler (api + event-handler — structurally identical: spec → tests → implement → review)
backend:persistence (repository + projection — both interface → integration tests → implement → review against test DB)
frontend:client (api-client + hook — similar test-first patterns)
frontend:visual (component + page — both need UI validation)
That's 6 types, 6 loops, roughly the same benefits, half the maintenance surface. The V-loop and S-loop are almost identical (write signature → write tests → implement → export). A-loop and E-loop are identical (spec → tests → implement → review). R-loop and Q-loop are identical (interface → integration tests → implement → review). You're creating 12 files to express 6 patterns.

Why this matters: Every cross-cutting change (quality gate, stuck handling, state write format) hits 12 files. The v4 trigger says "5+ coordinated edits post-impl." You'll hit that within the first two slices. Your system will demand its own refactor before it's battle-tested.

FATAL-2: Feature Granularity Creates Absurd Overhead for Trivial Work
A value object like ChannelId is this:

export type ChannelId = string & { readonly \_brand: "ChannelId" };
export function channelId(value: string): ChannelId {
if (!value || typeof value !== "string") throw new Error("Invalid ChannelId");
return value as ChannelId;
}
Under v3, this 5-line type goes through: V0 → V1 → V2 → V3 → V4 → feature-integrate with:

3 quality gates (typecheck + lint + tests each time)
1 feature-integrate checklist (upstream wiring: N/A, downstream wiring: N/A, policy docs: N/A, feature flags: N/A)
5 state.json writes
1 session banner display
You'll spend more time managing the state machine than writing the code. A slice with 4 value objects means 4 serial cycles of this ceremony. That's potentially 30+ minutes of SDLC process for 20 lines of code.

The fix you should consider: Batch trivial types. Allow slice-deliver to group value objects into a single "value object bundle" feature, or let the V-loop process multiple value objects in a single pass. The design principle "one type = one loop" is good. The corollary "one instance = one feature" is not.

FATAL-3: Sequential Ordering Means 20+ Serial Feature Cycles Per Slice
With 12 types, a realistic slice could easily have 20 features:

3 value objects + 2 domain services + 1 aggregate + 1 migration + 1 repository + 1 projection + 2 APIs + 1 event-handler + 2 api-clients + 2 hooks + 2 components + 2 pages = 20 features

Each goes through: spec → implement → integrate, serialized. Even at 15 minutes per trivial feature and 45 minutes per complex one, that's 6-10 hours of SDLC ceremony for one slice. v2 had 9 features for SL-002. v3 would decompose the same work into ~15-20 features because you split read-model into 4 distinct types and contract into 2.

You solved the "wrong loop" problem by creating a "too many loops" problem. The overhead per feature is lower (shorter loops), but the total overhead is higher (more features).

SERIOUS-1: State Mapping Tables for Migration Are Lossy and Contradictory
The --migrate-v3 mapping says:

Legacy state → backend:api
C3–C4 A2
C3 means "domain tests RED" and C4 means "domain tests GREEN + code review passed." These are fundamentally different states. A2 means "contract tests written."

If you're at C4 (tests passing, code reviewed), mapping to A2 means the A-loop expects tests to FAIL ("All must FAIL before handler exists"). But the tests already PASS. The feature is in a contradictory state.

The mapping table needs per-C-state mappings, not ranges:

| C3 | A2 (tests written, pre-implementation — compatible) |
| C4 | A3 (implementation done — skip to review) |

Same problem with C5–C6 → A3. C5 means "contract tests done" and C6 means "adapters built." These map to different points in the A-loop.

SERIOUS-2: feature-integrate Is Pure Ceremony for 8 of 12 Types
The type-aware checklist in the impl plan says:

core:value-object, core:domain-service: Feature flag lifecycle (if feature is behind a flag)

A value object is never behind a feature flag. A domain service is never behind a feature flag. This checklist item will be N/A for 100% of core types. You're forcing every trivial type through a mandatory integration gate that adds zero value.

The fix: Let the sub-skill write "done" directly for types where integration is always N/A (value-object, domain-service, api-client). Reserve feature-integrate for types that actually have integration concerns (aggregate, event-handler, api, page). The "sole owner of done" rule is architecturally clean but practically wasteful. A rule that makes every 5-line branded type go through an integration checklist is not serving you.

SERIOUS-3: feature-spec Becomes a God Skill
feature-spec now handles 12 routing branches. It does JSDoc templates for V, S, F, H. It invokes skills:ui-design-expert for D. It writes table-format specs for A and E. It checks test DB for M, R, Q. It generates assembly plans for P. It writes full spec.md for C.

This is going to be an enormous file with 12 code paths, each with different validation rules, output formats, and side effects. The probability that all 12 branches remain correct across multiple maintenance cycles is low.

The fix: If you're going to have 12 implementation sub-skills, you should also have 12 spec sub-skills (or at least group them: feature-spec-core, feature-spec-backend, feature-spec-frontend). Apply the same design principle: one type, one spec logic. Don't have a 12-branch spec skill routing to 12 single-branch implement skills.

SERIOUS-4: P-Loop State Machine Has a Gap
P1 assembles the page. P2 writes RTL tests that "must PASS." But what if the tests reveal the assembly is wrong? You're at P2 with failing tests for code written at P1.

The design says "Tests verify an already-assembled page" but doesn't specify what happens when they reveal the assembly is incorrect. Do you fix at P2 and stay at P2? Go back to P1? The state machine is silent here.

For every other loop, failing tests at the test-writing step means "working as intended — tests should fail before implementation." But P-loop flips this, and then doesn't handle the failure case.

SERIOUS-5: D4 Visual Harness Is Disconnected From Reality
The visual harness at packages/ui/src/<ComponentName>/**visual**/<ComponentName>.visual.tsx renders components in isolation. But the actual app has:

Theme providers / design tokens
Layout containers
CSS resets / global styles
Context providers (query client, auth, etc.)
A component can pass D4 (looks good in harness) and look broken in the actual app because the harness environment doesn't match production. The design says "If the project uses Storybook, stories serve as the rendering target instead" — but even Storybook decorators need to match the app environment.

The harness approach will give you false confidence. Either specify that the harness MUST wrap the component in the same providers the app uses (and document exactly which providers those are), or acknowledge that D4 is partial validation and the real visual check happens at P3 (page E2E).

SERIOUS-6: Missing Cross-Slice Feature Dependencies Path
The design handles intra-slice dependencies via the dependencies array and completedFeatures. But what happens when SL-003 needs a value object created in SL-002?

completedFeatures is at the version level, so the dependency check would find it. But slice-deliver generates features for one slice at a time. How does it know to add "SL-002/feat-001" to the dependencies array of a feature in SL-003? The decomposition rules don't address this. The user would need to manually edit dependencies after decomposition, which defeats the purpose of automated decomposition.

DESIGN SMELL-1: Hook Location Rule Is Fragile Under Change
A hook starts as pure (packages/ui), then you discover it needs to wrap an api-client. Now you need to:

Reclassify (but it's the same type — frontend:hook)
Move the file from packages/ui/src/hooks/ to apps/\*/src/hooks/
Update exports
Update all imports in consumers
The design says the H-loop sub-skill reads dependencies to determine location at H1. But dependencies can change mid-development. There's no path for "location migration" within the H-loop. You'd need to use the stuck → reclassify escape hatch, which resets to H0 and loses all work.

The simpler rule: All hooks live in apps/\*/src/hooks/. If they're genuinely reusable, extract to packages/ui later. This avoids the prediction problem entirely.

DESIGN SMELL-2: Quality Gate Overhead for Short Loops
V-loop runs 3 light gates. Each light gate is pnpm turbo typecheck + lint + filter test. In a monorepo, pnpm turbo typecheck alone can take 15-30 seconds even with caching. For a 5-line branded type, you're running 45-90 seconds of CI per gate × 3 gates = 2-4 minutes of CI for 30 seconds of code.

The full gate at V4 runs pnpm turbo test (all packages). For a branded type. Why would a branded type break tests in another package? The only risk is an export collision, which typecheck already catches.

Consider: Skip the light gate for pure types (V-loop, parts of S-loop) where the work is trivially verifiable. Run the full gate at loop-complete only.

DESIGN SMELL-3: Success Criteria #7 Contradicts the Design
Success criteria #7: "CLAUDE.md stays under 200 lines after all additions"

The design doc says the ceiling was raised to 250. The implementation plan says ≤ 250. This was never updated. It's a small thing, but it tells me the revision process has lost track of its own invariants — which is ironic for a system designed to enforce invariants.

DESIGN SMELL-4: 12 Sub-Skill Files Will Rot at Different Rates
The design acknowledges this with the grep-able comment:

<!-- Quality gate: see CLAUDE.md § Quality Gate — keep in sync across all 12 sub-skills -->

But a comment is not enforcement. There's no mechanism to detect drift. When you update the quality gate command in 11 out of 12 files, nothing catches the miss until that 12th type runs and gets a different gate. The design even lists this as a v4 trigger condition: "A bug is found where one sub-skill was missed during a coordinated update."

You're designing for a failure mode that you know will happen and accepting it as a trigger for the next version. That's building in a landmine and labeling it.

NITS
S-loop enforcement says {S1, S2, S3, S4, S5} but S5 is loop-complete. The sub-skill should handle S1-S4 and advance TO S5. Including S5 in the enforcement set means the sub-skill could be invoked at S5, but there's nothing to do at S5 — the next step is feature-integrate. This is either a bug (S5 shouldn't be in the set) or a no-op branch (if at S5, display "loop complete" and stop).

Duplicate step numbers in the D-loop impl plan: There are two "Step 3" items (the Playwright screenshots and the human checkpoint).

M-loop has no tests — the design explicitly says "No new tests written for the migration itself." But the quality gate still runs pnpm turbo test. If the schema change breaks an existing test, the migration loop is stuck — you can't fix the broken test within the M-loop (that's the R-loop's job) and you can't advance without passing the gate. This is a deadlock potential.

Summary Verdict
The problem diagnosis is excellent. You correctly identified that read-model was a catch-all, that DDD tests don't apply to hooks, that components need a design step, and that the testing strategy should vary by layer. This is sharp thinking.

The solution overshoots. 12 types where 6 would suffice. Mandatory feature-integrate for trivial types. Sequential execution of 20+ features per slice. The overhead-per-feature dropped, but the number-of-features exploded, and total overhead increased.

The most dangerous issue is FATAL-2 + FATAL-3 combined: you're going to spend more time on SDLC ceremony than on coding, and you'll feel it immediately on the first slice. SL-002 had 9 features and you felt the friction. v3's decomposition of SL-002 would produce ~18 features. You doubled the feature count and halved the loop length — that's a wash at best, and worse when you account for the inter-feature overhead (state.json writes, feature-integrate, queue advance).

My recommendation: Ship a v3 with 6-7 types, not 12. Merge the structurally identical loops. Allow batching for trivial types. Let trivial types skip feature-integrate. Then observe whether you need the full 12-type split based on actual friction in the next 2-3 slices.
