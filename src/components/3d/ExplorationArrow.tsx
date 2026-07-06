import React, { useState, useRef, useMemo } from 'react';
import { ExplorationPoint } from '../../game/types';
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

  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const activeHighlight = !isSubtle && (isHighlighted || hovered);
  const scale = isSubtle ? 0.6 : (activeHighlight ? 1.2 : 1.0); // Base scale for the mesh

  const arrowColor = isSubtle ? "#999999" : (activeHighlight ? "#00ffff" : "#ffcc00");
  const emissiveColor = isSubtle ? "#333333" : (activeHighlight ? "#00ffff" : "#ff8800");
  const emissiveIntensity = isSubtle ? 0.4 : (activeHighlight ? 2.5 : 1.2);
  const opacity = isSubtle ? 0.35 : 0.9;
  const baseScale = isSubtle ? 0.35 : 0.6;

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Bobbing animation: vertical float using sine wave
    if (groupRef.current) {
      const bobOffset = Math.sin(time * 3) * 0.12;
      groupRef.current.position.y = 0.5 + bobOffset;
    }

    // Scale and glow pulsing
    if (meshRef.current) {
      if (!isSubtle && activeHighlight) {
        const pulseScale = scale * (1 + Math.sin(time * 5) * 0.1);
        meshRef.current.scale.set(pulseScale, pulseScale, pulseScale);
        
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        if (material) {
          material.emissiveIntensity = emissiveIntensity * (1 + Math.sin(time * 5) * 0.25);
        }
      } else {
        meshRef.current.scale.set(scale, scale, scale);
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        if (material) {
          material.emissiveIntensity = emissiveIntensity;
        }
      }
    }
  });

  // Determine rotation based on outward direction
  const rotY = useMemo(() => {
    switch (point.edge) {
      case 'north': return Math.PI;
      case 'south': return 0;
      case 'east':  return Math.PI * 1.5;
      case 'west':  return Math.PI * 0.5;
      default:      return 0;
    }
  }, [point.edge]);

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
      ref={groupRef}
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
