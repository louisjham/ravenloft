import React, { useState, useRef } from 'react';
import { ExplorationPoint, Direction } from '../../game/types';
import { TILE_SIZE } from './Tile3D';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ExplorationArrowProps {
  point: ExplorationPoint;
  onClick?: (point: ExplorationPoint) => void;
  isHighlighted: boolean;
  isSubtle?: boolean;
}

export const ExplorationArrow: React.FC<ExplorationArrowProps> = ({
  point,
  onClick,
  isHighlighted,
  isSubtle = false
}) => {
  const [hovered, setHovered] = useState(false);

  // Pulse animation for active highlights
  const meshRef = useRef<THREE.Mesh>(null);
  const activeHighlight = !isSubtle && (isHighlighted || hovered);
  const scale = isSubtle ? 0.6 : (activeHighlight ? 1.2 : 1.0); // Base scale for the mesh

  useFrame((state) => {
    if (!isSubtle && activeHighlight && meshRef.current) {
      const pulseScale = scale * (1 + Math.sin(state.clock.elapsedTime * 4) * 0.1);
      meshRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    } else if (meshRef.current) {
      // Ensure scale resets when not active
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  // Determine rotation based on outward direction
  let rotY = 0;
  switch (point.edge) {
    case 'north': rotY = Math.PI; break;
    case 'south': rotY = 0; break;
    case 'east':  rotY = Math.PI * 1.5; break;
    case 'west':  rotY = Math.PI * 0.5; break;
  }

  const arrowColor = isSubtle ? "#999999" : (activeHighlight ? "#00ffff" : "#ffcc00");
  const emissiveColor = isSubtle ? "#333333" : (activeHighlight ? "#00ffff" : "#ff8800");
  const emissiveIntensity = isSubtle ? 0.4 : (activeHighlight ? 2.5 : 1.2);
  const opacity = isSubtle ? 0.35 : 0.9;
  const baseScale = isSubtle ? 0.35 : 0.6;

  // Pointer event handlers are omitted for subtle arrows to avoid blocking clicks on tiles
  const interactionHandlers = isSubtle ? {} : {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(false);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (onClick) onClick(point);
    }
  };

  return (
    <group
      position={[point.worldX, 0.5, point.worldZ]}
      rotation={[0, rotY, 0]}
      scale={[baseScale, baseScale, baseScale]}
      {...interactionHandlers}
    >
      {/* 
        A simple flat arrow shape.
        Pointing "North" initially means negative Z direction in Three.js,
        so we rotate the cone so its tip points along -Z.
      */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.7, 1.5, 4]} />
        <meshStandardMaterial 
          color={arrowColor} 
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
        />
      </mesh>
    </group>
  );
};
