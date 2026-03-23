import { Tile, ExplorationPoint, Rotation, ValidationResult, EdgeConflict, EdgeDirection } from '../types';
import { TileSystem, isPlacementValid, getEffectiveOpenEdges } from './TileSystem';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

export type ExplorationState =
  | { phase: 'idle' }
  | { phase: 'arrow_selected'; point: ExplorationPoint }
  | {
    phase: 'positioning';
    point: ExplorationPoint;
    drawnTile: Tile;
    drawnCardId: string;
    remainingDeck: string[];
    currentRotation: Rotation;
    pendingRotation?: Rotation;
    validationPreview: ValidationResult | null;
  }
  | {
    phase: 'placement_blocked';
    point: ExplorationPoint;
    drawnTile: Tile;
    drawnCardId: string;
    remainingDeck: string[];
    currentRotation: Rotation;
    pendingRotation?: Rotation;
    conflicts: EdgeConflict[];
  }
  | {
    phase: 'placing';
    point: ExplorationPoint;
    rotation: Rotation;
  }
  | { phase: 'exhausted' };

export function setTileRotation(state: ExplorationState, rotation: Rotation): ExplorationState {
  if (state.phase === 'positioning' || state.phase === 'placement_blocked') {
    return { ...state, pendingRotation: rotation, currentRotation: rotation };
  }
  return state;
}

/**
 * Called when player clicks an exploration arrow.
 * Draws the next tile from deck and enters positioning phase.
 */
export function onArrowClicked(
  state: ExplorationState,
  point: ExplorationPoint,
  drawResult: ReturnType<typeof TileSystem.drawAndPlace>
): ExplorationState {
  if (state.phase !== 'idle') return state;

  if (drawResult.tile) {
    return {
      phase: 'positioning',
      point,
      drawnTile: drawResult.tile,
      drawnCardId: drawResult.tile.id,
      remainingDeck: drawResult.remainingDeck,
      currentRotation: 0,
      validationPreview: null, // Will be computed by caller
    };
  }

  return { phase: 'exhausted' };
}

/**
 * Called when player rotates the tile during positioning.
 * Updates validation preview based on new rotation.
 */
export function onRotationChanged(
  state: ExplorationState,
  rotation: Rotation,
  validation: ValidationResult
): ExplorationState {
  if (state.phase !== 'positioning') return state;

  return {
    ...state,
    currentRotation: rotation,
    validationPreview: validation,
  };
}

/**
 * Called when player attempts to place the tile.
 * If valid, transitions to placing phase. If invalid, transitions to placement_blocked.
 */
export function onPlacementAttempted(
  state: ExplorationState,
  validation: ValidationResult
): ExplorationState {
  if (state.phase !== 'positioning') return state;

  const gameStore = useGameStore.getState();
  const gameState = gameStore.gameState;

  if (gameState) {
    const board = new Map<string, { openEdges: EdgeDirection[], rotation: number }>();
    for (const t of gameState.tiles) {
      const edges = t.connections.filter(c => c.isOpen).map(c => c.edge as EdgeDirection);
      board.set(`${t.x},${t.z}`, { openEdges: edges, rotation: t.rotation || 0 });
    }

    const candidateEdges = state.drawnTile.connections
      .filter(c => c.isOpen)
      .map(c => c.edge as EdgeDirection);
    
    const parentTile = gameState.tiles.find(t => t.id === state.point.tileId);
    let targetX = 0;
    let targetZ = 0;
    if (parentTile) {
      if (state.point.edge === 'north') { targetX = parentTile.x; targetZ = parentTile.z - 1; }
      if (state.point.edge === 'south') { targetX = parentTile.x; targetZ = parentTile.z + 1; }
      if (state.point.edge === 'east') { targetX = parentTile.x + 1; targetZ = parentTile.z; }
      if (state.point.edge === 'west') { targetX = parentTile.x - 1; targetZ = parentTile.z; }
    }

    const chosenRotation = state.pendingRotation ?? state.currentRotation;
    const result = isPlacementValid(candidateEdges, chosenRotation, targetX, targetZ, board);

    if (!result.valid) {
      // a. Push rejection reason to the game log via gameStore
      const updatedLog = [
        ...gameState.log,
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString(),
          message: `Placement Invalid: ${result.reason}`,
          type: 'system' as const
        }
      ];
      useGameStore.setState({
        gameState: {
          ...gameState,
          log: updatedLog
        }
      });

      // b. Set UI flag in uiStore
      useUIStore.setState({ tilePlacementError: result.reason } as any);

      // c. Keep exploration state waiting
      return {
        ...state,
        phase: 'positioning',
        currentRotation: chosenRotation,
        validationPreview: validation
      };
    }
  }

  if (validation.valid) {
    return {
      phase: 'placing',
      point: state.point,
      rotation: state.pendingRotation ?? state.currentRotation,
    };
  }

  return {
    phase: 'placement_blocked',
    point: state.point,
    drawnTile: state.drawnTile,
    drawnCardId: state.drawnCardId,
    remainingDeck: state.remainingDeck,
    currentRotation: state.pendingRotation ?? state.currentRotation,
    conflicts: validation.conflicts,
  };
}

/**
 * Called when player clicks "Try Again" after blocked placement.
 * Returns to positioning phase with same tile.
 */
export function onTryAgain(
  state: ExplorationState
): ExplorationState {
  if (state.phase !== 'placement_blocked') return state;

  return {
    phase: 'positioning',
    point: state.point,
    drawnTile: state.drawnTile,
    drawnCardId: state.drawnCardId,
    remainingDeck: state.remainingDeck,
    currentRotation: state.currentRotation,
    validationPreview: null,
  };
}

/**
 * Called when player clicks "Draw Different Tile" after blocked placement.
 * Returns current tile to deck and draws next tile.
 */
export function onDrawDifferentTile(
  state: ExplorationState,
  drawResult: ReturnType<typeof TileSystem.returnAndDrawNext>
): ExplorationState {
  if (state.phase !== 'placement_blocked') return state;

  if (drawResult.tile) {
    return {
      phase: 'positioning',
      point: state.point,
      drawnTile: drawResult.tile,
      drawnCardId: drawResult.cardId || drawResult.tile.id,
      remainingDeck: drawResult.remainingDeck,
      currentRotation: 0,
      validationPreview: null,
    };
  }

  // No more tiles available
  return { phase: 'exhausted' };
}

/**
 * Legacy function for backwards compatibility.
 * Use onPlacementAttempted instead for validation-based flow.
 */
export function onRotationConfirmed(
  state: ExplorationState,
  rotation: Rotation
): ExplorationState {
  if (state.phase !== 'positioning') return state;

  const gameStore = useGameStore.getState();
  const gameState = gameStore.gameState;

  if (gameState) {
    const board = new Map<string, { openEdges: EdgeDirection[], rotation: number }>();
    for (const t of gameState.tiles) {
      const edges = t.connections.filter(c => c.isOpen).map(c => c.edge as EdgeDirection);
      board.set(`${t.x},${t.z}`, { openEdges: edges, rotation: t.rotation || 0 });
    }

    const candidateEdges = state.drawnTile.connections
      .filter(c => c.isOpen)
      .map(c => c.edge as EdgeDirection);
    
    const parentTile = gameState.tiles.find(t => t.id === state.point.tileId);
    let targetX = 0;
    let targetZ = 0;
    if (parentTile) {
      if (state.point.edge === 'north') { targetX = parentTile.x; targetZ = parentTile.z - 1; }
      if (state.point.edge === 'south') { targetX = parentTile.x; targetZ = parentTile.z + 1; }
      if (state.point.edge === 'east') { targetX = parentTile.x + 1; targetZ = parentTile.z; }
      if (state.point.edge === 'west') { targetX = parentTile.x - 1; targetZ = parentTile.z; }
    }

    const result = isPlacementValid(candidateEdges, rotation, targetX, targetZ, board);

    if (!result.valid) {
      const updatedLog = [
        ...gameState.log,
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString(),
          message: `Placement Invalid: ${result.reason}`,
          type: 'system' as const
        }
      ];
      useGameStore.setState({
        gameState: {
          ...gameState,
          log: updatedLog
        }
      });

      useUIStore.setState({ tilePlacementError: result.reason } as any);

      return {
        ...state,
        phase: 'positioning',
        currentRotation: rotation
      };
    }
  }

  return {
    phase: 'placing',
    point: state.point,
    rotation,
  };
}

export function onCancel(state: ExplorationState): ExplorationState {
  // Cancel path from any phase
  // The caller handles returning `drawnTile` to `remainingDeck`
  return { phase: 'idle' };
}

export function onPlacementComplete(state: ExplorationState): ExplorationState {
  if (state.phase !== 'placing') return state;

  return { phase: 'idle' };
}
