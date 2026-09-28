import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { Cylinder, Box, Sphere, Billboard, Text } from '@react-three/drei';
import { Interactive, useXR } from '@react-three/xr';
import { Hero, Position } from '../../game/types';
import { getHeroModelPath, DUMMY_MODE } from '../../utils/modelLoader';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import * as THREE from 'three';
import { Select } from '@react-three/postprocessing';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { GamePiece } from './GamePiece';
import { getLegalTargets } from '../ui/TargetSelection';
import { DataLoader } from '../../game/dataLoader';
import { useGameActions } from '../../hooks/useGameActions';
import { TileSystem } from '../../game/engine/TileSystem';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { playHapticProfile } from '../../xr/XRHaptics';

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

const _ctrlPos = new THREE.Vector3();
const _ctrlRot = new THREE.Quaternion();
const _tempVec = new THREE.Vector3();

const Hero3DInner: React.FC<Hero3DProps> = ({ hero }) => {
  const { controllers } = useXR();
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const isSelected = selectedEntity?.id === hero.id;
  const currentHeroId = useGameStore((state) => state.gameState?.currentHeroId);
  const isHeroPhase = useGameStore((state) => state.gameState?.phase === 'hero');
  const isActive = isHeroPhase && currentHeroId === hero.id;

  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);
  const { addNotification } = useUIStore();

  const { handleMoveHero, handleAttackMonster } = useGameActions();

  // Grabbing & 6DoF Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState<Position | null>(null);
  const [hoveredMonsterId, setHoveredMonsterId] = useState<string | null>(null);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);
  const dragStartPosRef = useRef<Position>(hero.position);

  let outlineColor = '#00aaff';
  if (interactionMode === 'attack') outlineColor = '#ff3333';
  if (interactionMode === 'ability') outlineColor = '#ffbb00';
  if (isDragging) outlineColor = '#00ff88';

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
    if (!isDragging) {
      const dx = worldX - targetPos.current.x;
      const dz = worldZ - targetPos.current.z;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        targetRotY.current = Math.atan2(dx, dz);
      }
      targetPos.current.set(worldX, 0, worldZ);
      dragStartPosRef.current = hero.position;
    }
  }, [worldX, worldZ, isDragging, hero.position]);

  useEffect(() => {
    if (hero.hp < prevHp.current) {
      hitTimer.current = 0.4;
    }
    prevHp.current = hero.hp;
  }, [hero.hp]);

  // Compute reachable squares when dragging
  const reachableSet = useMemo(() => {
    if (!isActive) return new Set<string>();
    const gs = useGameStore.getState().gameState;
    if (!gs) return new Set<string>();

    const effectiveSpeed = ConditionSystem.getEffectiveSpeed(hero, gs);
    const TS = 4;
    const blockedSquares = new Set<string>(
      gs.monsters
        .filter(m => !m.isDefeated && m.hp > 0)
        .map(m => `${m.position.x * TS + m.position.sqX},${m.position.z * TS + m.position.sqZ}`)
    );

    return TileSystem.getReachableSquares(
      hero.position,
      gs.tiles,
      effectiveSpeed,
      blockedSquares
    );
  }, [isActive, hero]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (isDragging) {
      // Follow VR 6DoF controller or mouse pointer
      if (grabbingControllerRef.current && groupRef.current.parent) {
        grabbingControllerRef.current.updateWorldMatrix(true, false);
        grabbingControllerRef.current.getWorldPosition(_ctrlPos);
        groupRef.current.parent.updateWorldMatrix(true, false);
        
        _tempVec.copy(_ctrlPos);
        groupRef.current.parent.worldToLocal(_tempVec);

        // Keep elevated above board while dragging
        targetPos.current.set(_tempVec.x, Math.max(0.35, _tempVec.y + 0.1), _tempVec.z);
      }

      const lerpFactor = Math.min(22 * delta, 1);
      groupRef.current.position.lerp(targetPos.current, lerpFactor);

      // Determine hovered square on board
      const curX = groupRef.current.position.x;
      const curZ = groupRef.current.position.z;
      const globalSqX = Math.floor(curX);
      const globalSqZ = Math.floor(curZ);
      const tileX = Math.floor(globalSqX / 4);
      const tileZ = Math.floor(globalSqZ / 4);
      const sqX = ((globalSqX % 4) + 4) % 4;
      const sqZ = ((globalSqZ % 4) + 4) % 4;

      const hoveredPos: Position = { x: tileX, z: tileZ, sqX, sqZ };
      setHoveredSquare(hoveredPos);

      // Check if hovering near an enemy monster
      const gs = useGameStore.getState().gameState;
      if (gs) {
        const monster = gs.monsters.find(m => 
          !m.isDefeated && m.hp > 0 &&
          m.position.x === tileX && m.position.z === tileZ &&
          m.position.sqX === sqX && m.position.sqZ === sqZ
        );
        setHoveredMonsterId(monster ? monster.id : null);
      }
    } else {
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

    // hit reaction animation
    if (modelRef.current) {
      if (hitTimer.current > 0) {
        hitTimer.current -= delta;
        const progress = Math.max(0, hitTimer.current / 0.4);
        const scaleY = 1.0 + Math.sin(progress * Math.PI) * 0.18;
        const scaleXZ = 1.0 - Math.sin(progress * Math.PI) * 0.08;
        modelRef.current.scale.set(scaleXZ, scaleY, scaleXZ);
        modelRef.current.position.y = Math.sin(progress * Math.PI) * 0.25;

        modelRef.current.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.setRGB(progress * 0.8, 0, 0);
            child.material.emissiveIntensity = progress * 1.5;
          }
        });

        if (hitTimer.current <= 0) {
          modelRef.current.scale.set(1, 1, 1);
          modelRef.current.position.y = 0;
          modelRef.current.traverse((child: any) => {
            if (child.isMesh && child.material && child.material.emissive) {
              child.material.emissive.setRGB(0, 0, 0);
              child.material.emissiveIntensity = 0;
            }
          });
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Grab / Pick-Up Handlers
  // ---------------------------------------------------------------------------
  const handleGrabStart = (e: any) => {
    if (!isActive) return;

    playHapticProfile('hover');
    setIsDragging(true);
    setInteractionMode('move');
    dragStartPosRef.current = hero.position;

    const xrCtrl = e?.controller || (e?.target?.controller ? e.target : null);
    const ctrlObj = xrCtrl?.controller || xrCtrl?.grip || (e?.target instanceof THREE.Object3D ? e.target : null);
    if (ctrlObj) {
      grabbingControllerRef.current = ctrlObj;
    }
  };

  // ---------------------------------------------------------------------------
  // Release / Drop Handlers
  // ---------------------------------------------------------------------------
  const handleGrabEnd = () => {
    if (!isDragging) return;

    setIsDragging(false);
    grabbingControllerRef.current = null;

    const gs = useGameStore.getState().gameState;
    if (!gs || !hoveredSquare) {
      // Snap back
      targetPos.current.set(worldX, 0, worldZ);
      return;
    }

    // 1. Attack Target Check (if dropped on enemy monster)
    if (hoveredMonsterId) {
      const monster = gs.monsters.find(m => m.id === hoveredMonsterId);
      if (monster) {
        playHapticProfile('rollDice');
        handleAttackMonster(monster.id);
        targetPos.current.set(worldX, 0, worldZ);
        setInteractionMode('none');
        return;
      }
    }

    // 2. Reachable Square Check
    const destTile = gs.tiles.find(t => t.x === hoveredSquare.x && t.z === hoveredSquare.z);
    const targetKey = destTile ? `${destTile.id}:${hoveredSquare.sqX}:${hoveredSquare.sqZ}` : '';

    if (destTile && reachableSet.has(targetKey)) {
      // Legal Square: Snap and Move
      playHapticProfile('click');
      handleMoveHero(hoveredSquare);
      setInteractionMode('none');
    } else {
      // Illegal Square: Cannot let go on illegal square! Snap back to start.
      playHapticProfile('error');
      addNotification('Cannot place hero on an illegal square — returned to start.', 'warning');
      targetPos.current.set(worldX, 0, worldZ);
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isActive) return;
    e.stopPropagation();
    handleGrabStart(e);

    const onPointerMove = (moveEvt: PointerEvent) => {
      // Desktop raycast tracking
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      handleGrabEnd();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

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
    <Interactive
      onSelect={handleGrabStart}
      onSqueeze={handleGrabStart}
      onSqueezeEnd={handleGrabEnd}
    >
      <group 
        ref={setGroupRef}
        userData={{ entity: hero }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      >
        <Select enabled={isActive}>
          {/* Active / Dragging Selection Rings */}
          {isActive && (
            <group position={[0, 0.01, 0]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.45, 0.58, 32]} />
                <meshBasicMaterial 
                  color={isDragging ? '#00ff88' : outlineColor} 
                  transparent 
                  opacity={isDragging ? 0.95 : 0.8} 
                  side={THREE.DoubleSide} 
                />
              </mesh>
              {isDragging && (
                <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.55, 32]} />
                  <meshBasicMaterial color="#00ff88" transparent opacity={0.3} />
                </mesh>
              )}
            </group>
          )}

          {isLegalTarget && (
            <group position={[0, 0.012, 0]}>
              <mesh ref={legalRingRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.45, 0.55, 16]} />
                <meshBasicMaterial color="#ffbb00" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            </group>
          )}

          <Cylinder args={[0.4, 0.4, 0.05, 16]} position={[0, 0.025, 0]}>
            <meshStandardMaterial color={isSelected || isDragging ? outlineColor : "#222222"} />
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
            {/* Active Movement Prompt Banner */}
            {isActive && (interactionMode === 'move' || isDragging) && (
              <group position={[0, 0.42, 0]}>
                <mesh>
                  <boxGeometry args={[1.8, 0.18, 0.02]} />
                  <meshStandardMaterial color="#004d40" emissive="#00e5ff" emissiveIntensity={0.7} />
                </mesh>
                <Text
                  position={[0, 0, 0.02]}
                  fontSize={0.09}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                >
                  {isDragging ? 'DRAG & DROP TO MOVE OR ATTACK' : 'PICK UP HERO TO MOVE'}
                </Text>
              </group>
            )}

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
    </Interactive>
  );
};

export const Hero3D = React.memo(Hero3DInner);
export default Hero3D;
