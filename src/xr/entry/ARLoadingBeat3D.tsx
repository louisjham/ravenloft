import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR, Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '../../store/uiStore';
import { getCastleSilhouetteTexture, getTarokkaCardTexture, TarokkaMotif } from './AREntryMotifs';
import { playHapticProfile } from '../XRHaptics';

interface TarokkaDisplayCardProps {
  motif: TarokkaMotif;
  position: [number, number, number];
  rotation: [number, number, number];
  delay: number;
}

const TarokkaDisplayCard: React.FC<TarokkaDisplayCardProps> = ({ motif, position, rotation, delay }) => {
  const meshRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => getTarokkaCardTexture(motif), [motif]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() + delay;
    // Gentle bobbing and yaw sway
    meshRef.current.position.y = position[1] + Math.sin(t * 1.8) * 0.025;
    meshRef.current.rotation.y = rotation[1] + Math.sin(t * 1.2) * 0.08;
    meshRef.current.rotation.z = rotation[2] + Math.cos(t * 1.4) * 0.04;
  });

  return (
    <group ref={meshRef} position={position} rotation={rotation} scale={0.88}>
      {/* Front Face with Tarokka Motif Texture */}
      <mesh castShadow receiveShadow>
        <planeGeometry args={[0.22, 0.33]} />
        <meshBasicMaterial map={texture} transparent opacity={0.92} depthWrite={false} />
      </mesh>

      {/* Back Face in dark obsidian */}
      <mesh position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.22, 0.33]} />
        <meshStandardMaterial color="#0c0714" roughness={0.7} />
      </mesh>

      {/* Outer Ethereal Shimmer Frame (Clean rectangular loop, zero diagonal X lines) */}
      <lineLoop position={[0, 0, 0.002]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                -0.11, -0.165, 0,
                 0.11, -0.165, 0,
                 0.11,  0.165, 0,
                -0.11,  0.165, 0,
              ]),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f0d070" transparent opacity={0.65} />
      </lineLoop>
    </group>
  );
};

/**
 * Drifting gothic mist motes that billow during the loading beat.
 */
const AtmosphericLoadingMist: React.FC = () => {
  const count = 120;
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 4.0;
      pos[i * 3 + 1] = Math.random() * 2.2 - 0.2;
      pos[i * 3 + 2] = -Math.random() * 2.5 - 0.3;

      vel.push({
        x: (Math.random() - 0.5) * 0.25,
        y: (Math.random() - 0.5) * 0.08,
        z: (Math.random() - 0.5) * 0.20,
      });
    }
    return [pos, vel];
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    if (!posAttr) return;

    for (let i = 0; i < count; i++) {
      let x = posAttr.getX(i) + velocities[i].x * delta;
      let y = posAttr.getY(i) + velocities[i].y * delta;
      let z = posAttr.getZ(i) + velocities[i].z * delta;

      if (Math.abs(x) > 2.2) velocities[i].x = -velocities[i].x;
      if (y < -0.3 || y > 2.5) velocities[i].y = -velocities[i].y;
      if (z < -3.0 || z > -0.2) velocities[i].z = -velocities[i].z;

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#d8b4e2"
        size={0.16}
        transparent
        opacity={0.45}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/**
 * ARLoadingBeat3D presents the opening cinematic beat when cold-entering AR:
 * - Backlit Castle Ravenloft silhouette
 * - 3 revolving Tarokka cards with evocative symbols
 * - Billowing gothic mist motes
 * - Atmospheric narrative subtitle
 * Automatically advances to 'transitioning' after 2.4 seconds, or instantly upon tap.
 */
export const ARLoadingBeat3D: React.FC = () => {
  const { isPresenting } = useXR();
  const arEntryStage = useUIStore((state) => state.arEntryStage);
  const setAREntryStage = useUIStore((state) => state.setAREntryStage);

  const groupRef = useRef<THREE.Group>(null);
  const castleTex = useMemo(() => getCastleSilhouetteTexture(), []);
  const startTimeRef = useRef<number>(Date.now());

  // Advance to transition after 2.5 seconds
  useEffect(() => {
    if (arEntryStage !== 'loading') return;
    startTimeRef.current = Date.now();
    const timer = setTimeout(() => {
      playHapticProfile('hover');
      setAREntryStage('transitioning');
    }, 2500);

    return () => clearTimeout(timer);
  }, [arEntryStage, setAREntryStage]);

  const handleSkip = () => {
    playHapticProfile('click');
    setAREntryStage('transitioning');
  };

  useFrame((state) => {
    if (!groupRef.current || arEntryStage !== 'loading') return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    // Smooth fade in over first 0.6 seconds
    const fadeIn = Math.min(1, elapsed / 0.6);
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.92, 1.0, fadeIn));
  });

  if (!isPresenting || arEntryStage !== 'loading') {
    return null;
  }

  return (
    <Interactive onSelect={handleSkip}>
      <group ref={groupRef} onClick={handleSkip}>
        {/* Swirling volumetric mist clouds */}
        <AtmosphericLoadingMist />

        {/* Castle Ravenloft Moonlit Silhouette Backdrop */}
        <mesh position={[0, 0.42, -2.1]}>
          <planeGeometry args={[2.8, 1.4]} />
          <meshBasicMaterial map={castleTex} transparent opacity={0.88} depthWrite={false} />
        </mesh>

        {/* Top Gothic Header */}
        <group position={[0, 0.72, -1.4]}>
          <Text
            fontSize={0.065}
            color="#f5dfa3"
            textAlign="center"
            letterSpacing={0.08}
            anchorX="center"
            anchorY="middle"
          >
            CASTLE RAVENLOFT
          </Text>
          <Text
            position={[0, -0.055, 0]}
            fontSize={0.024}
            color="#c0b0d0"
            textAlign="center"
            letterSpacing={0.04}
            anchorX="center"
            anchorY="middle"
          >
            The mists of Barovia gather around you...
          </Text>
        </group>

        {/* Tarokka Card Flicker Arc (3 archetypal cards) */}
        <group position={[0, 0.08, 0]}>
          <TarokkaDisplayCard
            motif="mist"
            position={[-0.32, 0, -1.25]}
            rotation={[0, Math.PI / 12, -0.04]}
            delay={0.2}
          />
          <TarokkaDisplayCard
            motif="raven"
            position={[0, 0.04, -1.18]}
            rotation={[0, 0, 0]}
            delay={0.7}
          />
          <TarokkaDisplayCard
            motif="artifact"
            position={[0.32, 0, -1.25]}
            rotation={[0, -Math.PI / 12, 0.04]}
            delay={1.2}
          />
        </group>

        {/* Bottom Direction Prompt */}
        <group position={[0, -0.24, -1.2]}>
          <Text
            fontSize={0.02}
            color="#a090b0"
            textAlign="center"
            letterSpacing={0.06}
            anchorX="center"
            anchorY="middle"
          >
            Crossing beyond the veil into Augmented Reality...
          </Text>
          <Text
            position={[0, -0.035, 0]}
            fontSize={0.014}
            color="#685578"
            textAlign="center"
            letterSpacing={0.03}
            anchorX="center"
            anchorY="middle"
          >
            [Tap or pinch anywhere to proceed]
          </Text>
        </group>
      </group>
    </Interactive>
  );
};

export default ARLoadingBeat3D;
