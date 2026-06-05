import { Tile, ExplorationPoint, Rotation, ValidationResult, EdgeConflict } from '../types';
import { TileSystem } from './TileSystem';

export type ExplorationState =
  | { phase: 'idle' }
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
    return { ...state, pendingRotation: rotation };
  }
  return state;
}

/**
 * Called when player clicks an exploration arrow.
 * Only accepts idle phase — arrows should not be visible/clickable during
 * positioning, placement_blocked, or placing. If UI somehow shows arrows
 * outside idle, this silently returns state unchanged.
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
 * Called when player rotates the tile during positioning or from a blocked state.
 * Updates current rotation; updates validation preview only in positioning phase.
 */
export function onRotationChanged(
  state: ExplorationState,
  rotation: Rotation,
  validation: ValidationResult
): ExplorationState {
  if (state.phase === 'placement_blocked') {
    return { ...state, currentRotation: rotation };
  }

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
      currentRotation: chosenRotation,
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
    pendingRotation: state.pendingRotation,
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
    return {
      phase: 'positioning',
      point: state.point,
      drawnTile: drawResult.tile,
      drawnCardId: drawResult.cardId ?? drawResult.tile.id,
      remainingDeck: drawResult.remainingDeck,
      currentRotation: drawResult.validRotations.length > 0 ? drawResult.validRotations[0] : 0,
      validRotations: drawResult.validRotations,
      validationPreview: null,
    };
  }

  // No more tiles available
  return { phase: 'exhausted' };
}



export function onCancel(state: ExplorationState): {
  newState: ExplorationState;
  tileToReturn: string | null;
} {
  const tileToReturn =
    (state.phase === 'positioning' || state.phase === 'placement_blocked')
      ? state.drawnCardId
      : null;

  return { newState: { phase: 'idle' }, tileToReturn };
}

export function onPlacementComplete(state: ExplorationState): ExplorationState {
  if (state.phase !== 'placing') return state;

  return { phase: 'idle' };
}

