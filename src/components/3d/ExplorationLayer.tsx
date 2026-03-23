import React from 'react';
import { Tile, ExplorationPoint } from '../../game/types';
import { TileSystem } from '../../game/engine/TileSystem';
import { ExplorationArrow } from './ExplorationArrow';
import { ExplorationState } from '../../game/engine/ExplorationStateMachine';
import { useUIStore } from '../../store/uiStore';
import { Tile3D, TILE_SIZE } from './Tile3D';
import { ThreeEvent } from '@react-three/fiber';

interface ExplorationLayerProps {
  tiles: Tile[];
  onEdgeSelected: (point: ExplorationPoint) => void;
  explorationState?: ExplorationState;
}

export const ExplorationLayer: React.FC<ExplorationLayerProps> = ({ tiles, onEdgeSelected, explorationState }) => {
  const points = TileSystem.getExplorationPoints(tiles);
  const showTilePlacer = useUIStore(s => s.showTilePlacer);
  const rotation = useUIStore(s => s.pendingTileRotation);

  let previewTile: Tile | null = null;
  if (showTilePlacer && explorationState && (explorationState.phase === 'positioning' || explorationState.phase === 'placement_blocked')) {
    const parentTile = tiles.find(t => t.id === explorationState.point.tileId);
    let targetX = 0;
    let targetZ = 0;
    if (parentTile) {
      if (explorationState.point.edge === 'north') { targetX = parentTile.x; targetZ = parentTile.z - 1; }
      if (explorationState.point.edge === 'south') { targetX = parentTile.x; targetZ = parentTile.z + 1; }
      if (explorationState.point.edge === 'east') { targetX = parentTile.x + 1; targetZ = parentTile.z; }
      if (explorationState.point.edge === 'west') { targetX = parentTile.x - 1; targetZ = parentTile.z; }
    }
    
    previewTile = {
      ...explorationState.drawnTile,
      x: targetX,
      z: targetZ,
      rotation: rotation
    };
  }

  return (
    <group name="exploration-layer">
      {!showTilePlacer && points.map((point) => (
        <ExplorationArrow
          key={`${point.tileId}-${point.edge}`}
          point={point}
          onClick={onEdgeSelected}
          isHighlighted={false}
        />
      ))}

      {previewTile && (
        <group 
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('confirm-tile-placement'));
          }}
        >
          {/* Tile3D handles the translation position based on x/z, so we just group it. 
              But for rotation, Tile3D natively does not rotate the main body. 
              Let's wrap the mesh logically. However, rotating a group revolves around 0,0,0. 
              We offset, rotate, and inset. */}
          <group 
            position={[previewTile.x * TILE_SIZE + TILE_SIZE / 2 - 0.5, 0, previewTile.z * TILE_SIZE + TILE_SIZE / 2 - 0.5]}
            rotation={[0, (rotation * Math.PI) / 180, 0]}
          >
            <group position={[-(previewTile.x * TILE_SIZE + TILE_SIZE / 2 - 0.5), 0, -(previewTile.z * TILE_SIZE + TILE_SIZE / 2 - 0.5)]}>
              <Tile3D tile={previewTile} isRevealed={true} />
            </group>
          </group>
        </group>
      )}
    </group>
  );
};
