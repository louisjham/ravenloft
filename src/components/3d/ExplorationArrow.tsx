import React, { useState } from 'react';
import { ExplorationPoint, Direction } from '../../game/types';
import { TILE_SIZE } from './Tile3D';
import { ThreeEvent } from '@react-three/fiber';

interface ExplorationArrowProps {
  point: ExplorationPoint;
  onClick: (point: ExplorationPoint) => void;
  isHighlighted: boolean;
}

export const ExplorationArrow: React.FC<ExplorationArrowProps> = ({
  point,
  onClick,
  isHighlighted
}) => {
  const [hovered, setHovered] = useState(false);

  // Determine rotation based on outward direction
  let rotY = 0;
  switch (point.edge) {
    case 'north': rotY = 0; break;
    case 'south': rotY = Math.PI; break;
    case 'east':  rotY = Math.PI * 0.5; break;
    case 'west':  rotY = Math.PI * 1.5; break;
  }

  // Visual scaling logic based on hover or parent highlight state
  const activeHighlight = isHighlighted || hovered;
  const scale = activeHighlight ? 1.2 : 1.0;

  return (
    <group
      position={[point.worldX * TILE_SIZE, 0.1, point.worldZ * TILE_SIZE]}
      rotation={[0, rotY, 0]}
      scale={[scale, scale, scale]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(false);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(point);
      }}
    >
      {/* 
        A simple flat arrow shape.
        Pointing "North" initially means negative Z direction in Three.js,
        so we rotate the cone so its tip points along -Z.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 1, 4]} />
        <meshStandardMaterial 
          color={activeHighlight ? "#00ffff" : "#ffff00"} 
          emissive={activeHighlight ? "#00aaaa" : "#aaaa00"}
          emissiveIntensity={activeHighlight ? 1.5 : 0.8}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
};
