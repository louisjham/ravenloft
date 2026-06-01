import { Card, CardResolutionState, Effect, GameState, Hero } from '../types';
import { EncounterSystem } from './EncounterSystem';
import { TreasureSystem } from './TreasureSystem';

export class CardResolutionSystem {
  public static beginResolution(
    state: GameState,
    card: Card,
    activeHero: Hero
  ): GameState {
    return {
      ...state,
      cardResolution: {
        phase: 'drawing',
        cardId: card.id,
        cardType: card.type as 'encounter' | 'treasure',
        targetEntityId: activeHero.id,
        result: null,
        pendingEffects: [],
        resolvedEffects: []
      }
    };
  }

  public static advanceResolution(state: GameState, activeHero: Hero): GameState {
    const res = state.cardResolution;
    if (!res || res.phase === 'idle') return state;

    switch (res.phase) {
      case 'drawing':
        return {
          ...state,
          cardResolution: { ...res, phase: 'revealing' }
        };

      case 'revealing': {
        const pendingEffects: Effect[] = [];
        if (res.cardId === 'encounter-volcanic-smoke') {
          pendingEffects.push({ type: 'status_effect' as any, statusEffect: 'frightened', duration: 1, target: 'single' });
        } else if (res.cardId === 'event_test') {
          pendingEffects.push({ type: 'damage' as any, value: 2, target: 'single' });
        } else if (res.cardType === 'treasure') {
          pendingEffects.push({ type: 'heal' as any, value: 1, target: 'self' });
        }
        return {
          ...state,
          cardResolution: { ...res, phase: 'resolving', pendingEffects }
        };
      }

      case 'resolving': {
        const pending = [...(res.pendingEffects ?? [])];
        const resolved = [...(res.resolvedEffects ?? [])];

        if (pending.length > 0) {
          const effect = pending.shift()!;
          const newState = this.applyCardEffect(effect, activeHero, state);

          const currentRes = newState.cardResolution;
          if (currentRes) {
            const nextResolved = [...(currentRes.resolvedEffects ?? []), effect];
            const nextPhase = pending.length === 0 ? 'complete' : 'resolving';

            return {
              ...newState,
              cardResolution: {
                ...currentRes,
                phase: nextPhase,
                pendingEffects: pending,
                resolvedEffects: nextResolved,
                result: pending.length === 0 ? { success: true, message: 'Card resolution complete' } : currentRes.result
              }
            };
          }
        }

        return {
          ...state,
          cardResolution: { ...res, phase: 'complete', pendingEffects: pending, resolvedEffects: resolved }
        };
      }

      case 'complete':
        return this.clearResolution(state);

      default:
        return state;
    }
  }

  public static clearResolution(state: GameState): GameState {
    return {
      ...state,
      cardResolution: {
        phase: 'idle',
        cardId: null,
        cardType: null,
        targetEntityId: null,
        result: null,
        pendingEffects: [],
        resolvedEffects: []
      }
    };
  }

  private static applyCardEffect(effect: Effect, target: Hero, state: GameState): GameState {
    if (!state.cardResolution) return state;

    if (state.cardResolution.cardType === 'encounter') {
      const card: Card = {
        id: state.cardResolution.cardId!,
        type: 'encounter',
        name: 'Temp',
        description: '',
        effects: [effect]
      };

      if (effect.type === 'damage') {
        return EncounterSystem.processEventCard(state, card, target).gameState;
      } else if (effect.type === 'status_effect') {
        return EncounterSystem.processEnvironmentCard(state, card).gameState;
      }
    } else if (state.cardResolution.cardType === 'treasure') {
      const card: Card = {
        id: state.cardResolution.cardId!,
        type: 'treasure',
        name: 'Temp',
        description: '',
        effects: [effect],
        treasureType: 'item'
      };
      const result = TreasureSystem.useFortune(state, card, target);
      return result.newState;
    }
    return state;
  }

  public static assignTreasure(state: GameState, card: Card, hero: Hero): GameState {
    const treasureAssignments = [...(state.treasureAssignments ?? [])];
    treasureAssignments.push({
      heroId: hero.id,
      cardId: card.id,
      assignedAt: state.turnCount,
      isUsed: false
    });
    const assignResult = TreasureSystem.assignItem({ ...state, treasureAssignments }, card, hero);
    return assignResult.newState;
  }

  public static useTreasure(state: GameState, card: Card, hero: Hero, target?: any): GameState {
    if (!state.treasureAssignments) return state;

    const treasureAssignments = state.treasureAssignments.map(a =>
      a.heroId === hero.id && a.cardId === card.id && !a.isUsed
        ? { ...a, isUsed: true }
        : a
    );
    const useResult = TreasureSystem.useItem({ ...state, treasureAssignments }, card, hero, target);
    return useResult.newState;
  }
}
