# Colloquium — Claude Code Project Memory

## Development Workflow

All feature work follows the Maximum Skill Workflow defined in:
`docs/plans/2026-02-21-maximum-skill-workflow-design.md`

**Phase entry point per situation:**

| Situation              | Enter at                                        |
| ---------------------- | ----------------------------------------------- |
| Brand new feature      | Phase 1 · Discovery                             |
| Existing spec / ticket | Phase 3 · Design                                |
| Bug in existing code   | Phase 4 · Implementation (systematic-debugging) |
| PR ready for review    | Phase 5 · Validation                            |

## Monorepo Package Boundaries

**Rule:** Business logic lives in `packages/`. App-specific wiring lives in `apps/`.

| Package                    | Owns                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/types`           | Zod schemas + inferred TypeScript types                                                        |
| `packages/utils`           | Pure utility functions (zero framework deps)                                                   |
| `packages/ui`              | React components (may depend on packages/types and packages/utils)                             |
| `packages/config`          | Shared configuration (ESLint, Prettier, etc.)                                                  |
| `packages/tsconfig`        | Shared TypeScript configurations                                                               |
| `apps/colloquium-blog-api` | Hono route handlers (depends on packages/types)                                                |
| `apps/colloquium-blog`     | React pages (depends on packages/ui)                                                           |
| `apps/sonar`               | Kintsugi Sonar ADE — session management dashboard (React/Vite, TanStack Router, Zustand, nuqs) |

**Hard rules:**

- `packages/utils` must have zero runtime dependencies on frameworks
- `packages/ui` may import from `packages/types` and `packages/utils` — but NOT from `apps/` or framework-specific packages other than React
- `apps/` directories must NOT import from each other
- New shared logic goes to `packages/` first — never start in `apps/`
- Run `pnpm turbo typecheck` to catch cross-package import leaks

**Dependency graph (allowed directions):**
`packages/types` ← `packages/utils` ← `packages/ui` ← `apps/*`
(arrows point from dependency to dependent; no cycles permitted)

## `cn` helper — two implementations, use the right one

`@colloquium/ui` exports `cn` (clsx + tailwind-merge — for React components).
`@colloquium/utils` may also export a `cn` (simple string join — NOT for Tailwind).

**Rule:** Always import `cn` from `@colloquium/ui` in any component that uses Tailwind classes.

```typescript
import { cn } from "@colloquium/ui"; // ✅ correct — handles class merging
```

## shadcn/ui Components

shadcn components live in `packages/ui/src/components/ui` — placed there by the shadcn MCP.
Custom hand-crafted components use the per-directory pattern: `src/ComponentName/ComponentName.tsx`.
Both must be exported from `packages/ui/src/index.ts`.

**App-specific CSS extensions:** Apps that need design tokens beyond the shadcn globals can add a companion CSS file (e.g., `apps/sonar/src/styles/sonar.css`) imported AFTER `@colloquium/ui/src/styles/globals.css` in `main.tsx`. This file defines app-scoped CSS custom properties (`--sonar-*`) without modifying the shared globals.

## Verification Commands

```bash
pnpm turbo build          # full monorepo build
pnpm turbo typecheck      # TypeScript check across all packages
pnpm turbo test           # all tests
pnpm turbo lint           # lint all packages
```

## Code Conventions

- Commit messages must follow Conventional Commits: `type(scope): message`
  (enforced by commitlint via husky — commits without this format will be rejected)
- Prefer named exports in all `packages/` code
- No `any` without a comment explaining why
- Every new package must include a `typecheck` script that runs `tsc --noEmit`

## Skills Available

See `.claude/settings.json` for full plugin list.
Key skills for daily use:

- `superpowers:brainstorming` — before any new feature
- `superpowers:test-driven-development` — before any implementation
- `superpowers:verification-before-completion` — before claiming done
- `superpowers:systematic-debugging` — before any bug fix attempt

Phase-specific skills are defined in the Maximum Skill Workflow document.

## Known Workflow Gaps

Two phases currently lack explicit hard gates — understand these before skipping them:

- **Phase 2 (Isolation) has no enforcement gate** — All feature development should occur in an isolated git worktree created in Phase 2; no implementation commits should be made on the main branch directly.
- **Phase 4 (Code review sign-off) has no blocking mechanism** — Critical issues from code review must be resolved or explicitly accepted by code-architect before moving to the next task; dismissing feedback without justification blocks task closure by convention, not by tooling.
