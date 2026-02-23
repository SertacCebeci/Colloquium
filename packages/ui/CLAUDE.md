# packages/ui — Claude Memory

## Current State (as of 2026-02-21)

All 48 shadcn/ui components are installed. The package is fully production-ready.

**What exists:**

- `src/components/ui/` — 48 shadcn/ui components (new-york style, zinc base)
- `src/hooks/use-toast.ts` — Radix toast hook
- `src/hooks/use-mobile.tsx` — mobile breakpoint hook
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `src/styles/globals.css` — CSS variable layer (light + dark, all tokens)
- `tailwind.config.ts` — full zinc/new-york theme with sidebar + chart tokens
- `postcss.config.mjs` — tailwindcss + autoprefixer

**All components are barrel-exported from `src/index.ts`.**

---

## Rules

- Components must not import from `apps/` directories
- Use `frontend-design:frontend-design` skill before writing new **hand-crafted** components
- Props interfaces should use types from `@colloquium/types` where applicable
- No `any` without a comment explaining why

## Component Placement — Two Conventions

| Type                | Location                              | Pattern                        |
| ------------------- | ------------------------------------- | ------------------------------ |
| shadcn/ui generated | `src/components/ui/ComponentName.tsx` | Flat file, MCP-managed         |
| Hand-crafted custom | `src/ComponentName/ComponentName.tsx` | Per-directory, test co-located |

Both must be exported from `src/index.ts`.

---

## Adding a shadcn component (via MCP)

Use the shadcn MCP — it reads `components.json` and writes directly into `src/components/ui/`.

After the MCP adds a component:

1. Check `src/components/ui/` for the new file(s)
2. Add `export * from "./components/ui/<name>"` to `src/index.ts`
3. Run `pnpm --filter @colloquium/ui typecheck` to verify
4. Commit with `feat(ui): add <name> shadcn component`

---

## Adding a hand-crafted component

1. Run `frontend-design:frontend-design` skill to design it first
2. Create `src/ComponentName/ComponentName.tsx` and `ComponentName.test.tsx`
3. Write test with React Testing Library before implementing (TDD)
4. Add `export { ComponentName } from "./ComponentName/ComponentName"` to `src/index.ts`
5. Run `pnpm --filter @colloquium/ui build` to verify
6. Commit with `feat(ui): add <ComponentName> component`

---

## Consumer Setup — CSS Import Required

Consumers **must** import the globals.css to get CSS variables (colors, radius, etc.):

```typescript
// In the consuming app's entry point (e.g., apps/web/src/main.tsx)
import "@colloquium/ui/src/styles/globals.css";
```

Without this import, shadcn components render without their design tokens.

---

## Importing from this package

```typescript
// Components
import { Button, Dialog, Sidebar, Input } from "@colloquium/ui";

// Utility
import { cn } from "@colloquium/ui";

// Hooks
import { useToast } from "@colloquium/ui";
import { useIsMobile } from "@colloquium/ui";

// TOASTER NAMING — two implementations exist:
import { Toaster } from "@colloquium/ui"; // Sonner (modern, preferred)
import { RadixToaster } from "@colloquium/ui"; // Radix toast (legacy)
```

---

## Known Gotchas

### `cn` two-source trap

`cn` is available from both `@colloquium/ui` and potentially `@colloquium/utils`. They are NOT equivalent:

- `@colloquium/ui` → clsx + tailwind-merge (handles conflicting Tailwind classes correctly)
- `@colloquium/utils` → simple string join (breaks when overriding Tailwind classes)

Always import `cn` from `@colloquium/ui` in any component using Tailwind classes.

### Toaster naming collision

Both `sonner.tsx` and `toaster.tsx` export a component called `Toaster`. The barrel resolves this with:

- `Toaster` → Sonner implementation (modern, preferred)
- `RadixToaster` → Radix toast implementation (legacy)

Do NOT change this aliasing without updating all consumers.

### react-resizable-panels v4 API

`resizable.tsx` was hand-patched for `react-resizable-panels@4.x` which renamed exports:

- `PanelGroup` → `Group`
- `PanelResizeHandle` → `Separator`

If you upgrade `react-resizable-panels`, re-check `resizable.tsx` imports. The `ResizablePanel`, `ResizablePanelGroup`, and `ResizableHandle` named exports are unchanged — only the internal Radix primitive names changed.

### combobox is not a component

`combobox` does not exist in the shadcn registry as a standalone file. It is a docs recipe (Command + Popover composition). Do not attempt `shadcn add combobox` — it will 404.

---

## Installed Components (48 total)

accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip

---

## Verification Commands

```bash
pnpm --filter @colloquium/ui typecheck    # type-check this package only
pnpm --filter @colloquium/ui build        # build this package only
pnpm turbo typecheck                    # type-check full monorepo
pnpm turbo build                        # build full monorepo
```

---

## Workflow Reference

This package follows the Maximum Skill Workflow:
`docs/plans/2026-02-21-maximum-skill-workflow-design.md`

For any feature touching this package:

- New shadcn component needed → use shadcn MCP, then export from `index.ts`
- New custom component → use `frontend-design:frontend-design` skill first
- Bug in a component → use `superpowers:systematic-debugging` skill first
- Anything else → enter at Phase 1 · Discovery via `/colloquium:feature`
