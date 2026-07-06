import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import { createD20Geometry, createD20Material, getQuaternionForNumber } from './D20Geometry';
import { useDiceStore } from '../../store/diceStore';
import { useGameStore } from '../../store/gameStore';
import { DiceDismissEffect } from './DiceDismissEffect';

const DIE_RADIUS = 0.35;
const GRAVITY = 9.8;

export const Dice3D: React.FC = () => {
  const phase = useDiceStore(s => s.phase);
  const result = useDiceStore(s => s.result);
  const diceColor = useDiceStore(s => s.diceColor);
  const physicsProfile = useDiceStore(s => s.physicsProfile);
  const settleResult = useDiceStore(s => s.settleResult);

  const activeHeroPos = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs) return null;
    const hero = gs.heroes.find(h => h.id === gs.currentHeroId);
    return hero ? hero.position : null;
  });

  const arenaPosition = useMemo((): [number, number, number] => {
    if (!activeHeroPos) return [0, 0, -6];
    const worldX = activeHeroPos.x * 4 + activeHeroPos.sqX + 0.5;
    const worldZ = activeHeroPos.z * 4 + activeHeroPos.sqZ + 0.5;
    // Offset the dice drop slightly towards the camera/side (+1.0 in X and Z)
    // so it is visible and does not drop directly on top of the hero miniature.
    return [worldX + 1.0, 0.1, worldZ + 1.0];
  }, [activeHeroPos]);

  // We only render the physical die when rolling, settling, or showing result
  const shouldRenderPhysical = phase === 'rolling' || phase === 'settling' || phase === 'showing_result';
  const shouldRenderDismiss = phase === 'dismissing';

  return (
    <group renderOrder={10}>
      {shouldRenderPhysical && (
        <PhysicalDie 
          color={diceColor}
          physics={physicsProfile}
          targetResult={result}
          onSettled={settleResult}
          arenaPosition={arenaPosition}
        />
      )}
      {shouldRenderDismiss && (
        <group position={arenaPosition}>
          <DiceDismissEffect />
        </group>
      )}
    </group>
  );
};

interface PhysicalDieProps {
  color: string;
  physics: { mass: number; friction: number; restitution: number; impulseMultiplier: number; dropHeight: number };
  targetResult: number | null;
  onSettled: () => void;
  arenaPosition: [number, number, number];
}

const PhysicalDie: React.FC<PhysicalDieProps> = ({ color, physics, targetResult, onSettled, arenaPosition }) => {
  const { geometry } = useMemo(() => createD20Geometry(), []);
  const material = useMemo(() => createD20Material(color), [color]);

  // Track state
  const [isSettled, setIsSettled] = useState(false);
  const settledRef = useRef(false);
  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const angularVelocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const settledFrames = useRef(0);
  const ageRef = useRef(0);

  // Physics body — uses sphere shape for simplicity but needs high damping
  // to compensate for the lack of rolling resistance on a flat plane
  const [ref, api] = useSphere(() => ({
    mass: physics.mass,
    args: [DIE_RADIUS],
    position: [arenaPosition[0], physics.dropHeight + DIE_RADIUS, arenaPosition[2]],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    material: { friction: physics.friction, restitution: Math.min(physics.restitution, 0.2) },
    linearDamping: physics.friction, // Use Cannon's native linear damping
    angularDamping: Math.min(0.9, physics.friction * 1.5), // Use Cannon's native angular damping
    allowSleep: true,
  }));

  // Calculate initial drop velocity from dropHeight
  const initialDropVelocity = useMemo(() => Math.sqrt(2 * GRAVITY * physics.dropHeight), [physics.dropHeight]);

  // Setup initial impulse — stronger for faster, more energetic rolls
  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const baseImpulse = 4 * physics.impulseMultiplier;
    const speed = baseImpulse;
    api.applyImpulse([Math.cos(angle) * speed, initialDropVelocity, Math.sin(angle) * speed], [0, 0, 0]);
    
    const spin = 15 * physics.impulseMultiplier;
    api.angularVelocity.set(
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin
    );
  }, [api, physics.impulseMultiplier, initialDropVelocity]);

  // Safety timeout — force settlement after physics-based settle duration
  useEffect(() => {
    const settleMs = 400 + physics.mass * 200; // Derived from mass
    const timer = setTimeout(() => {
      if (!settledRef.current) {
        if (targetResult !== null && ref.current) {
          const q = getQuaternionForNumber(targetResult);
          api.quaternion.set(q.x, q.y, q.z, q.w);
          api.velocity.set(0, 0, 0);
          api.angularVelocity.set(0, 0, 0);
        }
        onSettled();
      }
    }, settleMs);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track velocity - subscribe returns [number, number, number] tuples from cannon-es
  useEffect(() => {
    const unsubV = api.velocity.subscribe((v: [number, number, number]) => (velocityRef.current = v));
    const unsubW = api.angularVelocity.subscribe((w: [number, number, number]) => (angularVelocityRef.current = w));
    return () => {
      unsubV();
      unsubW();
    };
  }, [api]);

  // Settlement detection
  useFrame((state, delta) => {
    if (isSettled) return;

    // Track elapsed time to prevent premature settlement in the first few frames
    ageRef.current += delta;
    if (ageRef.current < 0.2) return;

    const v = velocityRef.current;
    const w = angularVelocityRef.current;
    
    const speedSq = v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
    const spinSq = w[0]*w[0] + w[1]*w[1] + w[2]*w[2];

    // If moving very slowly
    if (speedSq < 0.01 && spinSq < 0.01) {
      settledFrames.current++;
      
      // Quick confirmation — 5 frames (~0.08s at 60fps)
      if (settledFrames.current > 5) {
        setIsSettled(true);
        settledRef.current = true;
        
        // Ensure it shows the target result by forcing rotation
        if (targetResult !== null && ref.current) {
          const q = getQuaternionForNumber(targetResult);
          api.quaternion.set(q.x, q.y, q.z, q.w);
          api.velocity.set(0, 0, 0);
          api.angularVelocity.set(0, 0, 0);
          
          // Little hop to emphasize the result
          api.applyImpulse([0, 0.5 * physics.mass, 0], [0, 0, 0]);
        }
        
        onSettled();
      }
    } else {
      settledFrames.current = 0;
    }
  });

  return (
    <mesh ref={ref as any} geometry={geometry} material={material} castShadow receiveShadow />
  );
};