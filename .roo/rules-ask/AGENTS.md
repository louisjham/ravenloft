# AGENTS.md - Ask Mode

This file provides guidance to agents when working with code in this repository.

## Ask Mode Specific Rules

### Project Context
- This is a 3D recreation of the D&D board game "Castle Ravenloft" (2010)
- Tech stack: React + TypeScript + Three.js (via react-three-fiber) + Vite
- Game uses cooperative turn-based mechanics with heroes exploring dungeon tiles
- Source material: D&D 4th Edition Adventure System by Wizards of the Coast

### Data Organization
- All game content in JSON files under `src/data/`:
  - `heroes.json` - 5 hero characters (Arjhan, Immeril, Kat, Thorgrim, Vani)
  - `monsters.json` - 13 monster types with behaviors
  - `tiles.json` - 42 dungeon tiles (4x4 grid each)
  - `cards/` subdirectory - Attack, Item, Spell, Encounter, Treasure cards
  - `scenarios/` subdirectory - 5 adventure scenarios
- Data loaded via `DataLoader.getInstance()` singleton

### Architecture Overview
- Entry point: `src/main.tsx` → `src/App.tsx` (wrapped in `GlobalErrorBoundary`)
- State management: Zustand stores in `src/store/`
  - `gameStore.ts` - Game state (heroes, monsters, tiles, phase, etc.)
  - `uiStore.ts` - UI state (modals, transitions, selection, etc.)
- 3D rendering: React Three Fiber components in `src/components/3d/`
- Game logic: Engine classes in `src/game/` (GameEngine, CombatSystem, MonsterAI, etc.)
- UI overlay: Absolute positioned layer over 3D canvas in `src/components/ui/`

### Key Game Concepts
- Position system: `{x, z, sqX, sqZ}` - tile + square coordinates for 4x4 grid
- Game phases: 'hero' → 'exploration' → 'monster' → repeat
- Turn order: Heroes take turns, then all monsters act
- Heroes have abilities, items, healing surges; monsters have AI behaviors
- D20 die mechanic for all attack rolls and skill checks

### Asset System
- `DUMMY_MODE=true` in development - returns empty groups instead of loading GLB files
- Audio logs to console instead of playing when `DUMMY_MODE=true`
- Model paths defined in `src/utils/modelLoader.ts` MODELS constant
- Components provide procedural fallbacks (Cylinders, Boxes, Spheres) for missing assets

### Testing
- No automated test runner configured
- Manual tests: `runFullGameLoopTest()` and `runAIStressTest()` in `src/testing/integrationTests.ts`
- Tests access Zustand stores directly via `useGameStore.getState()`
