import { Entity, Condition, ConditionType, GameState, Hero } from '../types';
import { AbilitySystem } from '../ai/AbilitySystem';

/**
 * Condition System - Manages condition application, removal, and effects.
 * All methods are pure functions — input entities are never mutated.
 *
 * Conditions:
 * - slowed:      Movement speed reduced by half (rounded down)
 * - immobilized: Cannot move at all
 * - poisoned:    Takes damage at start of turn
 * - dazed:       Cannot use Daily powers
 * - weakened:    Damage dealt is halved
 * - stunned:     Cannot take any actions
 */
export class ConditionSystem {
  /**
   * Returns a new entity with the condition applied.
   * If the entity already has the condition, its duration is refreshed.
   */
  public static applyCondition<T extends Entity>(
    entity: T,
    conditionType: ConditionType,
    sourceId?: string,
    duration: number = 1,
    value?: number
  ): T {
    console.log(`[ConditionSystem] Applying condition '${conditionType}' to ${entity.name} from ${sourceId || 'unknown'}`);

    const existing = entity.conditions.find(c => c.type === conditionType);
    let newConditions: Condition[];

    if (existing) {
      // Refresh duration
      newConditions = entity.conditions.map(c =>
        c.type === conditionType ? { ...c, turnsRemaining: duration, value } : c
      );
      console.log(`[ConditionSystem] Condition '${conditionType}' refreshed on ${entity.name}, duration: ${duration}`);
    } else {
      // Add new condition
      newConditions = [
        ...entity.conditions,
        { type: conditionType, sourceId, turnsRemaining: duration, value }
      ];
      console.log(`[ConditionSystem] Condition '${conditionType}' added to ${entity.name}, duration: ${duration}`);
    }

    return { ...entity, conditions: newConditions };
  }

  /**
   * Returns a new entity with the given condition removed.
   */
  public static removeCondition<T extends Entity>(entity: T, conditionType: ConditionType): T {
    const newConditions = entity.conditions.filter(c => c.type !== conditionType);
    if (newConditions.length < entity.conditions.length) {
      console.log(`[ConditionSystem] Condition '${conditionType}' removed from ${entity.name}`);
    }
    return { ...entity, conditions: newConditions };
  }

  /**
   * Returns a new entity with all conditions cleared.
   */
  public static clearAllConditions<T extends Entity>(entity: T): T {
    console.log(`[ConditionSystem] Cleared ${entity.conditions.length} conditions from ${entity.name}`);
    return { ...entity, conditions: [] };
  }

  /**
   * Returns a new entity with condition durations decremented.
   * Conditions that reach 0 turns are removed.
   */
  public static processTurnEnd<T extends Entity>(entity: T): T {
    console.log(`[ConditionSystem] Processing turn end for ${entity.name}, conditions: ${entity.conditions.map(c => c.type).join(', ') || 'none'}`);

    const newConditions = entity.conditions
      .map(c => ({ ...c, turnsRemaining: c.turnsRemaining - 1 }))
      .filter(c => {
        if (c.turnsRemaining <= 0) {
          console.log(`[ConditionSystem] Condition '${c.type}' expired on ${entity.name}`);
          return false;
        }
        console.log(`[ConditionSystem] Condition '${c.type}' on ${entity.name}, turns remaining: ${c.turnsRemaining}`);
        return true;
      });

    return { ...entity, conditions: newConditions };
  }

  /**
   * Checks if an entity has a specific condition. (Read-only — no mutation.)
   */
  public static hasCondition(entity: Entity, conditionType: ConditionType): boolean {
    return entity.conditions.some(c => c.type === conditionType);
  }

  /**
   * Gets the effective speed of an entity considering conditions. (Read-only.)
   */
  public static getEffectiveSpeed(entity: Entity): number {
    let effectiveSpeed = entity.speed;

    if (this.hasCondition(entity, 'slowed')) {
      effectiveSpeed = Math.floor(effectiveSpeed / 2);
      console.log(`[ConditionSystem] ${entity.name} is slowed, speed reduced from ${entity.speed} to ${effectiveSpeed}`);
    }

    if (this.hasCondition(entity, 'crippling_miasma')) {
      effectiveSpeed = Math.max(0, effectiveSpeed - 1);
      console.log(`[ConditionSystem] ${entity.name} has crippling miasma, speed reduced to ${effectiveSpeed}`);
    }

    if (this.hasCondition(entity, 'immobilized')) {
      effectiveSpeed = 0;
      console.log(`[ConditionSystem] ${entity.name} is immobilized, speed is 0`);
    }

    return effectiveSpeed;
  }

  /**
   * Checks if an entity can take actions. (Read-only.)
   */
  public static canTakeActions(entity: Entity): boolean {
    if (this.hasCondition(entity, 'stunned')) {
      console.log(`[ConditionSystem] ${entity.name} is stunned and cannot take actions`);
      return false;
    }
    return true;
  }

  /**
   * Checks if an entity can use Daily powers. (Read-only.)
   */
  public static canUseDailyPowers(entity: Entity): boolean {
    if (this.hasCondition(entity, 'dazed')) {
      console.log(`[ConditionSystem] ${entity.name} is dazed and cannot use Daily powers`);
      return false;
    }
    return true;
  }

  /**
   * Gets damage modifier based on conditions. (Read-only.)
   */
  public static getDamageModifier(entity: Entity): number {
    if (this.hasCondition(entity, 'weakened')) {
      console.log(`[ConditionSystem] ${entity.name} is weakened, damage will be halved`);
      return 0.5;
    }
    return 1.0;
  }

  /**
   * Processes poison damage at start of turn. (Read-only — returns damage amount only.)
   */
  public static processPoisonDamage(entity: Entity): number {
    if (this.hasCondition(entity, 'poisoned')) {
      const poisonDamage = 1;
      console.log(`[ConditionSystem] ${entity.name} is poisoned, taking ${poisonDamage} damage`);
      return poisonDamage;
    }
    return 0;
  }

  /**
   * Processes saving throws and start-of-turn conditions for a hero.
   */
  public static processTurnStart(gameState: GameState, heroId: string): GameState {
    const hero = gameState.heroes.find(h => h.id === heroId);
    if (!hero) return gameState;

    let updatedHero = { ...hero };
    let logs = [...gameState.log];

    const hasMiasma = this.hasCondition(hero, 'crippling_miasma');
    if (hasMiasma) {
      // Roll Fortitude save (d20 >= 10)
      const roll = AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : Math.floor(Math.random() * 20) + 1;
      if (roll >= 10) {
        updatedHero = this.removeCondition(updatedHero, 'crippling_miasma');
        logs.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `${hero.name} rolled a Fortitude save of ${roll} (needed 10+) and cured Crippling Miasma!`,
          type: 'system' as const
        });
      } else {
        logs.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `${hero.name} rolled a Fortitude save of ${roll} (needed 10+) and failed to cure Crippling Miasma.`,
          type: 'system' as const
        });
      }
    }

    return {
      ...gameState,
      heroes: gameState.heroes.map(h => h.id === heroId ? updatedHero : h),
      log: logs
    };
  }
}
