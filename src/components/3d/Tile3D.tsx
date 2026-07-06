import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { useFrame, ThreeEvent, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import { Tile, Position } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { MagicalTorches } from './MagicalTorches';

export const TILE_SIZE = 4;

interface Tile3DProps {
  tile: Tile;
  isRevealed: boolean;
  /** Set of "tileId:sqX:sqZ" keys for every square the active hero can reach. */
  reachableSquares?: Set<string>;
  /** Stable callback from DungeonBoard to move the active hero. */
  onMoveHero: (pos: Position) => void;
}

const TileTexture: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const texture = useLoader(THREE.TextureLoader, imageUrl);
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
 * ClosedEdgeWall renders a physical stone wall on closed connections of revealed tiles.
 * Height is 1.2 units (keeps board visible but gives enclosed dungeon feel).
 */
const ClosedEdgeWall: React.FC<{ edge: 'north' | 'south' | 'east' | 'west' }> = ({ edge }) => {
  const size: [number, number, number] = (() => {
    switch (edge) {
      case 'north':
      case 'south':
        return [TILE_SIZE, 1.2, 0.15];
      case 'east':
      case 'west':
        return [0.15, 1.2, TILE_SIZE];
    }
  })();

  const position: [number, number, number] = (() => {
    const half = TILE_SIZE / 2;
    switch (edge) {
      case 'north': return [half, 0.6, 0.075];
      case 'south': return [half, 0.6, TILE_SIZE - 0.075];
      case 'east':  return [TILE_SIZE - 0.075, 0.6, half];
      case 'west':  return [0.075, 0.6, half];
    }
  })();

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial 
        color="#1b1b22" 
        roughness={0.95} 
        metalness={0.05} 
      />
    </mesh>
  );
};

const Tile3DInner: React.FC<Tile3DProps> = ({ tile, isRevealed, reachableSquares, onMoveHero }) => {
  // Boolean selector: only this tile re-renders when its own hover state flips
  const isHovered = useGameStore((state) => state.hoveredTile?.id === tile.id);

  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);

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

  // Stable onMove handler for movement squares
  const handleMoveSquare = useCallback((pos: Position) => {
    onMoveHero(pos);
    setInteractionMode('none');
  }, [onMoveHero, setInteractionMode]);

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

      {/* Textured face */}
      {tile.imageUrl && (
        <Suspense fallback={null}>
          <TileTexture imageUrl={tile.imageUrl} />
        </Suspense>
      )}

      {/* Hover highlight */}
      <mesh
        position={[TILE_SIZE / 2, 0.02, TILE_SIZE / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={isHovered}
      >
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
      </mesh>

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

      {/* Reachable movement squares */}
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
                  onMove={handleMoveSquare}
                />
              );
            })
          )}
        </group>
      )}

      {/* Dynamic Walls & Magical Torches for closed edges (walls) */}
      {(['north', 'south', 'east', 'west'] as const).map(edge => {
        const conn = tile.connections.find(c => c.edge === edge);
        if (!conn || (!conn.isOpen && !conn.connectedTileId)) {
          return (
            <React.Fragment key={`wall-group-${edge}`}>
              <ClosedEdgeWall edge={edge} />
              <MagicalTorches edge={edge} />
            </React.Fragment>
          );
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
  onMove: (pos: Position) => void;
}

const MovementSquare3D: React.FC<MovementSquare3DProps> = ({ sqX, sqZ, tile, onMove }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onMove({ x: tile.x, z: tile.z, sqX, sqZ });
  };

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      // Pulsing scale: slightly larger and faster pulse on hover
      const pulseScale = hovered 
        ? 1.04 + Math.sin(time * 8) * 0.03
        : 0.96 + Math.sin(time * 3) * 0.04;
      
      meshRef.current.scale.set(pulseScale, pulseScale, 1);

      // Pulsing opacity
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      if (material) {
        material.opacity = hovered
          ? 0.5 + Math.sin(time * 8) * 0.05
          : 0.22 + Math.sin(time * 3) * 0.04;
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
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
        opacity={0.22}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export const Tile3D = React.memo(Tile3DInner);
