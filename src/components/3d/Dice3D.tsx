import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import { createD20Geometry, createD20Material, getQuaternionForNumber } from './D20Geometry';
import { useDiceStore } from '../../store/diceStore';
import { DiceDismissEffect } from './DiceDismissEffect';

export const Dice3D: React.FC = () => {
  const phase = useDiceStore(s => s.phase);
  const result = useDiceStore(s => s.result);
  const diceColor = useDiceStore(s => s.diceColor);
  const physicsProfile = useDiceStore(s => s.physicsProfile);
  const worldPosition = useDiceStore(s => s.worldPosition);
  const settleResult = useDiceStore(s => s.settleResult);

  // We only render the physical die when rolling, settling, or showing result
  const shouldRenderPhysical = phase === 'rolling' || phase === 'settling' || phase === 'showing_result';
  const shouldRenderDismiss = phase === 'dismissing';

  if (!shouldRenderPhysical && !shouldRenderDismiss) {
    return null;
  }

  return (
    <group position={worldPosition}>
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
  // Generate d20 visual geometry and material
  const { geometry } = useMemo(() => createD20Geometry(), []);
  const material = useMemo(() => createD20Material(color), [color]);

  // Use a sphere for physics (simpler than convex polyhedron, works identically for rolling)
  const DIE_RADIUS = 0.35;

  // Track state
  const [isSettled, setIsSettled] = useState(false);
  const settledRef = useRef(false);
  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const angularVelocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const settledFrames = useRef(0);

  // Physics body
  const [ref, api] = useSphere(() => ({
    mass: physics.mass,
    args: [DIE_RADIUS],
    position: [0, physics.dropHeight, 0],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    material: { friction: physics.friction, restitution: physics.restitution },
    allowSleep: true,
  }));

  // Setup initial impulse
  useEffect(() => {
    // Random direction and spin
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 * physics.impulseMultiplier;
    api.applyImpulse([Math.cos(angle) * speed, 2 * physics.impulseMultiplier, Math.sin(angle) * speed], [0, 0, 0]);
    
    const spin = 10 * physics.impulseMultiplier;
    api.angularVelocity.set(
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin
    );
  }, [api, physics.impulseMultiplier]);

  // Safety timeout — force settlement after 10s if physics never settles
  useEffect(() => {
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
    }, 10000);
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
  useFrame(() => {
    if (isSettled) return;

    const v = velocityRef.current;
    const w = angularVelocityRef.current;
    
    const speedSq = v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
    const spinSq = w[0]*w[0] + w[1]*w[1] + w[2]*w[2];

    // If moving very slowly
    if (speedSq < 0.01 && spinSq < 0.01) {
      settledFrames.current++;
      
      // Wait for it to be still for ~0.5s (30 frames at 60fps)
      if (settledFrames.current > 30) {
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
