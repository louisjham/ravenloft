import { Monster, GameState, BossPhase, TacticPattern } from '../types';

// TODO: Import from AMI-5 when available
// import { BOSS_TACTICS } from './BossTactics';

/**
 * Boss phase definitions - will be replaced by BOSS_TACTICS from AMI-5
 */
const BOSS_PHASES: Record<string, BossPhase[]> = {
  'strahd': [
    {
      id: 'p1',
      className: 'The Lord of Ravenloft',
      hpThreshold: 1.0,
      triggers: ['start'],
      abilities: ['fireball', 'summon_skeletons'],
      tactics: [
        { condition: 'hp_full', actions: ['cast_fireball'] },
        { condition: 'heroes_near', actions: ['summon_skeletons'] }
      ]
    },
    {
      id: 'p2',
      className: 'The Ancient Fear',
      hpThreshold: 0.5,
      triggers: ['half_hp'],
      abilities: ['vampiric_bite', 'mist_stride', 'multiattack'],
      tactics: [
        { condition: 'hp_low', actions: ['vampiric_bite'] },
        { condition: 'surrounded', actions: ['mist_stride'] },
        { condition: 'default', actions: ['multiattack'] }
      ]
    }
  ],
  'vampire_lord': [
    {
      id: 'drain',
      className: 'Bloodweaver',
      hpThreshold: 1.0,
      triggers: ['start'],
      abilities: ['drain_life'],
      tactics: [
        { condition: 'default', actions: ['drain_life'] }
      ]
    },
    {
      id: 'frenzy',
      className: 'Sanguine Beast',
      hpThreshold: 0.3,
      triggers: ['near_death'],
      abilities: ['blood_frenzy', 'regeneration'],
      tactics: [
        { condition: 'near_death', actions: ['blood_frenzy'] },
        { condition: 'hp_low', actions: ['regeneration'] }
      ]
    }
  ]
};

/**
 * Manages complex phase transitions for boss monsters like Strahd or Vampires.
 */
export class BossPhases {
  /**
   * Gets the current active phase for a boss monster.
   * @param monster The monster to check
   * @param gameState The current game state
   * @returns The current BossPhase or null if not a boss or no phases found
   */
  public static getCurrentPhase(
    monster: Monster,
    gameState: GameState
  ): BossPhase | null {
    // If monster.isBoss is false or undefined → return null
    if (!monster.isBoss) {
      return null;
    }

    // Load boss phase definitions by monster.monsterType
    const phases = BOSS_PHASES[monster.monsterType.toLowerCase()];
    if (!phases || phases.length === 0) {
      return null;
    }

    // Find the phase whose id matches monster.currentPhase
    if (monster.currentPhase) {
      const matchingPhase = phases.find(p => p.id === monster.currentPhase);
      if (matchingPhase) {
        return matchingPhase;
      }
    }

    // If monster.currentPhase is null/undefined, return the phase with the highest hpThreshold
    const sortedPhases = [...phases].sort((a, b) => b.hpThreshold - a.hpThreshold);
    return sortedPhases[0] || null;
  }

  /**
   * Determines if a boss monster should transition to a new phase based on HP.
   * @param monster The monster to check
   * @param gameState The current game state
   * @returns true if a phase transition should occur, false otherwise
   */
  public static shouldTransitionPhase(
    monster: Monster,
    gameState: GameState
  ): boolean {
    // If not a boss → return false
    if (!monster.isBoss) {
      return false;
    }

    // Get all phases for this monsterType sorted by hpThreshold descending
    const phases = BOSS_PHASES[monster.monsterType.toLowerCase()];
    if (!phases || phases.length === 0) {
      return false;
    }

    const sortedPhases = [...phases].sort((a, b) => b.hpThreshold - a.hpThreshold);

    // Compute hpPercent = monster.hp / monster.maxHp
    const hpPercent = monster.hp / monster.maxHp;

    // Find the highest-threshold phase where hpThreshold <= hpPercent
    let targetPhase: BossPhase | null = null;
    for (const phase of sortedPhases) {
      if (hpPercent <= phase.hpThreshold) {
        targetPhase = phase;
      } else {
        break;
      }
    }

    // If no phase found (shouldn't happen with proper config), return false
    if (!targetPhase) {
      return false;
    }

    // Return true if that phase's id !== monster.currentPhase
    return targetPhase.id !== monster.currentPhase;
  }

  /**
   * Transitions a boss monster to the appropriate phase based on current HP.
   * @param monster The monster to transition
   * @param gameState The current game state
   * @returns A new GameState with the monster's currentPhase updated, or unchanged state if no transition needed
   */
  public static transitionPhase(
    monster: Monster,
    gameState: GameState
  ): GameState {
    // If not a boss → return state unchanged
    if (!monster.isBoss) {
      return gameState;
    }

    // Get all phases for this monsterType sorted by hpThreshold descending
    const phases = BOSS_PHASES[monster.monsterType.toLowerCase()];
    if (!phases || phases.length === 0) {
      return gameState;
    }

    const sortedPhases = [...phases].sort((a, b) => b.hpThreshold - a.hpThreshold);

    // Compute hpPercent = monster.hp / monster.maxHp
    const hpPercent = monster.hp / monster.maxHp;

    // Find the highest-threshold phase where hpThreshold <= hpPercent
    let targetPhase: BossPhase | null = null;
    for (const phase of sortedPhases) {
      if (hpPercent <= phase.hpThreshold) {
        targetPhase = phase;
      } else {
        break;
      }
    }

    // If no phase found or already in this phase, return state unchanged
    if (!targetPhase || targetPhase.id === monster.currentPhase) {
      return gameState;
    }

    // Return new GameState where that monster's currentPhase is set to the new phase id
    const updatedMonsters = gameState.monsters.map(m =>
      m.id === monster.id ? { ...m, currentPhase: targetPhase!.id } : m
    );

    return {
      ...gameState,
      monsters: updatedMonsters
    };
  }

  /**
   * Gets the tactic patterns for the current phase of a boss monster.
   * @param monster The monster to get tactics for
   * @param gameState The current game state
   * @returns Array of TacticPattern for the current phase, or empty array if not a boss or no phase found
   */
  public static getPhaseTactics(
    monster: Monster,
    gameState: GameState
  ): TacticPattern[] {
    const currentPhase = this.getCurrentPhase(monster, gameState);
    return currentPhase?.tactics ?? [];
  }
}

export default BossPhases;
