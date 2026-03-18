import { Monster, GameState } from '../types';

export interface BossPhase {
  id: string;
  className: string;
  hpThreshold: number; // 0.0 to 1.0
  triggers: string[];
  abilities: string[];
}

/**
 * Manages complex phase transitions for boss monsters like Strahd or Vampires.
 */
export class BossPhases {
  private static config: Record<string, BossPhase[]> = {
    'strahd': [
      {
        id: 'p1',
        className: 'The Lord of Ravenloft',
        hpThreshold: 1.0,
        triggers: ['start'],
        abilities: ['fireball', 'summon_skeletons']
      },
      {
        id: 'p2',
        className: 'The Ancient Fear',
        hpThreshold: 0.5,
        triggers: ['half_hp'],
        abilities: ['vampiric_bite', 'mist_stride', 'multiattack']
      }
    ],
    'vampire_lord': [
      {
        id: 'drain',
        className: 'Bloodweaver',
        hpThreshold: 1.0,
        triggers: ['start'],
        abilities: ['drain_life']
      },
      {
        id: 'frenzy',
        className: 'Sanguine Beast',
        hpThreshold: 0.3,
        triggers: ['near_death'],
        abilities: ['blood_frenzy', 'regeneration']
      }
    ]
  };

  /**
   * Returns current active phase based on monster state.
   */
  public static getCurrentPhase(monster: Monster): BossPhase | null {
    const phases = this.config[monster.monsterType.toLowerCase()];
    if (!phases) return null;

    const hpRatio = monster.hp / monster.maxHp;
    
    // Find the current phase (the one with lowest threshold >= current hp)
    let current = phases[0];
    for (const phase of phases) {
      if (hpRatio <= phase.hpThreshold) {
        current = phase;
      }
    }
    
    return current;
  }

  /**
   * Checks if monster just entered a new phase.
   */
  public static shouldTriggerTransition(monster: Monster, lastHp: number): boolean {
    const currentPhase = this.getCurrentPhase(monster);
    if (!currentPhase) return false;

    const lastHpRatio = lastHp / monster.maxHp;
    const currentHpRatio = monster.hp / monster.maxHp;

    return lastHpRatio > currentPhase.hpThreshold && currentHpRatio <= currentPhase.hpThreshold;
  }
}
