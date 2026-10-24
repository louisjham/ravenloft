import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WallTorchProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  lightColor?: string;
  intensity?: number;
  distance?: number;
}

/**
 * WallTorch renders a high-fidelity gothic wrought-iron wall sconce with
 * an animated multi-layer flame and realistic dynamic flickering light.
 */
export const WallTorch: React.FC<WallTorchProps> = ({
  position,
  rotation = [0, 0, 0],
  lightColor = '#ff8833',
  intensity = 1.6,
  distance = 12,
}) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const flameOuterRef = useRef<THREE.Mesh>(null);
  const flameInnerRef = useRef<THREE.Mesh>(null);

  // Random phase seed so each torch flickers independently
  const phaseSeed = useMemo(() => Math.random() * 100, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 4 + phaseSeed;

    // Organic flame flicker calculation
    const flicker =
      Math.sin(t * 3.7) * 0.12 +
      Math.cos(t * 7.3) * 0.08 +
      Math.sin(t * 13.1) * 0.05 +
      (Math.random() - 0.5) * 0.06;

    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0.4, intensity + flicker * intensity);
      // Subtle light position jitter
      lightRef.current.position.y = 0.55 + flicker * 0.04;
      lightRef.current.position.x = flicker * 0.02;
    }

    if (flameOuterRef.current) {
      const s = 1.0 + flicker * 0.25;
      flameOuterRef.current.scale.set(s, 1.0 + flicker * 0.4, s);
      flameOuterRef.current.rotation.y += 0.02;
    }

    if (flameInnerRef.current) {
      const s = 1.0 + flicker * 0.15;
      flameInnerRef.current.scale.set(s, 1.0 + flicker * 0.25, s);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Iron wall mounting plate */}
      <mesh position={[0, 0, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.45, 0.04]} />
        <meshStandardMaterial color="#1a181b" roughness={0.7} metalness={0.85} />
      </mesh>

      {/* Mounting bolts */}
      {[-0.08, 0.08].map((x) =>
        [-0.16, 0.16].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.045]}>
            <cylinderGeometry args={[0.015, 0.015, 0.02, 6]} />
            <meshStandardMaterial color="#333038" roughness={0.6} metalness={0.9} />
          </mesh>
        ))
      )}

      {/* Sconce bracket arm curving outward */}
      <mesh position={[0, 0.12, 0.14]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.05, 0.05, 0.28]} />
        <meshStandardMaterial color="#1e1c20" roughness={0.65} metalness={0.88} />
      </mesh>

      {/* Sconce basket ring */}
      <mesh position={[0, 0.25, 0.25]}>
        <cylinderGeometry args={[0.1, 0.06, 0.12, 8, 1, true]} />
        <meshStandardMaterial
          color="#1e1c20"
          roughness={0.65}
          metalness={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wooden torch handle resting in the sconce */}
      <mesh position={[0, 0.22, 0.25]} rotation={[-0.1, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.03, 0.38, 8]} />
        <meshStandardMaterial color="#2d1b0e" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Wrapped cloth/pitch head */}
      <mesh position={[0, 0.42, 0.26]}>
        <cylinderGeometry args={[0.065, 0.05, 0.14, 8]} />
        <meshStandardMaterial color="#151210" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Outer flame (warm orange glow) */}
      <mesh ref={flameOuterRef} position={[0, 0.54, 0.26]}>
        <coneGeometry args={[0.075, 0.24, 7]} />
        <meshBasicMaterial
          color="#ff5500"
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner flame (bright amber/yellow core) */}
      <mesh ref={flameInnerRef} position={[0, 0.52, 0.26]}>
        <coneGeometry args={[0.045, 0.17, 7]} />
        <meshBasicMaterial
          color="#ffdd44"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Dynamic flickering point light */}
      <pointLight
        ref={lightRef}
        position={[0, 0.55, 0.26]}
        color={lightColor}
        intensity={intensity}
        distance={distance}
        decay={2}
      />
    </group>
  );
};
