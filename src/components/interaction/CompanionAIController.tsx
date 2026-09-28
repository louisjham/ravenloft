import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useGameActions } from '../../hooks/useGameActions';
import { TileSystem } from '../../game/engine/TileSystem';
import { GameState, Hero, Monster } from '../../game/types';

export const CompanionAIController: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const { handleMoveHero, handleAttackMonster, handleEndTurn } = useGameActions();
  
  // Prevent double-execution
  const executingTurnRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'hero') return;

    const currentHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    if (!currentHero || !currentHero.isAutoFollow) {
      executingTurnRef.current = null;
      return;
    }

    if (executingTurnRef.current === currentHero.id) return;
    executingTurnRef.current = currentHero.id;

    let isCancelled = false;

    const playTurn = async () => {
      console.log(`[CompanionAI] Starting turn for ${currentHero.name}`);
      
      // Delay before starting
      await new Promise(r => setTimeout(r, 800));
      if (isCancelled) return;

      // Ensure state is fresh
      let state = useGameStore.getState().gameState as GameState;
      if (!state) return;

      let hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero || hero.hp <= 0 || hero.isDefeated) {
        handleEndTurn();
        return;
      }

      // Step 1: Check if already adjacent to an enemy
      let targetMonsterId = findAdjacentMonster(state, hero);

      // Step 2: If no adjacent enemy, try to move
      if (!targetMonsterId) {
        // Find lead hero (first hero not auto-following, or hero 0)
        const leadHero = state.heroes.find(h => !h.isAutoFollow && h.hp > 0 && !h.isDefeated) || state.heroes[0];
        
        // Find closest enemy within 1 tile of lead hero or current hero
        const closestEnemy = findClosestEnemy(state, hero, leadHero);
        
        const moveTarget = closestEnemy 
          ? { x: closestEnemy.position.x, z: closestEnemy.position.z, sqX: closestEnemy.position.sqX, sqZ: closestEnemy.position.sqZ } 
          : { x: leadHero.position.x, z: leadHero.position.z, sqX: leadHero.position.sqX, sqZ: leadHero.position.sqZ };

        // Calculate path towards target
        const speed = hero.speed || 6; 
        const TS = 4;
        const blockedSquares = new Set<string>(
          state.monsters.filter(m => !m.isDefeated && m.hp > 0).map(m => `${m.position.x * TS + m.position.sqX},${m.position.z * TS + m.position.sqZ}`)
        );

        const reachable = TileSystem.getReachableSquares(hero.position, state.tiles, speed, blockedSquares);
        
        // Find the reachable square that minimizes distance to the moveTarget
        let bestSq = hero.position;
        let minDist = Infinity;
        
        // Simple heuristic: absolute distance in squares
        const getDist = (p1: any, p2: any) => Math.abs((p1.x * 4 + p1.sqX) - (p2.x * 4 + p2.sqX)) + Math.abs((p1.z * 4 + p1.sqZ) - (p2.z * 4 + p2.sqZ));

        for (const key of reachable.keys()) {
          const [tileId, sqXStr, sqZStr] = key.split(':');
          const tile = state.tiles.find(t => t.id === tileId);
          if (!tile) continue;
          
          const pos = { x: tile.x, z: tile.z, sqX: parseInt(sqXStr), sqZ: parseInt(sqZStr) };
          
          // Don't step ON the target if it's occupied by an entity we can't share a square with
          if (getDist(pos, moveTarget) === 0 && closestEnemy) continue; 
          
          const d = getDist(pos, moveTarget);
          if (d < minDist) {
            minDist = d;
            bestSq = pos;
          }
        }

        if (bestSq.x !== hero.position.x || bestSq.z !== hero.position.z || bestSq.sqX !== hero.position.sqX || bestSq.sqZ !== hero.position.sqZ) {
          await handleMoveHero(bestSq);
          await new Promise(r => setTimeout(r, 1000));
          if (isCancelled) return;
        }

        // Re-evaluate state after moving
        state = useGameStore.getState().gameState as GameState;
        if (!state) return;
        hero = state.heroes.find(h => h.id === state.currentHeroId)!;
        targetMonsterId = findAdjacentMonster(state, hero);
      }

      // Step 3: Attack if possible
      if (targetMonsterId && state && !state.hasAttackedThisTurn) {
        await handleAttackMonster(targetMonsterId);
        await new Promise(r => setTimeout(r, 1200));
        if (isCancelled) return;
      }

      // Step 4: End Turn
      console.log(`[CompanionAI] Ending turn for ${currentHero.name}`);
      handleEndTurn();
    };

    playTurn();

    return () => {
      isCancelled = true;
    };
  }, [gameState?.currentHeroId, gameState?.phase, handleMoveHero, handleAttackMonster, handleEndTurn]);

  return null;
};

function findAdjacentMonster(state: GameState, hero: Hero): string | null {
  const hAbsX = hero.position.x * 4 + hero.position.sqX;
  const hAbsZ = hero.position.z * 4 + hero.position.sqZ;
  
  for (const m of state.monsters) {
    if (m.hp > 0 && !m.isDefeated) {
      const mAbsX = m.position.x * 4 + m.position.sqX;
      const mAbsZ = m.position.z * 4 + m.position.sqZ;
      const dist = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ);
      if (dist === 1) {
        return m.id;
      }
    }
  }
  return null;
}

function findClosestEnemy(state: GameState, hero: Hero, leadHero: Hero): Monster | null {
  // Find an enemy to move towards.
  let closest = null;
  let minDist = Infinity;
  
  const hAbsX = hero.position.x * 4 + hero.position.sqX;
  const hAbsZ = hero.position.z * 4 + hero.position.sqZ;

  for (const m of state.monsters) {
    if (m.hp > 0 && !m.isDefeated) {
      const mAbsX = m.position.x * 4 + m.position.sqX;
      const mAbsZ = m.position.z * 4 + m.position.sqZ;
      const dist = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ);
      if (dist < minDist) {
        minDist = dist;
        closest = m;
      }
    }
  }
  
  return closest;
}
