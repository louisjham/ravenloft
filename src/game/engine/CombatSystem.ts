import { Entity, AttackResult, ConditionType, GameState } from '../types';
import { GAME_CONSTANTS } from '../constants';
import { ConditionSystem } from './ConditionSystem';
import { DataLoader } from '../dataLoader';

/**
 * Handles all combat math and resolution.
 * All methods are pure functions — no parameters are mutated.
 */
export class CombatSystem {
  /**
   * Resolves an attack between an attacker and a target.
   * Pure — does not modify attacker or target.
   */
  public static resolveAttack(
    attacker: Entity,
    target: Entity,
    attackBonus: number,
    damage: number,
    rollModifier: number = 0,
    preRolledValue?: number
  ): AttackResult {
    const roll = preRolledValue !== undefined ? preRolledValue : Math.floor(Math.random() * GAME_CONSTANTS.D20_SIDES) + 1;
    const total = roll + attackBonus + rollModifier;
    const critical = roll === GAME_CONSTANTS.CRITICAL_HIT_ROLL;

    // Check if attacker can take actions (not stunned)
    if (!ConditionSystem.canTakeActions(attacker)) {
      console.log(`[CombatSystem] ${attacker.name} cannot attack - stunned`);
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

    let actualDamage = damage;
    if (hit) {
      const damageModifier = ConditionSystem.getDamageModifier(attacker);
      actualDamage = Math.floor(damage * damageModifier);
      console.log(`[CombatSystem] ${attacker.name} deals ${actualDamage} damage (base: ${damage}, modifier: ${damageModifier})`);

      const isTargetGargoyle = (target as any).monsterType === 'gargoyle' ||
        (target as any).monsterType?.toLowerCase() === 'gargoyle' ||
        target.name.toLowerCase() === 'gargoyle';
      if (isTargetGargoyle && !(target as any).hasActivated) {
        console.log(`[CombatSystem] Gargoyle is in Stone Form - immune to damage!`);
        actualDamage = 0;
      }
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
   * Returns a new entity with damage applied, respecting HP bounds.
   * Pure — does not modify the original entity.
   * If gameState is provided, checks active environment card for damage modifiers.
   */
  public static applyDamage<T extends Entity>(entity: T, amount: number, gameState?: GameState): T {
    let actualAmount = amount;
    const isGargoyle = (entity as any).monsterType === 'gargoyle' ||
      (entity as any).monsterType?.toLowerCase() === 'gargoyle' ||
      entity.name.toLowerCase() === 'gargoyle';
    if (isGargoyle && !(entity as any).hasActivated) {
      console.log(`[CombatSystem] Gargoyle is in Stone Form - immune to damage!`);
      actualAmount = 0;
    }

    // Check active environment card for damage modifiers against heroes
    if (gameState?.activeEnvironmentCard && entity.type === 'hero') {
      const envCard = DataLoader.getInstance().getCardById(gameState.activeEnvironmentCard);
      if (envCard) {
        for (const effect of envCard.effects) {
          if (effect.type === 'damage_bonus' && typeof effect.value === 'number') {
            actualAmount += effect.value;
            console.log(`[CombatSystem] Environment ${envCard.name}: +${effect.value} damage modifier applied`);
          }
        }
      }
    }

    const clampedAmount = Math.max(0, actualAmount);
    const newHp = Math.max(0, entity.hp - clampedAmount);
    console.log(`[CombatSystem] ${entity.name} took ${entity.hp - newHp} damage (base: ${amount}), HP: ${newHp}/${entity.maxHp}`);
    return { ...entity, hp: newHp };
  }

  /**
   * Returns a new entity with healing applied, respecting max HP.
   * Pure — does not modify the original entity.
   */
  public static applyHealing<T extends Entity>(entity: T, amount: number): T {
    const newHp = Math.min(entity.maxHp, entity.hp + Math.min(entity.maxHp - entity.hp, amount));
    console.log(`[CombatSystem] ${entity.name} healed ${newHp - entity.hp} HP, HP: ${newHp}/${entity.maxHp}`);
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
   * then computes the final logic.
   */
  public static async resolveAttackAsync(
    attacker: Entity,
    target: Entity,
    attackBonus: number,
    damage: number,
    rollModifier: number = 0
  ): Promise<AttackResult> {
    const isMonster = !('experience' in attacker); // Heroes have experience
    const rollType = isMonster ? 'monster_attack' : 'hero_attack';
    const store = (await import('../../store/diceStore')).useDiceStore;

    return new Promise<AttackResult>((resolve) => {
      // Compute world position from entity's tile coordinates (same as used for 3D rendering)
      let worldX = 0, worldZ = 0;
      if (attacker.position) {
        worldX = attacker.position.x * 4 + attacker.position.sqX + 0.5;
        worldZ = attacker.position.z * 4 + attacker.position.sqZ + 0.5;
      }
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
        worldPosition: [worldX, 2, worldZ], // Drop die from 2 units above the tile
        onComplete: () => {
          // The store generated the result during the playerRoll step
          const preRolledValue = store.getState().result;
          if (preRolledValue !== null) {
             const logicResult = this.resolveAttack(attacker, target, attackBonus, damage, rollModifier, preRolledValue);
             resolve(logicResult);
          } else {
             // Fallback if something went wrong
             resolve(this.resolveAttack(attacker, target, attackBonus, damage, rollModifier));
          }
        }
      });
    });
  }
}
