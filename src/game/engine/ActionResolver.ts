import { GameState, Hero, Monster, Position, AttackResult, Card } from '../types';
import { CombatSystem } from './CombatSystem';
import { TileSystem } from './TileSystem';
import { ConditionSystem } from './ConditionSystem';

/**
 * Validates and resolves game actions.
 */
export class ActionResolver {
  /**
   * Checks if a move is legal.
   */
  public static validateMove(gameState: GameState, entityId: string, to: Position): boolean {
    const entity = [...gameState.heroes, ...gameState.monsters].find(e => e.id === entityId);
    if (!entity) return false;

    // DEBUG: Check if entity is immobilized
    if (ConditionSystem.hasCondition(entity, 'immobilized')) {
      console.log(`[DEBUG ActionResolver] ${entity.name} is immobilized and cannot move`);
      return false;
    }

    // DEBUG: Get effective speed considering conditions
    const effectiveSpeed = ConditionSystem.getEffectiveSpeed(entity);

    // Check speed
    if (!TileSystem.isValidSquareMove(entity.position, to, effectiveSpeed)) {
      return false;
    }

    // Check if tile is revealed
    const targetTile = gameState.tiles.find(t => t.x === to.x && t.z === to.z);
    if (!targetTile || !targetTile.isRevealed) {
      return false;
    }

    return true;
  }

  /**
   * Resolves a melee or ranged attack.
   */
  public static resolveAttack(
    attacker: Hero | Monster,
    target: Hero | Monster,
    modifiers: number = 0
  ): AttackResult {
    const attackBonus = (attacker as any).attackBonus || 0; // Heroes might have dynamic bonuses
    const damage = (attacker as any).damage || 1;

    return CombatSystem.resolveAttack(attacker, target, attackBonus, damage, modifiers);
  }
}
