import React, { useMemo } from 'react';
import { Tile, ExplorationPoint, Direction } from '../../game/types';
import { TileSystem } from '../../game/engine/TileSystem';
import { ExplorationArrow } from './ExplorationArrow';
import { ExplorationState } from '../../game/engine/ExplorationStateMachine';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { useTilePlacement } from '../../contexts/TilePlacementContext';
import { Tile3D, TILE_SIZE } from './Tile3D';
import { ThreeEvent } from '@react-three/fiber';

interface ExplorationLayerProps {
  tiles: Tile[];
  onEdgeSelected: (point: ExplorationPoint) => void;
  explorationState?: ExplorationState;
}

export const ExplorationLayer: React.FC<ExplorationLayerProps> = ({ tiles, onEdgeSelected, explorationState }) => {
  const { confirmPlacement } = useTilePlacement();
  const points = useMemo(() => TileSystem.getExplorationPoints(tiles), [tiles]);
  const showTilePlacer = useUIStore(s => s.showTilePlacer);
  const rotation = useUIStore(s => s.pendingTileRotation);
  const interactionMode = useUIStore(s => s.interactionMode);
  const isExploreMode = interactionMode === 'explore';

  // ── Exploration constraint: board-game rule ────────────────────────────────
  // Only show explore arrows for open edges on the active hero's CURRENT tile,
  // and only when the hero occupies a border square adjacent to that edge.
  // (Castle Ravenloft 2010: "If Hero at edge of tile, draw new tile.")
  const gameState = useGameStore(s => s.gameState);
  const activeHero = gameState?.heroes.find(h => h.id === gameState?.currentHeroId);
  const heroPos = activeHero?.position;

  // Find which tile the hero is standing on
  const heroTileId = heroPos
    ? tiles.find(t => t.x === heroPos.x && t.z === heroPos.z)?.id
    : undefined;

  /**
   * Returns true when the hero's square is on the outer row/column
   * that faces the given edge — i.e. they're physically at that tile edge.
   */
  const isHeroAtEdgeFor = (edge: Direction): boolean => {
    if (!heroPos) return false;
    switch (edge) {
      case 'north': return heroPos.sqZ === 0;
      case 'south': return heroPos.sqZ === 3;
      case 'east':  return heroPos.sqX === 3;
      case 'west':  return heroPos.sqX === 0;
      default:      return false;
    }
  };

  // Only show arrows for edges the hero can actually explore right now
  const visiblePoints = isExploreMode
    ? points.filter(p => p.tileId === heroTileId && isHeroAtEdgeFor(p.edge))
    : [];
  // ──────────────────────────────────────────────────────────────────────────

  let previewTile: Tile | null = null;
  if (showTilePlacer && explorationState && (explorationState.phase === 'positioning' || explorationState.phase === 'placement_blocked')) {
    const parentTile = tiles.find(t => t.id === explorationState.point.tileId);
    let targetX = 0;
    let targetZ = 0;
    if (parentTile) {
      const coords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, explorationState.point.edge);
      targetX = coords.x;
      targetZ = coords.z;
    }

    if (explorationState.drawnTile) {
      previewTile = {
        ...explorationState.drawnTile,
        x: targetX,
        z: targetZ
      };
    }
  }

  return (
    <group name="exploration-layer">
      {!showTilePlacer && points.map((point) => {
        const isExplorableNow = isExploreMode && point.tileId === heroTileId && isHeroAtEdgeFor(point.edge);
        
        if (isExplorableNow) {
          return (
            <ExplorationArrow
              key={`${point.tileId}-${point.edge}`}
              point={point}
              onClick={onEdgeSelected}
              isHighlighted={true}
            />
          );
        } else if (gameState?.phase === 'hero') {
          return (
            <ExplorationArrow
              key={`${point.tileId}-${point.edge}`}
              point={point}
              isHighlighted={false}
              isSubtle={true}
            />
          );
        }
        return null;
      })}

      {previewTile && (
        <group
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            confirmPlacement();
          }}
        >
          {/*
            Rotate preview tile around its visual centre (TILE_SIZE/2).
            Matches the coordinate system used by Tile3D (centred at 2.0).
          */}
          <group
            position={[previewTile.x * TILE_SIZE + TILE_SIZE / 2, 0, previewTile.z * TILE_SIZE + TILE_SIZE / 2]}
            rotation={[0, -(rotation * Math.PI) / 180, 0]}
          >
            <group position={[-(previewTile.x * TILE_SIZE + TILE_SIZE / 2), 0, -(previewTile.z * TILE_SIZE + TILE_SIZE / 2)]}>
              <Tile3D tile={previewTile} isRevealed={true} />
            </group>
          </group>
        </group>
      )}
    </group>
  );
};
