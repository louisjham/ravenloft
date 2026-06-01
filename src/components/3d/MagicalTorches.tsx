import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PointLight } from 'three';

const TILE_SIZE = 4;

type Vec3 = [number, number, number];

interface MagicalTorchesProps {
  edge: 'north' | 'south' | 'east' | 'west';
}

export const MagicalTorches: React.FC<MagicalTorchesProps> = ({ edge }) => {
  const redLightRef = useRef<PointLight>(null);
  const purpleLightRef = useRef<PointLight>(null);
  const yellowLightRef = useRef<PointLight>(null);

  // Use a unique phase per instance to avoid all torches strobing in sync
  const phases = useMemo(() => ({
    red: Math.random() * Math.PI * 2,
    purple: Math.random() * Math.PI * 2,
    yellow: Math.random() * Math.PI * 2,
  }), []);

  const edgePosition = useMemo(() => {
    const half = TILE_SIZE / 2;
    switch (edge) {
      case 'north': return [half, 0, 0] as Vec3;
      case 'south': return [half, 0, TILE_SIZE] as Vec3;
      case 'east':  return [TILE_SIZE, 0, half] as Vec3;
      case 'west':  return [0, 0, half] as Vec3;
      default:      return [half, 0, 0] as Vec3;
    }
  }, [edge]);

  const rotation = useMemo(() => {
    switch (edge) {
      case 'north': return [0, 0, 0] as Vec3;
      case 'south': return [0, Math.PI, 0] as Vec3;
      case 'east':  return [0, -Math.PI / 2, 0] as Vec3;
      case 'west':  return [0, Math.PI / 2, 0] as Vec3;
      default:      return [0, 0, 0] as Vec3;
    }
  }, [edge]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    const flicker = (phase: number, speedMult: number) => {
      const slow  = Math.sin(time * 2  * speedMult + phase);
      const fast  = Math.sin(time * 7  * speedMult + phase * 2);
      const micro = Math.sin(time * 15 * speedMult + phase * 3.7);
      return 1.2 + slow * 0.15 + fast * 0.1 + micro * 0.05;
    };

    const colorBreath = (phase: number, speedMult: number) =>
      0.85 + 0.15 * Math.sin(time * 1.5 * speedMult + phase);

    if (redLightRef.current) {
      const f = flicker(phases.red, 1.0);
      const b = colorBreath(phases.red, 1.0);
      redLightRef.current.intensity = f;
      redLightRef.current.color.setRGB(1.0, 0.13 * b, 0.13 * b);
    }
    if (purpleLightRef.current) {
      const f = flicker(phases.purple, 1.2);
      const b = colorBreath(phases.purple, 1.2);
      purpleLightRef.current.intensity = f;
      purpleLightRef.current.color.setRGB(0.67 * b, 0.13, 1.0);
    }
    if (yellowLightRef.current) {
      const f = flicker(phases.yellow, 0.8);
      const b = colorBreath(phases.yellow, 0.8);
      yellowLightRef.current.intensity = f;
      yellowLightRef.current.color.setRGB(1.0, 0.87 * b, 0.13);
    }
  });

  return (
    <group position={edgePosition} rotation={rotation}>
      {/* 
        Three point lights placed near the wall to simulate magical torches.
        Distances reduced to 2.5 for better light culling.
      */}
      <pointLight ref={redLightRef} position={[-1, 1.5, 0]} color="#ff2222" distance={2.5} castShadow={false} />
      <pointLight ref={purpleLightRef} position={[0, 1.8, 0]} color="#aa22ff" distance={2.5} castShadow={false} />
      <pointLight ref={yellowLightRef} position={[1, 1.5, 0]} color="#ffdd22" distance={2.5} castShadow={false} />
    </group>
  );
};
