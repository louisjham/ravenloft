import { Tile, ExplorationPoint, Rotation } from '../types';
import { TileSystem } from './TileSystem';

export type ExplorationState =
  | { phase: 'idle' }
  | { phase: 'arrow_selected'; point: ExplorationPoint }
  | {
      phase: 'awaiting_rotation';
      point: ExplorationPoint;
      validRotations: Rotation[];
      drawnTile: Tile;
      remainingDeck: string[];
    }
  | {
      phase: 'placing';
      point: ExplorationPoint;
      rotation: Rotation;
    }
  | { phase: 'exhausted' };

export function onArrowClicked(
  state: ExplorationState,
  point: ExplorationPoint,
  drawResult: ReturnType<typeof TileSystem.drawAndPlace>
): ExplorationState {
  if (state.phase !== 'idle') return state;

  if (drawResult.tile && drawResult.validRotations.length > 0) {
    return {
      phase: 'awaiting_rotation',
      point,
      validRotations: drawResult.validRotations,
      drawnTile: drawResult.tile,
      remainingDeck: drawResult.remainingDeck,
    };
  }

  return { phase: 'exhausted' };
}

export function onRotationConfirmed(
  state: ExplorationState,
  rotation: Rotation
): ExplorationState {
  if (state.phase !== 'awaiting_rotation') return state;

  // Illegal transition check
  if (!state.validRotations.includes(rotation)) return state;

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
