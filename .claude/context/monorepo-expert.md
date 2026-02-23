# Monorepo Expert — Deep Reference

## Identity

You are a world-class monorepo engineer specializing in Turborepo, pnpm workspaces, and TypeScript project references. You know the Colloquium package boundary rules from CLAUDE.md and can design, extend, and debug the monorepo architecture.

---

## Package Ownership Matrix

| Package             | Owns                                  | Can Depend On            | Cannot Import From |
| ------------------- | ------------------------------------- | ------------------------ | ------------------ |
| `packages/types`    | Zod schemas + inferred TS types       | (nothing)                | everything         |
| `packages/utils`    | Pure utility functions                | (nothing)                | everything         |
| `packages/config`   | ESLint, Prettier, Vitest configs      | (nothing)                | everything         |
| `packages/tsconfig` | TypeScript compiler configs           | (nothing)                | everything         |
| `packages/ui`       | React components (shadcn + custom)    | types, utils             | apps/\*            |
| `apps/api`          | Hono routes (backend)                 | types, config, tsconfig  | web, sonar         |
| `apps/web`          | Next.js SPA                           | ui, types, config        | api, sonar         |
| `apps/sonar`        | Kintsugi Sonar dashboard (React/Vite) | types, ui, utils, config | api, web           |

**Hard rules:**

- `packages/utils` must have **zero runtime dependencies on frameworks**
- `apps/` directories must **NOT import from each other**
- New shared logic goes to `packages/` first — never start in `apps/`
- Run `pnpm turbo typecheck` to catch cross-package import leaks

---

## Turborepo Pipeline

**`turbo.json`:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "lint": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true },
    "format": { "cache": false }
  }
}
```

**`^build` means:** Run `build` in all workspace dependencies **before** this package's task. Turbo automatically discovers the order: `types → utils → ui → apps/*`

**Filtering:**

```bash
pnpm turbo build --filter="@colloquium/ui"        # UI + its deps
pnpm turbo test --filter="@colloquium/types"      # types only
pnpm turbo build --filter="...[origin/main]"    # only changed packages
pnpm turbo typecheck                            # all packages
```

---

## pnpm Workspaces

**`pnpm-workspace.yaml`:**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`workspace:*` protocol** — always use for internal deps:

```json
{
  "dependencies": {
    "@colloquium/types": "workspace:*",
    "@colloquium/ui": "workspace:*"
  }
}
```

**Adding dependencies:**

```bash
pnpm add zod --filter="@colloquium/types"              # add to specific package
pnpm add -D typescript --filter="@colloquium/tsconfig" # add dev dep
pnpm add react --filter="@colloquium/ui"               # add to ui
```

**`.npmrc`:**

```ini
shamefully-hoist=false      # strict isolation (pnpm default)
strict-peer-dependencies=false
```

---

## TypeScript Configuration

**`packages/tsconfig/` exports three configs:**

```json
// base.json
{
  "compilerOptions": {
    "strict": true, "skipLibCheck": true, "esModuleInterop": true,
    "module": "ESNext", "moduleResolution": "bundler",
    "declaration": true, "declarationMap": true, "sourceMap": true
  }
}

// react.json (extends base)
{
  "extends": "./base.json",
  "compilerOptions": { "target": "ES2020", "lib": ["ES2020", "DOM", "DOM.Iterable"], "jsx": "react-jsx" }
}

// node.json (extends base)
{
  "extends": "./base.json",
  "compilerOptions": { "target": "ES2022", "lib": ["ES2022"] }
}
```

**Package-level tsconfig:**

```json
// packages/types/tsconfig.json
{
  "extends": "@colloquium/tsconfig/base",
  "compilerOptions": { "noEmit": true, "rootDir": "src" },
  "include": ["src"]
}

// packages/ui/tsconfig.json
{
  "extends": "@colloquium/tsconfig/react",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

**Build output (tsup):**

```typescript
// packages/types/tsup.config.ts
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true, // generate .d.ts
  clean: true,
});
```

**package.json exports:**

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

---

## Barrel Files (index.ts)

Every package exports through a single barrel — never allow consumers to import from internal paths:

```typescript
// packages/types/src/index.ts
export { SessionSchema, SessionStatusSchema } from "./session";
export type { Session, SessionStatus } from "./session";
export { HealthResponseSchema } from "./health";
export type { HealthResponse } from "./health";
```

```typescript
// packages/ui/src/index.ts
export { Button, buttonVariants } from "./components/ui/button";
export { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";
export { cn } from "./lib/utils";
// ... all 48 shadcn components + custom components
```

---

## ESLint & Prettier (Shared Config)

**`packages/config/` exports:**

- `./eslint` — base TypeScript ESLint config
- `./eslint-react` — base + React hooks + React Refresh
- `./prettier` — formatting rules
- `./vitest` — shared Vitest setup

**Root `eslint.config.mjs`:**

```javascript
import { baseConfig } from "@colloquium/config/eslint";
export default baseConfig;
```

**App-specific:**

```javascript
// apps/web/eslint.config.mjs
import { reactConfig } from "@colloquium/config/eslint-react";
export default reactConfig;
```

**Commit format (enforced by commitlint + husky):**

```
feat(scope): message       ← new feature
fix(scope): message        ← bug fix
docs(scope): message       ← docs only
chore(scope): message      ← maintenance
refactor(scope): message   ← code change without feature/fix
test(scope): message       ← adding tests
```

---

## CLI Flags

```bash
pnpm turbo build                          # full build
pnpm turbo build --force                  # skip cache, force re-run
pnpm turbo build --dry-run               # show what would run, no execution
pnpm turbo test --continue               # keep running after a failure
pnpm turbo build --concurrency=3         # limit parallel tasks
pnpm turbo build --output-logs=new-only  # suppress cached task output
pnpm turbo build --output-logs=errors-only
```

---

## Caching

**What invalidates the cache:**

- Source files change
- Dependencies change
- Environment variables listed in `env` change
- `turbo.json` task config changes

**Limit cache inputs** (exclude test files from build cache key):

```json
"build": {
  "inputs": ["src/**/*.ts", "!src/**/*.test.ts"],
  "env": ["NODE_ENV"]
}
```

**Pass-through env** (available at runtime but doesn't affect cache hash):

```json
"build": { "passThroughEnv": ["DEBUG"] }
```

**Output modes** (per task in turbo.json):

```json
"build": { "outputMode": "new-only" },  // suppress cached tasks
"test":  { "outputMode": "errors-only" }
```

**Clear local cache:**

```bash
rm -rf ./node_modules/.cache/turbo
turbo run build --force  # one-off skip
```

---

## Remote Caching

```bash
turbo login   # authenticate with Vercel
turbo link    # link this repo to Vercel remote cache
turbo unlink  # remove link
```

**CI (GitHub Actions):**

```yaml
- run: pnpm turbo build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

**Custom remote cache** (`.turbo/config.json`):

```json
{ "teamid": "team_123", "apiurl": "https://cache.example.com", "token": "your-token" }
```

---

## Docker (turbo prune)

Prune the monorepo to only what one app needs — critical for keeping Docker images small:

```bash
turbo prune --scope=web --docker   # outputs to ./out/
```

```dockerfile
FROM node:20-alpine AS builder
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=web --docker

FROM node:20-alpine AS installer
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile

FROM installer AS runner
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=web
```

---

## Verification Commands

```bash
pnpm turbo build            # full build (catches missing exports)
pnpm turbo typecheck        # TypeScript across all packages
pnpm turbo test             # all tests
pnpm turbo lint             # all linting
pnpm turbo run build test lint --parallel  # all at once
```

---

## Build Order (Turbo resolves automatically)

```
1. packages/types:build     (zero deps — runs first)
2. packages/utils:build     (zero deps — parallel)
3. packages/config:build    (zero deps — parallel)
4. packages/tsconfig:build  (zero deps — parallel)
5. packages/ui:build        (waits for ^build of types, utils)
6. apps/api:build           (waits for ^build of types)
7. apps/web:build           (waits for ^build of ui, types)
8. apps/sonar:build         (waits for ^build of types, ui, utils)
```

---

## Common Mistakes & Fixes

| Mistake                                        | Fix                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| New logic in `apps/` that could be shared      | Move to `packages/` first                                                              |
| `@colloquium/types` import in `packages/utils` | Use structural generics instead: `<T extends { updatedAt: string }>`                   |
| Cross-app import `@colloquium/web/src/...`     | Extract to `packages/` and import from there                                           |
| `workspace:^` in package.json                  | Use `workspace:*` (exact local symlink)                                                |
| Forgetting `dependsOn: ["^build"]`             | New task won't have deps available                                                     |
| Missing barrel export                          | Add to `packages/*/src/index.ts`                                                       |
| New package without `typecheck` script         | Every package needs `"typecheck": "tsc --noEmit"`                                      |
| `shamefully-hoist=true`                        | Set to `false` for proper isolation                                                    |
| Consumer imports from internal path            | Only import from package name: `@colloquium/types` not `@colloquium/types/src/session` |
