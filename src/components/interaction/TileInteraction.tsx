import React from 'react'
import { Tile } from '../../game/types'
import { useGameStore } from '../../store/gameStore'
import { useGameActions } from '../../hooks/useGameActions'

interface TileInteractionProps {
  tile: Tile;
  children: React.ReactNode;
}

/**
 * Wraps a 3D Tile to provide interaction logic.
 */
export const TileInteraction: React.FC<TileInteractionProps> = ({ tile, children }) => {
  const { hoveredTile, selectedEntity } = useGameStore();
  const { handleMoveHero } = useGameActions();

  const isHovered = hoveredTile?.id === tile.id;

  const onTileClick = (e: any) => {
    e.stopPropagation();
    
    // If a hero is selected and it's their phase, move there
    if (selectedEntity?.type === 'hero') {
      // In a real implementation, we'd check if the clicked sub-square is valid
      // For now, move to tile center or specific square if clicked
      handleMoveHero({ x: tile.x, z: tile.z, sqX: 1, sqZ: 1 });
    }
  };

  const onTileRightClick = (e: any) => {
    e.stopPropagation();
    console.log('Tile Info:', tile.name, tile.terrainType);
  };

  return (
    <group 
      onClick={onTileClick}
      onContextMenu={onTileRightClick}
    >
      {children}
      {/* Edge highlighting logic would go here, or be passed down to children via context/props */}
    </group>
  );
}
