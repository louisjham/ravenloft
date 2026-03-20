import { Card, CardResolutionState, Effect, GameState, Hero } from '../types';
import { EncounterSystem } from './EncounterSystem';
import { TreasureSystem } from './TreasureSystem';

/**
 * Card Resolution System - Manages the phased resolution of card effects
 * 
 * Phases:
 * 1. drawing -> revealing
 * 2. revealing -> resolving (populates pendingEffects)
 * 3. resolving -> (processes one effect at a time) -> resolving/complete
 * 4. complete -> idle (clears resolution state)
 */
export class CardResolutionSystem {
  /**
   * Initializes the card resolution state for a drawn card
   */
  public static beginResolution(
    state: GameState,
    card: Card,
    activeHero: Hero
  ): GameState {
    state.cardResolution = {
      phase: 'drawing',
      cardId: card.id,
      cardType: card.type as 'encounter' | 'treasure',
      targetEntityId: activeHero.id,
      result: null,
      pendingEffects: [],
      resolvedEffects: []
    };
    return state;
  }

  /**
   * Advances the resolution phase and processes effects
   */
  public static advanceResolution(state: GameState, activeHero: Hero): GameState {
    const res = state.cardResolution;
    if (!res || res.phase === 'idle') return state;

    switch (res.phase) {
      case 'drawing':
        res.phase = 'revealing';
        break;

      case 'revealing':
        res.phase = 'resolving';
        // Mock card lookup for effect population
        if (res.cardId === 'encounter-volcanic-smoke') {
          res.pendingEffects = [{ type: 'status_effect', statusEffect: 'frightened', duration: 1, target: 'single' }];
        } else if (res.cardId === 'event_test') {
          res.pendingEffects = [{ type: 'damage', value: 2, target: 'single' }];
        } else if (res.cardType === 'treasure') {
          res.pendingEffects = [{ type: 'heal', value: 1, target: 'self' }];
        }
        break;

      case 'resolving':
        if ((res.pendingEffects ?? []).length > 0) {
          const effect = (res.pendingEffects ?? []).shift()!;
          this.applyCardEffect(effect, activeHero, state);
          (res.resolvedEffects ?? []).push(effect);

          if ((res.pendingEffects ?? []).length === 0) {
            res.phase = 'complete';
            res.result = { success: true, message: 'Card resolution complete' };
          }
        } else {
          res.phase = 'complete';
        }
        break;

      case 'complete':
        this.clearResolution(state);
        break;
    }
    return state;
  }

  /**
   * Clears the card resolution state
   */
  public static clearResolution(state: GameState): GameState {
    state.cardResolution = {
      phase: 'idle',
      cardId: null,
      cardType: null,
      targetEntityId: null,
      result: null,
      pendingEffects: [],
      resolvedEffects: []
    };
    return state;
  }

  /**
   * Delegates specific card effect application to Encounter or Treasure systems
   */
  private static applyCardEffect(effect: Effect, target: Hero, state: GameState): void {
    if (!state.cardResolution) return;

    if (state.cardResolution.cardType === 'encounter') {
      const card: Card = {
        id: state.cardResolution.cardId!,
        type: 'encounter',
        name: 'Temp',
        description: '',
        effects: [effect]
      };

      if (effect.type === 'damage') {
        EncounterSystem.processEventCard(state, card, target);
      } else if (effect.type === 'status_effect') {
        EncounterSystem.processEnvironmentCard(state, card);
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
      TreasureSystem.useFortune(state, card, target);
    }
  }

  /**
   * Assigns a treasure card to a hero and tracks it
   */
  public static assignTreasure(state: GameState, card: Card, hero: Hero): GameState {
    if (!state.treasureAssignments) {
      state.treasureAssignments = [];
    }

    state.treasureAssignments.push({
      heroId: hero.id,
      cardId: card.id,
      assignedAt: state.turnCount,
      isUsed: false
    });
    TreasureSystem.assignItem(state, card, hero);
    return state;
  }

  /**
   * Marks a treasure as used if it was assigned to a hero
   */
  public static useTreasure(state: GameState, card: Card, hero: Hero, target?: any): GameState {
    if (!state.treasureAssignments) return state;

    const assignment = state.treasureAssignments.find(
      a => a.heroId === hero.id && a.cardId === card.id && !a.isUsed
    );

    if (assignment) {
      assignment.isUsed = true;
      TreasureSystem.useItem(state, card, hero, target);
    }
    return state;
  }
}
