import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDiceStore } from '../../store/diceStore';

const ARENA_POSITION: [number, number, number] = [0, 0.1, -6];

export const DiceArena: React.FC = () => {
  const phase = useDiceStore(s => s.phase);
  const diceColor = useDiceStore(s => s.diceColor);
  
  const isActive = phase !== 'idle' && phase !== 'dismissing';

  const trayGeometry = useMemo(() => new THREE.BoxGeometry(2.5, 0.15, 2.5), []);
  const trayMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a0f2e',
    metalness: 0.3,
    roughness: 0.7,
    transparent: true,
    opacity: isActive ? 0.9 : 0.3,
  }), [isActive]);

  const rimGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.25, -1.25);
    shape.lineTo(1.25, -1.25);
    shape.lineTo(1.25, -1.05);
    shape.lineTo(-1.25, -1.05);
    shape.lineTo(-1.25, -1.25);
    
    const extrudeSettings = { depth: 0.15, bevelEnabled: false };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);
  
  const rimMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: diceColor,
    metalness: 0.8,
    roughness: 0.2,
    emissive: new THREE.Color(diceColor),
    emissiveIntensity: isActive ? 0.5 : 0,
  }), [diceColor, isActive]);

  const glowGeometry = useMemo(() => new THREE.RingGeometry(1.0, 1.3, 32), []);
  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: diceColor,
    transparent: true,
    opacity: isActive ? 0.3 : 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }), [diceColor, isActive]);

  const pulseRef = useRef(0);

  useFrame((_, delta) => {
    if (isActive) {
      pulseRef.current += delta * 3;
      if (glowMaterial) {
        glowMaterial.opacity = 0.15 + Math.sin(pulseRef.current) * 0.15;
      }
      if (rimMaterial) {
        rimMaterial.emissiveIntensity = 0.3 + Math.sin(pulseRef.current * 2) * 0.2;
      }
    }
  });

  if (!isActive && phase === 'idle') return null;

  return (
    <group position={ARENA_POSITION} renderOrder={10}>
      <mesh
        geometry={trayGeometry}
        material={trayMaterial}
        receiveShadow
        position={[0, -0.075, 0]}
      />
      <mesh
        geometry={rimGeometry}
        material={rimMaterial}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={rimGeometry}
        material={rimMaterial}
        position={[0, 0, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={rimGeometry}
        material={rimMaterial}
        position={[0, 0, 1.25]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={rimGeometry}
        material={rimMaterial}
        position={[0, 0, -1.25]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={rimGeometry}
        material={rimMaterial}
        position={[1.25, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      />
      <mesh
        geometry={rimGeometry}
        material={rimMaterial}
        position={[-1.25, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      />
      <mesh
        geometry={glowGeometry}
        material={glowMaterial}
        position={[0, 0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  );
};