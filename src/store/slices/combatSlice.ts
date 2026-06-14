import { StateCreator } from 'zustand';
import { GameStore, CombatSlice } from '../storeTypes';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { CombatAdapter } from '../../game/engine/CombatAdapter';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { Position, GameLogEntry } from '../../game/types';

export const createCombatSlice: StateCreator<GameStore, [], [], CombatSlice> = (set, get) => ({
  moveHero: (targetPosition: Position) => {
      const state = get().gameState;
      if (!state) return;

      // Bug 5: Target tile validation guard (tile exists and is revealed)
      const targetTile = state.tiles.find(t => t.x === targetPosition.x && t.z === targetPosition.z);
      if (!targetTile || !targetTile.isRevealed) return;

      const updatedHeroes = state.heroes.map(hero => {
        if (hero.id === state.currentHeroId) {
          return { ...hero, position: targetPosition };
        }
        return hero;
      });

      // Bug 6: Use deterministic logIdCounter instead of crypto.randomUUID()
      const counter = state.logIdCounter ?? 0;
      const updatedLog: GameLogEntry[] = [
        ...state.log,
        {
          id: String(counter),
          timestamp: new Date().toISOString(),
          message: `${state.heroes.find(h => h.id === state.currentHeroId)?.name} moves to tile (${targetPosition.x}, ${targetPosition.z}) sq (${targetPosition.sqX}, ${targetPosition.sqZ})`,
          type: 'action' as const
        }
      ].slice(-100);

      set({
        gameState: {
          ...state,
          heroes: updatedHeroes,
          log: updatedLog,
          logIdCounter: counter + 1
        }
      });
    },

  attackMonster: async (monsterId: string) => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      const monster = state.monsters.find(m => m.id === monsterId);

      if (!hero || !monster) return;

      // Bug 2: Hero basic attack: use hero's actual damage stat
      const attackBonus = hero.attackBonus ?? 0;
      const damage = hero.damage ?? 1;
      const result = await CombatAdapter.resolveAttackAsync(hero, monster, attackBonus, damage, 0, state);

      // Re-fetch state after await in case it changed
      const currentState = get().gameState;
      if (!currentState) return;

      // Bug 4: Resolve currentMonster and currentHero from currentState to avoid stale reference
      const currentMonster = currentState.monsters.find(m => m.id === monsterId);
      const currentHero = currentState.heroes.find(h => h.id === currentState.currentHeroId);
      if (!currentMonster || !currentHero) return;

      const updatedHero = CombatSystem.applyAttackResultEffects(currentHero, result);
      const updatedHeroes = currentState.heroes.map(h => h.id === updatedHero.id ? updatedHero : h);

      // Bug 3: Apply damage using CombatSystem.applyDamage instead of manual update
      const updatedMonsters = currentState.monsters.map(m => {
        if (m.id === monsterId) {
          return CombatSystem.applyDamage(m, result.damage, currentState);
        }
        return m;
      });

      // Bug 6: Use deterministic logIdCounter instead of crypto.randomUUID()
      const counter = currentState.logIdCounter ?? 0;
      const updatedLog: GameLogEntry[] = [
        ...currentState.log,
        {
          id: String(counter),
          timestamp: new Date().toISOString(),
          message: `${currentHero.name} attacks ${currentMonster.name} and deals ${result.damage} damage!`,
          type: 'combat' as const
        }
      ].slice(-100);

      set({
        gameState: TreasureSystem.processDefeatedMonsters({
          ...currentState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          log: updatedLog,
          logIdCounter: counter + 1
        })
      });
    },

});
