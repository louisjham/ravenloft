import React, { useRef, useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { Cylinder, Box, Sphere, Billboard, Text } from '@react-three/drei';
import { Interactive, useXR } from '@react-three/xr';
import { Hero, Monster, Position } from '../../game/types';
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
import { XRGrabSource, resolveGrabSource, isGrabActive, recordGrabRelease, getGrabWorldPose } from '../../xr/XRGrabManager';

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

// Scratch objects allocated once for 90Hz frame updates
const _ctrlPos = new THREE.Vector3();
const _ctrlRot = new THREE.Quaternion();
const _tempVec = new THREE.Vector3();
const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const Hero3DInner: React.FC<Hero3DProps> = ({ hero }) => {
  const { controllers, isPresenting } = useXR();
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const isSelected = selectedEntity?.id === hero.id;
  const currentHeroId = useGameStore((state) => state.gameState?.currentHeroId);
  const isHeroPhase = useGameStore((state) => state.gameState?.phase === 'hero');
  const isActive = isHeroPhase && currentHeroId === hero.id;
  const pendingAITurnApproval = useGameStore((state) => state.gameState?.pendingAITurnApproval);
  const approveAITurn = useGameStore((state) => state.approveAITurn);
  const isPendingApproval = pendingAITurnApproval?.heroId === hero.id;

  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);
  const setHoveredTargetEntityId = useUIStore((state) => state.setHoveredTargetEntityId);
  const { addNotification } = useUIStore();

  const { handleMoveHero, handleAttackMonster } = useGameActions();

  // Grabbing & 6DoF Dragging State (VR + Desktop)
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState<Position | null>(null);
  const [hoveredMonsterId, setHoveredMonsterId] = useState<string | null>(null);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);
  const grabSourceRef = useRef<XRGrabSource | null>(null);
  const heroResetVersionRef = useRef<number>(0);
  const isPointerDraggingRef = useRef(false);
  const dragStartPosRef = useRef<Position>(hero.position);
  const lastPointerPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const currentHoverRef = useRef<{ square: Position | null; monsterId: string | null }>({ square: null, monsterId: null });

  // Query hovered monster from store for live combat stats
  const hoveredMonster = useGameStore((state) =>
    hoveredMonsterId ? state.gameState?.monsters.find(m => m.id === hoveredMonsterId && !m.isDefeated) : null
  );

  // Active hero aura & light pillar animation refs
  const auraRingRef = useRef<THREE.Mesh>(null);
  const lightPillarRef = useRef<THREE.Mesh>(null);

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

  // Compute reachable squares when dragging or active
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

    // 1. Animate Active Hero Aura Ring & Light Beacon
    if (auraRingRef.current) {
      auraRingRef.current.rotation.z += delta * 1.5;
    }
    if (lightPillarRef.current) {
      const time = state.clock.getElapsedTime();
      const pulse = 1.0 + Math.sin(time * 3) * 0.06;
      lightPillarRef.current.scale.set(pulse, 1.0 + Math.sin(time * 2) * 0.04, pulse);
    }

        // Reset All placement check: restore hero to exact legal square
    const currentResetVersion = useUIStore.getState().resetAllVersion;
    if (currentResetVersion > heroResetVersionRef.current) {
      heroResetVersionRef.current = currentResetVersion;
      if (isDragging) {
        setIsDragging(false);
        grabbingControllerRef.current = null;
        grabSourceRef.current = null;
        isPointerDraggingRef.current = false;
      }
      targetPos.current.set(worldX, 0, worldZ);
      if (groupRef.current) {
        groupRef.current.position.set(worldX, 0, worldZ);
      }
    }
    // 2. Grabbing & 6DoF / Desktop Mouse Dragging
    if (isDragging && grabSourceRef.current) {
      if (!isGrabActive(grabSourceRef.current)) {
        handleGrabEnd();
        return;
      }
    }

    if (isDragging) {
      if (grabSourceRef.current && groupRef.current.parent) {
        getGrabWorldPose(grabSourceRef.current, _ctrlPos, _ctrlRot);
        groupRef.current.parent.updateWorldMatrix(true, false);

        _tempVec.copy(_ctrlPos);
        groupRef.current.parent.worldToLocal(_tempVec);

        targetPos.current.set(_tempVec.x, Math.max(0.35, _tempVec.y + 0.1), _tempVec.z);
        lastPointerPosRef.current = { x: _tempVec.x, z: _tempVec.z };
      } else if (grabbingControllerRef.current && groupRef.current.parent) {
        // VR 6DoF Controller tracking
        grabbingControllerRef.current.updateWorldMatrix(true, false);
        grabbingControllerRef.current.getWorldPosition(_ctrlPos);
        groupRef.current.parent.updateWorldMatrix(true, false);
        
        _tempVec.copy(_ctrlPos);
        groupRef.current.parent.worldToLocal(_tempVec);

        // Keep elevated above board while dragging in VR
        targetPos.current.set(_tempVec.x, Math.max(0.35, _tempVec.y + 0.1), _tempVec.z);
        lastPointerPosRef.current = { x: _tempVec.x, z: _tempVec.z };
      } else if (isPointerDraggingRef.current) {
        // Desktop mouse pointer tracking: project ray onto board floor plane (y = 0)
        const ray = state.raycaster.ray;
        if (ray.intersectPlane(_floorPlane, _tempVec)) {
          if (groupRef.current.parent) {
            groupRef.current.parent.updateWorldMatrix(true, false);
            groupRef.current.parent.worldToLocal(_tempVec);
          }
          // Elevate smoothly above board while dragging on desktop
          targetPos.current.set(_tempVec.x, 0.42, _tempVec.z);
          lastPointerPosRef.current = { x: _tempVec.x, z: _tempVec.z };
        }
      }

      // Snappy responsiveness: 48 * delta gives immediate tight tracking with zero sluggish drag
      const lerpFactor = Math.min(48 * delta, 1);
      groupRef.current.position.lerp(targetPos.current, lerpFactor);

      // Determine hovered square on board using instantaneous pointer coordinates (zero state lag)
      const curX = lastPointerPosRef.current.x;
      const curZ = lastPointerPosRef.current.z;
      const globalSqX = Math.floor(curX);
      const globalSqZ = Math.floor(curZ);
      const tileX = Math.floor(globalSqX / 4);
      const tileZ = Math.floor(globalSqZ / 4);
      const sqX = ((globalSqX % 4) + 4) % 4;
      const sqZ = ((globalSqZ % 4) + 4) % 4;

      const hoveredPos: Position = { x: tileX, z: tileZ, sqX, sqZ };
      setHoveredSquare(hoveredPos);

      // Check if hovering near an enemy monster (within generous 0.88 unit radius)
      const gs = useGameStore.getState().gameState;
      let hoveredEnemy: Monster | null = null;
      if (gs) {
        for (const m of gs.monsters) {
          if (m.isDefeated || m.hp <= 0) continue;
          const mWldX = m.position.x * 4 + m.position.sqX + 0.5;
          const mWldZ = m.position.z * 4 + m.position.sqZ + 0.5;
          const dist = Math.hypot(curX - mWldX, curZ - mWldZ);
          if (dist < 0.88) {
            hoveredEnemy = m;
            break;
          }
        }
      }

      const nextMonsterId = hoveredEnemy ? hoveredEnemy.id : null;
      if (nextMonsterId !== currentHoverRef.current.monsterId) {
        if (nextMonsterId) {
          playHapticProfile('hover');
        }
        setHoveredTargetEntityId(nextMonsterId);
        setHoveredMonsterId(nextMonsterId);
      }
      currentHoverRef.current = { square: hoveredPos, monsterId: nextMonsterId };
    } else {
      const lerpFactor = Math.min(24 * delta, 1);
      groupRef.current.position.lerp(targetPos.current, lerpFactor);
      let diff = targetRotY.current - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * lerpFactor;
    }

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

    // Hit reaction animation
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

  const hpRatio = hero.hp / hero.maxHp;
  const orbColor = useMemo(
    () => (hpRatio > 0.5 ? "#00ff00" : hpRatio > 0.25 ? "#ffaa00" : "#ff2200"),
    [hpRatio]
  );
  const hpBarColor = useMemo(
    () => (hpRatio > 0.5 ? "#2e7d32" : hpRatio > 0.25 ? "#f57c00" : "#d32f2f"),
    [hpRatio]
  );

  // ---------------------------------------------------------------------------
  // Grab / Pick-Up Handlers
  // ---------------------------------------------------------------------------
  const handleGrabStart = useCallback((e: any) => {
    if (!isActive) return;

    let source: XRGrabSource | null = null;
    if (isPresenting) {
      source = resolveGrabSource(e, controllers);
      if (!source) return;
    }

    playHapticProfile('hover');
    setIsDragging(true);
    setInteractionMode('move');
    dragStartPosRef.current = hero.position;
    lastPointerPosRef.current = { x: worldX, z: worldZ };
    currentHoverRef.current = { square: hero.position, monsterId: null };

    if (source) {
      grabSourceRef.current = source;
      grabbingControllerRef.current = source.controller;
    } else {
      const xrCtrl = e?.controller || (e?.target?.controller ? e.target : null);
      const ctrlObj = xrCtrl?.controller || xrCtrl?.grip || (e?.target instanceof THREE.Object3D ? e.target : null);
      if (ctrlObj) {
        grabbingControllerRef.current = ctrlObj;
      }
    }
  }, [isActive, isPresenting, controllers, hero.position, worldX, worldZ, setInteractionMode]);

  // ---------------------------------------------------------------------------
  // Release / Drop Handlers (Intuitive, responsive, no stickiness)
  // ---------------------------------------------------------------------------
  const handleGrabEnd = useCallback(() => {
    if (!isDragging) return;

    recordGrabRelease(grabSourceRef.current);
    grabSourceRef.current = null;
    grabbingControllerRef.current = null;
    setIsDragging(false);
    isPointerDraggingRef.current = false;
    setHoveredTargetEntityId(null);
    setHoveredMonsterId(null);

    const gs = useGameStore.getState().gameState;
    if (!gs) {
      targetPos.current.set(worldX, 0, worldZ);
      setInteractionMode('none');
      return;
    }

    // 1. Attack Target Check (if dropped onto or near an enemy monster)
    const targetMonsterId = currentHoverRef.current.monsterId || hoveredMonsterId;
    if (targetMonsterId) {
      const monster = gs.monsters.find(m => m.id === targetMonsterId && !m.isDefeated && m.hp > 0);
      if (monster) {
        if (gs.hasAttackedThisTurn) {
          playHapticProfile('error');
          addNotification(`${hero.name} has already attacked this turn!`, 'warning');
          targetPos.current.set(worldX, 0, worldZ);
          setInteractionMode('none');
          return;
        }

        const hGX = hero.position.x * 4 + hero.position.sqX;
        const hGZ = hero.position.z * 4 + hero.position.sqZ;
        const mGX = monster.position.x * 4 + monster.position.sqX;
        const mGZ = monster.position.z * 4 + monster.position.sqZ;
        const isAlreadyAdjacent = Math.max(Math.abs(hGX - mGX), Math.abs(hGZ - mGZ)) <= 1;

        if (isAlreadyAdjacent) {
          playHapticProfile('rollDice');
          handleAttackMonster(monster.id);
          targetPos.current.set(worldX, 0, worldZ);
          setInteractionMode('none');
          return;
        }

        // Hero is not adjacent: can hero move to reach?
        if (hero.isExhausted) {
          playHapticProfile('error');
          addNotification(`${hero.name} has already moved and cannot reach ${monster.name}!`, 'warning');
          targetPos.current.set(worldX, 0, worldZ);
          setInteractionMode('none');
          return;
        }

        // Find reachable adjacent squares to monster
        const adjOffsets = [
          { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
          { dx: 1, dz: 1 }, { dx: -1, dz: 1 }, { dx: 1, dz: -1 }, { dx: -1, dz: -1 }
        ];

        let bestSquare: Position | null = null;
        let minSqDist = 999;
        const dropGX = Math.floor(lastPointerPosRef.current.x);
        const dropGZ = Math.floor(lastPointerPosRef.current.z);

        for (const offset of adjOffsets) {
          const adjGX = mGX + offset.dx;
          const adjGZ = mGZ + offset.dz;
          const tX = Math.floor(adjGX / 4);
          const tZ = Math.floor(adjGZ / 4);
          const sX = ((adjGX % 4) + 4) % 4;
          const sZ = ((adjGZ % 4) + 4) % 4;
          const tile = gs.tiles.find(t => t.x === tX && t.z === tZ && t.isRevealed);
          if (!tile) continue;

          const key = `${tile.id}:${sX}:${sZ}`;
          if (reachableSet.has(key)) {
            const dist = Math.hypot(adjGX - dropGX, adjGZ - dropGZ);
            if (dist < minSqDist) {
              minSqDist = dist;
              bestSquare = { x: tX, z: tZ, sqX: sX, sqZ: sZ };
            }
          }
        }

        if (bestSquare) {
          playHapticProfile('rollDice');
          handleMoveHero(bestSquare);
          handleAttackMonster(monster.id);
          setInteractionMode('none');
          return;
        } else {
          playHapticProfile('error');
          addNotification(`${monster.name} is out of movement reach!`, 'warning');
          targetPos.current.set(worldX, 0, worldZ);
          setInteractionMode('none');
          return;
        }
      }
    }

    // 2. Reachable Square Check
    const dropCandidate = currentHoverRef.current.square || hoveredSquare;
    let chosenSquare: Position | null = null;

    if (dropCandidate) {
      const destTile = gs.tiles.find(t => t.x === dropCandidate.x && t.z === dropCandidate.z);
      const targetKey = destTile ? `${destTile.id}:${dropCandidate.sqX}:${dropCandidate.sqZ}` : '';
      if (destTile && reachableSet.has(targetKey)) {
        chosenSquare = dropCandidate;
      }
    }

    // Forgiving snap radius: if not directly on a legal square, check nearest reachable square within 0.85 units
    if (!chosenSquare && reachableSet.size > 0) {
      const dropWorldX = lastPointerPosRef.current.x;
      const dropWorldZ = lastPointerPosRef.current.z;
      let minDistance = 0.85;

      for (const key of reachableSet) {
        const [tId, sXStr, sZStr] = key.split(':');
        const sX = parseInt(sXStr, 10);
        const sZ = parseInt(sZStr, 10);
        const tile = gs.tiles.find(t => t.id === tId);
        if (!tile) continue;

        const sqWldX = tile.x * 4 + sX + 0.5;
        const sqWldZ = tile.z * 4 + sZ + 0.5;
        const dist = Math.hypot(dropWorldX - sqWldX, dropWorldZ - sqWldZ);
        if (dist < minDistance) {
          minDistance = dist;
          chosenSquare = { x: tile.x, z: tile.z, sqX: sX, sqZ: sZ };
        }
      }
    }

    if (chosenSquare) {
      // Legal Square: Snap and Move
      playHapticProfile('click');
      handleMoveHero(chosenSquare);
      setInteractionMode('none');
    } else {
      // Illegal Square: snap back to start
      playHapticProfile('error');
      addNotification('Cannot place hero on an illegal square — returned to start.', 'warning');
      targetPos.current.set(worldX, 0, worldZ);
      setInteractionMode('none');
    }
  }, [isDragging, hoveredSquare, hoveredMonsterId, reachableSet, worldX, worldZ,
      handleAttackMonster, handleMoveHero, setInteractionMode, setHoveredTargetEntityId, addNotification, hero]);

  // Desktop Mouse Drag initiation
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isActive) return;
    if (e.nativeEvent && 'button' in e.nativeEvent && e.nativeEvent.button !== 0) return;

    e.stopPropagation();
    handleGrabStart(e);
    isPointerDraggingRef.current = true;

    const onPointerUp = () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      isPointerDraggingRef.current = false;
      handleGrabEnd();
    };

    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [isActive, handleGrabStart, handleGrabEnd]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (isPendingApproval) {
      e.stopPropagation();
      approveAITurn();
      return;
    }
    if (interactionMode === 'ability' && selectedPowerId) {
      e.stopPropagation();
      useGameStore.getState().usePower(selectedPowerId, hero.id);
      setInteractionMode('none');
      setSelectedPowerId(null);
    }
  }, [isPendingApproval, approveAITurn, interactionMode, selectedPowerId, hero.id, setInteractionMode, setSelectedPowerId]);

  const handleVRSelect = useCallback((e: any) => {
    if (isPendingApproval) {
      approveAITurn();
      return;
    }
    handleGrabStart(e);
  }, [isPendingApproval, approveAITurn, handleGrabStart]);

  return (
    <Interactive
      onSelect={handleVRSelect}
      onSelectEnd={handleGrabEnd}
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
          {/* ── Active Hero Rotating Pedestal Aura Ring ─────────────────────── */}
          {isActive && (
            <group position={[0, 0.015, 0]}>
              <mesh ref={auraRingRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.42, 0.62, 32]} />
                <meshBasicMaterial 
                  color={hoveredMonster ? '#ff1744' : (isDragging ? '#00ff88' : '#f5dfa3')} 
                  transparent 
                  opacity={isDragging ? 0.95 : 0.85} 
                  side={THREE.DoubleSide} 
                />
              </mesh>
              {isDragging && (
                <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.55, 32]} />
                  <meshBasicMaterial color={hoveredMonster ? '#ff1744' : '#00ff88'} transparent opacity={0.3} />
                </mesh>
              )}
            </group>
          )}

          {/* ── Active Hero Ascending Light Pillar Beacon ───────────────────── */}
          {isActive && (
            <mesh ref={lightPillarRef} position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.35, 0.45, 1.8, 24, 1, true]} />
              <meshBasicMaterial
                color={hoveredMonster ? '#ff2244' : '#ffd700'}
                transparent
                opacity={isDragging ? 0.30 : 0.16}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}

          {isLegalTarget && (
            <group position={[0, 0.012, 0]}>
              <mesh ref={legalRingRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.45, 0.55, 16]} />
                <meshBasicMaterial color="#ffbb00" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            </group>
          )}

          {/* Miniature Base Pedestal with Radiant Gold Highlight when Active */}
          <Cylinder args={[0.4, 0.4, 0.05, 24]} position={[0, 0.025, 0]}>
            <meshStandardMaterial 
              color={isActive ? '#c5a059' : (isSelected || isDragging ? outlineColor : '#222222')} 
              emissive={isActive ? (hoveredMonster ? '#ff1744' : (isDragging ? '#00ff88' : '#a08040')) : '#000000'}
              emissiveIntensity={isActive ? (isDragging ? 0.85 : 0.4) : 0}
              metalness={isActive ? 0.8 : 0.1}
              roughness={0.3}
            />
          </Cylinder>

          {/* Health Status Orb */}
          <Sphere args={[0.08]} position={[0.3, 0.1, 0]}>
            <meshStandardMaterial 
              color={orbColor} 
              emissive={orbColor}
              emissiveIntensity={0.5 + hpRatio * 1.5}
            />
          </Sphere>
   
          {/* Diegetic Billboard Stats & Active Turn Indicator */}
          <Billboard position={[0, 1.45, 0]}>
            {/* Active Turn Guidance / AI Approval Banner */}
            {(isActive || isPendingApproval) && (
              <group position={[0, 0.42, 0]}>
                <mesh>
                  <boxGeometry args={[2.0, 0.22, 0.02]} />
                  <meshStandardMaterial 
                    color="#20150b" 
                    emissive={isPendingApproval ? '#00e676' : (hoveredMonster ? '#ff1744' : (isDragging ? '#00e5ff' : '#d4af37'))} 
                    emissiveIntensity={isPendingApproval ? 0.95 : (isDragging ? 0.85 : 0.5)} 
                    roughness={0.4}
                    metalness={0.7}
                  />
                </mesh>
                <mesh position={[0, 0, 0.011]}>
                  <boxGeometry args={[1.96, 0.18, 0.002]} />
                  <meshStandardMaterial color={isPendingApproval ? '#00ff88' : (hoveredMonster ? '#ffd700' : (isDragging ? '#00ffff' : '#f5dfa3'))} roughness={0.4} metalness={0.5} />
                </mesh>
                <Text
                  position={[0, 0.035, 0.02]}
                  fontSize={0.082}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                  letterSpacing={0.04}
                  fontWeight="bold"
                >
                  {isPendingApproval
                    ? '🤖 AI TURN COMPLETE — CLICK TO APPROVE 🤖'
                    : hoveredMonster 
                      ? `⚔ DROP TO ATTACK ${hoveredMonster.name.toUpperCase()} ⚔` 
                      : (isDragging ? '⚡ DRAG TO MOVE OR ATTACK ⚡' : '⭐ ACTIVE HERO — YOUR TURN ⭐')}
                </Text>
                <Text
                  position={[0, -0.045, 0.02]}
                  fontSize={0.052}
                  color={isPendingApproval ? '#55ffaa' : (hoveredMonster ? '#ffd700' : '#f5dfa3')}
                  anchorX="center"
                  anchorY="middle"
                >
                  {isPendingApproval
                    ? 'Click hero piece or press [Space] to advance to Villain Phase'
                    : hoveredMonster 
                      ? `D20 vs AC ${hoveredMonster.ac} • Deals ${hero.damage ?? 1} Damage` 
                      : (isDragging 
                        ? 'Drop on legal square to Move • Drop on Monster to Attack' 
                        : 'Grab piece to Move • Attack or Play Card')}
                </Text>
              </group>
            )}

            {/* Hero Name */}
            <Text
              position={[0, 0.22, 0]}
              fontSize={0.14}
              color={isActive ? '#ffd700' : '#4fc3f7'}
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
              <planeGeometry args={[hpRatio * 0.6, 0.05]} />
              <meshBasicMaterial color={hpBarColor} />
            </mesh>
   
            {/* Active Conditions Display */}
            {hero.conditions.length > 0 && (
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
