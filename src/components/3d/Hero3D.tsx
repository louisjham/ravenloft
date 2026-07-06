import React, { useRef, useEffect, Suspense } from 'react';
import { Cylinder, Box, Sphere, Billboard, Text } from '@react-three/drei';
import { Hero } from '../../game/types';
import { getHeroModelPath, DUMMY_MODE } from '../../utils/modelLoader';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import * as THREE from 'three';
import { Select } from '@react-three/postprocessing';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { GamePiece } from './GamePiece';
import { getLegalTargets } from '../ui/TargetSelection';
import { DataLoader } from '../../game/dataLoader';

interface Hero3DProps {
  hero: Hero;
}

const HeroPlaceholder: React.FC = () => (
  <group>
    <Box args={[0.4, 0.8, 0.4]} position={[0, 0.45, 0]} castShadow>
      <meshStandardMaterial color="#4444aa" />
    </Box>
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

  const isLegalTarget = useGameStore((state) => {
    if (interactionMode !== 'ability' || !selectedPowerId || !state.gameState) return false;
    const card = DataLoader.getInstance().getCardById(selectedPowerId);
    if (!card) return false;
    const targets = getLegalTargets(card, state.gameState);
    return targets.some(t => t.entityId === hero.id);
  });

  const worldX = hero.position.x * 4 + hero.position.sqX + 0.5;
  const worldZ = hero.position.z * 4 + hero.position.sqZ + 0.5;

  const groupRef = useRef<THREE.Group>(null);
  const legalRingRef = useRef<THREE.Mesh>(null);
  const modelRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(worldX, 0, worldZ));
  const targetRotY = useRef(0);
  const prevHp = useRef(hero.hp);
  const hitTimer = useRef(0);

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

  useEffect(() => {
    if (hero.hp < prevHp.current) {
      hitTimer.current = 0.4; // 0.4s hit animation
    }
    prevHp.current = hero.hp;
  }, [hero.hp]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const lerpFactor = Math.min(18 * delta, 1);
      groupRef.current.position.lerp(targetPos.current, lerpFactor);
      let diff = targetRotY.current - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * lerpFactor;
    }

    // target selection ring pulsing animation
    if (isLegalTarget && legalRingRef.current) {
      const time = state.clock.getElapsedTime();
      const scale = 1.0 + Math.sin(time * 5) * 0.05;
      legalRingRef.current.scale.set(scale, scale, 1);
      
      const material = legalRingRef.current.material as THREE.MeshBasicMaterial;
      if (material) {
        material.opacity = 0.5 + Math.sin(time * 5) * 0.2;
      }
    }

    // hit reaction animation (jolt + red flash)
    if (modelRef.current) {
      if (hitTimer.current > 0) {
        hitTimer.current -= delta;
        const progress = Math.max(0, hitTimer.current / 0.4); // 1.0 down to 0.0
        
        // Squash and stretch jolt
        const scaleY = 1.0 + Math.sin(progress * Math.PI) * 0.18;
        const scaleXZ = 1.0 - Math.sin(progress * Math.PI) * 0.08;
        modelRef.current.scale.set(scaleXZ, scaleY, scaleXZ);

        // Recoil (vertical jump/hop)
        modelRef.current.position.y = Math.sin(progress * Math.PI) * 0.25;

        // Red flash (traverses child meshes and adds red emissive tint)
        modelRef.current.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (child.material.emissive) {
              child.material.emissive.setRGB(progress * 0.8, 0, 0);
              child.material.emissiveIntensity = progress * 1.5;
            }
          }
        });
      } else {
        // Reset scale and position
        modelRef.current.scale.set(1, 1, 1);
        modelRef.current.position.y = 0;
        
        // Reset emissive
        modelRef.current.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.setRGB(0, 0, 0);
            child.material.emissiveIntensity = 0;
          }
        });
      }
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

        {isLegalTarget && (
          <group position={[0, 0.012, 0]}>
            <mesh ref={legalRingRef} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.45, 0.55, 16]} />
              <meshBasicMaterial color="#ffbb00" transparent opacity={0.6} side={2} depthWrite={false} />
            </mesh>
            <pointLight color="#ffbb00" intensity={1.5} distance={1.5} castShadow={false} />
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
 
        {/* Diegetic Billboard Stats */}
        <Billboard position={[0, 1.45, 0]}>
          {/* Hero Name */}
          <Text
            position={[0, 0.22, 0]}
            fontSize={0.14}
            color="#4fc3f7"
            anchorX="center"
            anchorY="middle"
          >
            {hero.name}
          </Text>
 
          {/* HP Bar Background */}
          <mesh position={[0, 0.08, 0]}>
            <planeGeometry args={[0.6, 0.06]} />
            <meshBasicMaterial color="#222222" />
          </mesh>
          {/* HP Bar Foreground */}
          <mesh position={[-0.3 + (hpRatio * 0.6) / 2, 0.08, 0.005]}>
            <planeGeometry args={[hpRatio * 0.6, 0.06]} />
            <meshBasicMaterial color={hpRatio > 0.5 ? "#2e7d32" : hpRatio > 0.25 ? "#f57c00" : "#d32f2f"} />
          </mesh>
 
          {/* HP Text (e.g. "8/10") */}
          <Text
            position={[0, 0.08, 0.01]}
            fontSize={0.075}
            color="#ffffff"
            fontWeight="bold"
            anchorX="center"
            anchorY="middle"
          >
            {`${hero.hp}/${hero.maxHp}`}
          </Text>
 
          {/* Conditions */}
          {hero.conditions && hero.conditions.length > 0 && (
            <Text
              position={[0, -0.05, 0]}
              fontSize={0.09}
              color="#ffbb00"
              anchorX="center"
              anchorY="middle"
            >
              {hero.conditions.map(c => c.type.toUpperCase()).join(', ')}
            </Text>
          )}
        </Billboard>

        {/* Hero Body Model wrapped in modelRef group for recoil animations */}
        <group ref={modelRef}>
          {DUMMY_MODE ? <HeroPlaceholder /> : (
            <Suspense fallback={<HeroPlaceholder />}>
              <GamePiece url={getHeroModelPath(hero.heroClass)} position={[0, 0.5, 0]} rotation={[0, 0, 0]} scale={0.4} />
            </Suspense>
          )}
        </group>
      </Select>
    </group>
  );
};

export const Hero3D = React.memo(Hero3DInner);
