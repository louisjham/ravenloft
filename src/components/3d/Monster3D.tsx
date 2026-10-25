import React, { Suspense, memo, useRef, useEffect } from 'react';
import { Cylinder, Box, Sphere, Billboard, Text } from '@react-three/drei';
import { Interactive } from '@react-three/xr';
import { Monster } from '../../game/types';
import { getMonsterModelPath, DUMMY_MODE } from '../../utils/modelLoader';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GamePiece } from './GamePiece';
import { getLegalTargets } from '../ui/TargetSelection';
import { DataLoader } from '../../game/dataLoader';
import { TileSystem } from '../../game/engine/TileSystem';
import { ConditionSystem } from '../../game/engine/ConditionSystem';

interface Monster3DProps {
  monster: Monster;
}

/**
 * Placeholder for when the Monster model is loading or fails.
 */
const MonsterPlaceholder: React.FC = () => (
  <group>
    {/* Body */}
    <Box args={[0.5, 0.7, 0.5]} position={[0, 0.4, 0]} castShadow>
      <meshStandardMaterial color="#aa4444" />
    </Box>
    {/* Head */}
    <Sphere args={[0.2]} position={[0, 0.85, 0]} castShadow>
      <meshStandardMaterial color="#666666" />
    </Sphere>
  </group>
);

/**
 * 3D component for a Monster miniature.
 */
const Monster3DInner: React.FC<Monster3DProps> = ({ monster }) => {
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const attackMonster = useGameStore((state) => state.attackMonster);
  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);
  
  const hoveredTargetEntityId = useUIStore((state) => state.hoveredTargetEntityId);
  const isSelected = selectedEntity?.id === monster.id;
  const isHoveredTarget = hoveredTargetEntityId === monster.id;

  const isLegalTarget = useGameStore((state) => {
    if (interactionMode !== 'ability' || !selectedPowerId || !state.gameState) return false;
    const card = DataLoader.getInstance().getCardById(selectedPowerId);
    if (!card) return false;
    const targets = getLegalTargets(card, state.gameState);
    return targets.some(t => t.entityId === monster.id);
  });

  // Check if monster is within move & attack reach of active hero when a piece is picked up
  const isMonsterInRange = useGameStore((state) => {
    if (interactionMode !== 'move' || !state.gameState || state.gameState.phase !== 'hero' || state.gameState.hasAttackedThisTurn) {
      return false;
    }
    const gs = state.gameState;
    const activeHero = gs.heroes.find(h => h.id === gs.currentHeroId);
    if (!activeHero) return false;

    const hGX = activeHero.position.x * 4 + activeHero.position.sqX;
    const hGZ = activeHero.position.z * 4 + activeHero.position.sqZ;
    const mGX = monster.position.x * 4 + monster.position.sqX;
    const mGZ = monster.position.z * 4 + monster.position.sqZ;

    // Directly adjacent to active hero
    if (Math.max(Math.abs(hGX - mGX), Math.abs(hGZ - mGZ)) <= 1) {
      return true;
    }

    if (activeHero.isExhausted) return false;

    const effectiveSpeed = ConditionSystem.getEffectiveSpeed(activeHero, gs);
    const mTile = gs.tiles.find(t => t.x === monster.position.x && t.z === monster.position.z);
    const hTile = gs.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
    if (!mTile || !hTile) return false;
    if (Math.abs(mTile.x - hTile.x) + Math.abs(mTile.z - hTile.z) > Math.ceil(effectiveSpeed / 2)) {
      return false;
    }

    const TS = 4;
    const blockedSquares = new Set<string>(
      gs.monsters
        .filter(m => !m.isDefeated && m.hp > 0)
        .map(m => `${m.position.x * TS + m.position.sqX},${m.position.z * TS + m.position.sqZ}`)
    );
    const reachable = TileSystem.getReachableSquares(activeHero.position, gs.tiles, effectiveSpeed, blockedSquares);

    const adjOffsets = [
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
      { dx: 1, dz: 1 }, { dx: -1, dz: 1 }, { dx: 1, dz: -1 }, { dx: -1, dz: -1 }
    ];

    for (const offset of adjOffsets) {
      const adjGX = mGX + offset.dx;
      const adjGZ = mGZ + offset.dz;
      const tX = Math.floor(adjGX / TS);
      const tZ = Math.floor(adjGZ / TS);
      const sX = ((adjGX % TS) + TS) % TS;
      const sZ = ((adjGZ % TS) + TS) % TS;
      const tile = gs.tiles.find(t => t.x === tX && t.z === tZ && t.isRevealed);
      if (tile && reachable.has(`${tile.id}:${sX}:${sZ}`)) {
        return true;
      }
    }
    return false;
  });

  const legalRingRef = useRef<THREE.Mesh>(null);
  const hoverRingRef = useRef<THREE.Mesh>(null);
  const modelRef = useRef<THREE.Group>(null);
  const prevHp = useRef(monster.hp);
  const hitTimer = useRef(0);

  useEffect(() => {
    if (monster.hp < prevHp.current) {
      hitTimer.current = 0.4; // 0.4s hit animation
    }
    prevHp.current = monster.hp;
  }, [monster.hp]);

  useFrame((state, delta) => {
    // Target selection ring pulsing animation
    if (isLegalTarget && legalRingRef.current) {
      const time = state.clock.getElapsedTime();
      const scale = 1.0 + Math.sin(time * 5) * 0.05;
      legalRingRef.current.scale.set(scale, scale, 1);
      
      const material = legalRingRef.current.material as THREE.MeshBasicMaterial;
      if (material) {
        material.opacity = 0.5 + Math.sin(time * 5) * 0.2;
      }
    }

    // Hover target locked ring pulsing and spinning
    if (hoverRingRef.current) {
      const time = state.clock.getElapsedTime();
      const pulse = 1.0 + Math.sin(time * 8) * 0.07;
      hoverRingRef.current.scale.set(pulse, pulse, 1);
      hoverRingRef.current.rotation.z += delta * 2;
    }

    // Hit reaction animation (jolt + red flash) or hover highlight
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
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.setRGB(progress * 0.8, 0, 0);
            child.material.emissiveIntensity = progress * 1.5;
          }
        });

        // If hit animation just completed, reset emissive once
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
      } else if (isHoveredTarget) {
        // Red glow when hovered by hero piece
        const hoverIntensity = 0.7 + Math.sin(state.clock.getElapsedTime() * 8) * 0.3;
        modelRef.current.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.setRGB(hoverIntensity, 0, 0);
            child.material.emissiveIntensity = hoverIntensity;
          }
        });
      } else {
        // Ensure clean neutral emissive when not hit and not hovered
        modelRef.current.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.emissive && child.material.emissiveIntensity > 0) {
            child.material.emissive.setRGB(0, 0, 0);
            child.material.emissiveIntensity = 0;
          }
        });
      }
    }
  });

  // Center squares are 0.5, 1.5, 2.5, 3.5 relative to tile origin
  const worldX = monster.position.x * 4 + monster.position.sqX + 0.5;
  const worldZ = monster.position.z * 4 + monster.position.sqZ + 0.5;

  if (monster.isDefeated) return null;

  const handleTriggerAction = () => {
    if (interactionMode === 'attack') {
      attackMonster(monster.id);
      setInteractionMode('none');
    } else if (interactionMode === 'ability' && selectedPowerId) {
      useGameStore.getState().usePower(selectedPowerId, monster.id);
      setInteractionMode('none');
      setSelectedPowerId(null);
    } else if (interactionMode === 'none') {
      const gs = useGameStore.getState().gameState;
      if (gs && gs.phase === 'hero' && !gs.hasAttackedThisTurn) {
        attackMonster(monster.id);
      }
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (interactionMode === 'attack') {
      e.stopPropagation();
      attackMonster(monster.id);
      setInteractionMode('none');
    } else if (interactionMode === 'ability' && selectedPowerId) {
      e.stopPropagation();
      useGameStore.getState().usePower(selectedPowerId, monster.id);
      setInteractionMode('none');
      setSelectedPowerId(null);
    } else if (interactionMode === 'none') {
      const gs = useGameStore.getState().gameState;
      if (gs && gs.phase === 'hero' && !gs.hasAttackedThisTurn) {
        e.stopPropagation();
        attackMonster(monster.id);
      }
    }
  };

  const isGravestorm = monster.id.startsWith('monster_gravestorm');
  const modelScale = isGravestorm ? 1.2 : 0.4;
  const modelYPos = isGravestorm ? 1.2 : 0.5;

  const hpRatio = monster.hp / monster.maxHp;
  const barWidth = hpRatio * 0.5;
  const barX = -0.25 + barWidth / 2;

  return (
    <Interactive onSelect={handleTriggerAction}>
      <group 
        position={[worldX, 0, worldZ]} 
        userData={{ entity: monster }}
        onClick={handleClick}
      >
        {/* Selected Target Highlight */}
        {isSelected && (
          <group position={[0, 0.01, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.45, 0.55, 16]} />
              <meshBasicMaterial color="#ff0000" transparent opacity={0.6} side={2} />
            </mesh>
          </group>
        )}

        {/* Hover Target Locked Reticle (Bright Crimson & Gold) */}
        {isHoveredTarget && (
          <group position={[0, 0.015, 0]}>
            <mesh ref={hoverRingRef} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.45, 0.65, 32]} />
              <meshBasicMaterial color="#ff1744" transparent opacity={0.95} side={2} depthWrite={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.72, 0.78, 32]} />
              <meshBasicMaterial color="#ffd700" transparent opacity={0.85} side={2} depthWrite={false} />
            </mesh>
          </group>
        )}

        {/* In-Range Subtle Amber Ring when Hero is Picked Up */}
        {!isHoveredTarget && isMonsterInRange && (
          <group position={[0, 0.012, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.42, 0.52, 24]} />
              <meshBasicMaterial color="#f5a623" transparent opacity={0.65} side={2} depthWrite={false} />
            </mesh>
          </group>
        )}

        {/* Legal Target Highlight (pulsing gold) */}
        {isLegalTarget && (
          <group position={[0, 0.012, 0]}>
            <mesh ref={legalRingRef} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.45, 0.55, 16]} />
              <meshBasicMaterial color="#ffbb00" transparent opacity={0.6} side={2} depthWrite={false} />
            </mesh>
          </group>
        )}

        {/* Monster Base Pedestal with Radiant Outline when Targeted */}
        <Cylinder args={[0.4, 0.4, 0.05, 16]} position={[0, 0.025, 0]}>
          <meshStandardMaterial 
            color={isHoveredTarget ? "#500a0a" : (isSelected ? "#442222" : "#222222")} 
            emissive={isHoveredTarget ? "#ff1744" : "#000000"}
            emissiveIntensity={isHoveredTarget ? 0.7 : 0}
          />
        </Cylinder>

        {/* Diegetic Combat Target Banner (shown when hero hovers over monster) */}
        {isHoveredTarget && (
          <Billboard position={[0, 1.55, 0]}>
            <mesh>
              <boxGeometry args={[2.0, 0.28, 0.02]} />
              <meshStandardMaterial color="#2d0505" emissive="#ff1744" emissiveIntensity={0.6} roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.011]}>
              <boxGeometry args={[1.96, 0.24, 0.002]} />
              <meshBasicMaterial color="#ffd700" wireframe />
            </mesh>
            <Text
              position={[0, 0.04, 0.02]}
              fontSize={0.11}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`⚔ ATTACK TARGET: ${monster.name.toUpperCase()} ⚔`}
            </Text>
            <Text
              position={[0, -0.05, 0.02]}
              fontSize={0.075}
              color="#ffd700"
              anchorX="center"
              anchorY="middle"
            >
              {`AC ${monster.ac} • HP ${monster.hp}/${monster.maxHp} • Drop Hero to Strike`}
            </Text>
          </Billboard>
        )}

        {/* Threat Level or HP Bar (Diegetic) */}
        <Billboard position={[0, 1.2, 0]}>
          <mesh>
            <planeGeometry args={[0.5, 0.05]} />
            <meshBasicMaterial color="#333" />
          </mesh>
          <mesh position={[barX, 0, 0.01]}>
            <planeGeometry args={[barWidth, 0.05]} />
            <meshBasicMaterial color={hpRatio < 0.3 ? "#ff4400" : "#ff0000"} />
          </mesh>
        </Billboard>

        {/* Monster Body with Suspense fallback (ref attached for hit recoil) */}
        <group ref={modelRef}>
          {DUMMY_MODE ? (
            <MonsterPlaceholder />
          ) : (
            <Suspense fallback={<MonsterPlaceholder />}>
              <GamePiece url={getMonsterModelPath(monster.templateId || monster.id || monster.name || monster.monsterType)} position={[0, modelYPos, 0]} rotation={[0, 0, 0]} scale={modelScale} />
            </Suspense>
          )}
        </group>
      </group>
    </Interactive>
  );
};

export const Monster3D = memo(Monster3DInner);
