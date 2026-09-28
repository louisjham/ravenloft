import React, { useState, useEffect } from 'react';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';

const TABLE_SIZE = 28;
const TABLE_THICKNESS = 0.4;
const BEVEL_SIZE = 0.15;

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
        tex.repeat.set(4, 4);
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {
        // Fallback gracefully to procedural dark stone material on load error
        console.warn('Could not load stone-wall texture; using procedural gothic stone material.');
      }
    );
  }, []);

  // In WebXR presentation mode, the game pieces and board float directly in VR/AR without a giant artificial slab
  if (isPresenting) {
    return null;
  }

  const half = TABLE_SIZE / 2;

  return (
    <group position={[0, -TABLE_THICKNESS / 2, 0]}>
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[TABLE_SIZE, TABLE_THICKNESS, TABLE_SIZE]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#18141c'}
          roughness={0.88}
          metalness={0.12}
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
