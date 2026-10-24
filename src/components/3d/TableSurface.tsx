import React, { useState, useEffect } from 'react';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';

const TABLE_SIZE = 28;
const TABLE_THICKNESS = 0.45;
const HALF = TABLE_SIZE / 2;

/**
 * TableSurface renders a gothic dark-stone gaming altar tabletop with carved
 * stone borders, wrought-iron corner brackets, and heavy masonry pedestal legs.
 */
export const TableSurface: React.FC = () => {
  const { isPresenting } = useXR();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/ui/stone-wall.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(6, 6);
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {
        console.warn('Could not load stone-wall texture; using procedural gothic stone material.');
      }
    );
  }, []);

  // In WebXR presentation mode, the game pieces and board float directly in VR/AR without a giant artificial slab
  if (isPresenting) {
    return null;
  }

  return (
    <group position={[0, -TABLE_THICKNESS / 2, 0]}>
      {/* 1. Main Tabletop Stone Slab */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[TABLE_SIZE, TABLE_THICKNESS, TABLE_SIZE]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#787082' : '#1a1820'}
          roughness={0.88}
          metalness={0.15}
        />
      </mesh>

      {/* 2. Recessed Dark Obsidian Center Field */}
      <mesh position={[0, TABLE_THICKNESS / 2 + 0.005, 0]}>
        <planeGeometry args={[TABLE_SIZE - 1.2, TABLE_SIZE - 1.2]} />
        <meshStandardMaterial
          color="#121016"
          roughness={0.92}
          metalness={0.1}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* 3. Carved Stone Border Moulding Frame */}
      {/* North & South borders */}
      {[-HALF + 0.3, HALF - 0.3].map((z, idx) => (
        <mesh key={`border-ns-${idx}`} position={[0, TABLE_THICKNESS / 2 + 0.02, z]} receiveShadow>
          <boxGeometry args={[TABLE_SIZE, 0.04, 0.6]} />
          <meshStandardMaterial color="#1f1d26" roughness={0.8} metalness={0.2} />
        </mesh>
      ))}
      {/* East & West borders */}
      {[-HALF + 0.3, HALF - 0.3].map((x, idx) => (
        <mesh key={`border-ew-${idx}`} position={[x, TABLE_THICKNESS / 2 + 0.02, 0]} receiveShadow>
          <boxGeometry args={[0.6, 0.04, TABLE_SIZE - 1.2]} />
          <meshStandardMaterial color="#1f1d26" roughness={0.8} metalness={0.2} />
        </mesh>
      ))}

      {/* 4. Wrought Iron Corner Reinforcement Brackets & Rivets */}
      {[-1, 1].map((dirX) =>
        [-1, 1].map((dirZ) => {
          const cornerX = dirX * (HALF - 0.5);
          const cornerZ = dirZ * (HALF - 0.5);
          return (
            <group key={`corner-${dirX}-${dirZ}`} position={[cornerX, TABLE_THICKNESS / 2 + 0.025, cornerZ]}>
              {/* Iron Corner L-Plate */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.0, 0.03, 1.0]} />
                <meshStandardMaterial color="#1a181d" roughness={0.6} metalness={0.85} />
              </mesh>
              {/* Corner Boss Stud */}
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.08, 0.12, 0.04, 6]} />
                <meshStandardMaterial color="#2d2b33" roughness={0.5} metalness={0.9} />
              </mesh>
            </group>
          );
        })
      )}

      {/* 5. Massive Carved Stone Pedestal Legs (supporting the altar on the dungeon floor) */}
      {[-1, 1].map((dirX) =>
        [-1, 1].map((dirZ) => {
          const legX = dirX * (HALF - 2.5);
          const legZ = dirZ * (HALF - 2.5);
          return (
            <group key={`leg-${dirX}-${dirZ}`} position={[legX, -TABLE_THICKNESS / 2 - 0.1, legZ]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[2.0, 0.45, 2.0]} />
                <meshStandardMaterial color="#18161d" roughness={0.92} metalness={0.1} />
              </mesh>
            </group>
          );
        })
      )}
    </group>
  );
};
