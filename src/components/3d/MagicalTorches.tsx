import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PointLight } from 'three';
import { useGameStore } from '../../store/gameStore';

const TILE_SIZE = 4;

type Vec3 = [number, number, number];

interface MagicalTorchesProps {
  edge: 'north' | 'south' | 'east' | 'west';
}

/**
 * TorchFixture renders a lightweight 3D representation of a wall-mounted torch.
 * Constructed from box, cylinder, and cone primitives.
 */
const TorchFixture: React.FC<{ 
  position: [number, number, number]; 
  color: string;
  edge: 'north' | 'south' | 'east' | 'west';
}> = ({ position, color, edge }) => {
  const rotY = useMemo(() => {
    switch (edge) {
      case 'north': return 0;
      case 'south': return Math.PI;
      case 'east':  return -Math.PI / 2;
      case 'west':  return Math.PI / 2;
      default:      return 0;
    }
  }, [edge]);

  // Height of the torch bulb above the tile plane
  const torchHeight = position[1];

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Wall bracket (dark metal plate mounted to wall surface) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.03]} />
        <meshStandardMaterial color="#2d2d30" roughness={0.7} metalness={0.8} />
      </mesh>
      
      {/* Standing iron post (grounds the bracket down to the low stone curb) */}
      <mesh position={[0, -torchHeight / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.02, torchHeight, 5]} />
        <meshStandardMaterial color="#202025" roughness={0.7} metalness={0.9} />
      </mesh>
      
      {/* Torch handle (slanted cylinder protruding outward) */}
      <mesh position={[0, 0.08, 0.05]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.015, 0.2, 6]} />
        <meshStandardMaterial color="#404044" roughness={0.6} metalness={0.9} />
      </mesh>
      
      {/* Torch cup/holder */}
      <mesh position={[0, 0.18, 0.08]}>
        <cylinderGeometry args={[0.04, 0.02, 0.06, 6]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.5} metalness={0.9} />
      </mesh>

      {/* Flame (glowing cone) */}
      <mesh position={[0, 0.23, 0.08]}>
        <coneGeometry args={[0.03, 0.09, 5]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

export const MagicalTorches: React.FC<MagicalTorchesProps> = ({ edge }) => {
  const graphicsQuality = useGameStore((state) => state.settings?.graphicsQuality ?? 'high');
  const redLightRef = useRef<PointLight>(null);
  const purpleLightRef = useRef<PointLight>(null);
  const yellowLightRef = useRef<PointLight>(null);

  // Unique strobe phase per instance
  const phases = useMemo(() => ({
    red: Math.random() * Math.PI * 2,
    purple: Math.random() * Math.PI * 2,
    yellow: Math.random() * Math.PI * 2,
  }), []);

  const lightPositions = useMemo(() => {
    const half = TILE_SIZE / 2;
    const base: Vec3 = (() => {
      switch (edge) {
        case 'north': return [half, 0, 0];
        case 'south': return [half, 0, TILE_SIZE];
        case 'east':  return [TILE_SIZE, 0, half];
        case 'west':  return [0, 0, half];
        default:      return [half, 0, 0];
      }
    })();
    return {
      red:    [base[0] - 1, base[1] + 1.5, base[2]] as Vec3,
      purple: [base[0],     base[1] + 1.8, base[2]] as Vec3,
      yellow: [base[0] + 1, base[1] + 1.5, base[2]] as Vec3,
    };
  }, [edge]);

  useFrame((state) => {
    if (graphicsQuality === 'low') return;

    const time = state.clock.elapsedTime;

    const flicker = (phase: number, speedMult: number) => {
      const slow  = Math.sin(time * 2  * speedMult + phase);
      const fast  = Math.sin(time * 7  * speedMult + phase * 2);
      const micro = Math.sin(time * 15 * speedMult + phase * 3.7);
      return 1.2 + slow * 0.15 + fast * 0.1 + micro * 0.05;
    };

    const colorBreath = (phase: number, speedMult: number) =>
      0.85 + 0.15 * Math.sin(time * 1.5 * speedMult + phase);

    if (graphicsQuality === 'medium') {
      if (purpleLightRef.current) {
        const f = flicker(phases.purple, 1.0);
        purpleLightRef.current.intensity = f * 1.2;
      }
      return;
    }

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

  if (graphicsQuality === 'low') {
    return null;
  }

  if (graphicsQuality === 'medium') {
    return (
      <>
        <pointLight 
          ref={purpleLightRef} 
          position={lightPositions.purple} 
          color="#ffaa44" 
          distance={4.0} 
          castShadow={false} 
        />
        <TorchFixture position={lightPositions.purple} color="#ffaa00" edge={edge} />
      </>
    );
  }

  return (
    <>
      <pointLight ref={redLightRef} position={lightPositions.red} color="#ff2222" distance={2.5} castShadow={false} />
      <pointLight ref={purpleLightRef} position={lightPositions.purple} color="#aa22ff" distance={2.5} castShadow={false} />
      <pointLight ref={yellowLightRef} position={lightPositions.yellow} color="#ffdd22" distance={2.5} castShadow={false} />

      <TorchFixture position={lightPositions.red} color="#ff4400" edge={edge} />
      <TorchFixture position={lightPositions.purple} color="#cc33ff" edge={edge} />
      <TorchFixture position={lightPositions.yellow} color="#ffaa00" edge={edge} />
    </>
  );
};
