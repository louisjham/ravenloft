import React, { Suspense, memo } from 'react';
import { Cylinder, Box, Sphere, Billboard } from '@react-three/drei';
import { Monster } from '../../game/types';
import { getMonsterModelPath, DUMMY_MODE } from '../../utils/modelLoader';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GamePiece } from './GamePiece';

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
 * 3D component for a Monster miniature.
 */
const Monster3DInner: React.FC<Monster3DProps> = ({ monster }) => {
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const attackMonster = useGameStore((state) => state.attackMonster);
  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);
  
  const isSelected = selectedEntity?.id === monster.id;

  // Center squares are 0.5, 1.5, 2.5, 3.5 relative to tile origin
  const worldX = monster.position.x * 4 + monster.position.sqX + 0.5;
  const worldZ = monster.position.z * 4 + monster.position.sqZ + 0.5;

  if (monster.isDefeated) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (interactionMode === 'attack') {
      e.stopPropagation();
      attackMonster(monster.id);
      setInteractionMode('none');
    } else if (interactionMode === 'ability' && selectedPowerId) {
      e.stopPropagation();
      useGameStore.getState().usePower(selectedPowerId, monster.id);
      setInteractionMode('none');
      setSelectedPowerId(null);
    }
  };

  const isGravestorm = monster.id.startsWith('monster_gravestorm');
  const modelScale = isGravestorm ? 1.2 : 0.4;
  const modelYPos = isGravestorm ? 1.2 : 0.5;

  const hpRatio = monster.hp / monster.maxHp;
  const barWidth = hpRatio * 0.5;
  const barX = -0.25 + barWidth / 2;

  return (
    <group 
      position={[worldX, 0, worldZ]} 
      userData={{ entity: monster }}
      onClick={handleClick}
    >
      {/* Target Highlight */}
      {isSelected && (
        <group position={[0, 0.01, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.55, 16]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.6} side={2} />
          </mesh>
          <pointLight color="#ff0000" intensity={2} distance={2} castShadow={false} />
        </group>
      )}

      {/* Monster Base */}
      <Cylinder args={[0.4, 0.4, 0.05, 16]} position={[0, 0.025, 0]}>
        <meshStandardMaterial color={isSelected ? "#442222" : "#222222"} />
      </Cylinder>

      {/* Threat Level or HP Bar (Diegetic) */}
      <Billboard position={[0, 1.2, 0]}>
        <mesh>
          <planeGeometry args={[0.5, 0.05]} />
          <meshBasicMaterial color="#333" />
        </mesh>
        <mesh position={[barX, 0, 0.01]}>
          <planeGeometry args={[barWidth, 0.05]} />
          <meshBasicMaterial color={hpRatio < 0.3 ? "#ff4400" : "#ff0000"} />
        </mesh>
      </Billboard>

      {/* Monster Body with Suspense fallback */}
      {DUMMY_MODE ? (
        <MonsterPlaceholder />
      ) : (
        <Suspense fallback={<MonsterPlaceholder />}>
          <GamePiece url={getMonsterModelPath(monster.id)} position={[0, modelYPos, 0]} rotation={[0, 0, 0]} scale={modelScale} />
        </Suspense>
      )}
    </group>
  );
};

export const Monster3D = memo(Monster3DInner);
