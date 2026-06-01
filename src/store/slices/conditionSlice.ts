import { StateCreator } from 'zustand';
import { GameStore, ConditionSlice } from '../storeTypes';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { GameState, Entity, Tile, Card, GameSettings, Position, Hero, PowerType, Trap, Monster, TacticResult, GameToken, TokenSearchResult } from '../../game/types';

export const createConditionSlice: StateCreator<GameStore, [], [], ConditionSlice> = (set, get) => ({
  applyCondition: (targetId: string, type: import('../../game/types').ConditionType, sourceId?: string, duration: number = 1) => {
      const { gameState } = get();
      if (!gameState) return;

      const newCondition: import('../../game/types').ActiveCondition = {
        type,
        targetId,
        sourceId,
        turnsRemaining: duration
      };

      const existingIdx = (gameState.activeConditions ?? []).findIndex(c => c.targetId === targetId && c.type === type);
      const nextConditions = [...(gameState.activeConditions ?? [])];

      if (existingIdx >= 0) {
        nextConditions[existingIdx] = newCondition;
      } else {
        nextConditions.push(newCondition);
      }

      const updatedHeroes = gameState.heroes.map(h =>
        h.id === targetId ? ConditionSystem.applyCondition(h, type, sourceId, duration) : h
      );
      const updatedMonsters = gameState.monsters.map(m =>
        m.id === targetId ? ConditionSystem.applyCondition(m, type, sourceId, duration) : m
      );

      set({
        gameState: {
          ...gameState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          activeConditions: nextConditions
        }
      });
    },

  removeCondition: (targetId: string, type: import('../../game/types').ConditionType) => {
      const { gameState } = get();
      if (!gameState) return;

      const updatedHeroes = gameState.heroes.map(h =>
        h.id === targetId ? ConditionSystem.removeCondition(h, type) : h
      );
      const updatedMonsters = gameState.monsters.map(m =>
        m.id === targetId ? ConditionSystem.removeCondition(m, type) : m
      );

      set({
        gameState: {
          ...gameState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          activeConditions: (gameState.activeConditions ?? []).filter(c => !(c.targetId === targetId && c.type === type))
        }
      });
    },

  decrementConditions: () => {
      const { gameState } = get();
      if (!gameState) return;

      const nextConditions = (gameState.activeConditions ?? [])
        .map(c => ({ ...c, turnsRemaining: c.turnsRemaining - 1 }))
        .filter(c => c.turnsRemaining > 0 || c.turnsRemaining === -1);

      const updatedHeroes = gameState.heroes.map(h => ConditionSystem.processTurnEnd(h));
      const updatedMonsters = gameState.monsters.map(m => ConditionSystem.processTurnEnd(m));

      set({
        gameState: {
          ...gameState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          activeConditions: nextConditions
        }
      });
    },

});
