import React, { useMemo } from 'react';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { Position } from '../../game/types';
import { ThreatAssessment } from '../../game/ai/ThreatAssessment';

/**
 * Visual debugging tool for Monster AI.
 * Shows target selection with lines and potentially paths.
 */
export const MonsterAIIndicator: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const settings = useGameStore((state) => state.settings);
  const selectedEntity = useGameStore((state) => state.selectedEntity);

  // Use a fallback for showDevTools to allow testing even if settings is initial
  const showDev = settings?.showDevTools ?? true;

  if (!gameState) return null;

  const posToVector = (pos: Position): [number, number, number] => {
    // grid coordinates to world space
    // Tile size is 4. Center of tile is (tileX*4, tileZ*4) in group space? 
    // NO, Hero3D uses: tile.x * 4 + pos.sqX + 0.5
    // BUT Tiles are translated by Group: [tile.x * 4, 0, tile.z * 4]
    // WAIT. App.tsx renders everything in the same world space?
    // Hero3D says: position={[worldX, 0, worldZ]} where worldX = hero.position.x * 4 + hero.position.sqX + 0.5
    // So the group translation in Tile3D is CORRECT for the floor, but inconsistent with Hero3D if we want absolute coordinates.
    // LET'S USE ABSOLUTE COORDINATES CONSISTENTLY.
    return [
      pos.x * 4 + pos.sqX + 0.5,
      0.1, 
      pos.z * 4 + pos.sqZ + 0.5
    ];
  };

  return (
    <group>
      {gameState.monsters.map((monster) => {
        if (monster.hp <= 0) return null;

        const target = ThreatAssessment.getTopTarget(monster, gameState.heroes);
        if (!target) return null;

        const start = posToVector(monster.position);
        const end = posToVector(target.position);
        
        const isMonsterSelected = selectedEntity?.id === monster.id;

        return (
          <group key={`debug-${monster.id}`}>
            {/* Target selection line - only in dev mode OR when monster is selected */}
            {(showDev || isMonsterSelected) && (
              <Line
                points={[new Vector3(...start), new Vector3(...end)]}
                color={isMonsterSelected ? "#ff0000" : "#aa0000"}
                lineWidth={isMonsterSelected ? 2 : 1}
                opacity={isMonsterSelected ? 0.8 : 0.4}
                transparent
                dashed
              />
            )}
            
            {/* Small red light above monster if targeted by someone OR selected */}
            {(showDev || isMonsterSelected) && (
              <pointLight position={[start[0], 1, start[2]]} color="#ff0000" intensity={0.5} distance={2} />
            )}
          </group>
        );
      })}
    </group>
  );
};
