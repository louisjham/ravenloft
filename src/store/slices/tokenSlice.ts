import { StateCreator } from 'zustand';
import { GameStore, TokenSlice } from '../storeTypes';
import { TokenSystem } from '../../game/engine/TokenSystem';
import { DataLoader } from '../../game/dataLoader';
import { EncounterSystem } from '../../game/engine/EncounterSystem';
import { GameState, Entity, Tile, Card, GameSettings, Position, Hero, PowerType, Trap, Monster, TacticResult, GameToken, TokenSearchResult } from '../../game/types';

export const createTokenSlice: StateCreator<GameStore, [], [], TokenSlice> = (set, get) => ({
  initializeTokensForScenario: (scenarioId: string) => { const state = get().gameState; if (!state) return; const newState = TokenSystem.initializeScenarioTokens(state, scenarioId); set({ gameState: newState }); },

  searchToken: (tokenId: string) => { const state = get().gameState; if (!state) return null; const { result, newState } = TokenSystem.searchToken(state, tokenId); set({ gameState: newState }); return result; },

  getTokensOnTile: (tileId: string) => { const state = get().gameState; if (!state) return []; return TokenSystem.getTokensOnTile(state, tileId); },

  canSearchTokens: (heroId: string) => { const state = get().gameState; if (!state) return { canSearch: false, reason: 'No state', tokens: [] }; return TokenSystem.canSearchTokens(state, heroId); },

  disableTrap: async (trapId: string) => {
      const state = get().gameState;
      if (!state) return;

      const trap = state.traps.find(t => t.id === trapId);
      if (!trap) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(trap.cardId);
      if (!card) return;

      const result = await EncounterSystem.attemptDisableTrap(state, hero, trap, card);
      console.log('[DEBUG gameStore] Disable trap:', result.message);
      if (result.success) {
        set({ gameState: { ...get().gameState! } });
      }
    },

});
