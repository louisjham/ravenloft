import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { MODELS } from '../../utils/modelLoader';

const WALL_LENGTH = 26;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 0.5;
const INNER_OFFSET = 13;
const TORCH_HEIGHT = 1.5;

interface WallConfig {
  position: [number, number, number];
  size: [number, number, number];
  torchPos: [number, number, number];
  modelPath: string;
  torchScale: number;
}

const walls: WallConfig[] = [
  {
    position: [0, WALL_HEIGHT / 2, -INNER_OFFSET - WALL_THICKNESS / 2],
    size: [WALL_LENGTH, WALL_HEIGHT, WALL_THICKNESS],
    torchPos: [0, TORCH_HEIGHT, -INNER_OFFSET],
    modelPath: MODELS.ENV_TORCH,
    torchScale: 0.02,
  },
  {
    position: [0, WALL_HEIGHT / 2, INNER_OFFSET + WALL_THICKNESS / 2],
    size: [WALL_LENGTH, WALL_HEIGHT, WALL_THICKNESS],
    torchPos: [0, TORCH_HEIGHT, INNER_OFFSET],
    modelPath: MODELS.ENV_TORCH,
    torchScale: 0.02,
  },
  {
    position: [-INNER_OFFSET - WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0],
    size: [WALL_THICKNESS, WALL_HEIGHT, WALL_LENGTH],
    torchPos: [-INNER_OFFSET, TORCH_HEIGHT, 0],
    modelPath: MODELS.ENV_TORCH_ALT,
    torchScale: 0.8,
  },
  {
    position: [INNER_OFFSET + WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0],
    size: [WALL_THICKNESS, WALL_HEIGHT, WALL_LENGTH],
    torchPos: [INNER_OFFSET, TORCH_HEIGHT, 0],
    modelPath: MODELS.ENV_TORCH_ALT,
    torchScale: 0.8,
  },
];

interface WallTorchProps {
  position: [number, number, number];
  modelPath: string;
  scale: number;
}

const TorchModel: React.FC<{ modelPath: string; scale: number }> = ({ modelPath, scale }) => {
  if (!modelPath) return null;
  const { scene } = useGLTF(modelPath);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} scale={scale} />;
};

const WallTorch: React.FC<WallTorchProps> = ({ position, modelPath, scale }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Mesh>(null);

  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const slow = Math.sin(time * 2 + phase);
    const fast = Math.sin(time * 7 + phase * 2);
    const micro = Math.sin(time * 15 + phase * 3.7);
    const flicker = 0.6 + slow * 0.15 + fast * 0.1 + micro * 0.05;

    if (lightRef.current) {
      lightRef.current.intensity = flicker;
    }
    if (flameRef.current) {
      const scale = 1 + 0.08 * Math.sin(time * 5 + phase);
      flameRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <TorchModel modelPath={modelPath} scale={scale} />
      <pointLight
        ref={lightRef}
        color="#ff8833"
        intensity={2.5}
        distance={30}
        decay={1}
        castShadow={false}
      >
        <mesh ref={flameRef} position={[0, 0.45, 0]}>
          <coneGeometry args={[0.12, 0.25, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </pointLight>
    </group>
  );
};

const BrickWallOverlay: React.FC = () => {
  if (!MODELS.ENV_BRICK_WALL) return null;
  const { scene } = useGLTF(MODELS.ENV_BRICK_WALL);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  const wallOverlayPositions: [number, number, number][] = [
    [0, WALL_HEIGHT / 2, -INNER_OFFSET],
    [0, WALL_HEIGHT / 2, INNER_OFFSET],
    [-INNER_OFFSET, WALL_HEIGHT / 2, 0],
    [INNER_OFFSET, WALL_HEIGHT / 2, 0],
  ];

  const rotations: [number, number, number][] = [
    [0, 0, 0],
    [0, Math.PI, 0],
    [0, -Math.PI / 2, 0],
    [0, Math.PI / 2, 0],
  ];

  return (
    <>
      {wallOverlayPositions.map((pos, i) => (
        <group key={i} position={pos} rotation={rotations[i]}>
          <primitive object={cloned.clone()} scale={[WALL_LENGTH / 4, 1.5, 1]} />
        </group>
      ))}
    </>
  );
};

export const DungeonWalls: React.FC = () => {
  const texture = useLoader(THREE.TextureLoader, '/ui/stone-wall.png');

  return (
    <group name="dungeon-walls">
      {walls.map((wall, i) => (
        <React.Fragment key={i}>
          <mesh position={wall.position} receiveShadow>
            <boxGeometry args={wall.size} />
            <meshStandardMaterial
              map={texture}
              roughness={0.95}
              metalness={0.05}
              color={texture ? '#ffffff' : '#333333'}
            />
          </mesh>
          <WallTorch position={wall.torchPos} modelPath={wall.modelPath} scale={wall.torchScale} />
        </React.Fragment>
      ))}
      <BrickWallOverlay />
    </group>
  );
};
