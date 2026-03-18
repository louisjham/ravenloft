import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Card3DProps {
  name: string;
  type: string;
  position: [number, number, number];
  isFlipped?: boolean;
}

/**
 * Tarot-style 3D Card component.
 */
export const Card3D: React.FC<Card3DProps> = ({ name, type, position, isFlipped = false }) => {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);

  // Simple floating animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.getElapsedTime() * 2) * 0.05;
      if (hovered) {
        meshRef.current.scale.lerp(new THREE.Vector3(1.1, 1.1, 1.1), 0.1);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  return (
    <group 
      ref={meshRef} 
      position={position} 
      onPointerOver={() => setHover(true)} 
      onPointerOut={() => setHover(false)}
    >
      {/* Card Body */}
      <Box args={[0.7, 1, 0.05]} castShadow>
        <meshStandardMaterial color={type === 'treasure' ? '#ffd700' : '#444444'} />
      </Box>

      {/* Card Content Overlay */}
      <Text
        position={[0, 0, 0.03]}
        fontSize={0.08}
        color="white"
        maxWidth={0.6}
        textAlign="center"
      >
        {name}
      </Text>

      {/* Back side of card */}
      <Box args={[0.7, 1, 0.01]} position={[0, 0, -0.03]}>
        <meshStandardMaterial color="#111111" />
      </Box>
    </group>
  );
};
