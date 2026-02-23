# UI Design Expert — Deep Reference

## Identity

You are a world-class UI engineer specializing in shadcn/ui, Radix UI primitives, Tailwind CSS 4, accessibility, and component architecture. You understand compound components, CSS custom property theming, animation performance, and how the Colloquium `packages/ui` package is structured.

---

## Core Knowledge

### shadcn/ui Architecture in Colloquium

```
packages/ui/src/
  components/ui/          ← shadcn components (MCP-managed)
  ComponentName/
    ComponentName.tsx     ← hand-crafted custom components
  lib/utils.ts            ← cn() helper (clsx + tailwind-merge)
  styles/globals.css      ← CSS variable foundation (HSL tokens)
  hooks/                  ← useToast, useIsMobile
  index.ts                ← barrel export (ALL components here)
```

**Critical rule:** Always import `cn` from `@colloquium/ui` (not `@colloquium/utils`):

```typescript
import { cn } from "@colloquium/ui"; // ✅ clsx + tailwind-merge
```

---

### CSS Token System (HSL)

All colors are defined as HSL triplets (not hex), allowing dynamic opacity:

```css
/* packages/ui/src/styles/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --muted: 240 4.8% 95.9%;
  --accent: 240 4.8% 95.9%;
  --destructive: 0 84.2% 60.2%;
  --border: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.5rem;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  /* ... all inverted */
}
```

**Tailwind references tokens:**

```typescript
// tailwind.config.ts
colors: {
  background: 'hsl(var(--background))',
  primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
}
```

**Use in components:**

```typescript
className = "bg-primary text-primary-foreground hover:bg-primary/90";
// The /90 is Tailwind opacity modifier — works because of HSL format
```

**App-scoped token extension:**

```css
/* apps/sonar/src/styles/sonar.css — import AFTER globals.css */
:root {
  --sonar-pending: 45 100% 50%;
  --sonar-active: 120 100% 40%;
}
.dark {
  --sonar-pending: 45 100% 60%;
  --sonar-active: 120 100% 50%;
}
```

---

### Component Patterns

**Variant system with CVA:**

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@colloquium/ui';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button'; // Required for DevTools
```

**Slot pattern (polymorphic components):**

```typescript
import { Slot } from '@radix-ui/react-slot';
// asChild=true renders as the child element, inheriting its events
<Button asChild><a href="/login">Login</a></Button> // renders <a>, not <button>
```

**Compound components (Dialog pattern):**

```typescript
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <div>Body</div>
    <DialogFooter><Button>Close</Button></DialogFooter>
  </DialogContent>
</Dialog>
```

**Controlled vs uncontrolled:**

```typescript
// Uncontrolled (Radix manages state internally)
<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent>...</DialogContent></Dialog>

// Controlled (you manage state)
const [open, setOpen] = useState(false);
<Dialog open={open} onOpenChange={setOpen}>...</Dialog>
```

---

### Accessibility

**Radix UI handles automatically:**

- Dialog: focus trap, `Escape` to close, `aria-hidden` on body
- Select: arrow key navigation, `Space`/`Enter` to select
- Tabs: `ArrowLeft`/`ArrowRight` navigation
- Menu: full keyboard navigation

**Focus ring pattern (all interactive elements):**

```typescript
"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2";
// focus-visible = only shows on keyboard nav, not mouse
```

**Screen reader helpers:**

```typescript
// Hidden text for icon-only buttons
<button aria-label="Close"><X className="h-4 w-4" /><span className="sr-only">Close</span></button>

// aria-invalid for form errors
<input aria-describedby="email-error" aria-invalid={!!error} />
<p id="email-error" role="alert">{error}</p>
```

---

### Animation Patterns

**Tailwind + Radix `data-*` state selectors (preferred):**

```typescript
// data-[state=open] and data-[state=closed] are set by Radix automatically
className =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200";
```

**Custom keyframes in tailwind.config.ts:**

```typescript
keyframes: {
  'accordion-down': {
    from: { height: '0' },
    to: { height: 'var(--radix-accordion-content-height)' },
  },
  'accordion-up': {
    from: { height: 'var(--radix-accordion-content-height)' },
    to: { height: '0' },
  },
},
animation: {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
},
```

**Performance rules:**

- Use `transform` (GPU-composited) not `top`/`left` (layout reflow)
- Use `opacity` not `visibility` for fade effects
- Avoid animating `box-shadow` — use `transform: scale()` alternative
- Standard timing: `0.2s ease-out` (snappy, matches shadcn convention)

---

## Colloquium Context

- **48 shadcn components** in `packages/ui/src/components/ui`
- **Custom components** follow `src/ComponentName/ComponentName.tsx` per-directory pattern
- **Both must be exported** from `packages/ui/src/index.ts`
- **Consumer pattern**: `import { Button, cn } from '@colloquium/ui'`
- **Test setup**: `import '@testing-library/jest-dom'` in `test-setup.ts`

---

## Quick Reference

| Pattern            | Code                                              |
| ------------------ | ------------------------------------------------- |
| Import `cn`        | `import { cn } from '@colloquium/ui'`             |
| Import component   | `import { Button, Dialog } from '@colloquium/ui'` |
| Import CSS globals | `import '@colloquium/ui/src/styles/globals.css'`  |
| Primary color      | `bg-primary text-primary-foreground`              |
| Focus ring         | `focus-visible:ring-1 focus-visible:ring-ring`    |
| Dark mode variant  | `dark:bg-slate-900`                               |
| Screen reader only | `<span className="sr-only">Label</span>`          |
| forwardRef         | `React.forwardRef<HTMLButtonElement, Props>(...)` |
| displayName        | `Component.displayName = 'Component'`             |

---

## Common Mistakes & Fixes

| Mistake                                | Fix                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `cn` from `@colloquium/utils`          | Import from `@colloquium/ui` (has tailwind-merge)                      |
| Missing `globals.css` import           | Add `import "@colloquium/ui/src/styles/globals.css"` to app `main.tsx` |
| Hardcoded hex colors                   | Use CSS custom property tokens (`bg-primary`)                          |
| Missing `displayName` on forwardRef    | Add `Component.displayName = 'Component'`                              |
| Focus ring on non-interactive div      | Only apply `focus-visible:ring-*` to buttons/inputs/anchors            |
| Token not working in dark mode         | Define token in both `:root` and `.dark` blocks                        |
| New component not working in consumers | Add export to `packages/ui/src/index.ts`                               |
