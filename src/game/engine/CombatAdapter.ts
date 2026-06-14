import { Entity, AttackResult, GameState, isMonsterEntity } from '../types';
import { CombatSystem } from './CombatSystem';
import { isDev } from '../../utils/devEnv';

const LOG_PREFIX = '[CombatAdapter]';
const ASYNC_TIMEOUT_MS = 15_000;

export class CombatAdapter {
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
        // targeted cancel roll before resolving
        store.getState().cancelRoll?.();
        resolve(CombatSystem.resolveAttack(attacker, target, attackBonus, damage, rollModifier, undefined, gameState, missDamage));
      }, ASYNC_TIMEOUT_MS);

      store.getState().requestRoll({
        rollType,
        rollerId: attacker.id,
        rollerName: attacker.name,
        targetId: target.id,
        targetName: target.name,
        announcementText: `${attacker.name} attacks!`,
        attackBonus: attackBonus + rollModifier,
        targetAC: CombatSystem.getEffectiveAC(target),
        damage,
        isAutoRoll: isMonster,
        worldPosition: [worldX, 2, worldZ],
        onComplete: () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          const preRolledValue = store.getState().result;
          if (preRolledValue !== null) {
            resolve(CombatSystem.resolveAttack(attacker, target, attackBonus, damage, rollModifier, preRolledValue, gameState, missDamage));
          } else {
            resolve(CombatSystem.resolveAttack(attacker, target, attackBonus, damage, rollModifier, undefined, gameState, missDamage));
          }
        }
      });
    });
  }
}
