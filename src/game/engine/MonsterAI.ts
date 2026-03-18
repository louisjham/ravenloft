import { Monster, Hero, Position } from '../types';
import { GAME_CONSTANTS } from '../constants';

/**
 * Basic AI for monsters: Move toward nearest hero, attack if adjacent.
 */
export class MonsterAI {
  /**
   * Simple A* search for pathfinding on a square grid.
   * For now, implements Manhattan distance heuristic as a placeholder.
   */
  public static findPath(start: Position, target: Position, obstacles: Position[]): Position[] {
    // This is a simplified BFS that acts as a placeholder for full A*.
    // In a production scenario, we'd use a more robust A* implementation.
    return [target]; // Stub: moves directly to target for now.
  }

  /**
   * Finds the nearest hero to the monster.
   */
  public static findNearestHero(monster: Monster, heroes: Hero[]): Hero | null {
    if (heroes.length === 0) return null;

    let nearestHero = heroes[0];
    let minDistance = this.getDistance(monster.position, nearestHero.position);

    for (let i = 1; i < heroes.length; i++) {
      const d = this.getDistance(monster.position, heroes[i].position);
      if (d < minDistance) {
        minDistance = d;
        nearestHero = heroes[i];
      } else if (d === minDistance) {
        // Tiebreaker: Lowest HP
        if (heroes[i].hp < nearestHero.hp) {
          nearestHero = heroes[i];
        }
      }
    }

    return nearestHero;
  }

  /**
   * Manhattan distance on the global square grid.
   */
  public static getDistance(p1: Position, p2: Position): number {
    const x1 = p1.x * GAME_CONSTANTS.TILE_SIZE_SQUARES + p1.sqX;
    const z1 = p1.z * GAME_CONSTANTS.TILE_SIZE_SQUARES + p1.sqZ;
    const x2 = p2.x * GAME_CONSTANTS.TILE_SIZE_SQUARES + p2.sqX;
    const z2 = p2.z * GAME_CONSTANTS.TILE_SIZE_SQUARES + p2.sqZ;

    return Math.abs(x1 - x2) + Math.abs(z1 - z2);
  }

  /**
   * Checks if a monster is adjacent to a hero (range 1 square).
   */
  public static isAdjacent(p1: Position, p2: Position): boolean {
    return this.getDistance(p1, p2) === 1;
  }
}
