import { StateCreator } from 'zustand';
import { GameStore, CardSlice } from '../storeTypes';
import { DataLoader } from '../../game/dataLoader';
import { PowerSystem } from '../../game/engine/PowerSystem';
import { EncounterSystem } from '../../game/engine/EncounterSystem';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';
import { Card, GameLogEntry, CardResolutionState } from '../../game/types';
import { executeVillainPhase, executeVillainPhaseStaged } from './villainPhaseLogic';
import { ScenarioManager } from '../../game/scenarios/ScenarioManager';
import { useUIStore } from '../uiStore';
import { isDev } from '../../utils/devEnv';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { getTileGraphDistance } from '../../game/engine/MonsterAI';
import { resetHeroTurnFlags } from '../../game/engine/HeroTurnUtils';
import { CARD_IDS } from '../../game/constants';
import { addLogEntry, formatEncounterOutcome, formatEncounterLogMessage } from '../../game/engine/LogUtils';
import { SoundLibrary } from '../../audio/SoundLibrary';

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
          SoundLibrary.Game.cardPlay();
          if (
            hero.heroClass === 'wizard' ||
            hero.heroClass === 'cleric' ||
            card.heroClass === 'wizard' ||
            card.heroClass === 'cleric' ||
            card.id.startsWith('wizard_') ||
            card.id.startsWith('cleric_')
          ) {
            SoundLibrary.Combat.spell();
          }

          const defeatedBefore = state.monsters.filter(m => m.isDefeated || m.hp <= 0).length;
          const defeatedAfter = result.newState.monsters.filter(m => m.isDefeated || m.hp <= 0).length;
          if (defeatedAfter > defeatedBefore) {
            SoundLibrary.Combat.death();
          }

          const updatedState = addLogEntry(result.newState, {
            message: result.message,
            type: 'spell'
          });
          set({
            gameState: TreasureSystem.processDefeatedMonsters(updatedState)
          });
        } else {
          if (isDev()) console.log('[DEBUG gameStore] Power use failed:', result.message);
        }
      } else if (card.type === 'treasure') {
        SoundLibrary.Game.cardPlay();
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

      SoundLibrary.Game.cardDraw();

      let drawState = result.newState;
      const activeHeroId = drawState.currentHeroId;
      const otherRogue = drawState.heroes.find(h =>
        h.id !== activeHeroId &&
        h.heroClass === 'rogue' &&
        (h.abilities.includes(CARD_IDS.ROGUE_SPRING_AWAY) || h.hand.includes(CARD_IDS.ROGUE_SPRING_AWAY)) &&
        !(h.flippedPowerIds ?? []).includes(CARD_IDS.ROGUE_SPRING_AWAY)
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
              flippedPowerIds: [...(otherRogue.flippedPowerIds ?? []), CARD_IDS.ROGUE_SPRING_AWAY]
            };

            drawState = {
              ...drawState,
              heroes: drawState.heroes.map(h => h.id === updatedRogue.id ? updatedRogue : h)
            };
            drawState = addLogEntry(drawState, {
              message: `${otherRogue.name} uses Spring Away! Teleports to tile (${foundPos.x}, ${foundPos.z}) before the Encounter triggers. Card flips face-down.`,
              type: 'system'
            });
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
        result: null,
        hasLoggedChronicle: false
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
        SoundLibrary.Game.cardPlay();
        let newState = result.newState;

        // Adventure 3: xp_cancel_penalty — active Hero takes 1 damage when spending XP to cancel
        const hasPenalty = state.activeScenario.specialRules?.some(
          r => r.id === 'xp_cancel_penalty'
        );
        const activeHero = newState.heroes.find(h => h.id === newState.currentHeroId);
        if (hasPenalty) {
          SoundLibrary.Combat.hurt();
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

        // Discard the cancelled card
        const discardPiles = { ...newState.discardPiles };
        if (!discardPiles['encounter']) discardPiles['encounter'] = [];
        if (!discardPiles['encounter'].includes(cardId)) {
          discardPiles['encounter'] = [...discardPiles['encounter'], cardId];
        }
        newState = { ...newState, discardPiles };

        // Log Chronicle entry for the encounter card draw with outcome: cancelled by spending 5 XP
        const card = DataLoader.getInstance().getCardById(cardId);
        if (card) {
          const outcome = formatEncounterOutcome(card, {
            cancelledByXP: true,
            xpPenaltyDamage: !!hasPenalty,
            activeHeroName: activeHero?.name
          });
          const message = formatEncounterLogMessage(card, outcome);
          newState = addLogEntry(newState, { message, type: 'encounter' });
        } else {
          newState = addLogEntry(newState, { message: result.message, type: 'encounter' });
        }

        // If there was a pending encounter trigger, check if we still need villain phase activation.
        if (state.pendingEncounter) {
          const stateWithIdleCard = {
            ...newState,
            pendingEncounter: false,
            cardResolution: {
              phase: 'idle' as const,
              cardId: null,
              cardType: null,
              targetEntityId: null,
              pendingEffects: [],
              resolvedEffects: [],
              result: null,
              hasLoggedChronicle: true
            }
          };

          executeVillainPhaseStaged(stateWithIdleCard, set, get);
        } else {
          set({
            gameState: {
              ...newState,
              cardResolution: {
                phase: 'idle' as const,
                cardId: null,
                cardType: null,
                targetEntityId: null,
                pendingEffects: [],
                resolvedEffects: [],
                result: null,
                hasLoggedChronicle: true
              }
            }
          });
        }
      }
    },

  cancelEncounterWithDispelMagic: (cardId: string) => {
      const state = get().gameState;
      if (!state) return;

      const wizard = state.heroes.find(h =>
          h.heroClass === 'wizard' &&
          (h.abilities.includes(CARD_IDS.WIZARD_DISPEL_MAGIC) || h.hand.includes(CARD_IDS.WIZARD_DISPEL_MAGIC)) &&
          !(h.flippedPowerIds ?? []).includes(CARD_IDS.WIZARD_DISPEL_MAGIC)
      );
      if (!wizard) return;

      SoundLibrary.Game.cardPlay();
      SoundLibrary.Combat.spell();

      const updatedWizard = {
          ...wizard,
          flippedPowerIds: [...(wizard.flippedPowerIds ?? []), CARD_IDS.WIZARD_DISPEL_MAGIC]
      };

      // Discard the cancelled card
      const discardPiles = { ...state.discardPiles };
      if (!discardPiles['encounter']) discardPiles['encounter'] = [];
      if (!discardPiles['encounter'].includes(cardId)) {
        discardPiles['encounter'] = [...discardPiles['encounter'], cardId];
      }

      let stateWithWizard = {
        ...state,
        heroes: state.heroes.map(h => h.id === wizard.id ? updatedWizard : h),
        discardPiles
      };

      const card = DataLoader.getInstance().getCardById(cardId);
      if (card) {
        const outcome = formatEncounterOutcome(card, {
          cancelledByDispelMagic: true,
          wizardName: wizard.name
        });
        const message = formatEncounterLogMessage(card, outcome);
        stateWithWizard = addLogEntry(stateWithWizard, { message, type: 'encounter' });
      } else {
        const fallbackMsg = `${wizard.name} uses Dispel Magic! The Encounter Card is cancelled.`;
        stateWithWizard = addLogEntry(stateWithWizard, { message: fallbackMsg, type: 'encounter' });
      }

      // If there was a pending encounter trigger, check if we still need villain phase activation.
      // If we are pendingEncounter from villain phase, we must continue villain phase (monster movement/attack),
      // just like in dismissCardResolution when pendingEncounter is true.
      if (state.pendingEncounter) {
        const stateWithIdleCard = {
          ...stateWithWizard,
          pendingEncounter: false,
          cardResolution: { phase: 'idle' as const, cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null, hasLoggedChronicle: true }
        };

        executeVillainPhaseStaged(stateWithIdleCard, set, get);
      } else {
        const newState = {
            ...stateWithWizard,
            cardResolution: {
                phase: 'idle' as const,
                cardId: null,
                cardType: null,
                pendingEffects: [],
                resolvedEffects: [],
                targetEntityId: null,
                result: null,
                hasLoggedChronicle: true
            }
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
        SoundLibrary.Game.cardDraw();
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

        const logEntryState = addLogEntry(newState, {
          message: `[Treasure] ${result.message}`,
          type: 'treasure'
        });
        set({ gameState: logEntryState });
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
        SoundLibrary.Game.cardPlay();
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

      if (resolution && resolution.cardId && resolution.cardType === 'encounter') {
        const card = DataLoader.getInstance().getCardById(resolution.cardId);
        if (card) {
          if (resolution.phase === 'complete') {
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

          if (!resolution.hasLoggedChronicle) {
            const hero = cleanupState.heroes.find(h => h.id === cleanupState.currentHeroId);
            const spawnedMonster = resolution.spawnedMonsterId
              ? cleanupState.monsters.find(m => m.id === resolution.spawnedMonsterId)
              : undefined;
            const tilePos = hero ? { x: hero.position.x, z: hero.position.z } : undefined;
            const outcome = formatEncounterOutcome(card, {
              spawnedMonsterName: spawnedMonster?.name,
              tilePos
            });
            const message = formatEncounterLogMessage(card, outcome);
            cleanupState = addLogEntry(cleanupState, { message, type: 'encounter' });
          }
        }
      }

      // Check if we need to continue the villain phase after an encounter card
      if (cleanupState.pendingEncounter) {
        // Clear card resolution and continue with monster activation
        const stateWithIdleCard = {
          ...cleanupState,
          pendingEncounter: false,
          cardResolution: { phase: 'idle' as const, cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null, hasLoggedChronicle: true }
        };

        // Execute the villain phase (monster/trap activation)
        executeVillainPhaseStaged(stateWithIdleCard, set, get);
      } else {
        // Normal dismiss without pending villain phase
        set({
          gameState: {
            ...cleanupState,
            cardResolution: { phase: 'idle', cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null, hasLoggedChronicle: true }
          }
        });
      }
    },

});
