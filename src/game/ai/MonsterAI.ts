import { Monster, Hero, MonsterAction, GameState, Position, Path, Tile, IBehavior } from '../types';
import { Pathfinding } from './Pathfinding';
import { ThreatAssessment } from './ThreatAssessment';

import { GargoyleBehavior } from './behaviors/GargoyleBehavior';
import { GoblinBehavior } from './behaviors/GoblinBehavior';
import { ZombieBehavior } from './behaviors/ZombieBehavior';
import { WolfBehavior } from './behaviors/WolfBehavior';
import { SkeletonBehavior } from './behaviors/SkeletonBehavior';
import { GhostBehavior } from './behaviors/GhostBehavior';
import { VampireBehavior } from './behaviors/VampireBehavior';
import { StrahdBehavior } from './behaviors/StrahdBehavior';

export class MonsterAI {
  private static readonly BEHAVIORS: Record<string, IBehavior> = {
    'gargoyle': new GargoyleBehavior(),
    'goblin': new GoblinBehavior(),
    'zombie': new ZombieBehavior(),
    'wolf': new WolfBehavior(),
    'skeleton': new SkeletonBehavior(),
    'ghost': new GhostBehavior(),
    'vampire': new VampireBehavior(),
    'strahd': new StrahdBehavior(),
  };

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

  public calculatePath(monster: Monster, target: Hero, tiles: Tile[]): Path {
    return Pathfinding.calculatePath(monster.position, target.position, tiles, []);
  }

  // --- Actions wrappers (to be triggered by GameEngine) ---

  public moveTowardTarget(monster: Monster, target: Hero): void {
    throw new Error('[MonsterAI] Use resolveTactic() from MonsterAI engine — this class method is not implemented.');
  }

  public moveRandomly(monster: Monster): void {
    throw new Error('[MonsterAI] Use resolveTactic() from MonsterAI engine — this class method is not implemented.');
  }

  public stayInPlace(monster: Monster): void {
    throw new Error('[MonsterAI] Use resolveTactic() from MonsterAI engine — this class method is not implemented.');
  }

  public attackTarget(monster: Monster, target: Hero): void {
    throw new Error('[MonsterAI] Use resolveTactic() from MonsterAI engine — this class method is not implemented.');
  }

  public useSpecialAbility(monster: Monster): void {
    throw new Error('[MonsterAI] Use resolveTactic() from MonsterAI engine — this class method is not implemented.');
  }

  private getBehavior(type: string): IBehavior | undefined {
    return MonsterAI.BEHAVIORS[type.toLowerCase()];
  }
}
