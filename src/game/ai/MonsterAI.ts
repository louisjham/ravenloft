import { Monster, Hero, MonsterAction, GameState, Position, Path, AttackResult } from '../types';
import { Pathfinding } from './Pathfinding';
import { ThreatAssessment } from './ThreatAssessment';

// Import behaviors
import { GargoyleBehavior } from './behaviors/GargoyleBehavior';
import { GoblinBehavior } from './behaviors/GoblinBehavior';
import { ZombieBehavior } from './behaviors/ZombieBehavior';
import { WolfBehavior } from './behaviors/WolfBehavior';
import { SkeletonBehavior } from './behaviors/SkeletonBehavior';
import { GhostBehavior } from './behaviors/GhostBehavior';
import { VampireBehavior } from './behaviors/VampireBehavior';
import { StrahdBehavior } from './behaviors/StrahdBehavior';

export class MonsterAI {
  /**
   * Main entry point to decide what a monster should do this turn.
   */
  public decideAction(monster: Monster, heroes: Hero[], gameState: GameState): MonsterAction {
    const behavior = this.getBehavior(monster.monsterType);
    if (behavior) {
      return behavior.decideAction(monster, heroes, gameState);
    }
    
    // Default fallback
    const target = this.findNearestHero(monster, heroes);
    if (target) {
      return { type: 'move', position: target.position };
    }
    
    return { type: 'idle' };
  }

  public findNearestHero(monster: Monster, heroes: Hero[]): Hero | null {
    return ThreatAssessment.getTopTarget(monster, heroes);
  }

  public calculatePath(monster: Monster, target: Hero, tiles: any[]): Path {
    return Pathfinding.calculatePath(monster.position, target.position, tiles, []);
  }

  // --- Actions wrappers (to be triggered by GameEngine) ---

  public moveTowardTarget(monster: Monster, target: Hero): void {
    // Engine will call this to update state
    console.log(`AI: ${monster.name} moving toward ${target.name}`);
  }

  public moveRandomly(monster: Monster): void {
    console.log(`AI: ${monster.name} moving randomly`);
  }

  public stayInPlace(monster: Monster): void {
    console.log(`AI: ${monster.name} staying in place`);
  }

  public attackTarget(monster: Monster, target: Hero): void {
    console.log(`AI: ${monster.name} attacking ${target.name}`);
  }

  public useSpecialAbility(monster: Monster): void {
    console.log(`AI: ${monster.name} using special ability`);
  }

  private getBehavior(type: string) {
    const behaviors: Record<string, any> = {
      'gargoyle': GargoyleBehavior,
      'goblin': GoblinBehavior,
      'zombie': ZombieBehavior,
      'wolf': WolfBehavior,
      'skeleton': SkeletonBehavior,
      'ghost': GhostBehavior,
      'vampire': VampireBehavior,
      'strahd': StrahdBehavior,
    };
    return behaviors[type.toLowerCase()];
  }
}
