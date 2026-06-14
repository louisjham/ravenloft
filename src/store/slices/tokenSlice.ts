import { StateCreator } from 'zustand';
import { GameStore, TokenSlice } from '../storeTypes';
import { TokenSystem } from '../../game/engine/TokenSystem';
import { DataLoader } from '../../game/dataLoader';
import { EncounterSystem } from '../../game/engine/EncounterSystem';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { ObjectiveTracker } from '../../game/scenarios/Objectives';
import { ScenarioManager } from '../../game/scenarios/ScenarioManager';
import { useUIStore } from '../uiStore';
import { isDev } from '../../utils/devEnv';

export const createTokenSlice: StateCreator<GameStore, [], [], TokenSlice> = (set, get) => ({
  initializeTokensForScenario: (scenarioId: string) => {
      const state = get().gameState;
      if (!state) return;
      const newState = TokenSystem.initializeScenarioTokens(state, scenarioId);
      set({ gameState: newState });
    },

  searchToken: (tokenId: string) => {
      const state = get().gameState;
      if (!state) return null;
      let { result, newState } = TokenSystem.searchToken(state, tokenId);
      if (!newState || !result) return result;

      const hero = newState.heroes.find(h => h.id === newState!.currentHeroId);
      if (hero && result.success && result.revealedData) {
          const itemId = result.revealedData.itemId;
          if (itemId === 'wooden_stake' || itemId === 'holy_water') {
              const cardId = itemId === 'wooden_stake' ? 'item_wooden_stake' : 'item_holy_water';
              const card = DataLoader.getInstance().getCardById(cardId);
              if (card) {
                  const assignResult = TreasureSystem.assignItem(newState, card, hero);
                  newState = assignResult.newState;
              }
          } else if (itemId === 'treasure_card') {
              const stateForDraw = { ...newState, treasuresDrawnThisTurn: 0 };
              const drawResult = TreasureSystem.drawTreasureCard(stateForDraw, hero);
              if (drawResult.card) {
                  let drawState = drawResult.newState;
                  const effectiveHero = drawState.heroes.find(h => h.id === hero.id) || hero;
                  if (drawResult.card.treasureType === 'blessing') {
                      const blessingResult = TreasureSystem.useBlessing(drawState, drawResult.card, effectiveHero);
                      newState = blessingResult.newState;
                  } else if (drawResult.card.treasureType === 'fortune') {
                      const fortuneResult = TreasureSystem.useFortune(drawState, drawResult.card, effectiveHero);
                      newState = fortuneResult.newState;
                  } else if (drawResult.card.treasureType === 'item') {
                      const assignResult = TreasureSystem.assignItem(drawState, drawResult.card, effectiveHero);
                      newState = assignResult.newState;
                  } else {
                      newState = drawState;
                  }
              }
          }
      }

      const updatedObjectives = ObjectiveTracker.checkObjectives(newState);
      const allComplete = updatedObjectives.every(obj => obj.isCompleted);
      const stateWithObjectives = {
        ...newState,
        activeScenario: { ...newState.activeScenario, objectives: updatedObjectives }
      };
      const isDefeated = ScenarioManager.checkDefeat(stateWithObjectives);

      if (isDefeated) {
        set({ gameState: { ...stateWithObjectives, phase: 'defeat' as const } });
        useUIStore.getState().showModal('defeat');
      } else if (allComplete) {
        set({ gameState: { ...stateWithObjectives, phase: 'victory' as const } });
        useUIStore.getState().showModal('victory');
      } else {
        set({ gameState: stateWithObjectives });
      }

      return result;
    },

  getTokensOnTile: (tileId: string) => {
      const state = get().gameState;
      if (!state) return [];
      return TokenSystem.getTokensOnTile(state, tileId);
    },

  canSearchTokens: (heroId: string) => {
      const state = get().gameState;
      if (!state) return { canSearch: false, reason: 'No state', tokens: [] };
      return TokenSystem.canSearchTokens(state, heroId);
    },

  disableTrap: (trapId: string) => {
      const state = get().gameState;
      if (!state) return;

      const trap = state.traps.find(t => t.id === trapId);
      if (!trap) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(trap.cardId);
      if (!card) return;

      const result = EncounterSystem.attemptDisableTrap(state, hero, trap, card);
      if (isDev()) console.log('[DEBUG gameStore] Disable trap:', result.message);
      set({ gameState: result.gameState });
    },

});
