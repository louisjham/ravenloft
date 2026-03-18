import React, { Suspense } from 'react';
import { Cylinder, Box, Sphere } from '@react-three/drei';
import { Hero } from '../../game/types';
import { MODELS, useModel, DUMMY_MODE } from '../../utils/modelLoader';
import { useGameStore } from '../../store/gameStore';

interface Hero3DProps {
  hero: Hero;
}

/**
 * Placeholder for when the Hero model is loading or fails.
 */
const HeroPlaceholder: React.FC = () => (
  <group>
    {/* Body */}
    <Box args={[0.4, 0.8, 0.4]} position={[0, 0.45, 0]} castShadow>
      <meshStandardMaterial color="#4444aa" />
    </Box>
    {/* Head */}
    <Sphere args={[0.15]} position={[0, 0.95, 0]} castShadow>
      <meshStandardMaterial color="#ffccaa" />
    </Sphere>
  </group>
);

/**
 * Component that loads and renders the actual GLTF model.
 */
const HeroModel: React.FC = () => {
  const model = useModel(MODELS.HERO_PALADIN);
  return <primitive object={model.clone()} scale={0.4} position={[0, 0, 0]} />;
};

/**
 * 3D component for a Hero miniature.
 */
export const Hero3D: React.FC<Hero3DProps> = ({ hero }) => {
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const isSelected = selectedEntity?.id === hero.id;

  // Center squares are 0.5, 1.5, 2.5, 3.5 relative to tile origin
  const worldX = hero.position.x * 4 + hero.position.sqX + 0.5;
  const worldZ = hero.position.z * 4 + hero.position.sqZ + 0.5;

  return (
    <group 
      position={[worldX, 0, worldZ]} 
      castShadow
      userData={{ entity: hero }}
    >
      {/* Selection Highlight */}
      {isSelected && (
        <group position={[0, 0.01, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.55, 32]} />
            <meshBasicMaterial color="#00ffcc" transparent opacity={0.6} side={2} />
          </mesh>
          <pointLight color="#00ffcc" intensity={2} distance={2} />
        </group>
      )}

      {/* Hero Base */}
      <Cylinder args={[0.4, 0.4, 0.05, 32]} position={[0, 0.025, 0]}>
        <meshStandardMaterial color={isSelected ? "#222244" : "#222222"} />
      </Cylinder>

      {/* HP Orb on base (Diegetic UI) */}
      <Sphere args={[0.08]} position={[0.3, 0.1, 0]}>
        <meshStandardMaterial 
          color={hero.hp > 0 ? "#00ff00" : "#ff0000"} 
          emissive={hero.hp > 0 ? "#00ff00" : "#ff0000"}
          emissiveIntensity={hero.hp / hero.maxHp * 2}
        />
      </Sphere>

      {/* Hero Body with Suspense fallback */}
      {DUMMY_MODE ? (
        <HeroPlaceholder />
      ) : (
        <Suspense fallback={<HeroPlaceholder />}>
          <HeroModel />
        </Suspense>
      )}
    </group>
  );
};
