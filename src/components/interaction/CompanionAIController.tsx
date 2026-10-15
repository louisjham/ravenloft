import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useGameActions } from '../../hooks/useGameActions';
import { TileSystem } from '../../game/engine/TileSystem';
import { GameState, Hero, Monster, Position } from '../../game/types';

export const CompanionAIController: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const { handleMoveHero, handleAttackMonster, handleEndTurn } = useGameActions();
  
  // Prevent double-execution
  const executingTurnRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'hero' || gameState.pendingAITurnApproval) return;

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
        
        // If no enemy exists, check for closest unexplored edge to explore new rooms!
        const getDist = (p1: Position, p2: Position) =>
          Math.abs((p1.x * 4 + p1.sqX) - (p2.x * 4 + p2.sqX)) + Math.abs((p1.z * 4 + p1.sqZ) - (p2.z * 4 + p2.sqZ));

        let edgeTarget: Position | null = null;
        if (!closestEnemy && !state.hasExploredThisTurn) {
          const explorablePoints = TileSystem.getExplorationPoints(state.tiles);
          let minEdgeDist = Infinity;
          for (const ep of explorablePoints) {
            const ptTile = state.tiles.find(t => t.id === ep.tileId);
            if (!ptTile) continue;
            let sX = 1;
            let sZ = 1;
            if (ep.edge === 'north') { sX = 1; sZ = 0; }
            else if (ep.edge === 'south') { sX = 1; sZ = 3; }
            else if (ep.edge === 'east') { sX = 3; sZ = 1; }
            else if (ep.edge === 'west') { sX = 0; sZ = 1; }

            const epPos = { x: ptTile.x, z: ptTile.z, sqX: sX, sqZ: sZ };
            const d = getDist(hero.position, epPos);
            if (d < minEdgeDist) {
              minEdgeDist = d;
              edgeTarget = epPos;
            }
          }
        }

        const moveTarget: Position = closestEnemy 
          ? { x: closestEnemy.position.x, z: closestEnemy.position.z, sqX: closestEnemy.position.sqX, sqZ: closestEnemy.position.sqZ } 
          : (edgeTarget || { x: leadHero.position.x, z: leadHero.position.z, sqX: leadHero.position.sqX, sqZ: leadHero.position.sqZ });

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

        for (const key of reachable.keys()) {
          const [tileId, sqXStr, sqZStr] = key.split(':');
          const tile = state.tiles.find(t => t.id === tileId);
          if (!tile) continue;
          
          const pos = { x: tile.x, z: tile.z, sqX: parseInt(sqXStr), sqZ: parseInt(sqZStr) };
          
          // Don't step ON the monster target if occupied
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

      // Step 4: Turn Completion (Player Approval in Director/Full AI mode vs Auto-end)
      const settings = useGameStore.getState().settings;
      const requiresApproval = settings.aiTurnApprovalRequired || settings.aiControlMode === 'all_ai';

      if (requiresApproval) {
        console.log(`[CompanionAI] Turn finished for ${currentHero.name} — awaiting player approval`);
        useGameStore.getState().setGameState({
          ...useGameStore.getState().gameState!,
          pendingAITurnApproval: {
            heroId: currentHero.id,
            heroName: currentHero.name
          }
        });
        useUIStore.getState().addNotification(
          `🤖 ${currentHero.name}'s turn is complete. Approve to proceed.`,
          'info',
          6000
        );
      } else {
        console.log(`[CompanionAI] Ending turn automatically for ${currentHero.name}`);
        handleEndTurn();
      }
    };

    playTurn();

    return () => {
      isCancelled = true;
    };
  }, [gameState?.currentHeroId, gameState?.phase, gameState?.pendingAITurnApproval, handleMoveHero, handleAttackMonster, handleEndTurn]);

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
  let closest: Monster | null = null;
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
