import React, { useRef, useEffect, useState, Suspense } from 'react';
import { useFrame, ThreeEvent, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import { Tile } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useGameActions } from '../../hooks/useGameActions';
import { MagicalTorches } from './MagicalTorches';

interface Tile3DProps {
  tile: Tile;
  isRevealed: boolean;
  /** Set of "tileId:sqX:sqZ" keys for every square the active hero can reach. */
  reachableSquares?: Set<string>;
}

/**
 * A tile is 4x4 units in our world scale (1 unit = 1 square).
 * Entity coordinates: worldX = tile.x * TILE_SIZE + sqX + 0.5
 * So tile-local cell centres are at sqX + 0.5 (i.e. 0.5, 1.5, 2.5, 3.5).
 * Visual geometry must be centred at TILE_SIZE/2 = 2.0 so grid lines fall
 * at 0, 1, 2, 3, 4 — exactly framing each cell.
 */
export const TILE_SIZE = 4;

const TileTexture: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const texture = useLoader(THREE.TextureLoader, imageUrl);
  // Need to clone the texture or set colorSpace on it, but useLoader caches it so modifying it directly might be okay
  // Actually, standard is to set colorSpace in useEffect or use clone, but since R3F sets it:
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh
      position={[TILE_SIZE / 2, 0.101, TILE_SIZE / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
      <meshStandardMaterial map={texture} roughness={0.9} transparent={true} />
    </mesh>
  );
};

/**
 * 3D component for a Dungeon Tile (4×4 squares).
 */
export const Tile3D: React.FC<Tile3DProps> = ({ tile, isRevealed, reachableSquares }) => {
  const hoveredTile = useGameStore((state) => state.hoveredTile);
  const isHovered = hoveredTile?.id === tile.id;
  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const { handleMoveHero } = useGameActions();

  const groupRef = useRef<THREE.Group>(null);
  const animDoneRef = useRef(false);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.scale.set(1, 0.01, 1);
    }
  }, []);

  useFrame((_, delta) => {
    if (animDoneRef.current || !groupRef.current) return;
    const speed = 1 - Math.pow(0.01, delta); // ~equivalent to 0.15 at 60fps
    groupRef.current.scale.y += (1.0 - groupRef.current.scale.y) * speed;
    if (groupRef.current.scale.y >= 0.99) {
      groupRef.current.scale.y = 1.0;
      animDoneRef.current = true;
    }
  });

  // Static physics floor — centred at TILE_SIZE/2 so physics matches visual
  const [ref] = useBox(() => ({
    type: 'Static',
    args: [TILE_SIZE, 0.2, TILE_SIZE],
    position: [TILE_SIZE / 2, -0.1, TILE_SIZE / 2],
  }));

  if (!isRevealed) return null;

  return (
    <group ref={groupRef} position={[tile.x * TILE_SIZE, 0, tile.z * TILE_SIZE]} userData={{ tile }}>
      <mesh ref={ref as any} receiveShadow>
        <boxGeometry args={[TILE_SIZE, 0.2, TILE_SIZE]} />
        <meshStandardMaterial
          color={isHovered ? '#3a3a3a' : '#1a1a1a'}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Textured face — centred at true tile centre (TILE_SIZE/2) */}
      {tile.imageUrl && (
        <Suspense fallback={null}>
          <TileTexture imageUrl={tile.imageUrl} />
        </Suspense>
      )}

      {/* Hover highlight */}
      {isHovered && (
        <mesh position={[TILE_SIZE / 2, 0.02, TILE_SIZE / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
        </mesh>
      )}

      {/*
        Grid lines — centred at TILE_SIZE/2 = 2.0 so that the 4 divisions
        produce lines at x/z = 0, 1, 2, 3, 4 in tile-local space.
        This puts cell centres at 0.5, 1.5, 2.5, 3.5 — exactly where
        entities and movement squares are rendered.
      */}
      <gridHelper
        args={[TILE_SIZE, 4, 0x444444, 0x333333]}
        position={[TILE_SIZE / 2, 0.01, TILE_SIZE / 2]}
      />

      {/* Tile ID label (debug) */}
      <Text
        position={[TILE_SIZE / 2, 0.2, TILE_SIZE / 2]}
        fontSize={0.2}
        color="white"
        fillOpacity={0.3}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {tile.id}
      </Text>

      {/* Reachable movement squares — only render squares present in reachableSquares */}
      {interactionMode === 'move' && reachableSquares && (
        <group position={[0, 0.105, 0]}>
          {Array.from({ length: 4 }).map((_, sqZ) =>
            Array.from({ length: 4 }).map((_, sqX) => {
              const squareKey = `${tile.id}:${sqX}:${sqZ}`;
              if (!reachableSquares.has(squareKey)) return null;
              return (
                <MovementSquare3D
                  key={`${sqX}-${sqZ}`}
                  sqX={sqX}
                  sqZ={sqZ}
                  tile={tile}
                  onMove={(pos) => {
                    handleMoveHero(pos);
                    setInteractionMode('none');
                  }}
                />
              );
            })
          )}
        </group>
      )}

      {/* Magical Torches for closed edges (walls) */}
      {(['north', 'south', 'east', 'west'] as const).map(edge => {
        const conn = tile.connections.find(c => c.edge === edge);
        if (!conn || (!conn.isOpen && !conn.connectedTileId)) {
          return <MagicalTorches key={`torch-${edge}`} edge={edge} />;
        }
        return null;
      })}
    </group>
  );
};

interface MovementSquare3DProps {
  sqX: number;
  sqZ: number;
  tile: Tile;
  onMove: (pos: { x: number; z: number; sqX: number; sqZ: number }) => void;
}

const MovementSquare3D: React.FC<MovementSquare3DProps> = ({ sqX, sqZ, tile, onMove }) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onMove({ x: tile.x, z: tile.z, sqX, sqZ });
  };

  return (
    <mesh
      position={[sqX + 0.5, 0, sqZ + 0.5]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      <planeGeometry args={[0.9, 0.9]} />
      <meshBasicMaterial
        color={hovered ? '#00ffcc' : '#c0a060'}
        transparent
        opacity={hovered ? 0.45 : 0.22}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
