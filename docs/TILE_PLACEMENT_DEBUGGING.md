# Tile Placement Debugging Guide

This guide helps you diagnose and fix issues with tile placement in the Ravenloft game.

## Quick Diagnostic

### Step 1: Run the Diagnostic Tool

Open your browser's developer console (F12) and run:

```javascript
runTilePlacementDiagnostics()
```

This will generate a comprehensive report showing:
- Current game state
- Number of tiles and exploration points
- Detailed tile connection information
- Detected issues with recommendations

### Step 2: Interpret the Results

The diagnostic tool will identify common issues:

#### ❌ No exploration points found
**Cause**: The most common reason you can't place tiles.

**Possible reasons**:
1. Starting tile is not marked as `isRevealed: true`
2. Starting tile has no open edges (`isOpen: false` on all connections)
3. All open edges are already connected to other tiles
4. Bug in `TileSystem.getExplorationPoints()`

**Fix**: Check the tile details in the diagnostic output. The starting tile should have:
- `isRevealed: true`
- At least one connection with `isOpen: true` and no `connectedTileId`

#### ❌ No revealed tiles
**Cause**: Starting tile wasn't revealed during initialization.

**Fix**: Check your game initialization code. The starting tile should be set to `isRevealed: true` when placed.

#### ⚠️ Wrong interaction mode
**Cause**: UI is not in exploration mode.

**Fix**: The interaction mode should be `'explore'` to see exploration arrows. Check `useUIStore` state.

#### ⚠️ Empty dungeon deck
**Cause**: All tiles have been drawn.

**Fix**: This is expected at end of game. Check if this is intentional.

## Manual Inspection

### Check Starting Tile

```javascript
const gameState = useGameStore.getState().gameState;
const startTile = gameState.tiles[0];
console.log('Starting Tile:', {
  id: startTile.id,
  name: startTile.name,
  isRevealed: startTile.isRevealed,
  position: { x: startTile.x, z: startTile.z },
  connections: startTile.connections
});
```

### Check Exploration Points

```javascript
import { TileSystem } from './game/engine/TileSystem';
const gameState = useGameStore.getState().gameState;
const points = TileSystem.getExplorationPoints(gameState.tiles);
console.log('Exploration Points:', points);
```

### Check UI State

```javascript
const uiState = useUIStore.getState();
console.log('UI State:', {
  interactionMode: uiState.interactionMode,
  showTilePlacer: uiState.showTilePlacer,
  tilePlacementError: uiState.tilePlacementError
});
```

## Common Issues and Solutions

### Issue: "I see the starting tile but no arrows"

**Diagnosis**: Run `runTilePlacementDiagnostics()` and check:
1. Is `explorationPoints.length` > 0?
2. Is `interactionMode` set to `'explore'`?
3. Are there revealed tiles with open edges?

**Solution**:
- If no exploration points: Check if starting tile `isRevealed: true`
- If wrong mode: Set interaction mode to explore
- If tiles not revealed: Fix initialization code

### Issue: "I click an arrow but nothing happens"

**Diagnosis**: Check browser console for errors during click.

**Possible causes**:
1. Event handler not connected
2. Dungeon deck is empty
3. Error in `TileSystem.drawAndPlace()`

**Solution**: Check `ExplorationLayer.tsx` and ensure `onEdgeSelected` prop is connected.

### Issue: "Tile preview appears but I can't confirm placement"

**Diagnosis**: Check for placement validation errors.

**Solution**:
- Look for red error message at top of screen
- Run diagnostics to see `tilePlacementError`
- Check if tile edges match neighboring tiles

### Issue: "Starting tile has no open edges"

**Diagnosis**: Check tile data in `src/data/tiles.json`.

**Solution**: Ensure starting tile definition has at least one connection with `"isOpen": true`.

## Code Locations

Key files for tile placement:

- **Tile System Logic**: `src/game/engine/TileSystem.ts`
- **Exploration State Machine**: `src/game/engine/ExplorationStateMachine.ts`
- **Exploration UI**: `src/components/3d/ExplorationLayer.tsx`
- **Exploration Arrows**: `src/components/3d/ExplorationArrow.tsx`
- **Tile Data**: `src/data/tiles.json`
- **Game Store**: `src/store/gameStore.ts`
- **UI Store**: `src/store/uiStore.ts`

## Advanced Debugging

### Enable Verbose Logging

Uncomment console.log statements in:
- `TileSystem.getExplorationPoints()` (line 313)
- `ExplorationLayer` (line 20)

### Test Tile System Directly

```javascript
import { TileSystem } from './game/engine/TileSystem';

// Test if a position can accept a tile
const canPlace = TileSystem.canPlaceTile(gameState.tiles, 1, 0);
console.log('Can place at (1,0):', canPlace);

// Test valid rotations for a tile
const tile = { /* tile data */ };
const validRotations = TileSystem.getValidRotations(tile, 'north');
console.log('Valid rotations:', validRotations);
```

### Inspect Tile Connections

```javascript
const gameState = useGameStore.getState().gameState;
gameState.tiles.forEach(tile => {
  console.log(`Tile ${tile.name}:`, tile.connections.map(c => ({
    edge: c.edge,
    open: c.isOpen,
    connected: c.connectedTileId || 'none'
  })));
});
```

## Getting Help

If diagnostics don't reveal the issue:

1. Run `runTilePlacementDiagnostics()` and copy the full output
2. Check browser console for any error messages
3. Note the exact steps to reproduce the issue
4. Check if the issue occurs with a fresh game start

## Diagnostic Tool Reference

### Available Functions

All functions are available in the browser console:

```javascript
// Run complete diagnostic with formatted output
runTilePlacementDiagnostics()

// Get raw diagnostic data
const report = generateTilePlacementDiagnostics()

// Log formatted diagnostics
logTilePlacementDiagnostics()

// Get list of detected issues
const issues = checkTilePlacementIssues()
```

### Diagnostic Report Structure

```typescript
{
  timestamp: string;
  gamePhase: string;
  tileCount: number;
  revealedTileCount: number;
  explorationPoints: ExplorationPoint[];
  dungeonDeckSize: number;
  interactionMode: string;
  showTilePlacer: boolean;
  tilePlacementError: string | null;
  startingTile: Tile | null;
  tileDetails: Array<{
    id: string;
    name: string;
    position: { x: number; z: number };
    isRevealed: boolean;
    connections: Array<{
      edge: string;
      isOpen: boolean;
      connectedTileId?: string;
    }>;
  }>;
  explorationPointDetails: Array<{
    tileId: string;
    tileName: string;
    edge: string;
    worldPosition: { x: number; z: number };
    canPlaceTile: boolean;
  }>;
}