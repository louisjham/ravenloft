import { Monster, Hero, MonsterAction, Position } from '../../types';
import { Pathfinding } from '../Pathfinding';
import { ThreatAssessment } from '../ThreatAssessment';

export const GoblinBehavior = {
  decideAction(monster: Monster, heroes: Hero[], gameState: any): MonsterAction {
    const target = ThreatAssessment.getTopTarget(monster, heroes);
    if (!target) return { type: 'idle' };

    const dist = getDistance(monster.position, target.position);
    const isLowHp = monster.hp <= monster.maxHp * 0.3;

    // Goblin Rules:
    // 1. If low HP, flee from nearest hero.
    // 2. If adjacent, attack.
    // 3. Otherwise, move toward.

    if (isLowHp) {
      // Flee logic: find a spot further away
      return { type: 'move', position: this.calculateFleePosition(monster, target, gameState) };
    }

    if (dist === 1) {
      return { type: 'attack', targetId: target.id };
    }

    const path = Pathfinding.calculatePath(monster.position, target.position, gameState.tiles, []);
    if (path.points.length > 1) {
      return { type: 'move', position: path.points[1] };
    }

    return { type: 'idle' };
  },

  calculateFleePosition(monster: Monster, target: Hero, gameState: any): Position {
    // Simple flee: step in a direction that increases distance from target
    const current = monster.position;
    const targetPos = target.position;

    const dx = current.x * 4 + current.sqX > targetPos.x * 4 + targetPos.sqX ? 1 : -1;
    const dz = current.z * 4 + current.sqZ > targetPos.z * 4 + targetPos.sqZ ? 1 : -1;

    // Try moving in flee direction
    const fleeGlobal = { 
      x: (current.x * 4 + current.sqX) + dx, 
      z: (current.z * 4 + current.sqZ) + dz 
    };
    
    // Check if valid tile (simplified)
    return {
      x: Math.floor(fleeGlobal.x / 4),
      z: Math.floor(fleeGlobal.z / 4),
      sqX: Math.abs(fleeGlobal.x % 4),
      sqZ: Math.abs(fleeGlobal.z % 4)
    };
  }
};

function getDistance(p1: Position, p2: Position): number {
  const g1 = { x: p1.x * 4 + p1.sqX, z: p1.z * 4 + p1.sqZ };
  const g2 = { x: p2.x * 4 + p2.sqX, z: p2.z * 4 + p2.sqZ };
  return Math.abs(g1.x - g2.x) + Math.abs(g1.z - g2.z);
}
