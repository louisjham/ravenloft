import { GameState, Hero, Monster, Tile } from '../types';

export interface Objective {
  id: string;
  type: 'find_item' | 'kill_boss' | 'escape' | 'escort' | 'survive' | 'find_tile' | 'all_at_position' | 'interact' | 'collect_items' | 'find_event';
  description: string;
  isCompleted: boolean;
  targetId?: string;
  targetTileId?: string;
  targetEntityId?: string;
  targetPositionId?: string;
  count?: number;
  currentCount?: number;
}

export class ObjectiveTracker {
  public static checkObjectives(gameState: GameState): Objective[] {
    return gameState.activeScenario.objectives.map(obj => {
      const updated = { ...obj };
      switch (obj.type) {
        case 'kill_boss':
          const boss = gameState.monsters.find(m => m.id === obj.targetId);
          if (boss && boss.hp <= 0) updated.isCompleted = true;
          break;
        case 'find_tile':
          const tile = gameState.tiles.find(t => t.id === obj.targetTileId && t.isRevealed);
          if (tile) updated.isCompleted = true;
          break;
        case 'all_at_position':
          const allAtPosition = gameState.heroes.every(h => 
            gameState.tiles.find(t => t.id === obj.targetTileId && t.x === h.position.x && t.z === h.position.z)
          );
          if (allAtPosition) updated.isCompleted = true;
          break;
        // Other types would be updated here as game logic progresses
      }
      return updated;
    });
  }
}
