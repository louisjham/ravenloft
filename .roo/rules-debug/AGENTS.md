# AGENTS.md - Debug Mode

This file provides guidance to agents when working with code in this repository.

## Debug Mode Specific Rules

### Debugging Asset Loading Issues
- Check `DUMMY_MODE` in `src/utils/modelLoader.ts` - if `true`, models return empty groups
- AudioManager logs `[Audio Dummy]` messages when `DUMMY_MODE=true` instead of playing sounds
- GLB model paths are defined in `MODELS` constant in `src/utils/modelLoader.ts`
- Missing models cause silent failures in DUMMY_MODE - check console for `[Audio Dummy]` messages

### Accessing Game State for Debugging
- Direct store access: `useGameStore.getState()` - returns current state without reactivity
- Check `gameState` is not null before accessing nested properties
- Game logs stored in localStorage as 'game_logs' (last 50 entries)
- Use `logGameError(module, message, data)` to persist debug info

### Common Silent Failures
- Audio play failures are caught and logged as warnings - won't crash app
- Model load failures return empty Groups in DUMMY_MODE - check console
- State updates in Zustand don't throw errors silently - verify state changes with store subscriptions

### Debugging 3D Scene Issues
- `GlobalErrorBoundary` in `src/App.tsx` wraps entire app - catches 3D shader/model errors
- Three.js errors appear in browser console, not VSCode debug console
- Physics issues: Check `@react-three/cannon` debug props on Physics component
- Camera issues: Scene component in `src/components/3d/Scene.tsx` controls camera

### Debugging Game Logic
- GameEngine in `src/game/GameEngine.ts` contains core game loop
- Monster AI in `src/game/ai/MonsterAI.ts` - check pathfinding and target selection
- CombatSystem in `src/game/engine/CombatSystem.ts` - verify damage calculations
- ActionResolver in `src/game/engine/ActionResolver.ts` - validates moves and attacks

### Running Manual Tests
- No automated test runner - call `runFullGameLoopTest()` from browser console
- Test file: `src/testing/integrationTests.ts`
- Tests access stores directly via `useGameStore.getState()`
- Run `runAIStressTest(iterations)` to test AI pathfinding
