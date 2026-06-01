import { Hero, Monster, Position } from '../types';
import { GAME_CONSTANTS } from '../constants';

export class ThreatAssessment {
  /**
   * Calculates a threat score for a hero from a monster's perspective.
   */
  public static calculateThreat(hero: Hero, monster: Monster): number {
    if (hero.hp <= 0) return -1; // Ignore dead heroes

    let score = 0;

    // 1. Proximity: Closer heroes are more threatening
    const dist = this.getManhattanDistance(monster.position, hero.position);
    score += Math.max(0, (20 - dist) * 2);

    // 2. Vulnerability: Heroes with lower current HP are attractive targets
    const hpRatio = hero.hp / hero.maxHp;
    score += (1 - hpRatio) * 30;

    // 3. Power: Higher level heroes are more dangerous
    score += (hero.level - 1) * 15;

    // 4. Aggro factor: Could be expanded with damage dealt to monster recently
    
    return score;
  }

  private static getManhattanDistance(p1: Position, p2: Position): number {
    const ts = GAME_CONSTANTS.TILE_SIZE_SQUARES;
    const g1 = { x: p1.x * ts + p1.sqX, z: p1.z * ts + p1.sqZ };
    const g2 = { x: p2.x * ts + p2.sqX, z: p2.z * ts + p2.sqZ };
    return Math.abs(g1.x - g2.x) + Math.abs(g1.z - g2.z);
  }

  /**
   * Returns the hero with the highest threat score.
   */
  public static getTopTarget(monster: Monster, heroes: Hero[]): Hero | null {
    if (heroes.length === 0) return null;

    let topHero = null;
    let maxThreat = -Infinity;

    for (const hero of heroes) {
      const threat = this.calculateThreat(hero, monster);
      if (threat > maxThreat) {
        maxThreat = threat;
        topHero = hero;
      }
    }

    return topHero;
  }
}
