import { GameState, Hero } from '../types';
import { PowerSystem } from './PowerSystem';
import { DataLoader } from '../dataLoader';

// Both costs are 5 per rulebook — separate constants in case they ever diverge
const XP_COST_CANCEL = 5;
const XP_COST_LEVEL_UP = 5;

/**
 * Experience System - Manages XP spending and leveling up.
 * All methods that change state are pure — they return new GameState objects.
 *
 * Rules:
 * - Canceling Encounter Cards: Spend monster cards whose XP values sum to ≥ 5 XP
 * - Leveling Up: Triggered by natural 20 on attack or disable trap roll, costs 5 XP
 * - Level 2 Benefits: Max HP +2, heal 2 HP, AC +1, Surge Value +1, choose new Daily power
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
    const template = DataLoader.getInstance().getMonsterById(monsterCardId);
    if (template && template.experienceValue) {
      return template.experienceValue;
    }
    console.warn(`[ExperienceSystem] No monster template found for ID "${monsterCardId}", defaulting to 1 XP`);
    return 1;
  }

  /**
   * Gets the array of actual XP values for each card in the experience pile.
   */
  private static getXpValues(gameState: GameState): number[] {
    return gameState.experiencePile.map(id => ExperienceSystem.getXpValue(id));
  }

  /**
   * Finds the indices of cards from the experience pile whose XP values
   * sum to at least `target`. Uses a greedy approach (largest-first),
   * which always succeeds for positive values given "sum to ≥ target".
   */
  private static findXpSubset(
    values: number[],
    target: number
  ): number[] | null {
    const indexed = values.map((v, i) => ({ val: v, idx: i }));
    indexed.sort((a, b) => b.val - a.val);

    let sum = 0;
    const chosen: number[] = [];
    for (const entry of indexed) {
      if (sum >= target) break;
      sum += entry.val;
      chosen.push(entry.idx);
    }

    return sum >= target ? chosen : null;
  }

  // ---------------------------------------------------------------------------
  // Read-only helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculates total XP available from the experience pile.
   * Each monster card contributes its actual XP value (1, 2, 3, or 5).
   */
  public static getTotalXP(gameState: GameState): number {
    const monsterXp = ExperienceSystem.getXpValues(gameState).reduce((sum, v) => sum + v, 0);
    const fortuneXp = (gameState.fortuneXpEntries ?? []).reduce((sum, e) => sum + e.amount, 0);
    return monsterXp + fortuneXp;
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
    if (!hero.hasRolledNatural20ThisTurn) return false;
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
    return ExperienceSystem.isNatural20(roll);
  }

  /**
   * Checks whether the party can cancel an encounter card (has enough XP). (Read-only.)
   */
  public static canCancelEncounter(gameState: GameState): boolean {
    const values = ExperienceSystem.getXpValues(gameState);
    return ExperienceSystem.findXpSubset(values, XP_COST_CANCEL) !== null;
  }

  /**
   * Gets hero's effective surge value including level-2 bonus. (Read-only.)
   */
  public static getSurgeValue(hero: Hero): number {
    return hero.level >= 2 ? hero.surgeValue + 1 : hero.surgeValue;
  }

  /**
   * Returns true if the hero has access to critical hit ability (level 2+). (Read-only.)
   */
  public static hasCriticalAbility(hero: Hero): boolean {
    return hero.level >= 2;
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
    gameState: GameState
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
   * Benefits: Max HP +2, heal 2 HP, AC +1, Surge Value +1, optional new Daily power.
   * Returns a new GameState with the updated hero and spent XP.
   */
  public static levelUpHero(
    gameState: GameState,
    hero: Hero,
    newDailyPowerId?: string
  ): { newState: GameState; success: boolean; message: string; cardsUsed: string[] } {
    if (hero.level >= 2) {
      return {
        newState: gameState,
        success: false,
        message: 'Cannot level up: already at max level.',
        cardsUsed: []
      };
    }

    if (!hero.hasRolledNatural20ThisTurn) {
      return {
        newState: gameState,
        success: false,
        message: 'Cannot level up: you must roll a natural 20 on an attack or disable trap roll this turn.',
        cardsUsed: []
      };
    }

    const values = ExperienceSystem.getXpValues(gameState);
    const indices = ExperienceSystem.findXpSubset(values, XP_COST_LEVEL_UP);

    if (!indices) {
      return {
        newState: gameState,
        success: false,
        message: `Cannot level up: not enough XP. Need at least ${XP_COST_LEVEL_UP} XP worth of monster cards.`,
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

  /**
   * Cures Mummy Rot by spending 5 XP.
   */
  public static cureMummyRot(
    gameState: GameState,
    hero: Hero
  ): { newState: GameState; success: boolean; message: string; cardsUsed: string[] } {
    if (!hero.conditions?.some(c => c.type === 'mummy_rot')) {
      return {
        newState: gameState,
        success: false,
        message: 'Cannot cure: hero does not have Mummy Rot.',
        cardsUsed: []
      };
    }

    const values = ExperienceSystem.getXpValues(gameState);
    const indices = ExperienceSystem.findXpSubset(values, 5);

    if (!indices) {
      return {
        newState: gameState,
        success: false,
        message: `Cannot cure Mummy Rot: not enough XP. Need at least 5 XP worth of monster cards.`,
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

    // Remove the mummy_rot condition
    const updatedConditions = hero.conditions.filter(c => c.type !== 'mummy_rot');
    const updatedHero = { ...hero, conditions: updatedConditions };
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        experiencePile: pile,
        discardPiles: ExperienceSystem.addToDiscard(gameState.discardPiles, 'monster', cardsToSpend)
      },
      success: true,
      message: `Cured ${hero.name}'s Mummy Rot! Spent ${cardsToSpend.length} monster cards (5 XP).`,
      cardsUsed: cardsToSpend
    };
  }
}
