import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useXR } from '@react-three/xr';
import { Group } from 'three';
import { MODELS } from '../../utils/modelLoader';

interface TavernPropProps {
  modelPath: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

const TavernPropItem: React.FC<TavernPropProps> = ({ modelPath, position, rotation = [0, 0, 0], scale = 1 }) => {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  const scaleArgs: [number, number, number] = typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <primitive
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={scaleArgs}
      castShadow
      receiveShadow
    />
  );
};

export const TavernProps3D: React.FC = () => {
  const { isPresenting } = useXR();

  // In WebXR mode, decorative room props are hidden so they don't block the tabletop or suspend board rendering
  if (isPresenting) {
    return null;
  }
  // Pre-configured decorative positions on the tabletop surrounding the dungeon tiles
  const tavernDecorations: TavernPropProps[] = [
    {
      modelPath: MODELS.ENV_TAVERN_BARREL,
      position: [-10, 0, -10],
      scale: 1.2,
      rotation: [0, Math.PI / 4, 0],
    },
    {
      modelPath: MODELS.ENV_TAVERN_BARREL,
      position: [-11.2, 0, -9.5],
      scale: 1.0,
      rotation: [0, -Math.PI / 6, 0],
    },
    {
      modelPath: MODELS.ENV_TAVERN_DESK,
      position: [11, 0, -10],
      scale: 0.85,
      rotation: [0, -Math.PI / 3, 0],
    },
    {
      modelPath: MODELS.ENV_TAVERN_CHAIR,
      position: [12.2, 0, -9.2],
      scale: 0.85,
      rotation: [0, Math.PI / 6, 0],
    },
    {
      modelPath: MODELS.ENV_TAVERN_ALTAR,
      position: [10, 0, 11],
      scale: 0.75,
      rotation: [0, Math.PI, 0],
    },
  ];

  return (
    <group name="tavern-props-group">
      <Suspense fallback={null}>
        {tavernDecorations.map((prop, idx) => (
          <TavernPropItem key={`tavern-prop-${idx}`} {...prop} />
        ))}
      </Suspense>
    </group>
  );
};
