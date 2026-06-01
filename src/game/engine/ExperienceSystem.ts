import { GameState, Hero } from '../types';
import { PowerSystem } from './PowerSystem';
import { DataLoader } from '../dataLoader';

/** Scalar: actual XP values are stored as integers (1, 2, 3, 5 per monster). */
const XP_COST_CANCEL = 5;
const XP_COST_LEVEL_UP = 5;

/**
 * Experience System - Manages XP spending and leveling up.
 * All methods that change state are pure — they return new GameState objects.
 *
 * Rules:
 * - Canceling Encounter Cards: Spend monster cards whose XP values sum to ≥ 5 XP
 * - Leveling Up: Triggered by natural 20 on attack or disable trap roll, costs 5 XP
 * - Level 2 Benefits: HP +2, AC +1, Surge Value +1, choose new Daily power
 *
 * XP values per monster (from the rulebook):
 *   1 XP: Rat Swarm, Spider
 *   2 XP: Kobold Skirmisher, Skeleton, Wolf
 *   3 XP: Blazing Skeleton, Ghoul, Zombie
 *   5 XP: Gargoyle, Wraith
 */
export class ExperienceSystem {

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private static addToDiscard(
    piles: GameState['discardPiles'],
    key: string,
    cardIds: string[]
  ): GameState['discardPiles'] {
    const pile = piles[key] ?? [];
    return { ...piles, [key]: [...pile, ...cardIds] };
  }

  /**
   * Looks up a monster template from DataLoader to get its XP value.
   * Monster card IDs in the experience pile are template IDs from the monster deck.
   */
  private static getXpValue(monsterCardId: string): number {
    // Try DataLoader first (for template IDs)
    const template = DataLoader.getInstance().getMonsterById(monsterCardId);
    if (template && template.experienceValue) {
      return template.experienceValue;
    }
    return 1; // fallback: assume 1 XP
  }

  /**
   * Gets the array of actual XP values for each card in the experience pile.
   */
  private static getXpValues(gameState: GameState): number[] {
    return gameState.experiencePile.map(id => ExperienceSystem.getXpValue(id));
  }

  /**
   * Finds the indices of cards from the experience pile whose XP values
   * sum to at least `target`. Uses a simple subset-sum approach.
   * Returns null if no valid subset exists.
   */
  private static findXpSubset(
    values: number[],
    target: number
  ): number[] | null {
    // Greedy: sort by value descending, take largest first.
    // This gives a valid (not necessarily optimal) subset for the "sum to ≥ target" problem.
    const indexed = values.map((v, i) => ({ val: v, idx: i }));
    indexed.sort((a, b) => b.val - a.val);

    let sum = 0;
    const chosen: number[] = [];
    for (const entry of indexed) {
      if (sum >= target) break;
      sum += entry.val;
      chosen.push(entry.idx);
    }

    if (sum >= target) {
      return chosen;
    }

    // If greedy fails (shouldn't with positive values but handle edge case),
    // try a brute-force backtracking for small N.
    if (values.length <= 15) {
      return ExperienceSystem.backtrackSubset(values, target);
    }

    return null;
  }

  /**
   * Brute-force backtracking subset-sum for small arrays (N ≤ 15).
   */
  private static backtrackSubset(values: number[], target: number): number[] | null {
    // Try single elements
    for (let i = 0; i < values.length; i++) {
      if (values[i] >= target) return [i];
    }

    // Try combinations of 2
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        if (values[i] + values[j] >= target) return [i, j];
      }
    }

    // Try combinations of 3
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        for (let k = j + 1; k < values.length; k++) {
          if (values[i] + values[j] + values[k] >= target) return [i, j, k];
        }
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Read-only helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculates total XP available from the experience pile.
   * Each monster card contributes its actual XP value (1, 2, 3, or 5).
   */
  public static getTotalXP(gameState: GameState): number {
    const values = ExperienceSystem.getXpValues(gameState);
    return values.reduce((sum, v) => sum + v, 0);
  }

  /**
   * Returns the number of monster cards in the experience pile. (Read-only.)
   */
  public static getExperienceCardCount(gameState: GameState): number {
    return gameState.experiencePile.length;
  }

  /**
   * Returns a copy of the experience card IDs. (Read-only.)
   */
  public static getExperienceCards(gameState: GameState): string[] {
    return [...gameState.experiencePile];
  }

  /**
   * Checks if the experience pile has enough XP to level up. (Read-only.)
   */
  public static canLevelUp(gameState: GameState, hero: Hero): boolean {
    if (hero.level >= 2) return false;
    return ExperienceSystem.getTotalXP(gameState) >= XP_COST_LEVEL_UP;
  }

  /**
   * Checks if a natural 20 was rolled. (Read-only.)
   */
  public static isNatural20(roll: number): boolean {
    return roll === 20;
  }

  /**
   * Returns true if the roll triggers a level-up opportunity. (Read-only.)
   */
  public static checkLevelUpTrigger(roll: number): boolean {
    if (ExperienceSystem.isNatural20(roll)) {
      return true;
    }
    return false;
  }

  /**
   * Checks whether the party can cancel an encounter card (has enough XP). (Read-only.)
   */
  public static canCancelEncounter(gameState: GameState): boolean {
    const values = ExperienceSystem.getXpValues(gameState);
    return ExperienceSystem.findXpSubset(values, XP_COST_CANCEL) !== null;
  }

  /**
   * Gets hero's surge value including level-2 bonus. (Read-only.)
   */
  public static getSurgeValue(hero: Hero, baseSurgeValue: number): number {
    return hero.level >= 2 ? baseSurgeValue + 1 : baseSurgeValue;
  }

  /**
   * Gets hero's critical hit ability (available at level 2). (Read-only.)
   */
  public static getCriticalAbility(hero: Hero): string | null {
    return hero.level >= 2 ? 'Critical ability active' : null;
  }

  // ---------------------------------------------------------------------------
  // State-modifying methods (return new GameState)
  // ---------------------------------------------------------------------------

  /**
   * Attempts to cancel an encounter card using XP from the experience pile.
   * Cost: any combination of monster cards whose XP values sum to ≥ 5.
   * Returns a new GameState with the spent XP cards removed.
   */
  public static cancelEncounterCard(
    gameState: GameState,
    encounterCardId: string
  ): { newState: GameState; success: boolean; message: string; cardsUsed: string[] } {
    const values = ExperienceSystem.getXpValues(gameState);
    const indices = ExperienceSystem.findXpSubset(values, XP_COST_CANCEL);

    if (!indices) {
      return {
        newState: gameState,
        success: false,
        message: `Cannot cancel encounter: not enough XP. Need at least ${XP_COST_CANCEL} XP worth of monster cards.`,
        cardsUsed: []
      };
    }

    // Sort indices descending so we splice from the end without shifting
    const sortedIndices = [...indices].sort((a, b) => b - a);
    const cardsToSpend: string[] = [];
    const pile = [...gameState.experiencePile];

    for (const idx of sortedIndices) {
      cardsToSpend.push(pile[idx]);
      pile.splice(idx, 1);
    }

    const spentXp = indices.reduce((sum, i) => sum + values[i], 0);

    return {
      newState: {
        ...gameState,
        experiencePile: pile,
        discardPiles: ExperienceSystem.addToDiscard(gameState.discardPiles, 'monster', cardsToSpend)
      },
      success: true,
      message: `Encounter card canceled! Spent ${cardsToSpend.length} monster cards (${spentXp} XP).`,
      cardsUsed: cardsToSpend
    };
  }

  /**
   * Levels up a hero to level 2.
   * Benefits: HP +2, AC +1, Surge Value +1, optional new Daily power.
   * Returns a new GameState with the updated hero and spent XP.
   */
  public static levelUpHero(
    gameState: GameState,
    hero: Hero,
    newDailyPowerId?: string
  ): { newState: GameState; success: boolean; message: string; cardsUsed: string[] } {
    if (!ExperienceSystem.canLevelUp(gameState, hero)) {
      return {
        newState: gameState,
        success: false,
        message: 'Cannot level up: Either not enough XP or already at max level.',
        cardsUsed: []
      };
    }

    const values = ExperienceSystem.getXpValues(gameState);
    const indices = ExperienceSystem.findXpSubset(values, XP_COST_LEVEL_UP);

    if (!indices) {
      return {
        newState: gameState,
        success: false,
        message: 'Cannot level up: Cannot find valid XP combination.',
        cardsUsed: []
      };
    }

    const sortedIndices = [...indices].sort((a, b) => b - a);
    const cardsToSpend: string[] = [];
    const pile = [...gameState.experiencePile];

    for (const idx of sortedIndices) {
      cardsToSpend.push(pile[idx]);
      pile.splice(idx, 1);
    }

    const newMaxHp = hero.maxHp + 2;
    const upgradedHero: Hero = {
      ...hero,
      level: 2,
      maxHp: newMaxHp,
      hp: Math.min(hero.hp + 2, newMaxHp),
      ac: hero.ac + 1,
      abilities: newDailyPowerId ? [...hero.abilities, newDailyPowerId] : hero.abilities
    };

    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? upgradedHero : h);

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        experiencePile: pile,
        discardPiles: ExperienceSystem.addToDiscard(gameState.discardPiles, 'monster', cardsToSpend)
      },
      success: true,
      message: `${hero.name} leveled up from ${hero.level} to 2! HP +2, AC +1, Surge Value +1.`,
      cardsUsed: cardsToSpend
    };
  }

  /**
   * Adds a monster card to the experience pile.
   * The card ID should be the monster template ID (from the monster deck),
   * which has the experienceValue used for XP calculations.
   */
  public static addMonsterToExperiencePile(
    gameState: GameState,
    monsterCardId: string
  ): GameState {
    return { ...gameState, experiencePile: [...gameState.experiencePile, monsterCardId] };
  }

  /**
   * Returns a new GameState with the experience pile reset (for new game).
   */
  public static resetExperiencePile(gameState: GameState): GameState {
    return { ...gameState, experiencePile: [] };
  }
}
