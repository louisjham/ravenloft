import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface HangingSkeletonProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

/**
 * Procedural chain link segment.
 */
const ChainSegment: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  links?: number;
}> = ({ start, end, links = 6 }) => {
  const points = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const result: [number, number, number][] = [];
    for (let i = 0; i <= links; i++) {
      const alpha = i / links;
      const pt = s.clone().lerp(e, alpha);
      // Subtle catenary droop
      pt.y -= Math.sin(alpha * Math.PI) * 0.08;
      result.push([pt.x, pt.y, pt.z]);
    }
    return result;
  }, [start, end, links]);

  return (
    <group>
      {points.map((pt, i) => (
        <mesh key={i} position={pt} rotation={[i % 2 === 0 ? 0 : Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.045, 0.014, 6, 12]} />
          <meshStandardMaterial color="#1f1d22" roughness={0.7} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Model skeleton loaded from GLTF with procedural rusted iron manacles.
 */
const ModelSkeleton: React.FC<{ scale: number }> = ({ scale }) => {
  const { scene } = useGLTF('/models/burning_skeleton.glb');
  const cloned = useMemo(() => {
    const c = scene.clone();
    c.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  return (
    <primitive
      object={cloned}
      position={[0, -1.1, 0.1]}
      rotation={[0.1, 0, 0]}
      scale={[scale * 0.85, scale * 0.85, scale * 0.85]}
    />
  );
};

/**
 * Procedural stylized skeleton fallback if model is suspended.
 */
const FallbackSkeleton: React.FC<{ scale: number }> = ({ scale }) => {
  return (
    <group position={[0, -1.0, 0.1]} scale={[scale, scale, scale]}>
      {/* Skull */}
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#d4cebe" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Eye sockets */}
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.65, 0.13]}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshBasicMaterial color="#0a0808" />
        </mesh>
      ))}
      {/* Spine */}
      <mesh position={[0, 0.25, -0.02]}>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 6]} />
        <meshStandardMaterial color="#c2bba8" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Ribcage */}
      {[0.4, 0.32, 0.24, 0.16].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]}>
          <torusGeometry args={[0.16 - idx * 0.02, 0.025, 6, 12, Math.PI * 1.5]} />
          <meshStandardMaterial color="#dcd6c5" roughness={0.9} metalness={0.1} />
        </mesh>
      ))}
      {/* Pelvis */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.15, 0.1, 0.12, 6]} />
        <meshStandardMaterial color="#cec7b4" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Hanging Legs */}
      {[-0.09, 0.09].map((x) => (
        <group key={x} position={[x, -0.15, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.03, 0.025, 0.45, 6]} />
            <meshStandardMaterial color="#cec7b4" roughness={0.9} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.65, 0.02]}>
            <cylinderGeometry args={[0.025, 0.02, 0.45, 6]} />
            <meshStandardMaterial color="#cec7b4" roughness={0.9} metalness={0.1} />
          </mesh>
        </group>
      ))}
      {/* Raised chained arms */}
      {[-1, 1].map((dir) => (
        <group key={dir} position={[dir * 0.2, 0.45, 0]}>
          <mesh position={[dir * 0.15, 0.18, 0]} rotation={[0, 0, dir * 0.8]}>
            <cylinderGeometry args={[0.03, 0.025, 0.4, 6]} />
            <meshStandardMaterial color="#cec7b4" roughness={0.9} metalness={0.1} />
          </mesh>
          <mesh position={[dir * 0.32, 0.45, 0]} rotation={[0, 0, dir * 0.3]}>
            <cylinderGeometry args={[0.025, 0.02, 0.4, 6]} />
            <meshStandardMaterial color="#cec7b4" roughness={0.9} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * HangingSkeleton renders an unfortunate soul bound to the dungeon stone wall
 * by heavy wrought-iron chains and wrist shackles.
 */
export const HangingSkeleton: React.FC<HangingSkeletonProps> = ({
  position,
  rotation = [0, 0, 0],
  scale = 1.1,
}) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Iron wall ring anchor (left) */}
      <group position={[-0.45, 0.9, -0.02]}>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.15, 0.15, 0.04]} />
          <meshStandardMaterial color="#1a181b" roughness={0.7} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.08, 0.02, 8, 16]} />
          <meshStandardMaterial color="#1a181b" roughness={0.7} metalness={0.85} />
        </mesh>
      </group>

      {/* Iron wall ring anchor (right) */}
      <group position={[0.45, 0.9, -0.02]}>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.15, 0.15, 0.04]} />
          <meshStandardMaterial color="#1a181b" roughness={0.7} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.08, 0.02, 8, 16]} />
          <meshStandardMaterial color="#1a181b" roughness={0.7} metalness={0.85} />
        </mesh>
      </group>

      {/* Left chain from wall ring down to left wrist manacle */}
      <ChainSegment
        start={[-0.45, 0.88, 0.08]}
        end={[-0.38, 0.38, 0.12]}
        links={6}
      />

      {/* Right chain from wall ring down to right wrist manacle */}
      <ChainSegment
        start={[0.45, 0.88, 0.08]}
        end={[0.38, 0.38, 0.12]}
        links={6}
      />

      {/* Left wrist manacle (iron shackle collar) */}
      <mesh position={[-0.38, 0.35, 0.12]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.06, 0.06, 0.08, 8, 1, true]} />
        <meshStandardMaterial
          color="#151316"
          roughness={0.6}
          metalness={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Right wrist manacle */}
      <mesh position={[0.38, 0.35, 0.12]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.06, 0.06, 0.08, 8, 1, true]} />
        <meshStandardMaterial
          color="#151316"
          roughness={0.6}
          metalness={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hanging skeleton figure */}
      <Suspense fallback={<FallbackSkeleton scale={scale} />}>
        <ModelSkeleton scale={scale} />
      </Suspense>
    </group>
  );
};
