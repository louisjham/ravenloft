import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import { Tile } from '../../game/types';
import { useGameStore } from '../../store/gameStore';

interface Tile3DProps {
  tile: Tile;
  isRevealed: boolean;
}

/**
 * A tile is 4x4 units in our world scale (1 unit = 1 square)
 */
export const TILE_SIZE = 4;

/**
 * 3D component for a Dungeon Tile (4x4 squares).
 */
export const Tile3D: React.FC<Tile3DProps> = ({ tile, isRevealed }) => {
  if (!isRevealed) return null;

  const hoveredTile = useGameStore((state) => state.hoveredTile);
  const isHovered = hoveredTile?.id === tile.id;

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.scale.set(1, 0.01, 1);
    }
  }, []);

  useFrame(() => {
    if (groupRef.current && groupRef.current.scale.y <= 0.99) {
      groupRef.current.scale.y += (1.0 - groupRef.current.scale.y) * 0.15;
    }
  });
  
  // Physics floor (Static body so dice don't fall through)
  const [ref] = useBox(() => ({
    type: 'Static',
    args: [TILE_SIZE, 0.2, TILE_SIZE],
    position: [tile.x * TILE_SIZE + TILE_SIZE / 2 - 0.5, -0.1, tile.z * TILE_SIZE + TILE_SIZE / 2 - 0.5],
  }));

  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (tile.imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(tile.imageUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      });
    }
  }, [tile.imageUrl]);

  return (
    <group ref={groupRef} position={[tile.x * TILE_SIZE, 0, tile.z * TILE_SIZE]} userData={{ tile }}>
      {/* Base Floor Mesh with physics ref */}
      <mesh ref={ref as any} receiveShadow>
        <boxGeometry args={[TILE_SIZE, 0.2, TILE_SIZE]} />
        <meshStandardMaterial 
          color={isHovered && !texture ? "#333333" : "#222222"} 
          roughness={0.8} 
          metalness={0.2} 
        />
      </mesh>

      {/* Textured face */}
      {texture && (
        <mesh position={[TILE_SIZE / 2 - 0.5, 0.101, TILE_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
          <meshStandardMaterial map={texture} roughness={0.9} transparent={true} />
        </mesh>
      )}

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
        fillOpacity={0.3}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {tile.id}
      </Text>
    </group>
  );
};
