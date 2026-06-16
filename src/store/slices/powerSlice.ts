import { StateCreator } from 'zustand';
import { GameStore, PowerSlice } from '../storeTypes';
import { DataLoader } from '../../game/dataLoader';
import { PowerSystem } from '../../game/engine/PowerSystem';
import PowerSelectionSystem from '../../game/engine/PowerSelectionSystem';
import { getAllPowerCards } from '../../data/powerCardLoader';
import { Card, GameLogEntry } from '../../game/types';

export const createPowerSlice: StateCreator<GameStore, [], [], PowerSlice> = (set, get) => ({
  usePower: async (cardId: string, targetId: string) => {
    const state = get().gameState;
    if (!state) return;

    const dataLoader = DataLoader.getInstance();
    const card = dataLoader.getCardById(cardId);
    if (!card) return;

    // Guard: Prevent using non-utility powers if the hero has already attacked
    if (state.hasAttackedThisTurn && card.powerType !== 'utility') {
      return;
    }

    const hero = state.heroes.find(h => h.id === state.currentHeroId);
    if (!hero) return;

    const target = targetId ? [...state.heroes, ...state.monsters].find(e => e.id === targetId) || null : null;
    const result = await PowerSystem.usePowerAsync(hero, card, target, state);

    if (result.success) {
      const consumesAttack = card.powerType !== 'utility';
      
      const updatedLog: GameLogEntry[] = [
        ...state.log,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: result.message,
          type: 'action' as const
        }
      ].slice(-100);
      set({ 
        gameState: { 
          ...result.newState, 
          log: updatedLog,
          hasAttackedThisTurn: consumesAttack ? true : result.newState.hasAttackedThisTurn
        } 
      });
    }
  },

  resetPower: (powerId: string) => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const updatedHero = PowerSystem.resetPower(hero, powerId);
      set({
        gameState: {
          ...state,
          heroes: state.heroes.map(h => h.id === updatedHero.id ? updatedHero : h)
        }
      });
    },

  getAvailablePowers: () => {
      const state = get().gameState;
      if (!state) return [];

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return [];

      const dataLoader = DataLoader.getInstance();
      const allCards = dataLoader.getAllCards();
      return PowerSystem.getAvailablePowers(hero, allCards);
    },

  selectPower: (heroId: string, card: Card) => {
      const state = get().gameState;
      if (!state) return;
      // Guard: if state.phase !== 'setup' return (no-op)
      if (state.phase !== 'setup') return;

      const selection = state.powerSelections?.find(s => s.heroId === heroId);
      if (!selection) return;

      const hero = state.heroes.find(h => h.id === heroId);
      if (!hero) return;

      const constraints = PowerSelectionSystem.getConstraints(hero.heroClass);
      const allPowerCards = getAllPowerCards();

      const updatedSelection = PowerSelectionSystem.selectPower(
        card,
        selection,
        constraints,
        allPowerCards
      );

      const newSelections = state.powerSelections?.map(s =>
        s.heroId === heroId ? updatedSelection : s
      ) ?? [];

      set({ gameState: { ...state, powerSelections: newSelections } });
    },

  deselectPower: (heroId: string, cardId: string) => {
      const state = get().gameState;
      if (!state) return;
      // Guard: if state.phase !== 'setup' return
      if (state.phase !== 'setup') return;

      const selection = state.powerSelections?.find(s => s.heroId === heroId);
      if (!selection) return;

      const updatedSelection = PowerSelectionSystem.deselectPower(cardId, selection);

      const newSelections = state.powerSelections?.map(s =>
        s.heroId === heroId ? updatedSelection : s
      ) ?? [];

      set({ gameState: { ...state, powerSelections: newSelections } });
    },

  confirmHeroSelection: (heroId: string) => {
      const state = get().gameState;
      if (!state) return;
      if (state.phase !== 'setup') return;

      const selection = state.powerSelections?.find(s => s.heroId === heroId);
      if (!selection) return;

      const hero = state.heroes.find(h => h.id === heroId);
      if (!hero) return;

      const constraints = PowerSelectionSystem.getConstraints(hero.heroClass);
      const allPowerCards = getAllPowerCards();

      const confirmResult = PowerSelectionSystem.confirmSelection(selection, constraints, allPowerCards);

      if (!confirmResult.success) {
        console.warn(`[PowerSystem] ${confirmResult.message}`);
        return;
      }

      // Add selected power IDs to the hero
      const selectedPowerIds = confirmResult.selection.selectedPowerIds;

      const updatedHero = {
        ...hero,
        selectedPowerIds
      };

      const newHeroes = state.heroes.map(h =>
        h.id === heroId ? updatedHero : h
      );

      set({ gameState: { ...state, heroes: newHeroes } });
    },

  autoSelectPowers: (heroId: string) => {
      const state = get().gameState;
      if (!state) return;
      if (state.phase !== 'setup') return;

      const selection = state.powerSelections?.find(s => s.heroId === heroId);
      if (!selection) return;

      const hero = state.heroes.find(h => h.id === heroId);
      if (!hero) return;

      const updatedSelection = PowerSelectionSystem.autoSelectPowers(hero.heroClass, heroId, PowerSelectionSystem.getConstraints(hero.heroClass));

      const newSelections = state.powerSelections?.map(s =>
        s.heroId === heroId ? updatedSelection : s
      ) ?? [];

      set({ gameState: { ...state, powerSelections: newSelections } });
    },

  beginAdventure: () => {
      const state = get().gameState;
      if (!state) return;
      if (state.phase !== 'setup') return;

      const allPowerCards = getAllPowerCards();

      // Check all power selections are confirmed
      const allConfirmed = state.heroes.every(hero => {
        const selection = state.powerSelections?.find(s => s.heroId === hero.id);
        return selection && selection.isConfirmed && selection.selectedPowerIds.length > 0;
      });

      if (!allConfirmed) {
        console.warn('Cannot begin adventure: Not all heroes have selected powers.');
        return;
      }

      // Populate hero abilities from powerSelections and set selectedPowerIds
      const newHeroes = state.heroes.map(hero => {
        const selection = state.powerSelections?.find(s => s.heroId === hero.id);
        const powerIds = selection?.selectedPowerIds ?? [];
        const selectedPowerCards = allPowerCards.filter(card => powerIds.includes(card.id));
        const abilities = selectedPowerCards.map(card => card.id);

        return {
          ...hero,
          selectedPowerIds: powerIds,
          abilities
        };
      });

      set({ 
        gameState: { 
          ...state, 
          phase: 'hero', 
          heroes: newHeroes,
          hasAttackedThisTurn: false,
          hasExploredThisTurn: false,
          exploredThisTurn: false
        } 
      });
    }
});
