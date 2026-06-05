import { Entity, AttackResult, ConditionType, GameState, Monster, isMonsterEntity, Hero } from '../types';
import { GAME_CONSTANTS } from '../constants';
import { ConditionSystem } from './ConditionSystem';
import { DataLoader } from '../dataLoader';
import { AbilitySystem } from '../ai/AbilitySystem';
import { isDev } from '../../utils/devEnv';

const LOG_PREFIX = '[CombatSystem]';
const ASYNC_TIMEOUT_MS = 15_000;

function isStoneFormGargoyle(entity: Entity): entity is Monster {
  return isMonsterEntity(entity)
    && entity.monsterType.toLowerCase() === 'gargoyle'
    && !entity.hasActivated;
}

/**
 * Handles all combat math and resolution.
 * All methods are pure functions — no parameters are mutated.
 */
export class CombatSystem {
  /**
   * Resolves an attack between an attacker and a target.
   * Returns raw hit/damage math without immunity logic (handled by applyDamage).
   * Pure — does not modify attacker or target.
   */
  public static resolveAttack(
    attacker: Entity,
    target: Entity,
    attackBonus: number,
    damage: number,
    rollModifier: number = 0,
    preRolledValue?: number,
    gameState?: GameState,
    missDamage: number = 0
  ): AttackResult {
    let roll = preRolledValue !== undefined
      ? preRolledValue
      : (AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : Math.floor(Math.random() * GAME_CONSTANTS.D20_SIDES) + 1);
    let roll2: number | undefined;

    // Bat Swarm (Environment 51)
    if (
      gameState?.activeEnvironmentCard === 'enc_bat_swarm' &&
      attacker.type === 'hero' &&
      target.type === 'monster' &&
      (attacker.position.x !== target.position.x || attacker.position.z !== target.position.z)
    ) {
      roll2 = AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : Math.floor(Math.random() * GAME_CONSTANTS.D20_SIDES) + 1;
      const originalRoll = roll;
      roll = Math.min(originalRoll, roll2);
      if (isDev()) {
        console.log(`${LOG_PREFIX} Bat Swarm active: Hero attacks across tiles. Rolled twice: ${originalRoll} and ${roll2}. Used lower: ${roll}`);
      }
    }

    let finalAttackBonus = attackBonus;
    let finalDamage = damage;

    // Sum any temporary attack bonus conditions on attacker
    if (attacker.conditions) {
      const attackBonusConditions = attacker.conditions.filter(c => c.type === 'attack_bonus');
      for (const c of attackBonusConditions) {
        finalAttackBonus += (c.value ?? 0);
      }
    }

    // Sum any active blessing attack bonuses
    if (gameState?.activeBlessing) {
      for (const effect of gameState.activeBlessing.effects) {
        if (effect.type === 'attack_bonus') {
          finalAttackBonus += (typeof effect.value === 'number' ? effect.value : 0);
        }
      }
    }

    if (attacker.type === 'hero' && target.type === 'monster') {
      const heroAttacker = attacker as Hero;
      const monsterTarget = target as Monster;
      const isUndead = monsterTarget.monsterType?.toLowerCase().includes('undead') ||
                       monsterTarget.name.toLowerCase().includes('skeleton') ||
                       monsterTarget.name.toLowerCase().includes('zombie') ||
                       monsterTarget.name.toLowerCase().includes('ghoul') ||
                       monsterTarget.name.toLowerCase().includes('wraith') ||
                       monsterTarget.name.toLowerCase().includes('strahd') ||
                       monsterTarget.name.toLowerCase().includes('dracolich');

      if (isUndead) {
        if (heroAttacker.items?.includes('item_sunsword')) {
          finalAttackBonus += 2;
          if (isDev()) console.log(`${LOG_PREFIX} Sunsword passive attack bonus (+2 vs Undead) applied.`);
        }
        if (heroAttacker.items?.includes('item_holy_avenger')) {
          finalAttackBonus += 2;
          if (isDev()) console.log(`${LOG_PREFIX} Holy Avenger passive attack bonus (+2 vs Undead) applied.`);
        }
      }
    }

    if (!ConditionSystem.canTakeActions(attacker)) {
      if (isDev()) console.log(`${LOG_PREFIX} ${attacker.name} cannot attack - stunned`);
      return {
        attackerId: attacker.id,
        targetId: target.id,
        hit: false,
        roll,
        total: roll + finalAttackBonus + rollModifier,
        damage: 0,
        critical: false
      };
    }

    const total = roll + finalAttackBonus + rollModifier;
    const critical = roll === GAME_CONSTANTS.CRITICAL_HIT_ROLL;
    const hit = critical || total >= target.ac;

    let actualDamage = finalDamage;
    if (hit) {
      const damageModifier = ConditionSystem.getDamageModifier(attacker);
      actualDamage = Math.floor(finalDamage * damageModifier);

      // Add damage_bonus conditions
      if (attacker.conditions) {
        const damageBonusConditions = attacker.conditions.filter(c => c.type === 'damage_bonus');
        for (const c of damageBonusConditions) {
          actualDamage += (c.value ?? 0);
        }
      }

      // Holy Avenger damage bonus (+2 vs Undead)
      if (attacker.type === 'hero' && target.type === 'monster' && (attacker as Hero).items?.includes('item_holy_avenger')) {
        const isUndead = (target as Monster).monsterType?.toLowerCase().includes('undead') ||
                         target.name.toLowerCase().includes('skeleton') ||
                         target.name.toLowerCase().includes('zombie') ||
                         target.name.toLowerCase().includes('ghoul') ||
                         target.name.toLowerCase().includes('wraith') ||
                         target.name.toLowerCase().includes('strahd') ||
                         target.name.toLowerCase().includes('dracolich');
        if (isUndead) {
          actualDamage += 2;
          if (isDev()) console.log(`${LOG_PREFIX} Holy Avenger passive damage bonus (+2 vs Undead) applied.`);
        }
      }

      // Blood Fog (Environment 52)
      if (gameState?.activeEnvironmentCard === 'enc_blood_fog' && roll >= 17) {
        actualDamage += 1;
        if (isDev()) console.log(`${LOG_PREFIX} Blood Fog: natural ${roll} (>=17) deals +1 additional damage.`);
      }

      if (isDev()) console.log(`${LOG_PREFIX} ${attacker.name} deals ${actualDamage} damage (base: ${damage}, modifier: ${damageModifier})`);
    } else {
      actualDamage = missDamage;
    }

    return {
      attackerId: attacker.id,
      targetId: target.id,
      hit,
      roll,
      total,
      damage: actualDamage,
      critical
    };
  }

  /**
   * Returns a new entity with damage applied, respecting HP bounds and immunities.
   * Single authority on damage immunity (e.g. gargoyle stone form).
   * If gameState is provided, checks active environment card for damage modifiers.
   * Pure — does not modify the original entity.
   */
  public static applyDamage<T extends Entity>(entity: T, amount: number, gameState?: GameState): T {
    let actualAmount = amount;

    if (isStoneFormGargoyle(entity)) {
      if (isDev()) console.log(`${LOG_PREFIX} Gargoyle is in Stone Form - immune to damage!`);
      actualAmount = 0;
    }

    // Environment card damage modifiers (e.g. sanctuary reduces damage with negative values)
    if (gameState?.activeEnvironmentCard && entity.type === 'hero') {
      const envCard = DataLoader.getInstance().getCardById(gameState.activeEnvironmentCard);
      if (envCard) {
        for (const effect of envCard.effects) {
          if (effect.type === 'damage_bonus' && typeof effect.value === 'number') {
            actualAmount += effect.value;
            if (isDev()) console.log(`${LOG_PREFIX} Environment ${envCard.name}: +${effect.value} damage modifier applied`);
          }
        }
      }
    }

    const clampedAmount = Math.max(0, actualAmount);
    const newHp = Math.max(0, entity.hp - clampedAmount);
    if (isDev()) console.log(`${LOG_PREFIX} ${entity.name} took ${entity.hp - newHp} damage (base: ${amount}), HP: ${newHp}/${entity.maxHp}`);
    return { ...entity, hp: newHp };
  }

  /**
   * Returns a new entity with healing applied, respecting max HP.
   * Pure — does not modify the original entity.
   */
  public static applyHealing<T extends Entity>(entity: T, amount: number): T {
    const newHp = Math.min(entity.maxHp, entity.hp + amount);
    if (isDev()) console.log(`${LOG_PREFIX} ${entity.name} healed ${newHp - entity.hp} HP, HP: ${newHp}/${entity.maxHp}`);
    return { ...entity, hp: newHp };
  }

  /**
   * Applies a condition to a target entity.
   * Delegates to ConditionSystem; returns a new entity.
   */
  public static applyCondition<T extends Entity>(
    target: T,
    conditionType: ConditionType,
    sourceId?: string,
    duration: number = 1
  ): T {
    return ConditionSystem.applyCondition(target, conditionType, sourceId, duration);
  }

  /**
   * Orchestrates an asynchronous attack resolution involving the 3D dice rolling system.
   * Prompts the user (or auto-rolls for monsters), waits for the animation,
   * then computes the final logic. Falls back to direct resolution after timeout.
   */
  public static async resolveAttackAsync(
    attacker: Entity,
    target: Entity,
    attackBonus: number,
    damage: number,
    rollModifier: number = 0,
    gameState?: GameState,
    missDamage: number = 0
  ): Promise<AttackResult> {
    const isMonster = isMonsterEntity(attacker);
    const rollType = isMonster ? 'monster_attack' : 'hero_attack';
    const store = (await import('../../store/diceStore')).useDiceStore;

    return new Promise<AttackResult>((resolve) => {
      let worldX = 0, worldZ = 0;
      if (attacker.position) {
        worldX = attacker.position.x * 4 + attacker.position.sqX + 0.5;
        worldZ = attacker.position.z * 4 + attacker.position.sqZ + 0.5;
      }

      let resolved = false;
      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        if (isDev()) console.log(`${LOG_PREFIX} Async attack timed out, resolving with direct roll`);
        resolve(this.resolveAttack(attacker, target, attackBonus, damage, rollModifier, undefined, gameState, missDamage));
      }, ASYNC_TIMEOUT_MS);

      store.getState().requestRoll({
        rollType,
        rollerId: attacker.id,
        rollerName: attacker.name,
        targetId: target.id,
        targetName: target.name,
        announcementText: `${attacker.name} attacks!`,
        attackBonus: attackBonus + rollModifier,
        targetAC: target.ac,
        damage,
        isAutoRoll: isMonster,
        worldPosition: [worldX, 2, worldZ],
        onComplete: () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          const preRolledValue = store.getState().result;
          if (preRolledValue !== null) {
            resolve(this.resolveAttack(attacker, target, attackBonus, damage, rollModifier, preRolledValue, gameState, missDamage));
          } else {
            resolve(this.resolveAttack(attacker, target, attackBonus, damage, rollModifier, undefined, gameState, missDamage));
          }
        }
      });
    });
  }
}
