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
 * All methods in this class are pure functions — no parameters are mutated.
 * Note: For async roll orchestration, see CombatAdapter.
 */
export class CombatSystem {
  /**
   * Computes the effective AC of an entity, including passive item bonuses (for heroes)
   * and any active AC conditions.
   */
  public static getEffectiveAC(entity: Entity): number {
    let effectiveAC = entity.ac;

    // Item AC bonuses (only for heroes)
    if (entity.type === 'hero') {
      const hero = entity as Hero;
      const allCards = DataLoader.getInstance().getAllCards();
      for (const itemId of hero.items) {
        const card = allCards.find(c => c.id === itemId);
        if (!card) continue;
        for (const effect of card.effects) {
          if (effect.type === 'defense_bonus' || effect.type === 'ac_bonus') {
            effectiveAC += typeof effect.value === 'number' ? effect.value : 0;
          }
        }
      }
    }

    // Condition AC bonuses
    if (entity.conditions) {
      const acBonusConditions = entity.conditions.filter(c => c.type === 'ac_bonus');
      for (const c of acBonusConditions) {
        effectiveAC += (c.value ?? 0);
      }
    }

    return effectiveAC;
  }

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
      target.type === 'monster'
    ) {
      roll2 = AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : Math.floor(Math.random() * GAME_CONSTANTS.D20_SIDES) + 1;
      const originalRoll = roll;
      roll = Math.min(originalRoll, roll2);
      if (isDev()) {
        console.log(`${LOG_PREFIX} Bat Swarm active: Hero attacks. Rolled twice: ${originalRoll} and ${roll2}. Used lower: ${roll}`);
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
    let healAttackerAmt = 0;
    if (gameState?.activeBlessings) {
      for (const blessing of gameState.activeBlessings) {
        if (blessing.cardId === 'treasure_blessing_heroic_stand_151') {
          const attackerTile = gameState.tiles.find(t => t.x === attacker.position?.x && t.z === attacker.position?.z);
          if (attackerTile) {
            const monstersOnTile = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated && m.position.x === attackerTile.x && m.position.z === attackerTile.z);
            finalAttackBonus += monstersOnTile.length;
            if (isDev() && monstersOnTile.length > 0) console.log(`${LOG_PREFIX} Heroic Stand: +${monstersOnTile.length} attack bonus applied.`);
          }
        } else if (blessing.cardId === 'treasure_blessing_surround_them_155') {
          if (target.type === 'monster') {
            finalDamage += 1;
            // Also adding attack bonus because the user explicitly requested it
            finalAttackBonus += 1;
            if (isDev()) console.log(`${LOG_PREFIX} Surround Them!: +1 damage/attack bonus applied.`);
          }
        } else if (blessing.cardId === 'treasure_blessing_rejuvenating_onslaught_153') {
          if (attacker.type === 'hero') {
            healAttackerAmt = 1; // Evaluated later if hit is true
          }
        } else {
          // Fallback for any passive generic attack bonuses on future blessing cards
          for (const effect of blessing.effects) {
            if (effect.type === 'attack_bonus') {
              finalAttackBonus += (typeof effect.value === 'number' ? effect.value : 0);
            }
          }
        }
      }
    }

    const undeadItemResult = CombatSystem.applyUndeadItemBonuses(attacker, target, finalAttackBonus, finalDamage, gameState);
    finalAttackBonus = undeadItemResult.attackBonus;
    finalDamage = undeadItemResult.damage;

    // Haunted Mists Environment (Undead monsters gain +2 attack)
    if (
      gameState?.activeEnvironmentCard === 'enc_haunted_mists' &&
      attacker.type === 'monster' &&
      (attacker as Monster).monsterType?.toLowerCase() === 'undead'
    ) {
      finalAttackBonus += 2;
      if (isDev()) console.log(`${LOG_PREFIX} Haunted Mists: +2 attack bonus applied to Undead monster.`);
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
    const hit = critical || total >= CombatSystem.getEffectiveAC(target);

    let actualDamage = finalDamage;
    if (hit) {
      const damageModifier = ConditionSystem.getDamageModifier(attacker);
      let flatBonuses = 0;
      if (attacker.conditions) {
        const damageBonusConditions = attacker.conditions.filter(c => c.type === 'damage_bonus');
        for (const c of damageBonusConditions) {
          flatBonuses += (c.value ?? 0);
        }
      }

      actualDamage = Math.floor((finalDamage + flatBonuses) * damageModifier);

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
      critical,
      healAttacker: hit && healAttackerAmt > 0 ? healAttackerAmt : undefined
    };
  }

  /**
   * Applies any trailing effects from an AttackResult to the attacker (e.g. healAttacker).
   * Pure — returns a new attacker entity.
   */
  public static applyAttackResultEffects<T extends Entity>(attacker: T, result: AttackResult): T {
    let updatedAttacker = { ...attacker };
    if (result.healAttacker && result.healAttacker > 0) {
      updatedAttacker = CombatSystem.applyHealing(updatedAttacker, result.healAttacker);
      if (isDev()) console.log(`${LOG_PREFIX} AttackResult triggered heal for ${attacker.name}: +${result.healAttacker} HP`);
    }
    return updatedAttacker;
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
    if (gameState?.activeEnvironmentCard) {
      const envCard = DataLoader.getInstance().getCardById(gameState.activeEnvironmentCard);
      if (envCard) {
        for (const effect of envCard.effects) {
          if (effect.type === 'damage_bonus' && typeof effect.value === 'number') {
            if (effect.targetType === 'hero' || effect.targetType === 'all') {
              actualAmount += effect.value;
              if (isDev()) console.log(`${LOG_PREFIX} Environment ${envCard.name}: +${effect.value} damage modifier applied`);
            }
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
    if (entity.conditions?.some(c => c.type === 'mummy_rot')) {
      if (isDev()) console.log(`${LOG_PREFIX} ${entity.name} healing BLOCKED by Mummy Rot!`);
      return entity;
    }
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

  private static isVampire(target: Monster): boolean {
    const typeLower = (target.monsterType ?? '').toLowerCase();
    const nameLower = (target.name ?? '').toLowerCase();
    const idLower = (target.id ?? '').toLowerCase();
    return typeLower.includes('vampire') || 
           nameLower.includes('vampire') || 
           nameLower.includes('strahd') ||
           idLower.includes('vampire') ||
           idLower.includes('strahd');
  }

  private static isAdjacent(p1?: { x: number; z: number }, p2?: { x: number; z: number }): boolean {
    if (!p1 || !p2) return false;
    const dx = Math.abs(p1.x - p2.x);
    const dz = Math.abs(p1.z - p2.z);
    return (dx + dz) <= 1;
  }

  private static applyUndeadItemBonuses(
    attacker: Entity,
    target: Entity,
    attackBonus: number,
    damage: number,
    gameState?: GameState
  ): { attackBonus: number; damage: number } {
    let finalAttackBonus = attackBonus;
    let finalDamage = damage;

    if (attacker.type === 'hero' && target.type === 'monster') {
      const heroAttacker = attacker as Hero;
      const monsterTarget = target as Monster;

      // 1. Sunsword: +1 damage against adjacent Vampires
      if (heroAttacker.items?.includes('item_sunsword') || heroAttacker.items?.includes('card-item-sunsword')) {
        if (CombatSystem.isVampire(monsterTarget) && CombatSystem.isAdjacent(attacker.position, target.position)) {
          finalDamage += 1;
          if (isDev()) console.log(`${LOG_PREFIX} Sunsword passive damage bonus (+1 vs adjacent Vampire) applied.`);
        }
      }

      // 2. Tome of Strahd: +2 attack bonus against Vampires for owner and each hero within 1 tile
      if (gameState && CombatSystem.isVampire(monsterTarget)) {
        const hasTomeBonus = gameState.heroes.some(h => {
          const ownsTome = h.items?.includes('item_tome_of_strahd') || h.items?.includes('card-item-tome-of-strahd');
          if (!ownsTome) return false;
          return CombatSystem.isAdjacent(attacker.position, h.position);
        });
        if (hasTomeBonus) {
          finalAttackBonus += 2;
          if (isDev()) console.log(`${LOG_PREFIX} Tome of Strahd passive attack bonus (+2 vs Vampire) applied to hero.`);
        }
      }

      // 3. Holy Avenger: +2 attack and damage vs Undead
      if (monsterTarget.isUndead === true) {
        if (heroAttacker.items?.includes('item_holy_avenger')) {
          finalAttackBonus += 2;
          finalDamage += 2;
          if (isDev()) console.log(`${LOG_PREFIX} Holy Avenger passive attack and damage bonuses (+2 vs Undead) applied.`);
        }
      }
    }

    return { attackBonus: finalAttackBonus, damage: finalDamage };
  }
}
