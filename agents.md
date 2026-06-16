# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Source of Truth
- The ultimate source of truth for the game mechanics is the official D&D Adventure System board game rules and the literal text printed on the game cards.
- The transcribed text for all cards is located in `card-source-truth/` (e.g., `items.md`, `monsters.md`, `environments.md`, `events.md`, `event-attacks.md`, `traps.md`, `powers.md`).
- The corresponding card art is located in `card-source-truth/cardart/`.
- Unless explicitly documented otherwise, always implement mechanics exactly as they are written in the physical board game rules and on the card text.

## Build & Run
- `npm run dev` — Start dev server on port 3000
- `npm run build` — TypeScript compile + Vite production build
- `npm run preview` — Preview production build
- `npm run typecheck` — Run TypeScript type checking (tsc --noEmit)
- No linter is configured; there is no `npm run lint` command

## Testing
- No Jest/Vitest configured; run tests via `npx tsx runTests.ts`
- Test entry point: `runTests.ts` at repo root (mocks localStorage, calls `runFullGameLoopTest()`)
- Integration tests are in `src/testing/integrationTests.ts`
- Suite helpers: `runAbilitySystemTests()` in `src/testing/ability-system-tests.ts`
- Test utilities (console capture, assertions) in `src/testing/testUtils.ts`
- Use `throw new Error('message')` for assertions — no assertion library
- All tests access Zustand stores directly via `useGameStore.getState()`
- Use `crypto.randomUUID()` for unique IDs in test data
- Factory functions for test objects: `createAITile()`, `createAIHero()`, `createAIMonster()`, `createAIState()` in integrationTests.ts; `createTestTile()`, `createTestHero()`, `createTestMonster()`, `createTestGameState()` in ability-system-tests.ts
- Deterministic rolls via `AbilitySystem._rollOverride = () => 14` / `null`
- Async combat tests: Any test file exercising `attackMonster` or async combat actions must import `useDiceStore` from `../store/diceStore` and initialize it with a stub `requestRoll` that immediately sets a result and calls `onComplete()` (e.g., using `useDiceStore.setState({ requestRoll: (params: any) => { ... params.onComplete(); } })`).
- Test both success and failure paths; verify immutability of original objects after operations
- `TileConnection` shorthands: `openEdge(edge)`, `closedEdge(edge)`

## Asset Resilience
- `DUMMY_MODE` in `src/utils/modelLoader.ts` controls asset fallback behavior (currently `true`)
- When `DUMMY_MODE=true`: GLB model loads return empty `Group()`, audio logs to console instead of playing
- Components use procedural fallbacks (Cylinders, Boxes, Spheres) when models fail to load
- This allows development without complete asset pipeline

## Critical Patterns
- **Singletons**: `DataLoader.getInstance()`, `AudioManager.getInstance()` — always use singleton access
- **Zustand Middleware**: Game store uses `subscribeWithSelector` for fine-grained reactivity; UI store does not use middleware
- **Position Type**: `{x, z, sqX, sqZ}` — tile coordinates (x,z) + square coordinates (sqX,sqZ) for 4x4 tile grid
- **Error Boundary**: `GlobalErrorBoundary` wraps entire app in `Root` component
- **Game Logs**: Stored in localStorage as 'game_logs' (last 50 entries) via `logGameError()`

## Architecture
- Entry: `src/main.tsx` → `src/App.tsx` (wrapped in `GlobalErrorBoundary`)
- State: `src/store/gameStore.ts` (game state, sliced), `src/store/uiStore.ts` (UI state)
  - Game store slices: `coreSlice`, `combatSlice`, `cardSlice`, `powerSlice`, `conditionSlice`, `tokenSlice`
  - Store types in `src/store/storeTypes.ts`: each slice is an interface, `GameStore extends CoreSlice, CombatSlice, ...`
  - Slice creator pattern: `StateCreator<GameStore, [], [], SliceName>`
- 3D: React Three Fiber + Cannon physics, Scene wraps all 3D components
  - 3D components in `src/components/3d/`, UI overlay in `src/components/ui/`
  - Event handlers type: `ThreeEvent<MouseEvent>` from `@react-three/fiber`
- Engine systems (TileSystem, CombatSystem, etc.) are pure functions — they take state and return new state
  - Class pattern: `export class TileSystem { public static methodName(...): ReturnType { ... } }`
  - Standalone functions: `MonsterAI` exports pure functions (no class wrapper)
  - ExplorationStateMachine uses discriminated union state: `{ phase: 'idle' } | { phase: 'positioning'; point; ... }`
- Logic in `src/game/`, components in `src/components/`, store in `src/store/`
- Custom hooks in `src/hooks/`: `useGameActions`, `useKeyboard`, `useSelection`
- Context in `src/contexts/TilePlacementContext.tsx` (minimal, only one context)

## Code Style Guidelines

### TypeScript
- Strict mode in tsconfig.json (`"strict": true`)
- Prefer `interface` for object shapes, `type` for unions/mapped types/intersections
- Avoid `any`; use `unknown` with type guards
- Export types inline at definition (no separate export statements)
- Use `import type { ... }` for type-only imports
- Generics follow `<T extends Constraint>` pattern where needed
- Import `StateCreator` from `zustand` for slice typing

### Imports
Group in this order with blank lines between:
1. External libraries (react, three, zustand, cannon-es, etc.)
2. Internal `../game/` and `../store/` imports
3. Relative component imports (../components/...)
4. Relative utility imports (../utils/..., ../hooks/...)
5. CSS / asset imports

### Naming Conventions
- **Components**: PascalCase (HeroPanel.tsx, EncounterCardOverlay.tsx)
- **Functions/variables**: camelCase (moveHero, currentHeroId)
- **Types/interfaces**: PascalCase (GameState, TileConnection, CombatSlice)
- **Constants**: UPPER_SNAKE_CASE (GAME_CONSTANTS, DUMMY_MODE, MODELS)
- **Files**: PascalCase for components, kebab-case for utilities (modelLoader.ts)
- **Boolean variables**: Prefix with `is`/`has`/`can` (isRevealed, hasAttackedThisTurn)

### Component Patterns
- `export const ComponentName: React.FC = () => { ... }` for function components
- `React.memo` for components with stable props
- `useCallback` for event handlers passed as props
- `useMemo` for expensive derived values
- Fine-grained Zustand selectors: `useGameStore((state) => state.field)` to minimize re-renders
- Direct store access for mutations: `useGameStore.getState().someAction(...)`
- 3D: `useFrame` from `@react-three/fiber` for animation loops
- 3D: Wrap model loads in `<Suspense fallback={<Placeholder />}>`
- 3D: `useRef` for animated values, `useMemo` for cloning/caching models

### Formatting
- 2-space indentation
- Semicolons required
- Trailing commas in multiline objects/arrays
- Max line length ~100 characters (soft limit)

### Error Handling
- `GlobalErrorBoundary` wraps the full React tree
- Game logs: localStorage key `'game_logs'`, last 50 entries, via `logGameError()`
- Helper `addLog()` in `gameStore.ts` for structured log entries with `{id, timestamp, message, type}`
- `console.error()` for unexpected runtime conditions
- User-facing errors go to UI components, not just the console
- Test assertions use `throw new Error('message')` — no assertion library

### State Management (Zustand)
- Game store: `create<GameStore>()(subscribeWithSelector((...a) => ({ ...createCoreSlice(...a), ...combatSlice(...a), ... })))`
- UI store: `create<UIStore>()((set) => ({ ... }))` — no middleware, no slices, simpler
- Never mutate state directly — always return new objects/arrays via `{ ...state, field: newValue }`
- Mutations happen only inside `set()` callbacks
- Action naming: verb-prefixed (setGameState, moveHero, attackMonster, endTurn, showModal, addNotification)
- Use `set({ field: value })` for simple updates, `set((state) => ({ ...state, field: derived }))` for computed

### Game Logic (Pure Functions)
- Systems are pure static classes: `TileSystem`, `CombatSystem`, `AbilitySystem`
- Standalone pure functions: `MonsterAI.manhattanDistance()`, etc.
- Every method takes state and returns new state without mutation
- No side effects, no I/O, no store access inside game logic
- Return new entity references: `return { ...entity, hp: newHp }`

### Performance
- `React.memo` for components with stable props
- `useCallback` for event handlers passed as props
- `useMemo` for expensive derived values
- Zustand `subscribeWithSelector` keeps re-renders scoped to subscribed slices
- Fine-grained selectors in components prevent unnecessary re-renders

## CSS
- Gothic theme with custom fonts: `--font-gothic: 'Cinzel'`, `--font-accent: 'MedievalSharp'`, `--font-body: 'Outfit'`
- CSS variables in `:root` for colors and effects
  - Colors: `--color-bg: #050505`, `--color-accent: #8b0000`, `--color-gold: #c0a060`
  - Vibe: dark, blood-red accents, deep purple secondary
- `.gothic-panel` class for themed containers with glare overlay
- Keyframe animations: `slideIn`, `pulse-glow`
- `.custom-scrollbar` class for styled scrollbars with `::-webkit-scrollbar`
- Components use extensive inline styles (no CSS modules or styled-components)
