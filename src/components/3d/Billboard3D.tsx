import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type BillboardCategory = 'hero' | 'monster' | 'villain';

export interface Billboard3DProps {
  category: BillboardCategory;
  imagePath: string;
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  label?: string;
}

interface ShapeConfig {
  baseShape: 'cylinder' | 'box' | 'cone';
  baseArgs: number[];
  baseColor: string;
  emissive: string;
  height: number;
  labelColor: string;
}

const SHAPE_CONFIGS: Record<BillboardCategory, ShapeConfig> = {
  hero: {
    baseShape: 'cylinder',
    baseArgs: [0.3, 0.4, 6],
    baseColor: '#2a4858',
    emissive: '#1a6030',
    height: 1.8,
    labelColor: '#4fc3f7',
  },
  monster: {
    baseShape: 'box',
    baseArgs: [0.5, 0.3, 0.5],
    baseColor: '#4a1a1a',
    emissive: '#2a0000',
    height: 1.2,
    labelColor: '#ff6b6b',
  },
  villain: {
    baseShape: 'cone',
    baseArgs: [0.4, 0.5, 4],
    baseColor: '#3a1a4a',
    emissive: '#1a0505',
    height: 2.2,
    labelColor: '#c084c0',
  },
};

export const Billboard3D: React.FC<Billboard3DProps> = ({
  category,
  imagePath,
  position,
  scale = 1,
  rotation = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const config = SHAPE_CONFIGS[category];

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(imagePath, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      setTexture(tex);
    }, undefined, (err) => {
      console.warn(`[Billboard3D] Failed to load texture: ${imagePath}`, err);
    });
  }, [imagePath]);

  useFrame((state) => {
    if (groupRef.current) {
      const camera = state.camera;
      groupRef.current.quaternion.copy(camera.quaternion);
    }
  });

  const renderBase = () => {
    const basePosition: [number, number, number] = [
      position[0],
      position[1] + 0.15,
      position[2],
    ];

    switch (config.baseShape) {
      case 'cylinder':
        return (
          <mesh position={basePosition} castShadow receiveShadow>
            <cylinderGeometry args={config.baseArgs as [number, number, number]} />
            <meshStandardMaterial 
              color={config.baseColor} 
              emissive={config.emissive}
              emissiveIntensity={0.3}
              roughness={0.7} 
              metalness={0.3} 
            />
          </mesh>
        );
      case 'cone':
        return (
          <mesh position={basePosition} castShadow receiveShadow>
            <coneGeometry args={config.baseArgs as [number, number, number]} />
            <meshStandardMaterial 
              color={config.baseColor} 
              emissive={config.emissive}
              emissiveIntensity={0.4}
              roughness={0.6} 
              metalness={0.4} 
            />
          </mesh>
        );
      case 'box':
      default:
        return (
          <mesh position={basePosition} castShadow receiveShadow>
            <boxGeometry args={config.baseArgs as [number, number, number]} />
            <meshStandardMaterial 
              color={config.baseColor} 
              emissive={config.emissive}
              emissiveIntensity={0.2}
              roughness={0.8} 
              metalness={0.2} 
            />
          </mesh>
        );
    }
  };

  const billboardPosition: [number, number, number] = [
    position[0],
    position[1] + config.height,
    position[2],
  ];

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {renderBase()}
      
      {texture && (
        <mesh position={billboardPosition} castShadow>
          <planeGeometry args={[scale, scale * 1.4]} />
          <meshStandardMaterial 
            map={texture} 
            transparent 
            side={THREE.DoubleSide}
            roughness={0.5}
            metalness={0.1}
            alphaTest={0.1}
          />
        </mesh>
      )}
    </group>
  );
};
