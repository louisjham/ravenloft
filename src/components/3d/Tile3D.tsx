import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { useFrame, ThreeEvent, useLoader } from '@react-three/fiber';
import { Interactive } from '@react-three/xr';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import { Tile, Position } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';


export const TILE_SIZE = 4;

// Shared static geometries to eliminate GC churn and improve draw call performance
const slabGeometry = new THREE.BoxGeometry(0.88, 0.06, 0.88);
const borderGeometry = new THREE.BoxGeometry(0.90, 0.065, 0.90);
const chevronGeometry = new THREE.ConeGeometry(0.08, 0.16, 4);
const hoverPlaneGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
const tileBaseGeometry = new THREE.BoxGeometry(TILE_SIZE, 0.2, TILE_SIZE);
const tilePlaneGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

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
      geometry={tilePlaneGeometry}
      receiveShadow
    >
      <meshStandardMaterial map={texture} roughness={0.9} transparent={true} />
    </mesh>
  );
};

/**
 * ClosedEdgeWall renders a physical stone wall curb on closed connections of revealed tiles.
 * Height is 0.25 units (prevents blocking views of characters and tiles).
 */
const ClosedEdgeWall: React.FC<{ edge: 'north' | 'south' | 'east' | 'west' }> = ({ edge }) => {
  const size: [number, number, number] = (() => {
    switch (edge) {
      case 'north':
      case 'south':
        return [TILE_SIZE, 0.25, 0.15];
      case 'east':
      case 'west':
        return [0.15, 0.25, TILE_SIZE];
    }
  })();

  const position: [number, number, number] = (() => {
    const half = TILE_SIZE / 2;
    switch (edge) {
      case 'north': return [half, 0.125, 0.075];
      case 'south': return [half, 0.125, TILE_SIZE - 0.075];
      case 'east':  return [TILE_SIZE - 0.075, 0.125, half];
      case 'west':  return [0.075, 0.125, half];
    }
  })();

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial 
        color="#15151a" 
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
      <mesh ref={ref as any} geometry={tileBaseGeometry} receiveShadow>
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
        geometry={hoverPlaneGeometry}
        visible={isHovered}
      >
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

      {/* Dynamic Walls for closed edges (walls) */}
      {(['north', 'south', 'east', 'west'] as const).map(edge => {
        const conn = tile.connections.find(c => c.edge === edge);
        if (!conn || (!conn.isOpen && !conn.connectedTileId)) {
          return <ClosedEdgeWall key={`wall-${edge}`} edge={edge} />;
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
  const groupRef = useRef<THREE.Group>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onMove({ x: tile.x, z: tile.z, sqX, sqZ });
  };

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.getElapsedTime();
      const pulseScale = hovered
        ? 1.05 + Math.sin(time * 8) * 0.03
        : 0.97 + Math.sin(time * 3) * 0.03;

      groupRef.current.scale.set(pulseScale, hovered ? 1.2 : 1.0, pulseScale);
      groupRef.current.position.y = hovered ? 0.04 + Math.sin(time * 6) * 0.01 : 0.02;
    }
  });

  const handleTriggerMove = () => {
    onMove({ x: tile.x, z: tile.z, sqX, sqZ });
  };

  return (
    <Interactive
      onSelect={handleTriggerMove}
      onHover={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <group
        ref={groupRef}
        position={[sqX + 0.5, 0.02, sqZ + 0.5]}
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
        {/* Raised 3D Waypoint Slab */}
        <mesh geometry={slabGeometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={hovered ? '#00e5ff' : '#1b6e4d'}
            emissive={hovered ? '#00e5ff' : '#0d402b'}
            emissiveIntensity={hovered ? 0.8 : 0.3}
            transparent
            opacity={hovered ? 0.85 : 0.55}
            roughness={0.3}
            metalness={0.2}
          />
        </mesh>

        {/* Luminous Outer Border */}
        <mesh position={[0, 0, 0]} geometry={borderGeometry}>
          <meshBasicMaterial color={hovered ? '#ffffff' : '#55ffaa'} wireframe transparent opacity={0.7} />
        </mesh>

        {/* Hover Floating Chevron Down Arrow */}
        {hovered && (
          <group position={[0, 0.28, 0]}>
            <mesh rotation={[0, 0, Math.PI]} geometry={chevronGeometry}>
              <meshBasicMaterial color="#00ffff" />
            </mesh>
          </group>
        )}
      </group>
    </Interactive>
  );
};

export const Tile3D = React.memo(Tile3DInner);
