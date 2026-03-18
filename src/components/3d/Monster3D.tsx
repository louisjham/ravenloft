import React, { Suspense } from 'react';
import { Cylinder, Box, Sphere } from '@react-three/drei';
import { Monster } from '../../game/types';
import { MODELS, useModel, DUMMY_MODE } from '../../utils/modelLoader';
import { useGameStore } from '../../store/gameStore';

interface Monster3DProps {
  monster: Monster;
}

/**
 * Placeholder for when the Monster model is loading or fails.
 */
const MonsterPlaceholder: React.FC = () => (
  <group>
    {/* Body */}
    <Box args={[0.5, 0.7, 0.5]} position={[0, 0.4, 0]} castShadow>
      <meshStandardMaterial color="#aa4444" />
    </Box>
    {/* Head */}
    <Sphere args={[0.2]} position={[0, 0.85, 0]} castShadow>
      <meshStandardMaterial color="#666666" />
    </Sphere>
  </group>
);

/**
 * Component that loads and renders the actual GLTF model.
 */
const MonsterModel: React.FC = () => {
  const model = useModel(MODELS.MONSTER_ZOMBIE);
  return <primitive object={model.clone()} scale={0.4} position={[0, 0, 0]} />;
};

/**
 * 3D component for a Monster miniature.
 */
export const Monster3D: React.FC<Monster3DProps> = ({ monster }) => {
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const isSelected = selectedEntity?.id === monster.id;

  // Center squares are 0.5, 1.5, 2.5, 3.5 relative to tile origin
  const worldX = monster.position.x * 4 + monster.position.sqX + 0.5;
  const worldZ = monster.position.z * 4 + monster.position.sqZ + 0.5;

  if (monster.hp <= 0) return null;

  return (
    <group 
      position={[worldX, 0, worldZ]} 
      castShadow
      userData={{ entity: monster }}
    >
      {/* Target Highlight */}
      {isSelected && (
        <group position={[0, 0.01, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.55, 32]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.6} side={2} />
          </mesh>
          <pointLight color="#ff0000" intensity={2} distance={2} />
        </group>
      )}

      {/* Monster Base */}
      <Cylinder args={[0.4, 0.4, 0.05, 32]} position={[0, 0.025, 0]}>
        <meshStandardMaterial color={isSelected ? "#442222" : "#222222"} />
      </Cylinder>

      {/* Threat Level or HP Bar (Diegetic) */}
      <mesh position={[0, 1.2, 0]}>
        <planeGeometry args={[0.5, 0.05]} />
        <meshBasicMaterial color="#333" />
        <mesh position={[(-0.25 + (monster.hp / monster.maxHp) * 0.25), 0, 0.01]}>
          <planeGeometry args={[(monster.hp / monster.maxHp) * 0.5, 0.05]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </mesh>

      {/* Monster Body with Suspense fallback */}
      {DUMMY_MODE ? (
        <MonsterPlaceholder />
      ) : (
        <Suspense fallback={<MonsterPlaceholder />}>
          <MonsterModel />
        </Suspense>
      )}
    </group>
  );
};
