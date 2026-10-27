import { Entity, AttackResult, GameState, isMonsterEntity, Hero } from '../types';
import { CombatSystem } from './CombatSystem';
import { isDev } from '../../utils/devEnv';
import { useDiceStore } from '../../store/diceStore';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { SoundLibrary } from '../../audio/SoundLibrary';
import { addLogEntry } from './LogUtils';

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
    const gameStoreState = useGameStore.getState();
    const isAIHero = !isMonster && (
      Boolean(('isAutoFollow' in attacker) && (attacker as Hero).isAutoFollow) ||
      gameStoreState.settings?.aiControlMode === 'all_ai' ||
      Boolean((gameState ?? gameStoreState.gameState)?.heroes?.find(h => h.id === attacker.id)?.isAutoFollow)
    );
    const isAutoRoll = isMonster || isAIHero;
    const rollType = isMonster ? 'monster_attack' : 'hero_attack';
    const store = useDiceStore;

    return new Promise<AttackResult>((resolve) => {
      let resolved = false;
      const timeoutMs = isAutoRoll ? 3000 : ASYNC_TIMEOUT_MS;
      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        if (isDev()) console.log(`${LOG_PREFIX} Async attack timed out, resolving with direct roll`);
        // targeted cancel roll before resolving
        store.getState().cancelRoll?.();
        const attackResult = CombatSystem.resolveAttack(attacker, target, attackBonus, damage, rollModifier, undefined, gameState, missDamage);
        if (attackResult.hit) {
          SoundLibrary.Combat.hit();
          if (target.type === 'hero' && attackResult.damage > 0) {
            SoundLibrary.Combat.hurt();
          }
        }

        const timeoutSeconds = Math.round(timeoutMs / 1000);
        const timeoutLogMessage = `🎲 Dice roll timed out after ${timeoutSeconds}s — auto-resolved attack roll for ${attacker.name} vs ${target.name}.`;

        const storeGameState = useGameStore.getState().gameState;
        const currentGameState = storeGameState ?? gameState;
        if (currentGameState) {
          const stateWithLog = addLogEntry(currentGameState, timeoutLogMessage, 'combat');
          useGameStore.setState({ gameState: stateWithLog });
          if (gameState) {
            gameState.log = stateWithLog.log;
            gameState.logIdCounter = stateWithLog.logIdCounter;
          }
        }

        useUIStore.getState().addNotification(
          `Dice roll timed out after ${timeoutSeconds}s — roll was auto-resolved for ${attacker.name}.`,
          'warning',
          4000
        );

        resolve(attackResult);
      }, timeoutMs);

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
        isAutoRoll,
        onComplete: () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          const preRolledValue = store.getState().result;
          const attackResult = preRolledValue !== null
            ? CombatSystem.resolveAttack(attacker, target, attackBonus, damage, rollModifier, preRolledValue, gameState, missDamage)
            : CombatSystem.resolveAttack(attacker, target, attackBonus, damage, rollModifier, undefined, gameState, missDamage);
          if (attackResult.hit) {
            SoundLibrary.Combat.hit();
            if (target.type === 'hero' && attackResult.damage > 0) {
              SoundLibrary.Combat.hurt();
            }
          }
          resolve(attackResult);
        }
      });
    });
  }
}
