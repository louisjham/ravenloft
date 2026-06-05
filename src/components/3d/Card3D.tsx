import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Card3DProps {
  name: string;
  type: string;
  position: [number, number, number];
  isFlipped?: boolean;
  onClick?: () => void;
}

const SCALE_HOVERED = new THREE.Vector3(1.1, 1.1, 1.1);
const SCALE_NORMAL  = new THREE.Vector3(1.0, 1.0, 1.0);

const TYPE_COLORS: Record<string, string> = {
  treasure: '#ffd700',
  monster: '#ff4444',
  event: '#4444ff',
  item: '#44ff44',
};

/**
 * Tarot-style 3D Card component.
 */
export const Card3D: React.FC<Card3DProps> = ({ name, type, position, isFlipped = false, onClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);

  // Floating, scaling, and flipping animation
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      
      const speed = 1 - Math.pow(0.01, delta); // ~0.1 at 60fps
      
      const targetScale = hovered ? SCALE_HOVERED : SCALE_NORMAL;
      groupRef.current.scale.lerp(targetScale, speed);
      
      const targetRotationY = isFlipped ? Math.PI : 0;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotationY,
        speed
      );
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={position} 
      onPointerOver={() => setHover(true)} 
      onPointerOut={() => setHover(false)}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      {/* Card Body */}
      <Box args={[0.7, 1, 0.05]} castShadow>
        <meshStandardMaterial color={TYPE_COLORS[type] || '#444444'} />
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
