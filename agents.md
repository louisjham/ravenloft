# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build & Run
- `npm run dev` - Start dev server on port 3000
- `npm run build` - TypeScript compile + Vite production build
- `npm run preview` - Preview production build

## Testing
- No automated test runner configured
- Manual tests: Call `runFullGameLoopTest()` or `runAIStressTest()` from `src/testing/integrationTests.ts`
- Tests access Zustand stores directly via `useGameStore.getState()`

## Asset Resilience
- `DUMMY_MODE` in `src/utils/modelLoader.ts` controls asset fallback behavior (currently `true`)
- When `DUMMY_MODE=true`: GLB model loads return empty `Group()`, audio logs to console instead of playing
- Components use procedural fallbacks (Cylinders, Boxes, Spheres) when models fail to load
- This allows development without complete asset pipeline

## Critical Patterns
- **Singletons**: `DataLoader.getInstance()`, `AudioManager.getInstance()` - always use singleton access
- **Zustand Middleware**: Stores use `subscribeWithSelector` for fine-grained reactivity
- **Position Type**: `{x, z, sqX, sqZ}` - tile coordinates (x,z) + square coordinates (sqX,sqZ) for 4x4 tile grid
- **Error Boundary**: `GlobalErrorBoundary` wraps entire app in `Root` component
- **Game Logs**: Stored in localStorage as 'game_logs' (last 50 entries) via `logGameError()`

## Architecture
- Entry: `src/main.tsx` → `src/App.tsx` (wrapped in `GlobalErrorBoundary`)
- State: `src/store/gameStore.ts` (game state), `src/store/uiStore.ts` (UI state)
- 3D: React Three Fiber + Cannon physics, Scene wraps all 3D components
- UI: Absolute overlay layer over 3D canvas, pointer-events managed per element

## CSS
- Gothic theme with custom fonts (Cinzel, MedievalSharp)
- CSS variables in `:root` for colors and effects
- `.gothic-panel` class for themed containers with glare overlay
