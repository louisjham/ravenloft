import { Hero } from '../types';

/**
 * Resets all per-turn flags on a hero at the start of their next turn.
 * Single source of truth — prevents the drift that previously caused
 * hasAttackedThisTurn to be omitted in one branch of cancelEncounterWithDispelMagic.
 *
 * NOTE: startedTurnAdjacentToDreadWarriorIds is intentionally NOT reset here
 * because it is computed once at turn-start in coreSlice.endTurn before being
 * passed in, not reset to empty.
 */
export function resetHeroTurnFlags(h: Hero): Hero {
  return {
    ...h,
    extraActionsThisTurn: 0,
    hasRolledNatural20ThisTurn: false,
    hasUsedSurgeThisTurn: false,
    isExhausted: false,
  };
}
