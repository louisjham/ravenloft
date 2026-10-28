import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '../../store/uiStore';
import { playHapticProfile } from '../XRHaptics';

interface ARTransitionMist3DProps {
  onProgress?: (progress: number) => void;
}

/**
 * ARTransitionMist3D eases the real-world passthrough view into the virtual game.
 * Uses billowing expanding mist rings and an ethereal assembly aura that rises from
 * below the tabletop, making the table and board materialize into the room rather
 * than popping in abruptly.
 */
export const ARTransitionMist3D: React.FC<ARTransitionMist3DProps> = ({ onProgress }) => {
  const { isPresenting } = useXR();
  const arEntryStage = useUIStore((state) => state.arEntryStage);
  const setAREntryStage = useUIStore((state) => state.setAREntryStage);

  const ringRef = useRef<THREE.Mesh>(null);
  const mistPointsRef = useRef<THREE.Points>(null);
  const textRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number>(Date.now());
  const DURATION_MS = 1800; // 1.8s transition beat

  // Generate expanding mist particles
  const count = 160;
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.1 + Math.random() * 0.4;
      pos[i * 3]     = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.random() * 0.2 - 0.1;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      // Radial expansion velocity
      const speed = 0.4 + Math.random() * 0.6;
      vel.push({
        x: Math.cos(angle) * speed,
        y: (Math.random() - 0.5) * 0.1,
        z: Math.sin(angle) * speed,
      });
    }
    return [pos, vel];
  }, []);

  useEffect(() => {
    if (arEntryStage !== 'transitioning') return;
    startTimeRef.current = Date.now();
    const timer = setTimeout(() => {
      playHapticProfile('hover');
      setAREntryStage('guidance');
    }, DURATION_MS);

    return () => clearTimeout(timer);
  }, [arEntryStage, setAREntryStage]);

  useFrame((_, delta) => {
    if (arEntryStage !== 'transitioning') return;

    const elapsed = Date.now() - startTimeRef.current;
    const t = Math.min(1, Math.max(0, elapsed / DURATION_MS));

    // Smooth cubic ease-out
    const easeProgress = 1 - Math.pow(1 - t, 3);
    if (onProgress) {
      onProgress(easeProgress);
    }

    // Expand tabletop assembly ring
    if (ringRef.current) {
      const ringScale = 0.2 + easeProgress * 1.8;
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        // Fade out ring in the final 30% of transition
        mat.opacity = t < 0.7 ? 0.75 : (1 - (t - 0.7) / 0.3) * 0.75;
      }
    }

    // Expand and dissipate mist motes outward
    if (mistPointsRef.current) {
      const geo = mistPointsRef.current.geometry;
      const posAttr = geo.attributes.position;
      if (posAttr) {
        for (let i = 0; i < count; i++) {
          let x = posAttr.getX(i) + velocities[i].x * delta * (1.2 - easeProgress * 0.4);
          let y = posAttr.getY(i) + velocities[i].y * delta;
          let z = posAttr.getZ(i) + velocities[i].z * delta * (1.2 - easeProgress * 0.4);
          posAttr.setXYZ(i, x, y, z);
        }
        posAttr.needsUpdate = true;
      }
      const pMat = mistPointsRef.current.material as THREE.PointsMaterial;
      if (pMat) {
        pMat.opacity = Math.max(0, (1 - easeProgress) * 0.55);
      }
    }

    // Text banner gently fades as table reveals
    if (textRef.current) {
      textRef.current.position.y = 0.55 + easeProgress * 0.08;
    }
  });

  if (!isPresenting || arEntryStage !== 'transitioning') {
    return null;
  }

  return (
    <group position={[0, 0.02, 0]}>
      {/* Expanding Gothic Tabletop Assembly Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.45, 0.49, 32]} />
        <meshBasicMaterial color="#c5a059" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* Billowing outward mist wave */}
      <points ref={mistPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#cfb0e8"
          size={0.14}
          transparent
          opacity={0.55}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Narrative Transition Title */}
      <group ref={textRef} position={[0, 0.55, -0.2]}>
        <Text
          fontSize={0.038}
          color="#f5dfa3"
          textAlign="center"
          letterSpacing={0.06}
          anchorX="center"
          anchorY="middle"
        >
          THE MISTS PART...
        </Text>
        <Text
          position={[0, -0.045, 0]}
          fontSize={0.018}
          color="#a090b0"
          textAlign="center"
          letterSpacing={0.03}
          anchorX="center"
          anchorY="middle"
        >
          Assembling the realm of Ravenloft upon your table
        </Text>
      </group>
    </group>
  );
};

export default ARTransitionMist3D;
