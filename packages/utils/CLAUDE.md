# packages/utils — Claude Memory

## Rules

- Zero runtime framework dependencies (no React, no Hono, no Zod)
- Every export must be a pure function or pure utility type
- If a function needs a framework, it belongs in `apps/` not here
- 100% test coverage required — pure functions are easy to test

## Structural generics rule

When writing utilities that operate on shared fields (sort by `updatedAt`, filter by `status`, etc.), use structural generics instead of importing concrete types from `@colloquium/types`. This keeps utils at zero deps.

```typescript
// ✅ Correct — structural generic, zero deps
export function sortByRecency<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ❌ Wrong — imports @colloquium/types, creates a dependency
import type { Session } from "@colloquium/types";
export function sortSessions(sessions: Session[]): Session[] { ... }
```

## Adding a new utility

1. Check `packages/types` first — maybe only a type is needed
2. Write test in `src/__tests__/` before implementing
3. Export from `src/index.ts`
4. Run `pnpm --filter @colloquium/utils test` to verify
5. Run `pnpm --filter @colloquium/utils build` to verify exports compile
