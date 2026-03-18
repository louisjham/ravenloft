# AGENTS.md - Code Mode

This file provides guidance to agents when working with code in this repository.

## Code Mode Specific Rules

### Singleton Pattern Requirements
- Always access `DataLoader` via `DataLoader.getInstance()` - never create new instances
- Always access `AudioManager` via `AudioManager.getInstance()` - never create new instances
- Singleton pattern ensures data consistency across components

### Zustand Store Access
- Use `subscribeWithSelector` middleware for all Zustand stores
- Store access: `useGameStore.getState()` for direct access (e.g., in tests)
- Component access: `useGameStore((state) => state.gameState)` for reactive updates
- Fine-grained subscriptions: `useGameStore((state) => state.selectedEntity)` to prevent unnecessary re-renders

### Asset Loading with DUMMY_MODE
- `DUMMY_MODE` in `src/utils/modelLoader.ts` controls asset fallback (currently `true`)
- When `DUMMY_MODE=true`: `useModel()` returns empty `Group()`, `AudioManager` logs instead of playing
- Components MUST provide procedural fallbacks (Cylinder, Box, Sphere) when models fail
- Never assume GLB files exist - always handle missing assets gracefully

### Position Type Convention
- `{x, z, sqX, sqZ}` - tile coordinates + square coordinates for 4x4 tile grid
- `x, z`: Tile position in dungeon grid
- `sqX, sqZ`: Square position within tile (0-3 range)
- Use this type consistently for all entity positioning

### Error Handling
- Wrap 3D scene components in `GlobalErrorBoundary` to prevent total app crashes
- Use `logGameError(module, message, data)` to persist errors to localStorage ('game_logs', last 50 entries)
- Check `DUMMY_MODE` before attempting to load assets or play audio

### Component Structure
- 3D components in `src/components/3d/` (Scene, Hero3D, Monster3D, Tile3D, etc.)
- UI components in `src/components/ui/` (MainMenu, ActionBar, HeroPanel, etc.)
- Game logic in `src/game/` (GameEngine, CardSystem, CombatSystem, etc.)
- Always import from `src/utils/errorHandling.tsx` for error boundary
