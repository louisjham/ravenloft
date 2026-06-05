import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface GamePieceProps {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export const GamePiece: React.FC<GamePieceProps> = ({ url, position, rotation, scale }) => {
  const { scene } = useGLTF(url);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const mat = child.material.clone();
        mat.emissive = new THREE.Color('#3a2f5f');
        mat.emissiveIntensity = 0.5;
        mat.roughness = 0.7;
        child.material = mat;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
};
