import { Tile, ExplorationPoint, Rotation, ValidationResult, EdgeConflict, EdgeDirection } from '../types';
import { TileSystem } from './TileSystem';

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
    validRotations: Rotation[];
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
    validRotations: Rotation[];
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
      currentRotation: drawResult.validRotations.length > 0 ? drawResult.validRotations[0] : 0,
      validRotations: drawResult.validRotations,
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

export function onPlacementAttempted(
  state: ExplorationState,
  validation: ValidationResult
): ExplorationState {
  if (state.phase !== 'positioning') return state;

  const chosenRotation = state.pendingRotation ?? state.currentRotation;

  if (!validation.valid) {
    return {
      ...state,
      phase: 'placement_blocked',
      drawnTile: state.drawnTile,
      drawnCardId: state.drawnCardId,
      remainingDeck: state.remainingDeck,
      currentRotation: chosenRotation,
      validRotations: state.validRotations,
      conflicts: validation.conflicts,
    };
  }

  return {
    phase: 'placing',
    point: state.point,
    rotation: chosenRotation,
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
    validRotations: state.validRotations,
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
    // If TileSystem.returnAndDrawNext returned validRotations it'd be robust, but it doesn't.
    // In actual game rules, "Draw Different Tile" gives a new tile which we must validate again 
    // vs the original target edge. We compute its validRotations here or expect them from the caller.
    // Note: Since TileSystem.returnAndDrawNext doesn't generate validRotations itself, we compute it inline:
    const newRotations = TileSystem.getValidRotations(drawResult.tile, state.point.edge);
    
    return {
      phase: 'positioning',
      point: state.point,
      drawnTile: drawResult.tile,
      drawnCardId: drawResult.cardId || drawResult.tile.id,
      remainingDeck: drawResult.remainingDeck,
      currentRotation: newRotations.length > 0 ? newRotations[0] : 0,
      validRotations: newRotations,
      validationPreview: null,
    };
  }

  // No more tiles available
  return { phase: 'exhausted' };
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

