/**
 * Tile Placement Diagnostics
 * 
 * This script helps diagnose issues with tile placement by logging detailed
 * information about the game state, exploration points, and tile system behavior.
 */

import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { TileSystem } from '../game/engine/TileSystem';
import { GameState, ExplorationPoint, Tile } from '../game/types';

export interface DiagnosticReport {
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

/**
 * Generates a comprehensive diagnostic report of the current tile placement state
 */
export function generateTilePlacementDiagnostics(): DiagnosticReport {
  const gameState = useGameStore.getState().gameState;
  const uiState = useUIStore.getState();

  if (!gameState) {
    return {
      timestamp: new Date().toISOString(),
      gamePhase: 'NO_GAME_STATE',
      tileCount: 0,
      revealedTileCount: 0,
      explorationPoints: [],
      dungeonDeckSize: 0,
      interactionMode: uiState.interactionMode,
      showTilePlacer: uiState.showTilePlacer,
      tilePlacementError: uiState.tilePlacementError,
      startingTile: null,
      tileDetails: [],
      explorationPointDetails: [],
    };
  }

  const tiles = gameState.tiles;
  const revealedTiles = tiles.filter(t => t.isRevealed);
  const explorationPoints = TileSystem.getExplorationPoints(tiles);

  // Get detailed tile information
  const tileDetails = tiles.map(tile => ({
    id: tile.id,
    name: tile.name || 'Unknown',
    position: { x: tile.x, z: tile.z },
    isRevealed: tile.isRevealed,
    connections: tile.connections.map(conn => ({
      edge: conn.edge,
      isOpen: conn.isOpen,
      connectedTileId: conn.connectedTileId,
    })),
  }));

  // Get detailed exploration point information
  const explorationPointDetails = explorationPoints.map(point => {
    const tile = tiles.find(t => t.id === point.tileId);
    const targetCoords = getTargetCoordsForEdge(tile!, point.edge);
    
    return {
      tileId: point.tileId,
      tileName: tile?.name || 'Unknown',
      edge: point.edge,
      worldPosition: { x: point.worldX, z: point.worldZ },
      canPlaceTile: TileSystem.canPlaceTile(tiles, targetCoords.x, targetCoords.z),
    };
  });

  return {
    timestamp: new Date().toISOString(),
    gamePhase: gameState.phase,
    tileCount: tiles.length,
    revealedTileCount: revealedTiles.length,
    explorationPoints,
    dungeonDeckSize: gameState.dungeonDeck.length,
    interactionMode: uiState.interactionMode,
    showTilePlacer: uiState.showTilePlacer,
    tilePlacementError: uiState.tilePlacementError,
    startingTile: tiles.find(t => t.id.includes('start')) || tiles[0] || null,
    tileDetails,
    explorationPointDetails,
  };
}

/**
 * Helper function to get target coordinates for an edge
 */
function getTargetCoordsForEdge(tile: Tile, edge: string): { x: number; z: number } {
  switch (edge) {
    case 'north': return { x: tile.x, z: tile.z - 1 };
    case 'south': return { x: tile.x, z: tile.z + 1 };
    case 'east': return { x: tile.x + 1, z: tile.z };
    case 'west': return { x: tile.x - 1, z: tile.z };
    default: return { x: tile.x, z: tile.z };
  }
}

/**
 * Logs a formatted diagnostic report to the console
 */
export function logTilePlacementDiagnostics(): void {
  const report = generateTilePlacementDiagnostics();
  
  console.group('🔍 TILE PLACEMENT DIAGNOSTICS');
  console.log('Timestamp:', report.timestamp);
  console.log('Game Phase:', report.gamePhase);
  console.log('Interaction Mode:', report.interactionMode);
  console.log('Show Tile Placer:', report.showTilePlacer);
  console.log('Placement Error:', report.tilePlacementError || 'None');
  
  console.group('📊 Tile Statistics');
  console.log('Total Tiles:', report.tileCount);
  console.log('Revealed Tiles:', report.revealedTileCount);
  console.log('Dungeon Deck Size:', report.dungeonDeckSize);
  console.groupEnd();
  
  console.group('🎯 Exploration Points');
  console.log('Count:', report.explorationPoints.length);
  if (report.explorationPoints.length === 0) {
    console.warn('⚠️ NO EXPLORATION POINTS FOUND - This is the likely issue!');
  }
  report.explorationPointDetails.forEach((point, idx) => {
    console.log(`Point ${idx + 1}:`, {
      tile: point.tileName,
      edge: point.edge,
      worldPos: point.worldPosition,
      canPlace: point.canPlaceTile,
    });
  });
  console.groupEnd();
  
  console.group('🗺️ Tile Details');
  report.tileDetails.forEach(tile => {
    console.group(`Tile: ${tile.name} (${tile.id})`);
    console.log('Position:', tile.position);
    console.log('Revealed:', tile.isRevealed);
    console.log('Connections:');
    tile.connections.forEach(conn => {
      const status = conn.isOpen ? '🟢 OPEN' : '🔴 CLOSED';
      const connected = conn.connectedTileId ? `→ ${conn.connectedTileId}` : '(no connection)';
      console.log(`  ${conn.edge}: ${status} ${connected}`);
    });
    console.groupEnd();
  });
  console.groupEnd();
  
  console.groupEnd();
}

/**
 * Checks for common tile placement issues and returns diagnostic messages
 */
export function checkTilePlacementIssues(): string[] {
  const report = generateTilePlacementDiagnostics();
  const issues: string[] = [];

  // Check 1: No game state
  if (report.gamePhase === 'NO_GAME_STATE') {
    issues.push('❌ No game state found - game may not be initialized');
    return issues;
  }

  // Check 2: No tiles
  if (report.tileCount === 0) {
    issues.push('❌ No tiles on board - starting tile may not be placed');
  }

  // Check 3: No revealed tiles
  if (report.revealedTileCount === 0) {
    issues.push('❌ No revealed tiles - starting tile may not be marked as revealed');
  }

  // Check 4: No exploration points
  if (report.explorationPoints.length === 0) {
    issues.push('❌ No exploration points found - this prevents tile placement');
    
    // Sub-check: Are there revealed tiles with open edges?
    const revealedWithOpenEdges = report.tileDetails.filter(t => 
      t.isRevealed && t.connections.some(c => c.isOpen && !c.connectedTileId)
    );
    
    if (revealedWithOpenEdges.length === 0) {
      issues.push('  → No revealed tiles have open, unconnected edges');
    } else {
      issues.push(`  → Found ${revealedWithOpenEdges.length} revealed tiles with open edges, but they're not generating exploration points`);
      issues.push('  → This suggests an issue in TileSystem.getExplorationPoints()');
    }
  }

  // Check 5: Wrong interaction mode
  if (report.interactionMode !== 'explore' && !report.showTilePlacer) {
    issues.push(`⚠️ Interaction mode is '${report.interactionMode}' (expected 'explore' for tile placement)`);
  }

  // Check 6: Empty dungeon deck
  if (report.dungeonDeckSize === 0) {
    issues.push('⚠️ Dungeon deck is empty - no more tiles to draw');
  }

  // Check 7: Placement error present
  if (report.tilePlacementError) {
    issues.push(`⚠️ Active placement error: ${report.tilePlacementError}`);
  }

  // Check 8: Starting tile issues
  if (report.startingTile) {
    const startTile = report.tileDetails.find(t => t.id === report.startingTile!.id);
    if (startTile && !startTile.isRevealed) {
      issues.push('❌ Starting tile is not marked as revealed');
    }
  } else {
    issues.push('⚠️ Could not identify starting tile');
  }

  if (issues.length === 0) {
    issues.push('✅ No obvious issues detected - tile placement should work');
  }

  return issues;
}

/**
 * Runs a complete diagnostic check and logs results
 */
export function runTilePlacementDiagnostics(): void {
  console.clear();
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 TILE PLACEMENT DIAGNOSTIC TOOL');
  console.log('═══════════════════════════════════════════════════════\n');
  
  logTilePlacementDiagnostics();
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 ISSUE DETECTION');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const issues = checkTilePlacementIssues();
  issues.forEach(issue => console.log(issue));
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('💡 NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('1. Review the issues listed above');
  console.log('2. Check the tile details to see connection states');
  console.log('3. Verify the starting tile is revealed and has open edges');
  console.log('4. Ensure interaction mode is set to "explore"');
  console.log('5. Check browser console for any errors during game initialization');
  console.log('\n');
}

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  (window as any).runTilePlacementDiagnostics = runTilePlacementDiagnostics;
  (window as any).logTilePlacementDiagnostics = logTilePlacementDiagnostics;
  (window as any).checkTilePlacementIssues = checkTilePlacementIssues;
  (window as any).generateTilePlacementDiagnostics = generateTilePlacementDiagnostics;
}

// Made with Bob
