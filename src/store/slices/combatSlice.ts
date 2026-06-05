import { StateCreator } from 'zustand';
import { GameStore, CombatSlice } from '../storeTypes';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { Position, GameLogEntry } from '../../game/types';

export const createCombatSlice: StateCreator<GameStore, [], [], CombatSlice> = (set, get) => ({
  moveHero: (targetPosition: Position) => {
      const state = get().gameState;
      if (!state) return;

      const updatedHeroes = state.heroes.map(hero => {
        if (hero.id === state.currentHeroId) {
          return { ...hero, position: targetPosition };
        }
        return hero;
      });

      const updatedLog: GameLogEntry[] = [
        ...state.log,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `${state.heroes.find(h => h.id === state.currentHeroId)?.name} moves to tile (${targetPosition.x}, ${targetPosition.z}) sq (${targetPosition.sqX}, ${targetPosition.sqZ})`,
          type: 'action' as const
        }
      ].slice(-100);

      set({ gameState: { ...state, heroes: updatedHeroes, log: updatedLog } });
    },

  attackMonster: async (monsterId: string) => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      const monster = state.monsters.find(m => m.id === monsterId);

      if (!hero || !monster) return;

      // Hero basic attack: use hero's attack bonus and damage from profile
      const attackBonus = hero.attackBonus ?? 0;
      const damage = 1;
      const result = await CombatSystem.resolveAttackAsync(hero, monster, attackBonus, damage, 0, state);

      // Re-fetch state after await in case it changed
      const currentState = get().gameState;
      if (!currentState) return;

      const updatedMonsters = currentState.monsters.map(m => {
        if (m.id === monsterId) {
          return { ...m, hp: Math.max(0, m.hp - result.damage) };
        }
        return m;
      });

      const updatedLog: GameLogEntry[] = [
        ...currentState.log,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `${hero.name} attacks ${monster.name} and deals ${result.damage} damage!`,
          type: 'combat' as const
        }
      ].slice(-100);

      set({
        gameState: {
          ...currentState,
          monsters: updatedMonsters.map(m => m.hp <= 0 ? { ...m, isDefeated: true } : m),
          log: updatedLog
        }
      });
    },

});
