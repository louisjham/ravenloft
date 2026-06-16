import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import { createD20Geometry, createD20Material, getQuaternionForNumber } from './D20Geometry';
import { useDiceStore } from '../../store/diceStore';
import { DiceDismissEffect } from './DiceDismissEffect';

const ARENA_POSITION: [number, number, number] = [0, 0, -6];
const DIE_RADIUS = 0.35;
const GRAVITY = 9.8;

export const Dice3D: React.FC = () => {
  const phase = useDiceStore(s => s.phase);
  const result = useDiceStore(s => s.result);
  const diceColor = useDiceStore(s => s.diceColor);
  const physicsProfile = useDiceStore(s => s.physicsProfile);
  const settleResult = useDiceStore(s => s.settleResult);

  // We only render the physical die when rolling, settling, or showing result
  const shouldRenderPhysical = phase === 'rolling' || phase === 'settling' || phase === 'showing_result';
  const shouldRenderDismiss = phase === 'dismissing';

  if (!shouldRenderPhysical && !shouldRenderDismiss) {
    return null;
  }

  return (
    <group position={ARENA_POSITION} renderOrder={10}>
      {shouldRenderPhysical && (
        <PhysicalDie 
          color={diceColor}
          physics={physicsProfile}
          targetResult={result}
          onSettled={settleResult}
        />
      )}
      {shouldRenderDismiss && (
        <DiceDismissEffect />
      )}
    </group>
  );
};

interface PhysicalDieProps {
  color: string;
  physics: { mass: number; friction: number; restitution: number; impulseMultiplier: number; dropHeight: number };
  targetResult: number | null;
  onSettled: () => void;
}

const PhysicalDie: React.FC<PhysicalDieProps> = ({ color, physics, targetResult, onSettled }) => {
  const { geometry } = useMemo(() => createD20Geometry(), []);
  const material = useMemo(() => createD20Material(color), [color]);

  // Track state
  const [isSettled, setIsSettled] = useState(false);
  const settledRef = useRef(false);
  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const angularVelocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const settledFrames = useRef(0);
  const settlingStartTime = useRef(0);
  const initialDropDone = useRef(false);

  // Physics body — uses sphere shape for simplicity but needs high damping
  // to compensate for the lack of rolling resistance on a flat plane
  const [ref, api] = useSphere(() => ({
    mass: physics.mass,
    args: [DIE_RADIUS],
    position: [0, physics.dropHeight + DIE_RADIUS, 0],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    material: { friction: physics.friction, restitution: Math.min(physics.restitution, 0.2) },
    linearDamping: 0, // We handle damping manually for frame-rate independence
    angularDamping: 0, // We handle damping manually for frame-rate independence
    allowSleep: true,
  }));

  // Calculate initial drop velocity from dropHeight
  const initialDropVelocity = useMemo(() => Math.sqrt(2 * GRAVITY * physics.dropHeight), [physics.dropHeight]);

  // Setup initial impulse — stronger for faster, more energetic rolls
  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const baseImpulse = 4 * physics.impulseMultiplier;
    const speed = baseImpulse; // Angular spin = baseImpulse * impulseMultiplier (NOT divided by mass)
    api.applyImpulse([Math.cos(angle) * speed, initialDropVelocity, Math.sin(angle) * speed], [0, 0, 0]);
    
    const spin = 15 * physics.impulseMultiplier; // Base spin * impulseMultiplier (NOT divided by mass)
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

  // Frame-rate independent friction damping and settlement detection
  useFrame((_, delta) => {
    if (isSettled) return;

    const v = velocityRef.current;
    const w = angularVelocityRef.current;
    
    // Apply frame-rate independent friction damping
    // velocity *= Math.pow(1 - friction, dt * 60)
    const frictionFactor = Math.pow(1 - physics.friction, delta * 60);
    const angularFrictionFactor = Math.pow(1 - physics.friction * 1.5, delta * 60);
    
    api.velocity.set(
      v[0] * frictionFactor,
      v[1] * frictionFactor,
      v[2] * frictionFactor
    );
    api.angularVelocity.set(
      w[0] * angularFrictionFactor,
      w[1] * angularFrictionFactor,
      w[2] * angularFrictionFactor
    );

    // Update refs after damping
    const newV = velocityRef.current;
    const newW = angularVelocityRef.current;
    
    const speedSq = newV[0]*newV[0] + newV[1]*newV[1] + newV[2]*newV[2];
    const spinSq = newW[0]*newW[0] + newW[1]*newW[1] + newW[2]*newW[2];

    // If moving very slowly
    if (speedSq < 0.005 && spinSq < 0.005) {
      settledFrames.current++;
      
      // Quick confirmation — 2 frames (~0.03s at 60fps)
      if (settledFrames.current > 2) {
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