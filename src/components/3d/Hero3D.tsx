import React, { useRef, useEffect, Suspense } from 'react';
import { Cylinder, Box, Sphere } from '@react-three/drei';
import { Hero } from '../../game/types';
import { getHeroModelPath, DUMMY_MODE } from '../../utils/modelLoader';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import * as THREE from 'three';
import { Select } from '@react-three/postprocessing';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { GamePiece } from './GamePiece';

interface Hero3DProps {
  hero: Hero;
}

const HeroPlaceholder: React.FC = () => (
  <group>
    <Box args={[0.4, 0.8, 0.4]} position={[0, 0.45, 0]} castShadow>
      <meshStandardMaterial color="#4444aa" />
    </Box>
    <Sphere args={[0.15]} position={[0, 0.95, 0]} castShadow>
      <meshStandardMaterial color="#ffccaa" />
    </Sphere>
  </group>
);



const Hero3DInner: React.FC<Hero3DProps> = ({ hero }) => {
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const isSelected = selectedEntity?.id === hero.id;
  const currentHeroId = useGameStore((state) => state.gameState?.currentHeroId);
  const isHeroPhase = useGameStore((state) => state.gameState?.phase === 'hero');
  const isActive = isHeroPhase && currentHeroId === hero.id;

  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);

  let outlineColor = '#00aaff';
  if (interactionMode === 'attack') outlineColor = '#ff3333';
  if (interactionMode === 'ability') outlineColor = '#ffbb00';

  const worldX = hero.position.x * 4 + hero.position.sqX + 0.5;
  const worldZ = hero.position.z * 4 + hero.position.sqZ + 0.5;

  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(worldX, 0, worldZ));
  const targetRotY = useRef(0);

  const setGroupRef = (node: THREE.Group | null) => {
    if (node && !groupRef.current) {
      node.position.copy(targetPos.current);
    }
    (groupRef as React.MutableRefObject<THREE.Group | null>).current = node;
  };

  useEffect(() => {
    const dx = worldX - targetPos.current.x;
    const dz = worldZ - targetPos.current.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      targetRotY.current = Math.atan2(dx, dz);
    }
    targetPos.current.set(worldX, 0, worldZ);
  }, [worldX, worldZ]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const lerpFactor = Math.min(10 * delta, 1);
      groupRef.current.position.lerp(targetPos.current, lerpFactor);
      let diff = targetRotY.current - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * lerpFactor;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (interactionMode === 'ability' && selectedPowerId) {
      e.stopPropagation();
      useGameStore.getState().usePower(selectedPowerId, hero.id);
      setInteractionMode('none');
      setSelectedPowerId(null);
    }
  };

  const hpRatio = hero.hp / hero.maxHp;
  const orbColor = hpRatio > 0.5 ? "#00ff00" : hpRatio > 0.25 ? "#ffaa00" : "#ff2200";

  return (
    <group 
      ref={setGroupRef}
      userData={{ entity: hero }}
      onClick={handleClick}
    >
      <Select enabled={isActive}>
        {isActive && (
          <group position={[0, 0.01, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.45, 0.55, 16]} />
              <meshBasicMaterial color={outlineColor} transparent opacity={0.8} side={2} />
            </mesh>
            <pointLight color={outlineColor} intensity={2} distance={2} castShadow={false} />
          </group>
        )}

        <Cylinder args={[0.4, 0.4, 0.05, 16]} position={[0, 0.025, 0]}>
          <meshStandardMaterial color={isSelected ? outlineColor : "#222222"} />
        </Cylinder>

        <Sphere args={[0.08]} position={[0.3, 0.1, 0]}>
          <meshStandardMaterial 
            color={orbColor} 
            emissive={orbColor}
            emissiveIntensity={0.5 + hpRatio * 1.5}
          />
        </Sphere>

        {DUMMY_MODE ? <HeroPlaceholder /> : (
          <Suspense fallback={<HeroPlaceholder />}>
            <GamePiece url={getHeroModelPath(hero.heroClass)} position={[0, 0.5, 0]} rotation={[0, 0, 0]} scale={0.4} />
          </Suspense>
        )}
      </Select>
    </group>
  );
};

export const Hero3D = Hero3DInner;
