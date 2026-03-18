import { Entity, AttackResult, ConditionType } from '../types';
import { GAME_CONSTANTS } from '../constants';
import { ConditionSystem } from './ConditionSystem';

/**
 * Handles all combat math and resolution.
 */
export class CombatSystem {
  /**
   * Resolves an attack between an attacker and a target.
   */
  public static resolveAttack(
    attacker: Entity,
    target: Entity,
    attackBonus: number,
    damage: number,
    rollModifier: number = 0
  ): AttackResult {
    const roll = Math.floor(Math.random() * GAME_CONSTANTS.D20_SIDES) + 1;
    const total = roll + attackBonus + rollModifier;
    const critical = roll === GAME_CONSTANTS.CRITICAL_HIT_ROLL;

    // DEBUG: Check if attacker can take actions (not stunned)
    if (!ConditionSystem.canTakeActions(attacker)) {
      console.log(`[DEBUG CombatSystem] ${attacker.name} cannot attack - stunned`);
      return {
        attackerId: attacker.id,
        targetId: target.id,
        hit: false,
        roll,
        total,
        damage: 0,
        critical: false
      };
    }

    // Critical hit always hits. Otherwise, total must meet or exceed target AC.
    const hit = critical || total >= target.ac;

    // DEBUG: Apply damage modifier if weakened
    let actualDamage = damage;
    if (hit) {
      const damageModifier = ConditionSystem.getDamageModifier(attacker);
      actualDamage = Math.floor(damage * damageModifier);
      console.log(`[DEBUG CombatSystem] ${attacker.name} deals ${actualDamage} damage (base: ${damage}, modifier: ${damageModifier})`);
    }

    return {
      attackerId: attacker.id,
      targetId: target.id,
      hit,
      roll,
      total,
      damage: hit ? actualDamage : 0,
      critical
    };
  }

  /**
   * Applies damage to an entity, respecting HP bounds.
   */
  public static applyDamage(entity: Entity, amount: number): number {
    const actualDamage = Math.min(entity.hp, amount);
    entity.hp = Math.max(0, entity.hp - actualDamage);
    console.log(`[DEBUG CombatSystem] ${entity.name} took ${actualDamage} damage, HP: ${entity.hp}/${entity.maxHp}`);
    return actualDamage;
  }

  /**
   * Applies healing to an entity, respecting max HP.
   */
  public static applyHealing(entity: Entity, amount: number): number {
    const actualHeal = Math.min(entity.maxHp - entity.hp, amount);
    entity.hp = Math.min(entity.maxHp, entity.hp + actualHeal);
    console.log(`[DEBUG CombatSystem] ${entity.name} healed ${actualHeal} HP, HP: ${entity.hp}/${entity.maxHp}`);
    return actualHeal;
  }

  /**
   * DEBUG: Applies a condition to a target entity
   */
  public static applyCondition(
    target: Entity,
    conditionType: ConditionType,
    sourceId?: string,
    duration: number = 1
  ): void {
    ConditionSystem.applyCondition(target, conditionType, sourceId, duration);
  }
}
