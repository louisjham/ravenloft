import React, { useState, useEffect, Suspense } from 'react';
import { useSphere } from '@react-three/cannon';
import { useGLTF, Text } from '@react-three/drei';
import { MODELS, useModel, DUMMY_MODE } from '../../utils/modelLoader';

/**
 * Placeholder for when the Dice model is loading or fails.
 */
const DicePlaceholder: React.FC = () => (
  <mesh castShadow>
    <icosahedronGeometry args={[0.5, 0]} />
    <meshStandardMaterial color="#880000" metalness={0.8} roughness={0.2} />
  </mesh>
);

/**
 * Component that loads and renders the actual GLTF model.
 */
const DiceModel: React.FC = () => {
  const model = useModel(MODELS.D20);
  return <primitive object={model.clone()} scale={0.5} />;
};

/**
 * 3D Physics-based d20 Dice.
 * Uses @react-three/cannon for physics.
 */
export const Dice3D: React.FC<{ onResult?: (result: number) => void }> = ({ onResult }) => {
  // Physics body (sphere for rolling, but visual is d20)
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: [1.5, 5, 1.5], // Center of first tile
    rotation: [Math.random(), Math.random(), Math.random()],
    args: [0.5],
    allowSleep: false,
  }));

  // We'll stub the "rolling" logic here. In reality, we'd detect resting position.
  useEffect(() => {
    const timer = setTimeout(() => {
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <group ref={ref as any}>
      {DUMMY_MODE ? (
        <DicePlaceholder />
      ) : (
        <Suspense fallback={<DicePlaceholder />}>
          <DiceModel />
        </Suspense>
      )}
    </group>
  );
};
