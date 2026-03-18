import React from 'react';
import { Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import { Tile } from '../../game/types';
import { useGameStore } from '../../store/gameStore';

interface Tile3DProps {
  tile: Tile;
  isRevealed: boolean;
}

/**
 * 3D component for a Dungeon Tile (4x4 squares).
 */
export const Tile3D: React.FC<Tile3DProps> = ({ tile, isRevealed }) => {
  if (!isRevealed) return null;

  const hoveredTile = useGameStore((state) => state.hoveredTile);
  const isHovered = hoveredTile?.id === tile.id;

  // A tile is 4x4 units in our world scale (1 unit = 1 square)
  const TILE_SIZE = 4;
  
  // Physics floor (Static body so dice don't fall through)
  const [ref] = useBox(() => ({
    type: 'Static',
    args: [TILE_SIZE, 0.2, TILE_SIZE],
    position: [tile.x * TILE_SIZE + TILE_SIZE / 2 - 0.5, -0.1, tile.z * TILE_SIZE + TILE_SIZE / 2 - 0.5],
  }));

  return (
    <group position={[tile.x * TILE_SIZE, 0, tile.z * TILE_SIZE]} userData={{ tile }}>
      {/* Base Floor Mesh with physics ref */}
      <mesh ref={ref as any} receiveShadow>
        <boxGeometry args={[TILE_SIZE, 0.2, TILE_SIZE]} />
        <meshStandardMaterial 
          color={isHovered ? "#333333" : "#222222"} 
          roughness={0.8} 
          metalness={0.2} 
        />
      </mesh>

      {/* Hover Highlight */}
      {isHovered && (
        <mesh position={[TILE_SIZE / 2 - 0.5, 0.02, TILE_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
        </mesh>
      )}

      {/* Grid Lines Placeholder */}
      <gridHelper 
        args={[TILE_SIZE, 4, 0x444444, 0x333333]} 
        position={[TILE_SIZE / 2 - 0.5, 0.01, TILE_SIZE / 2 - 0.5]} 
      />

      {/* Tile ID Label (Debug) */}
      <Text
        position={[TILE_SIZE / 2 - 0.5, 0.2, TILE_SIZE / 2 - 0.5]}
        fontSize={0.2}
        color="white"
        opacity={0.3}
        transparent
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {tile.id}
      </Text>
    </group>
  );
};
