import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Simple particle effect for "torches" or magical impacts.
 */
export const FireParticles: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const count = 50;
  const positions = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.2;
    positions[i * 3 + 1] = Math.random() * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.01;
      // Animate particles up
      const attr = pointsRef.current.geometry.attributes.position;
      for (let i = 0; i < count; i++) {
        attr.setY(i, (attr.getY(i) + 0.01) % 0.5);
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      <Points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <PointMaterial
          transparent
          color="#ffaa44"
          size={0.05}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  );
};

export const Effects: React.FC = () => {
  return (
    <group name="effects-layer">
      {/* We can spawn global effects here */}
    </group>
  );
};
