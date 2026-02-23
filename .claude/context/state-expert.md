# State Expert — Deep Reference

## Identity

You are a world-class state management engineer specializing in Zustand 5 for React 19 / Next.js 16 applications. You understand the v4 → v5 breaking changes, the full middleware stack, TypeScript strict-mode patterns, SSR hydration, and testing conventions. You know the Colloquium `gameStore` architecture and enforce the Colloquium store design conventions.

---

## Zustand 5 — Core API

### Version at a glance

```
zustand: 5.0.x  (current as of 2026-02)
Peer deps: React 18+ or 19 (both supported)
```

### `create` — the primary hook factory

**TypeScript: always use the double-call (curried) form with generics.**

```typescript
import { create } from "zustand";

interface BearState {
  bears: number;
  increase: (by: number) => void;
}

// Correct: create<Type>()(stateCreator)
const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
}));
```

The double-call `create<T>()((set) => ...)` is required for TypeScript to infer generics correctly when middleware is composed. Without the outer `()`, type inference breaks.

### `set` — updating state

```typescript
// Object merge (partial update — does NOT replace keys missing from object)
set({ bears: 5 });

// Updater function — access previous state
set((state) => ({ bears: state.bears + 1 }));

// Replace entire state (second arg `true` = replace, not merge)
set({ bears: 0 }, true);
```

### `get` — reading state inside actions

```typescript
const useStore = create<State>()((set, get) => ({
  count: 0,
  doubleCount: () => get().count * 2, // synchronous read
  incrementIfPositive: () => {
    if (get().count > 0) set((s) => ({ count: s.count + 1 }));
  },
}));
```

### `getState()` / `setState()` / `subscribe()` — store methods

Every hook created by `create` also exposes these static methods:

```typescript
// Read state outside React (event handlers, utilities, tests)
const state = useMyStore.getState();

// Write state outside React (use sparingly — prefer actions inside store)
useMyStore.setState({ count: 0 });
useMyStore.setState((s) => ({ count: s.count + 1 }));

// Subscribe outside React (fires on every state change)
const unsub = useMyStore.subscribe((newState, prevState) => {
  console.log("count changed:", prevState.count, "->", newState.count);
});
unsub(); // unsubscribe

// getInitialState — returns the initial state snapshot (used in tests)
const initial = useMyStore.getInitialState();
```

---

## Zustand v4 → v5 Breaking Changes

### 1. Stable selector outputs required (most impactful change)

In v4, selectors that returned new array/object references on every render caused silent excessive re-renders but not crashes. In v5, this causes an infinite render loop ("Maximum update depth exceeded").

```typescript
// v4 — worked but caused excess renders
// v5 — causes infinite loop
const [searchValue, setSearchValue] = useStore((state) => [
  state.searchValue,
  state.setSearchValue,
]);

// Fix 1: select each value separately (best for primitives)
const searchValue = useStore((state) => state.searchValue);
const setSearchValue = useStore((state) => state.setSearchValue);

// Fix 2: use useShallow for objects/arrays
import { useShallow } from "zustand/shallow";
const { searchValue, setSearchValue } = useStore(
  useShallow((state) => ({
    searchValue: state.searchValue,
    setSearchValue: state.setSearchValue,
  }))
);
```

### 2. `shallow` import path changed

```typescript
// v4 — imported from 'zustand/shallow'
import { shallow } from "zustand/shallow";

// v5 — import from 'zustand/vanilla/shallow' for the equality function
import { shallow } from "zustand/vanilla/shallow";

// useShallow hook (v5, for use inside components as a selector wrapper)
import { useShallow } from "zustand/shallow";
```

### 3. `createWithEqualityFn` moved to `zustand/traditional`

If you need v4-style custom equality at the store level (rather than per-selector), install `use-sync-external-store` and use:

```typescript
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

const useStore = createWithEqualityFn<State>()(stateCreator, shallow);
```

Prefer `useShallow` in components over `createWithEqualityFn` — it is more targeted and avoids the peer dependency.

### 4. `StateCreator` generic signature (middleware authoring)

The `StateCreator` type for writing custom middleware or the slices pattern uses the InMutators/OutMutators tuple pattern:

```typescript
type StateCreator<
  State,
  InMutators extends [StoreMutatorIdentifier, unknown][] = [],
  OutMutators extends [StoreMutatorIdentifier, unknown][] = [],
  Return = State
> = ...
```

---

## `useShallow` — the v5 equality tool

Use `useShallow` whenever a selector returns an object or array, to prevent infinite re-renders from referential inequality:

```typescript
import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'

const useCountStore = create<{ count: number; text: string }>()((set) => ({
  count: 0,
  text: 'hello',
}))

// Without useShallow: new object reference every render → infinite loop in v5
// With useShallow: shallow comparison → only re-renders when values change
const Component = () => {
  const { count, text } = useCountStore(
    useShallow((state) => ({ count: state.count, text: state.text }))
  )
  return <div>{count} {text}</div>
}
```

---

## `createStore` — Vanilla (Framework-Agnostic) Store

Use `createStore` from `zustand/vanilla` when you need state outside of React (utilities, PixiJS game loop, plain TS modules):

```typescript
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

interface CountState {
  count: number;
  increment: () => void;
}

// Create vanilla store — no React dependency
const countStore = createStore<CountState>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Direct access — no hooks needed
const { getState, setState, subscribe, getInitialState } = countStore;
console.log(getState().count); // 0
setState({ count: 5 });

// Subscribe in PixiJS ticker (no React)
app.ticker.add(() => {
  countStore.getState().increment();
});

// Bridge into React with useStore hook
const useCountStore = <T>(selector: (state: CountState) => T) => useStore(countStore, selector);

// In component:
const count = useCountStore((state) => state.count);
```

---

## Slices Pattern — Large Stores

Split a large store into domain-specific slice creators, then compose them:

```typescript
// src/store/bearSlice.ts
import { StateCreator } from "zustand";
import type { BoundStore } from "./store";

export interface BearSlice {
  bears: number;
  addBear: () => void;
  eatFish: () => void;
}

export const createBearSlice: StateCreator<
  BoundStore, // full combined store type
  [], // in-mutators (empty unless using middleware inside slice)
  [], // out-mutators
  BearSlice // this slice's return type
> = (set) => ({
  bears: 0,
  addBear: () => set((state) => ({ bears: state.bears + 1 })),
  eatFish: () => set((state) => ({ fishes: state.fishes - 1 })),
});
```

```typescript
// src/store/fishSlice.ts
import { StateCreator } from "zustand";
import type { BoundStore } from "./store";

export interface FishSlice {
  fishes: number;
  addFish: () => void;
}

export const createFishSlice: StateCreator<BoundStore, [], [], FishSlice> = (set) => ({
  fishes: 0,
  addFish: () => set((state) => ({ fishes: state.fishes + 1 })),
});
```

```typescript
// src/store/sharedSlice.ts — cross-slice orchestration uses get()
import { StateCreator } from "zustand";
import type { BoundStore } from "./store";

export interface SharedSlice {
  addBothAndReport: () => number;
}

export const createSharedSlice: StateCreator<BoundStore, [], [], SharedSlice> = (_set, get) => ({
  addBothAndReport: () => {
    get().addBear(); // call actions from other slices via get()
    get().addFish();
    return get().bears + get().fishes;
  },
});
```

```typescript
// src/store/store.ts — compose all slices
import { create } from "zustand";
import { createBearSlice, type BearSlice } from "./bearSlice";
import { createFishSlice, type FishSlice } from "./fishSlice";
import { createSharedSlice, type SharedSlice } from "./sharedSlice";

export type BoundStore = BearSlice & FishSlice & SharedSlice;

export const useBoundStore = create<BoundStore>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
  ...createSharedSlice(...a),
}));
```

With `devtools`, pass the mutator type to each `StateCreator`:

```typescript
export const createBearSlice: StateCreator<
  JungleStore,
  [["zustand/devtools", never]],
  [],
  BearSlice
> = (set) => ({
  bears: 0,
  addBear: () =>
    set(
      (state) => ({ bears: state.bears + 1 }),
      undefined,
      "jungle:bear/addBear" // action name in DevTools
    ),
});
```

---

## Middleware

### Order matters: outermost middleware wraps all inner middleware.

```typescript
create<State>()(
  devtools(        // outermost — sees all changes
    persist(
      subscribeWithSelector(
        immer(     // innermost — runs first
          (set) => ({ ... })
        )
      ),
      { name: 'app-storage' }
    ),
    { name: 'AppStore' }
  )
)
```

### `devtools` — Redux DevTools integration

```typescript
import { devtools } from "zustand/middleware";
import type {} from "@redux-devtools/extension"; // required for TypeScript types

const useStore = create<State>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () =>
        set(
          (state) => ({ count: state.count + 1 }),
          undefined, // replace flag — undefined = merge
          "counter/increment" // action name shown in DevTools
        ),
    }),
    { name: "MyStore" } // store name in DevTools panel
  )
);
```

Action name is the third argument to `set()`. Use namespaced strings like `'slice/actionName'` for clarity in DevTools.

### `persist` — LocalStorage / SessionStorage persistence

```typescript
import { persist, createJSONStorage } from "zustand/middleware";

const useFishStore = create<State>()(
  persist(
    (set, get) => ({
      fishes: 0,
      addAFish: () => set({ fishes: get().fishes + 1 }),
      // Do not persist actions — use partialize
    }),
    {
      name: "food-storage", // localStorage key (required)
      storage: createJSONStorage(() => sessionStorage), // override default localStorage
      partialize: (state) => ({ fishes: state.fishes }), // only persist data, not actions
      version: 1, // bump when schema changes
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          const s = persistedState as { oldField: number };
          return { fishes: s.oldField };
        }
        return persistedState;
      },
      onRehydrateStorage: (_state) => {
        console.log("Hydration starting");
        return (state, error) => {
          if (error) console.error("Rehydration failed", error);
          else console.log("Rehydrated:", state);
        };
      },
    }
  )
);

// Persist API — accessible outside components
useFishStore.persist.clearStorage(); // wipe persisted data
useFishStore.persist.rehydrate(); // manually trigger rehydration
const hydrated = useFishStore.persist.hasHydrated(); // boolean
const unsub = useFishStore.persist.onFinishHydration((state) => {
  console.log("Ready:", state);
});
```

### `immer` — Mutable-style updates for nested state

```typescript
import { immer } from "zustand/middleware/immer";

interface State {
  nested: { count: number };
  todos: Record<string, { done: boolean; title: string }>;
}

interface Actions {
  increment: () => void;
  toggleTodo: (id: string) => void;
}

const useStore = create<State & Actions>()(
  immer((set) => ({
    nested: { count: 0 },
    todos: {},
    // Direct mutation — Immer converts to immutable update under the hood
    increment: () =>
      set((state) => {
        state.nested.count += 1;
      }),
    toggleTodo: (id) =>
      set((state) => {
        state.todos[id].done = !state.todos[id].done;
      }),
  }))
);
```

Without `immer`, nested updates require full spread chains:

```typescript
// Without immer — verbose for deep nesting
set((s) => ({
  todos: {
    ...s.todos,
    [id]: { ...s.todos[id], done: !s.todos[id].done },
  },
}));
```

### `subscribeWithSelector` — Selective subscriptions outside React

```typescript
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/vanilla/shallow";

const useDogStore = create<DogState>()(
  subscribeWithSelector((set) => ({
    paw: true,
    fur: true,
    age: 5,
  }))
);

// Subscribe to a specific field — callback fires only when `paw` changes
const unsub1 = useDogStore.subscribe(
  (state) => state.paw,
  (paw, prevPaw) => console.log("paw changed:", prevPaw, "->", paw)
);

// Subscribe to multiple fields with shallow equality
const unsub2 = useDogStore.subscribe(
  (state) => [state.paw, state.fur],
  (value) => console.log("paw or fur changed:", value),
  { equalityFn: shallow }
);

// Fire callback immediately with current value, then on changes
const unsub3 = useDogStore.subscribe(
  (state) => state.age,
  (age) => console.log("age:", age),
  { fireImmediately: true }
);

// Always clean up subscriptions to prevent memory leaks
unsub1();
unsub2();
unsub3();
```

---

## Separating State Types from Action Types (Best Practice)

Keep state data and actions in separate types for testability and clarity:

```typescript
type GameStateData = {
  agents: Record<string, Agent>;
  energy: number;
  turn: number;
};

type GameStateActions = {
  addAgent: (agent: Agent) => void;
  tick: () => void;
  reset: () => void;
};

type GameState = GameStateData & GameStateActions;

// Extracting initialState separately enables clean reset()
const initialState: GameStateData = {
  agents: {},
  energy: 1000,
  turn: 0,
};

export const useGameStore = create<GameState>()((set) => ({
  ...initialState,
  addAgent: (agent) => set((s) => ({ agents: { ...s.agents, [agent.id]: agent } })),
  tick: () => set((s) => ({ turn: s.turn + 1 })),
  reset: () => set(initialState),
}));
```

---

## Testing Zustand with Vitest

### Pattern 1: Direct store testing (no React)

Call actions and assert `getState()` — no rendering needed for pure store logic:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store/gameStore";

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.getState().reset(); // reset to initialState before each test
  });

  it("starts with 1000 energy", () => {
    expect(useGameStore.getState().energy).toBe(1000);
  });

  it("addAgent stores agent by id", () => {
    const agent = makeTestAgent({ id: "a1" });
    useGameStore.getState().addAgent(agent);
    expect(useGameStore.getState().agents["a1"]).toEqual(agent);
  });

  it("tick increments turn", () => {
    useGameStore.setState({ currentUserId: "user-1" });
    useGameStore.getState().tick();
    expect(useGameStore.getState().turn).toBe(1);
  });
});
```

### Pattern 2: Auto-mock all stores (Vitest)

Place this file at `__mocks__/zustand.ts`. Vitest's module resolution uses it when `vi.mock('zustand')` is called:

```typescript
// __mocks__/zustand.ts
import { act } from "@testing-library/react";
import type * as ZustandExportedTypes from "zustand";
export * from "zustand";

const { create: actualCreate, createStore: actualCreateStore } =
  await vi.importActual<typeof ZustandExportedTypes>("zustand");

export const storeResetFns = new Set<() => void>();

const createUncurried = <T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => store.setState(initialState, true));
  return store;
};

export const create = (<T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  return typeof stateCreator === "function" ? createUncurried(stateCreator) : createUncurried;
}) as typeof ZustandExportedTypes.create;

const createStoreUncurried = <T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  const store = actualCreateStore(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => store.setState(initialState, true));
  return store;
};

export const createStore = (<T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  return typeof stateCreator === "function"
    ? createStoreUncurried(stateCreator)
    : createStoreUncurried;
}) as typeof ZustandExportedTypes.createStore;

// Automatically resets ALL stores after each test
afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => resetFn());
  });
});
```

```typescript
// setup-vitest.ts
import "@testing-library/jest-dom";
vi.mock("zustand"); // activates __mocks__/zustand.ts
```

```typescript
// vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./setup-vitest.ts"],
      },
    })
  )
);
```

### Pattern 3: Component testing with Colloquium's `reset()` action

The Colloquium project exposes a `reset()` action on every store. Use it directly instead of the auto-mock approach:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import { useGameStore } from '@/store'
import { DockPanel } from '@/components/DockPanel'

describe('DockPanel', () => {
  beforeEach(() => {
    useGameStore.getState().reset() // use the store's own reset() action
    vi.clearAllMocks()
  })

  it('clicking chat button opens chat panel', () => {
    render(<DockPanel {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Network Chat' }))
    expect(useGameStore.getState().activeDockPanel).toBe('chat')
  })

  it('second click on same panel closes it', () => {
    render(<DockPanel {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Network Chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Network Chat' }))
    expect(useGameStore.getState().activeDockPanel).toBeNull()
  })

  it('store mutations require act()', () => {
    act(() => { useGameStore.getState().tick() })
    expect(useGameStore.getState().turn).toBe(1)
  })
})
```

### Pattern 4: Mocking the store module for isolated component tests

```typescript
import { vi } from "vitest";

vi.mock("@/store/gameStore", () => ({
  useGameStore: vi.fn((selector) =>
    selector({
      selectedNodeId: "node-1",
      energy: 50,
      activeDockPanel: null,
      selectNode: vi.fn(),
      setActiveDockPanel: vi.fn(),
    })
  ),
}));
```

---

## Zustand with Next.js App Router

### The fundamental rule: Zustand is client-only

Server Components cannot use hooks. All Zustand usage must be inside Client Components (`'use client'`).

```typescript
// page.tsx (Server Component — no Zustand here)
export default async function Page() {
  const data = await fetchData() // server-side data fetch
  return <ClientWrapper initialData={data} />
}

// ClientWrapper.tsx
'use client'
import { useMyStore } from '@/store/myStore'
export function ClientWrapper({ initialData }) {
  const state = useMyStore((s) => s.someValue) // fine — Client Component
  // ...
}
```

### Provider pattern for SSR-safe stores (recommended for Next.js)

Use a factory function + Context provider to isolate store state per request, preventing leakage between concurrent server-side renders:

```typescript
// src/stores/counter-store.ts
import { createStore } from "zustand/vanilla";

export type CounterState = { count: number };
export type CounterActions = {
  increment: () => void;
  decrement: () => void;
};
export type CounterStore = CounterState & CounterActions;

export const defaultInitState: CounterState = { count: 0 };

// Factory — creates a NEW store instance per call (essential for SSR isolation)
export const createCounterStore = (initState: CounterState = defaultInitState) =>
  createStore<CounterStore>()((set) => ({
    ...initState,
    increment: () => set((s) => ({ count: s.count + 1 })),
    decrement: () => set((s) => ({ count: s.count - 1 })),
  }));
```

```typescript
// src/providers/counter-store-provider.tsx
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createCounterStore, type CounterStore } from '@/stores/counter-store'

export type CounterStoreApi = ReturnType<typeof createCounterStore>

export const CounterStoreContext = createContext<CounterStoreApi | undefined>(undefined)

export function CounterStoreProvider({ children }: { children: ReactNode }) {
  // useState ensures the store is only created ONCE per component mount
  const [store] = useState(() => createCounterStore())
  return (
    <CounterStoreContext.Provider value={store}>
      {children}
    </CounterStoreContext.Provider>
  )
}

// Custom hook — enforces provider presence with a clear error message
export function useCounterStore<T>(selector: (store: CounterStore) => T): T {
  const context = useContext(CounterStoreContext)
  if (!context) {
    throw new Error('useCounterStore must be used within CounterStoreProvider')
  }
  return useStore(context, selector)
}
```

```typescript
// app/layout.tsx (Server Component — wraps tree with client provider)
import { CounterStoreProvider } from '@/providers/counter-store-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <CounterStoreProvider>{children}</CounterStoreProvider>
      </body>
    </html>
  )
}
```

```typescript
// Any Client Component under the provider
'use client'
import { useCounterStore } from '@/providers/counter-store-provider'

export function HomePage() {
  const { count, increment, decrement } = useCounterStore(
    useShallow((s) => ({ count: s.count, increment: s.increment, decrement: s.decrement }))
  )
  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  )
}
```

### Hydration mismatch with `persist` middleware

When using `persist`, the client hydrates from localStorage after the server renders, causing content mismatches. Two solutions:

**Solution 1: `_hasHydrated` flag in store**

```typescript
const useBoundStore = create(
  persist(
    (set) => ({
      count: 0,
      _hasHydrated: false,
      setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),
    }),
    {
      name: 'my-store',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export function App() {
  const hasHydrated = useBoundStore((s) => s._hasHydrated)
  if (!hasHydrated) return <p>Loading...</p>
  return <MainContent />
}
```

**Solution 2: `skipHydration` + manual rehydrate**

```typescript
export const useBoundStore = create(
  persist(() => ({ count: 0 }), {
    name: "my-store",
    skipHydration: true, // do not auto-hydrate on create
  })
);

// In a Client Component
useEffect(() => {
  useBoundStore.persist.rehydrate(); // hydrate explicitly after mount
}, []);
```

---

## Colloquium-Specific Patterns

### Store location

All stores live in `src/store/`. The primary store is `src/store/gameStore.ts`. Export from `src/store/index.ts`.

### `useGameStore` architecture

The project uses a single large store with a separate `initialState` constant for clean `reset()`:

```typescript
const initialState = {
  agents: {} as Record<string, Agent>,
  energy: 1000,
  turn: 0,
  turnInterval: null as number | null,
  // ... all data fields
};

export const useGameStore = create<GameState>()((set) => ({
  ...initialState,
  // actions...
  reset: () => {
    const state = useGameStore.getState();
    if (state.turnInterval) clearInterval(state.turnInterval);
    set({ ...initialState, turnInterval: null });
  },
}));
```

### Accessing state in actions (the static `getState()` pattern)

For actions that need to read state before deciding to update, use `useGameStore.getState()`:

```typescript
startTurnTimer: () => {
  const state = useGameStore.getState()
  if (state.turnInterval) return // guard: already running
  const id = window.setInterval(() => {
    useGameStore.getState().tick()
  }, 10_000) as unknown as number
  set({ turnInterval: id })
},

// For actions that return a value (not a void setter)
spendEnergy: (amount: number, _reason: string): boolean => {
  const s = useGameStore.getState()
  if (s.energy < amount) return false
  set({
    energy: s.energy - amount,
    resourceDeltas: { ...s.resourceDeltas, energy: { value: -amount, ts: Date.now() } },
  })
  return true
},
```

### Selector patterns for Colloquium components

```typescript
// Good: primitive selectors — stable reference, no useShallow needed
const energy = useGameStore((s) => s.energy);
const activeTab = useGameStore((s) => s.activeTab);
const currentAgentId = useGameStore((s) => s.currentAgentId);

// Good: multiple primitives — use useShallow to bundle them
const { energy, minerals } = useGameStore(
  useShallow((s) => ({ energy: s.energy, minerals: s.minerals }))
);

// Good: derived value filtering agents — array, use useShallow
const myAgents = useGameStore(
  useShallow((s) => Object.values(s.agents).filter((a) => a.userId === s.currentUserId))
);

// Good: single agent by id — object, wrap with useShallow
const agent = useGameStore(useShallow((s) => s.agents[agentId]));

// BAD in v5 — new array reference every render → infinite loop
// const [energy, minerals] = useGameStore((s) => [s.energy, s.minerals])
```

### Node focus / selection pattern

```typescript
// Focused node with timestamp to force re-trigger even if same nodeId requested
requestFocus: (nodeId: string) =>
  set({ focusRequest: { nodeId, ts: Date.now() } }),

clearFocusRequest: () => set({ focusRequest: null }),

// Consumer component
const focusRequest = useGameStore((s) => s.focusRequest)
useEffect(() => {
  if (!focusRequest) return
  scrollToNode(focusRequest.nodeId)
  useGameStore.getState().clearFocusRequest()
}, [focusRequest])
```

### Store boundary rules for Colloquium

- **Do NOT** mix game logic with UI state in the same store
- **Do NOT** call `fetch()` or WebSocket inside store actions — use `useEffect` or Server Actions, then `set()` the result
- **DO** expose a `reset()` on every store for testing
- **DO** separate `initialState` constant from actions for easy reset
- **DO** name DevTools actions with namespace prefix: `'game/addAgent'`, `'ui/setActiveTab'`

---

## Common Pitfalls

### Pitfall 1: Stale closures in subscriptions

```typescript
// BAD — count captured at subscription creation, never updates
useEffect(() => {
  const unsub = useStore.subscribe(() => {
    console.log("count is", count); // stale closure — always initial value
  });
  return unsub;
}, []);

// GOOD — read fresh state from the subscription callback argument
useEffect(() => {
  const unsub = useStore.subscribe((state) => {
    console.log("count is", state.count); // always current
  });
  return unsub;
}, []);
```

### Pitfall 2: Over-subscribing (selecting the whole store)

```typescript
// BAD — re-renders on ANY state change anywhere in the store
const state = useGameStore((s) => s);

// GOOD — re-renders only when this field changes
const energy = useGameStore((s) => s.energy);
```

### Pitfall 3: Mutating state directly (bypassing `set`)

```typescript
// BAD — React/Zustand will not detect the change; no re-render
const agents = useGameStore.getState().agents;
agents["a1"].position = { x: 1, y: 2 }; // direct mutation — invisible to React

// GOOD — always go through set() or a store action
useGameStore.getState().moveAgent("a1", { x: 1, y: 2 });
// or directly:
useGameStore.setState((s) => ({
  agents: { ...s.agents, a1: { ...s.agents["a1"], position: { x: 1, y: 2 } } },
}));
```

### Pitfall 4: Selector returning new array/object literal in v5 (infinite loop)

```typescript
// BAD in v5 — causes infinite re-render loop
const data = useStore((s) => ({ a: s.a, b: s.b })); // new object every render
const list = useStore((s) => [s.x, s.y]); // new array every render

// GOOD
const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })));
// or select primitives separately
const a = useStore((s) => s.a);
const b = useStore((s) => s.b);
```

### Pitfall 5: Not cleaning up subscriptions (memory leak)

```typescript
// BAD — memory leak
useEffect(() => {
  useStore.subscribe(handler);
}, []);

// GOOD — return cleanup function
useEffect(() => {
  const unsub = useStore.subscribe(handler);
  return unsub;
}, []);
```

### Pitfall 6: Using Zustand in Server Components

```typescript
// BAD — Server Component
export default function ServerPage() {
  const count = useMyStore((s) => s.count) // Error: hooks in Server Component
  return <div>{count}</div>
}

// GOOD — push Zustand into a Client Component
'use client'
export function Counter() {
  const count = useMyStore((s) => s.count)
  return <div>{count}</div>
}
```

### Pitfall 7: Not resetting store between tests (test pollution)

```typescript
// BAD — state leaks from previous test
it("test A", () => {
  useGameStore.getState().addAgent(agentA);
  // ...
});
it("test B", () => {
  // agents from test A are still here!
  expect(Object.keys(useGameStore.getState().agents)).toHaveLength(0); // FAILS
});

// GOOD
beforeEach(() => {
  useGameStore.getState().reset();
});
```

---

## Quick Reference

| API                              | Import                     | Purpose                                          |
| -------------------------------- | -------------------------- | ------------------------------------------------ |
| `create<T>()`                    | `zustand`                  | Create a React hook store                        |
| `createStore<T>()`               | `zustand/vanilla`          | Create a vanilla (no-React) store                |
| `useStore(store, selector)`      | `zustand`                  | Use vanilla store in React                       |
| `useShallow(selector)`           | `zustand/shallow`          | Shallow-compare objects/arrays in selectors      |
| `shallow`                        | `zustand/vanilla/shallow`  | Equality function (for `subscribeWithSelector`)  |
| `createWithEqualityFn`           | `zustand/traditional`      | Store-level custom equality (v4 migration path)  |
| `devtools(creator, opts)`        | `zustand/middleware`       | Redux DevTools integration                       |
| `persist(creator, opts)`         | `zustand/middleware`       | localStorage / sessionStorage persistence        |
| `subscribeWithSelector(creator)` | `zustand/middleware`       | Selector-based subscriptions outside React       |
| `immer(creator)`                 | `zustand/middleware/immer` | Mutable-style updates (via Immer)                |
| `createJSONStorage`              | `zustand/middleware`       | Create custom storage for `persist`              |
| `store.getState()`               | —                          | Read current state (outside React)               |
| `store.setState(patch)`          | —                          | Write state (outside React)                      |
| `store.subscribe(fn)`            | —                          | Subscribe to all changes                         |
| `store.getInitialState()`        | —                          | Get initial state (for test resets in auto-mock) |

---

## Common Mistakes & Fixes

| Mistake                                         | Fix                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Selector returns new object/array in v5         | Wrap with `useShallow` or select primitives separately                                       |
| `shallow` imported from `zustand/shallow`       | In v5, import equality fn from `zustand/vanilla/shallow`; import hook from `zustand/shallow` |
| `create<T>(fn)` instead of `create<T>()(fn)`    | Use double-call for correct TypeScript inference with middleware                             |
| Calling Zustand hook in Server Component        | Move to Client Component (`'use client'`)                                                    |
| Forgetting to return `unsub` from `useEffect`   | Memory leak — always return the unsubscribe function                                         |
| Using `useGameStore(s => s)`                    | Subscribes to everything — select only the fields needed                                     |
| Mutating `getState()` result directly           | Always use `set()` or actions; direct mutation is invisible to React                         |
| Store not reset between tests                   | Add `beforeEach(() => useGameStore.getState().reset())`                                      |
| `persist` causing hydration mismatch in Next.js | Use `_hasHydrated` flag or `skipHydration: true` + manual `rehydrate()`                      |
| Stale value in subscription callback            | Read from the state argument passed to the callback, not from outer closure                  |
| `@redux-devtools/extension` missing             | Type-only import required: `import type {} from '@redux-devtools/extension'`                 |

---

## Key Library Versions

```
zustand: 5.0.x
immer: 10.x (peer dep for zustand/middleware/immer)
@redux-devtools/extension: latest (type-only import for devtools)
React: 19.2.3
TypeScript: 5+ (strict mode)
Vitest: 2.x
```
