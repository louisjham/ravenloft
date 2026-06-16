import { Entity, Condition, ConditionType, GameState, Hero, Tile, ActiveCondition } from '../types';
import { AbilitySystem } from '../ai/AbilitySystem';
import { ExperienceSystem } from './ExperienceSystem';
import { isDev } from '../../utils/devEnv';

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
 *
 * Sentinels:
 * - turnsRemaining: -1 represents permanent condition durations.
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
    if (isDev()) console.log(`[ConditionSystem] Applying condition '${conditionType}' to ${entity.name} from ${sourceId || 'unknown'}`);

    const existing = entity.conditions.find(c => c.type === conditionType);
    let newConditions: Condition[];

    if (existing) {
      // Refresh duration and update sourceId (Bug 2)
      newConditions = entity.conditions.map(c =>
        c.type === conditionType ? { ...c, turnsRemaining: duration, value, sourceId } : c
      );
      if (isDev()) console.log(`[ConditionSystem] Condition '${conditionType}' refreshed on ${entity.name}, duration: ${duration}`);
    } else {
      // Add new condition
      newConditions = [
        ...entity.conditions,
        { type: conditionType, sourceId, turnsRemaining: duration, value }
      ];
      if (isDev()) console.log(`[ConditionSystem] Condition '${conditionType}' added to ${entity.name}, duration: ${duration}`);
    }

    return { ...entity, conditions: newConditions };
  }

  /**
   * Returns a new entity with the given condition removed.
   */
  public static removeCondition<T extends Entity>(entity: T, conditionType: ConditionType): T {
    const newConditions = entity.conditions.filter(c => c.type !== conditionType);
    if (newConditions.length < entity.conditions.length) {
      if (isDev()) console.log(`[ConditionSystem] Condition '${conditionType}' removed from ${entity.name}`);
    }
    return { ...entity, conditions: newConditions };
  }

  /**
   * Returns a new entity with all conditions cleared.
   */
  public static clearAllConditions<T extends Entity>(entity: T): T {
    if (isDev()) console.log(`[ConditionSystem] Cleared ${entity.conditions.length} conditions from ${entity.name}`);
    return { ...entity, conditions: [] };
  }

  /**
   * Returns a new entity with condition durations decremented.
   * Conditions that reach 0 turns are removed.
   * Bug 1: Restructured to filter already-expired conditions first, then decrement survivors.
   */
  public static processTurnEnd<T extends Entity>(entity: T, currentTurnHeroId?: string): T {
    if (isDev()) {
      console.log(`[ConditionSystem] Processing turn end for ${entity.name}, conditions: ${entity.conditions.map(c => c.type).join(', ') || 'none'}`);
    }

    const newConditions = entity.conditions
      .filter(c => {
        const shouldProcess = !currentTurnHeroId || 
                              (entity.type === 'hero' && entity.id === currentTurnHeroId) || 
                              (entity.type === 'monster' && (c.sourceId === currentTurnHeroId || !c.sourceId));

        if (!shouldProcess) return true;

        // Expire immediately when it drops to 0
        if (c.turnsRemaining <= 1 && c.turnsRemaining !== -1) {
          if (isDev()) {
            console.log(`[ConditionSystem] Condition '${c.type}' expired on ${entity.name}`);
          }
          return false;
        }
        return true;
      })
      .map(c => {
        const shouldProcess = !currentTurnHeroId || 
                              (entity.type === 'hero' && entity.id === currentTurnHeroId) || 
                              (entity.type === 'monster' && (c.sourceId === currentTurnHeroId || !c.sourceId));

        if (!shouldProcess || c.turnsRemaining === -1) return c;
        const nextTurns = c.turnsRemaining - 1;
        if (isDev()) {
          console.log(`[ConditionSystem] Condition '${c.type}' on ${entity.name}, turns remaining decremented to: ${nextTurns}`);
        }
        return { ...c, turnsRemaining: nextTurns };
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
   * Gets the effective speed of an entity considering conditions and active blessings. (Read-only.)
   */
  public static getEffectiveSpeed(entity: Entity, gameState?: GameState): number {
    let effectiveSpeed = entity.speed;

    if (entity.type === 'hero' && gameState?.activeBlessings) {
      if (gameState.activeBlessings.some(b => b.cardId === 'treasure_blessing_run_154')) {
        effectiveSpeed += 2;
        if (isDev()) console.log(`[ConditionSystem] ${entity.name} has Run! blessing, speed increased to ${effectiveSpeed}`);
      }
    }

    if (this.hasCondition(entity, 'slowed')) {
      effectiveSpeed = Math.floor(effectiveSpeed / 2);
      if (isDev()) console.log(`[ConditionSystem] ${entity.name} is slowed, speed reduced from ${entity.speed} to ${effectiveSpeed}`);
    }

    if (gameState?.activeEnvironmentCard === 'enc_crippling_miasma' && !this.hasCondition(entity, 'slowed')) {
      effectiveSpeed = Math.max(0, effectiveSpeed - 1);
      if (isDev()) console.log(`[ConditionSystem] ${entity.name} is affected by Crippling Miasma environment, speed reduced to ${effectiveSpeed}`);
    }

    if (this.hasCondition(entity, 'immobilized')) {
      effectiveSpeed = 0;
      if (isDev()) console.log(`[ConditionSystem] ${entity.name} is immobilized, speed is 0`);
    }

    return effectiveSpeed;
  }

  /**
   * Checks if an entity can take actions. (Read-only.)
   */
  public static canTakeActions(entity: Entity): boolean {
    if (this.hasCondition(entity, 'stunned')) {
      if (isDev()) console.log(`[ConditionSystem] ${entity.name} is stunned and cannot take actions`);
      return false;
    }
    return true;
  }

  /**
   * Checks if an entity can use Daily powers. (Read-only.)
   */
  public static canUseDailyPowers(entity: Entity): boolean {
    if (this.hasCondition(entity, 'dazed')) {
      if (isDev()) console.log(`[ConditionSystem] ${entity.name} is dazed and cannot use Daily powers`);
      return false;
    }
    return true;
  }

  /**
   * Gets damage modifier based on conditions. (Read-only.)
   * Bug 5: Accumulated multiplicatively.
   */
  public static getDamageModifier(entity: Entity): number {
    let modifier = 1.0;
    if (this.hasCondition(entity, 'weakened')) {
      if (isDev()) console.log(`[ConditionSystem] ${entity.name} is weakened, damage will be halved`);
      modifier *= 0.5;
    }
    return modifier;
  }

  /**
   * Processes poison damage at start of turn. (Read-only — returns damage amount only.)
   */
  public static processPoisonDamage(entity: Entity): number {
    if (this.hasCondition(entity, 'poisoned')) {
      const poisonDamage = 1;
      if (isDev()) console.log(`[ConditionSystem] ${entity.name} is poisoned, taking ${poisonDamage} damage`);
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
    let newState = { ...gameState };
    let logs = [...newState.log];

    if (updatedHero.removedFromPlay) {
      const startTile = newState.tiles.find(t => t.isStart);
      const targetTile = startTile || newState.tiles.find(t => t.isRevealed);
      if (targetTile) {
        updatedHero.removedFromPlay = false;
        updatedHero.position = {
          x: targetTile.x,
          z: targetTile.z,
          sqX: 2,
          sqZ: 2
        };
        newState = {
          ...newState,
          tiles: newState.tiles.map(t =>
            t.id === targetTile.id
              ? { ...t, heroes: [...new Set([...t.heroes, heroId])] }
              : t
          )
        };
        logs.push({
          id: String((newState.logIdCounter ?? 0) + 1),
          timestamp: new Date().toISOString(),
          message: `${hero.name} returns to the dungeon on tile (${targetTile.x},${targetTile.z}).`,
          type: 'system' as const
        });
        newState.logIdCounter = (newState.logIdCounter ?? 0) + 1;
      }
    }

    // Bug 4: Auto-force healing surge at 0 HP
    if (updatedHero.hp <= 0) {
      if (newState.healingSurges > 0) {
        const surgeHeal = ExperienceSystem.getSurgeValue(updatedHero);
        updatedHero = { 
          ...updatedHero, 
          hp: Math.min(updatedHero.maxHp, updatedHero.hp + surgeHeal),
          hasUsedSurgeThisTurn: true
        };
        newState.healingSurges -= 1;
        
        logs.push({
          id: String((newState.logIdCounter ?? 0) + 1),
          timestamp: new Date().toISOString(),
          message: `${hero.name} is at 0 HP and automatically spends a Healing Surge to recover ${surgeHeal} HP.`,
          type: 'system' as const
        });
        newState.logIdCounter = (newState.logIdCounter ?? 0) + 1;
      }
      // If 0 surges, the defeat check in ScenarioManager (which runs immediately after this) will catch it
    }

    // Bug 3: Poison processing at turn start
    const poisonDmg = this.processPoisonDamage(updatedHero);
    if (poisonDmg > 0) {
      updatedHero = { ...updatedHero, hp: Math.max(0, updatedHero.hp - poisonDmg) };
      logs.push({
        id: String((newState.logIdCounter ?? 0) + 1),
        timestamp: new Date().toISOString(),
        message: `${hero.name} takes ${poisonDmg} poison damage at the start of their turn.`,
        type: 'system' as const
      });
      newState.logIdCounter = (newState.logIdCounter ?? 0) + 1;
    }

    return ConditionSystem.syncActiveConditions({
      ...newState,
      heroes: newState.heroes.map(h => h.id === heroId ? updatedHero : h),
      log: logs.slice(-100)
    });
  }

  /**
   * Synchronizes activeConditions in GameState from the conditions arrays on all heroes and monsters.
   */
  public static syncActiveConditions(gameState: GameState): GameState {
    const activeConditions: ActiveCondition[] = [];

    for (const hero of gameState.heroes) {
      if (hero.conditions) {
        for (const cond of hero.conditions) {
          activeConditions.push({
            type: cond.type,
            targetId: hero.id,
            sourceId: cond.sourceId,
            turnsRemaining: cond.turnsRemaining,
            value: cond.value
          });
        }
      }
    }

    for (const monster of gameState.monsters) {
      if (monster.conditions) {
        for (const cond of monster.conditions) {
          activeConditions.push({
            type: cond.type,
            targetId: monster.id,
            sourceId: cond.sourceId,
            turnsRemaining: cond.turnsRemaining,
            value: cond.value
          });
        }
      }
    }

    return {
      ...gameState,
      activeConditions
    };
  }
}
