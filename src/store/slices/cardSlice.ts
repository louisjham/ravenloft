import { StateCreator } from 'zustand';
import { GameStore, CardSlice } from '../storeTypes';
import { DataLoader } from '../../game/dataLoader';
import { PowerSystem } from '../../game/engine/PowerSystem';
import { EncounterSystem } from '../../game/engine/EncounterSystem';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';
import { Card, GameLogEntry, CardResolutionState } from '../../game/types';
import { executeVillainPhase } from './villainPhaseLogic';
import { ScenarioManager } from '../../game/scenarios/ScenarioManager';
import { useUIStore } from '../uiStore';
import { isDev } from '../../utils/devEnv';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { getTileGraphDistance } from '../../game/engine/MonsterAI';

export const createCardSlice: StateCreator<GameStore, [], [], CardSlice> = (set, get) => ({
  playCard: (cardId: string, targetId: string) => {
      if (isDev()) console.log('[DEBUG gameStore] Play card:', cardId, 'on target:', targetId);
      const state = get().gameState;
      if (!state) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);
      if (!card) {
        if (isDev()) console.log('[DEBUG gameStore] Card not found:', cardId);
        return;
      }

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) {
        if (isDev()) console.log('[DEBUG gameStore] Hero not found:', state.currentHeroId);
        return;
      }

      // Handle different card types
      if (card.type === 'ability') {
        const target = targetId ? [...state.heroes, ...state.monsters].find(e => e.id === targetId) || null : null;
        const result = PowerSystem.usePower(hero, card, target, state);

        if (result.success) {
          const updatedLog: GameLogEntry[] = [
            ...state.log,
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              message: result.message,
              type: 'event' as const
            }
          ].slice(-100);
          set({
            gameState: TreasureSystem.processDefeatedMonsters({
              ...result.newState,
              log: updatedLog
            })
          });
        } else {
          if (isDev()) console.log('[DEBUG gameStore] Power use failed:', result.message);
        }
      } else if (card.type === 'treasure') {
        let newState = { ...state };
        if (card.treasureType === 'blessing') {
          const result = TreasureSystem.useBlessing(newState, card, hero);
          newState = result.newState;
          if (isDev()) console.log('[DEBUG gameStore] Blessing result:', result);
        } else if (card.treasureType === 'fortune') {
          const result = TreasureSystem.useFortune(newState, card, hero);
          newState = result.newState;
          if (isDev()) console.log('[DEBUG gameStore] Fortune result:', result);
        } else if (card.treasureType === 'item') {
          const result = TreasureSystem.assignItem(newState, card, hero);
          newState = result.newState;
          if (isDev()) console.log('[DEBUG gameStore] Item assigned:', result);
        }
        set({ gameState: newState });
      }
    },

  drawEncounterCard: () => {
      const state = get().gameState;
      if (!state) return;

      const respiteResult = TreasureSystem.checkAndDiscardRespite(state, 'encounterDeck');
      if (respiteResult.wasRespite) {
        set({ gameState: respiteResult.gameState });
        return;
      }

      const result = EncounterSystem.drawEncounterCard(respiteResult.gameState);
      if (!result.card) {
        set({ gameState: result.newState });
        return;
      }

      let drawState = result.newState;
      const activeHeroId = drawState.currentHeroId;
      const otherRogue = drawState.heroes.find(h =>
        h.id !== activeHeroId &&
        h.heroClass === 'rogue' &&
        (h.abilities.includes('rogue_spring_away') || h.hand.includes('rogue_spring_away')) &&
        !(h.flippedPowerIds ?? []).includes('rogue_spring_away')
      );

      if (otherRogue) {
        const rogueTile = drawState.tiles.find(t => t.x === otherRogue.position.x && t.z === otherRogue.position.z);
        if (rogueTile) {
          const validTiles = drawState.tiles.filter(t => {
            return getTileGraphDistance(rogueTile, t, drawState.tiles) === 2;
          });

          let foundPos = null;
          for (const tile of validTiles) {
            for (let sqX = 0; sqX < 4; sqX++) {
              for (let sqZ = 0; sqZ < 4; sqZ++) {
                const occupied =
                  drawState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                  drawState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                if (!occupied) {
                  foundPos = { x: tile.x, z: tile.z, sqX, sqZ };
                  break;
                }
              }
              if (foundPos) break;
            }
            if (foundPos) break;
          }

          if (foundPos) {
            const updatedRogue = {
              ...otherRogue,
              position: foundPos,
              flippedPowerIds: [...(otherRogue.flippedPowerIds ?? []), 'rogue_spring_away']
            };

            const springAwayLog: GameLogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              message: `${otherRogue.name} uses Spring Away! Teleports to tile (${foundPos.x}, ${foundPos.z}) before the Encounter triggers. Card flips face-down.`,
              type: 'system' as const
            };

            drawState = {
              ...drawState,
              heroes: drawState.heroes.map(h => h.id === updatedRogue.id ? updatedRogue : h),
              log: [...drawState.log, springAwayLog].slice(-100)
            };
          }
        }
      }

      const cardResolution: CardResolutionState = {
        phase: 'revealing',
        cardId: result.card.id,
        cardType: result.card.type as 'encounter' | 'treasure',
        pendingEffects: [],
        resolvedEffects: [],
        targetEntityId: null,
        result: null
      };

      set({
        gameState: {
          ...drawState,
          cardResolution
        }
      });
    },

  cancelEncounterCard: (cardId: string) => {
      const state = get().gameState;
      if (!state) return;

      const result = ExperienceSystem.cancelEncounterCard(state);
      if (isDev()) console.log('[DEBUG gameStore] Cancel encounter:', result.message);
      if (result.success) {
        let newState = result.newState;

        // Adventure 3: xp_cancel_penalty — active Hero takes 1 damage when spending XP to cancel
        const hasPenalty = state.activeScenario.specialRules?.some(
          r => r.id === 'xp_cancel_penalty'
        );
        if (hasPenalty) {
          const activeHero = newState.heroes.find(h => h.id === newState.currentHeroId);
          if (activeHero) {
            const damagedHero = { ...activeHero, hp: Math.max(0, activeHero.hp - 1) };
            newState = {
              ...newState,
              heroes: newState.heroes.map(h =>
                h.id === activeHero.id ? damagedHero : h
              )
            };
          }
        }

        set({ gameState: newState });
      }
    },

  cancelEncounterWithDispelMagic: (cardId: string) => {
      const state = get().gameState;
      if (!state) return;

      const wizard = state.heroes.find(h =>
          h.heroClass === 'wizard' &&
          (h.abilities.includes('wizard_dispel_magic') || h.hand.includes('wizard_dispel_magic')) &&
          !(h.flippedPowerIds ?? []).includes('wizard_dispel_magic')
      );
      if (!wizard) return;

      const updatedWizard = {
          ...wizard,
          flippedPowerIds: [...(wizard.flippedPowerIds ?? []), 'wizard_dispel_magic']
      };

      const logEntry: GameLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `${wizard.name} uses Dispel Magic! The Encounter Card is cancelled.`,
          type: 'system' as const
      };

      // Discard the cancelled card
      const discardPiles = { ...state.discardPiles };
      if (!discardPiles['encounter']) discardPiles['encounter'] = [];
      if (!discardPiles['encounter'].includes(cardId)) {
        discardPiles['encounter'] = [...discardPiles['encounter'], cardId];
      }

      // If there was a pending encounter trigger, check if we still need villain phase activation.
      // If we are pendingEncounter from villain phase, we must continue villain phase (monster movement/attack),
      // just like in dismissCardResolution when pendingEncounter is true.
      if (state.pendingEncounter) {
        const stateWithIdleCard = {
          ...state,
          heroes: state.heroes.map(h => h.id === wizard.id ? updatedWizard : h),
          discardPiles,
          log: [...state.log, logEntry].slice(-100),
          pendingEncounter: false,
          cardResolution: { phase: 'idle' as const, cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null }
        };

        const villainState = executeVillainPhase(stateWithIdleCard);

        if (villainState.phase !== 'setup') {
          const isDefeated = ScenarioManager.checkDefeat(villainState);
          if (isDefeated) {
            set({
              gameState: { ...villainState, phase: 'defeat' as const }
            });
            useUIStore.getState().showModal('defeat');
            return;
          }
        }

        const currentIndex = villainState.turnOrder.indexOf(villainState.currentHeroId);
        const nextIndex = (currentIndex + 1) % villainState.turnOrder.length;
        const nextId = villainState.turnOrder[nextIndex];
        const stateAfterTurnStart = ConditionSystem.processTurnStart(villainState, nextId);

        // Bug 5: Check defeat right at the start of the next hero's turn
        if (ScenarioManager.checkDefeat({ ...stateAfterTurnStart, currentHeroId: nextId })) {
          set({ gameState: { ...stateAfterTurnStart, currentHeroId: nextId, phase: 'defeat' as const } });
          useUIStore.getState().showModal('defeat');
          return;
        }

        set({
          gameState: {
            ...stateAfterTurnStart,
            currentHeroId: nextId,
            phase: 'hero' as const,
            hasExploredThisTurn: false,
            exploredThisTurn: false,
            lastPlacedTileEncounterType: null,
            lastPlacedTileId: null,
            turnCount: stateAfterTurnStart.turnCount + (nextIndex === 0 ? 1 : 0),
            heroes: stateAfterTurnStart.heroes.map(h => ({
              ...h,
              extraActionsThisTurn: 0,
            }))
          }
        });
      } else {
        const newState = {
            ...state,
            heroes: state.heroes.map(h => h.id === wizard.id ? updatedWizard : h),
            discardPiles,
            cardResolution: {
                phase: 'idle' as const,
                cardId: '',
                cardType: 'encounter' as const,
                pendingEffects: [],
                resolvedEffects: [],
                targetEntityId: null,
                result: null
            },
            log: [...state.log, logEntry].slice(-100)
        };
        set({ gameState: newState });
      }
    },

  drawTreasureCard: () => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const respiteResult = TreasureSystem.checkAndDiscardRespite(state, 'treasureDeck');
      if (respiteResult.wasRespite) {
        set({ gameState: respiteResult.gameState });
        return;
      }

      const result = TreasureSystem.drawTreasureCard(respiteResult.gameState, hero);
      if (result.card) {
        let newState = result.newState;
        if (result.card.treasureType === 'blessing') {
          const blessingResult = TreasureSystem.useBlessing(newState, result.card, hero);
          newState = blessingResult.newState;
        } else if (result.card.treasureType === 'fortune') {
          const fortuneResult = TreasureSystem.useFortune(newState, result.card, hero);
          newState = fortuneResult.newState;
        } else {
          const assignResult = TreasureSystem.assignItem(newState, result.card, hero);
          newState = assignResult.newState;
        }

        const logEntry: GameLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: result.message,
          type: 'event'
        };

        const newLog = [...(newState.log || []), logEntry].slice(-100);
        set({ gameState: { ...newState, log: newLog } });
      }
    },

  useTreasureCard: (cardId: string, targetId?: string) => {
      const state = get().gameState;
      if (!state) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);
      if (!card) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const target = targetId ? [...state.heroes, ...state.monsters].find(e => e.id === targetId) || null : null;
      const result = TreasureSystem.useItem(state, card, hero, target);
      if (isDev()) console.log('[DEBUG gameStore] Use treasure:', result.message);
      if (result.success) {
        set({ gameState: result.newState });
      }
    },

  assignItem: (cardId: string, heroId: string) => {
      const state = get().gameState;
      if (!state) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);
      if (!card) return;

      const hero = state.heroes.find(h => h.id === heroId);
      if (!hero) return;

      const result = TreasureSystem.assignItem(state, card, hero);
      if (isDev()) console.log('[DEBUG gameStore] Assign item:', result.message);
      if (result.success) {
        set({ gameState: result.newState });
      }
    },

  advanceCardResolution: () => {
      const { gameState } = get();
      if (!gameState || !gameState.cardResolution) return;

      const nextState = EncounterSystem.advanceCardResolution(gameState);
      set({ gameState: nextState });
    },

  selectResolutionTarget: (entityId: string) => {
      const { gameState } = get();
      if (!gameState || !gameState.cardResolution) return;

      const nextState = {
        ...gameState,
        cardResolution: {
          ...gameState.cardResolution,
          targetEntityId: entityId
        }
      };
      set({ gameState: nextState });
    },

  dismissCardResolution: () => {
      const { gameState } = get();
      if (!gameState) return;

      // ── Card cleanup (discard, environment, trap) ────────────────────────
      const resolution = gameState.cardResolution;
      let cleanupState = { ...gameState };

      if (resolution && resolution.phase === 'complete' && resolution.cardId) {
        const card = DataLoader.getInstance().getCardById(resolution.cardId);
        if (card && resolution.cardType === 'encounter') {
          const discardPiles = { ...cleanupState.discardPiles };
          if (!discardPiles['encounter']) discardPiles['encounter'] = [];
          if (!discardPiles['encounter'].includes(card.id)) {
            discardPiles['encounter'] = [...discardPiles['encounter'], card.id];
          }
          cleanupState = { ...cleanupState, discardPiles };

          const hero = cleanupState.heroes.find(h => h.id === cleanupState.currentHeroId);
          if (hero) {
            if (card.encounterType === 'environment') {
              cleanupState = { ...cleanupState, activeEnvironmentCard: card.id };
            } else if (card.encounterType === 'trap') {
              const trapResult = EncounterSystem.placeTrap(cleanupState, card, hero);
              cleanupState = trapResult.gameState;
            }
          }
        }
      }

      // Check if we need to continue the villain phase after an encounter card
      if (cleanupState.pendingEncounter) {
        // Clear card resolution and continue with monster activation
        const stateWithIdleCard = {
          ...cleanupState,
          pendingEncounter: false,
          cardResolution: { phase: 'idle' as const, cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null }
        };

        // Execute the villain phase (monster/trap activation)
        const villainState = executeVillainPhase(stateWithIdleCard);

        // Check defeat after villain phase (heroes may have been killed by monsters)
        if (villainState.phase !== 'setup') {
          const isDefeated = ScenarioManager.checkDefeat(villainState);
          if (isDefeated) {
            set({
              gameState: { ...villainState, phase: 'defeat' as const }
            });
            useUIStore.getState().showModal('defeat');
            return;
          }
        }

        // Advance to next hero
        const currentIndex = villainState.turnOrder.indexOf(villainState.currentHeroId);
        const nextIndex = (currentIndex + 1) % villainState.turnOrder.length;
        const nextId = villainState.turnOrder[nextIndex];
        const stateAfterTurnStart = ConditionSystem.processTurnStart(villainState, nextId);
 
        // Bug 5: Check defeat right at the start of the next hero's turn
        if (ScenarioManager.checkDefeat({ ...stateAfterTurnStart, currentHeroId: nextId })) {
          set({ gameState: { ...stateAfterTurnStart, currentHeroId: nextId, phase: 'defeat' as const } });
          useUIStore.getState().showModal('defeat');
          return;
        }

        set({
          gameState: {
            ...stateAfterTurnStart,
            currentHeroId: nextId,
            phase: 'hero' as const,
            hasExploredThisTurn: false,
            exploredThisTurn: false,
            lastPlacedTileEncounterType: null,
            lastPlacedTileId: null,
            turnCount: stateAfterTurnStart.turnCount + (nextIndex === 0 ? 1 : 0),
            // Reset per-turn fortune flags on all heroes
            heroes: stateAfterTurnStart.heroes.map(h => ({
              ...h,
              extraActionsThisTurn: 0,
              hasRolledNatural20ThisTurn: false,
              hasUsedSurgeThisTurn: false,
              isExhausted: false,
            })),
            hasAttackedThisTurn: false
          }
        });
      } else {
        // Normal dismiss without pending villain phase
        set({
          gameState: {
            ...cleanupState,
            cardResolution: { phase: 'idle', cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null }
          }
        });
      }
    },

});
