import { StateCreator } from 'zustand';
import { GameStore, CombatSlice } from '../storeTypes';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { GameState, Entity, Tile, Card, GameSettings, Position, Hero, PowerType, Trap, Monster, TacticResult, GameToken, TokenSearchResult } from '../../game/types';

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

      const updatedLog: import('../../game/types').GameLogEntry[] = [
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

      // Hero basic attack: straight d20 vs monster's AC, deals 1 damage
      const result = await CombatSystem.resolveAttackAsync(hero, monster, 0, 1);

      // Re-fetch state after await in case it changed
      const currentState = get().gameState;
      if (!currentState) return;

      const updatedMonsters = currentState.monsters.map(m => {
        if (m.id === monsterId) {
          return { ...m, hp: Math.max(0, m.hp - result.damage) };
        }
        return m;
      });

      const updatedLog: import('../../game/types').GameLogEntry[] = [
        ...currentState.log,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `${hero.name} attacks ${monster.name} and deals ${result.damage} damage!`,
          type: 'combat' as const
        }
      ].slice(-100);

      set({ gameState: { ...currentState, monsters: updatedMonsters, log: updatedLog } });
    },

});
