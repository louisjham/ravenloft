import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';

const TABLE_SIZE = 28;
const TABLE_THICKNESS = 0.4;
const BEVEL_SIZE = 0.15;

export const TableSurface: React.FC = () => {
  const texture = useLoader(THREE.TextureLoader, '/ui/stone-wall.png');

  // Log if texture loads successfully or if there's an error
  React.useEffect(() => {
    if (texture) {
      console.log('Table texture loaded successfully:', texture);
      console.log('Texture image:', texture.image);
    } else {
      console.error('Failed to load table texture');
    }
  }, [texture]);

  const half = TABLE_SIZE / 2;

  return (
    <group position={[0, -TABLE_THICKNESS / 2, 0]}>
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[TABLE_SIZE, TABLE_THICKNESS, TABLE_SIZE]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.9}
          metalness={0.1}
          color={texture ? '#ffffff' : '#ff0000'}
        />
      </mesh>

      <mesh position={[0, TABLE_THICKNESS / 2 + 0.01, 0]}>
        <planeGeometry args={[TABLE_SIZE - BEVEL_SIZE * 2, TABLE_SIZE - BEVEL_SIZE * 2]} />
        <meshStandardMaterial
          color="#111111"
          roughness={1}
          metalness={0}
          transparent
          opacity={0.3}
        />
      </mesh>

      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * half, TABLE_THICKNESS, Math.sin(angle) * half]}>
            <boxGeometry args={[0.6, TABLE_THICKNESS * 2, 0.6]} />
            <meshStandardMaterial color="#1a1a1a" roughness={1} metalness={0.2} />
          </mesh>
        );
      })}
    </group>
  );
};
