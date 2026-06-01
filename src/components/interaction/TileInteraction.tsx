import React from 'react'
import { Tile } from '../../game/types'
import { useGameStore } from '../../store/gameStore'

import { ThreeEvent } from '@react-three/fiber';

interface TileInteractionProps {
  tile: Tile;
  children: React.ReactNode;
}

/**
 * Wraps a 3D Tile to provide interaction logic.
 * Movement is handled by useSelection.ts (raycaster-based with precise sqX/sqZ).
 */
export const TileInteraction: React.FC<TileInteractionProps> = ({ tile, children }) => {
  const { hoveredTile } = useGameStore();

  const isHovered = hoveredTile?.id === tile.id;

  const onTileRightClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    console.log('Tile Info:', tile.name, tile.terrainType);
  };

  return (
    <group onContextMenu={onTileRightClick}>
      {children}
    </group>
  );
}
