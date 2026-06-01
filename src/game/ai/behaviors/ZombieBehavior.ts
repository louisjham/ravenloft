import { Monster, Hero, MonsterAction, Position } from '../../types';
import { Pathfinding } from '../Pathfinding';
import { ThreatAssessment } from '../ThreatAssessment';

export const ZombieBehavior = {
  decideAction(monster: Monster, heroes: Hero[], gameState: any): MonsterAction {
    const target = ThreatAssessment.getTopTarget(monster, heroes);
    if (!target) return { type: 'idle' };

    const dist = getDistance(monster.position, target.position);

    // Zombie Rules:
    // 1. If adjacent, attack (high damage, slow).
    // 2. Otherwise, move 1 step toward (slowest speed).

    if (dist === 1) {
      return { type: 'attack', targetId: target.id };
    }

    const path = Pathfinding.calculatePath(monster.position, target.position, gameState.tiles, []);
    if (path.points.length > 1) {
      return { type: 'move', position: path.points[1] };
    }

    return { type: 'idle' };
  }
};

function getDistance(p1: Position, p2: Position): number {
  const g1 = { x: p1.x * 4 + p1.sqX, z: p1.z * 4 + p1.sqZ };
  const g2 = { x: p2.x * 4 + p2.sqX, z: p2.z * 4 + p2.sqZ };
  return Math.abs(g1.x - g2.x) + Math.abs(g1.z - g2.z);
}
