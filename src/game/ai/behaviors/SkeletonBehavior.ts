import { Monster, Hero, MonsterAction, Position } from '../../types';
import { Pathfinding } from '../Pathfinding';
import { ThreatAssessment } from '../ThreatAssessment';

export const SkeletonBehavior = {
  decideAction(monster: Monster, heroes: Hero[], gameState: any): MonsterAction {
    const target = ThreatAssessment.getTopTarget(monster, heroes);
    if (!target) return { type: 'idle' };

    const dist = getDistance(monster.position, target.position);

    // Skeleton Rules:
    // 1. If adjacent, attack.
    // 2. If dist 2-3, ranged attack.
    // 3. Otherwise, move toward.

    if (dist === 1) {
      return { type: 'attack', targetId: target.id };
    }

    if (dist <= 3) {
      return { type: 'special', targetId: target.id, abilityId: 'ranged_bow' };
    }

    const path = Pathfinding.calculatePath(monster.position, target.position, gameState.tiles, []);
    if (path.points.length > 1) {
      return { type: 'move', position: path.points[1] };
    }

    return { type: 'idle' };
  }
};

function getDistance(p1: Position, p2: Position): number {
  const ts = 4;
  const g1 = { x: p1.x * ts + p1.sqX, z: p1.z * ts + p1.sqZ };
  const g2 = { x: p2.x * ts + p2.sqX, z: p2.z * ts + p2.sqZ };
  return Math.abs(g1.x - g2.x) + Math.abs(g1.z - g2.z);
}
