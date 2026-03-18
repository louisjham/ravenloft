# AGENTS.md - Architect Mode

This file provides guidance to agents when working with code in this repository.

## Architect Mode Specific Rules

### Architecture Constraints
- **State Management**: Zustand with `subscribeWithSelector` middleware required for all stores
- **Singleton Pattern**: `DataLoader` and `AudioManager` MUST be accessed via `.getInstance()` - never new instances
- **Error Boundary**: All 3D rendering wrapped in `GlobalErrorBoundary` in `src/App.tsx` Root component
- **Position System**: `{x, z, sqX, sqZ}` - tile coordinates (x,z) + square coordinates (sqX,sqZ) for 4x4 tile grid

### Directory Structure
- `src/components/3d/` - React Three Fiber components (Scene, Hero3D, Monster3D, Tile3D, etc.)
- `src/components/ui/` - UI overlay components (MainMenu, ActionBar, HeroPanel, etc.)
- `src/components/interaction/` - Game controllers and input handlers
- `src/game/` - Core game logic (GameEngine, CardSystem, CombatSystem, MonsterAI, etc.)
- `src/game/engine/` - Game engine subsystems (ActionResolver, TileSystem, etc.)
- `src/game/ai/` - Monster AI behaviors and pathfinding
- `src/store/` - Zustand state stores (gameStore, uiStore)
- `src/data/` - JSON game data (heroes, monsters, tiles, cards, scenarios)
- `src/utils/` - Utilities (modelLoader, errorHandling, accessibility, etc.)

### Data Flow Architecture
```
User Input → GameController → GameEngine → ActionResolver → State Update
State Update → Zustand Store → React Components Re-render
```

### Game Loop Phases
1. **Hero Phase**: Player moves, attacks, uses abilities
2. **Exploration Phase**: Draw and place new tile, trigger encounter
3. **Monster Phase**: All monsters act via AI (move toward heroes, attack)
4. **Next Hero**: Cycle to next hero in turn order

### Asset Architecture
- `DUMMY_MODE` in `src/utils/modelLoader.ts` controls asset fallback (currently `true`)
- When `true`: GLB loads return empty `Group()`, audio logs to console
- Components MUST provide procedural fallbacks (Cylinder, Box, Sphere) for missing assets
- This allows development without complete asset pipeline

### Component Communication
- Props down: Game state passed to 3D components via props from store
- Events up: User actions dispatched through GameController to GameEngine
- Store subscriptions: Components subscribe to specific state slices for reactivity

### Performance Considerations
- Target: 60fps on mid-range PCs
- Max 50 active entities on screen
- LOD system for distant tiles (not yet implemented)
- Use `subscribeWithSelector` to prevent unnecessary re-renders
