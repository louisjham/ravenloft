import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { Tile3D } from './Tile3D';

/**
 * Renders the entire dungeon layout from the game state.
 */
export const DungeonBoard: React.FC = () => {
  const tiles = useGameStore((state) => state.gameState?.tiles || []);

  return (
    <group name="dungeon-board">
      {tiles.map((tile) => (
        <Tile3D 
          key={tile.id} 
          tile={tile} 
          isRevealed={tile.isRevealed} 
        />
      ))}
    </group>
  );
};
