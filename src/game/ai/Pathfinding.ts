import { Position, Path, Tile } from '../types';
import { GAME_CONSTANTS } from '../constants';

export class Pathfinding {
  /**
   * Calculates a path from start to target using A* algorithm.
   */
  public static calculatePath(
    start: Position,
    target: Position,
    tiles: Tile[],
    obstacles: Position[]
  ): Path {
    const startKey = this.posToKey(start);
    const targetKey = this.posToKey(target);

    if (startKey === targetKey) {
      return { points: [start], cost: 0 };
    }

    const openSet: string[] = [startKey];
    const cameFrom: Map<string, string> = new Map();
    const gScore: Map<string, number> = new Map();
    const fScore: Map<string, number> = new Map();

    gScore.set(startKey, 0);
    fScore.set(startKey, this.getHeuristic(start, target));

    const obstacleSet = new Set(obstacles.map(p => this.posToKey(p)));
    const tileSet = new Set(tiles.map(t => `${t.x},${t.z}`));

    while (openSet.length > 0) {
      // Get the node in openSet having the lowest fScore value
      openSet.sort((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
      const currentKey = openSet.shift()!;

      if (currentKey === targetKey) {
        return this.reconstructPath(cameFrom, currentKey);
      }

      const currentPos = this.keyToPos(currentKey);
      const neighbors = this.getNeighbors(currentPos, tileSet, obstacleSet);

      for (const neighbor of neighbors) {
        const neighborKey = this.posToKey(neighbor);
        const tentativeGScore = (gScore.get(currentKey) || 0) + 1;

        if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeGScore);
          fScore.set(neighborKey, tentativeGScore + this.getHeuristic(neighbor, target));

          if (!openSet.includes(neighborKey)) {
            openSet.push(neighborKey);
          }
        }
      }
    }

    // No path found
    return { points: [], cost: Infinity };
  }

  private static getHeuristic(p1: Position, p2: Position): number {
    const g1 = this.posToGlobal(p1);
    const g2 = this.posToGlobal(p2);
    return Math.abs(g1.x - g2.x) + Math.abs(g1.z - g2.z);
  }

  private static getNeighbors(pos: Position, tileSet: Set<string>, obstacleSet: Set<string>): Position[] {
    const neighbors: Position[] = [];
    const directions = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 },
    ];

    const global = this.posToGlobal(pos);

    for (const dir of directions) {
      const nextGlobal = { x: global.x + dir.dx, z: global.z + dir.dz };
      const nextPos = this.globalToPos(nextGlobal.x, nextGlobal.z);
      const nextKey = this.posToKey(nextPos);
      const nextTileKey = `${nextPos.x},${nextPos.z}`;

      // Must be on a revealed tile and not an obstacle
      if (tileSet.has(nextTileKey) && !obstacleSet.has(nextKey)) {
        neighbors.push(nextPos);
      }
    }

    return neighbors;
  }

  private static reconstructPath(cameFrom: Map<string, string>, currentKey: string): Path {
    const points: Position[] = [this.keyToPos(currentKey)];
    let tempKey = currentKey;
    while (cameFrom.has(tempKey)) {
      tempKey = cameFrom.get(tempKey)!;
      points.unshift(this.keyToPos(tempKey));
    }
    return { points, cost: points.length - 1 };
  }

  private static posToGlobal(pos: Position) {
    return {
      x: pos.x * GAME_CONSTANTS.TILE_SIZE_SQUARES + pos.sqX,
      z: pos.z * GAME_CONSTANTS.TILE_SIZE_SQUARES + pos.sqZ,
    };
  }

  private static globalToPos(gx: number, gz: number): Position {
    const tileSize = GAME_CONSTANTS.TILE_SIZE_SQUARES;
    return {
      x: Math.floor(gx / tileSize),
      z: Math.floor(gz / tileSize),
      sqX: ((gx % tileSize) + tileSize) % tileSize,
      sqZ: ((gz % tileSize) + tileSize) % tileSize,
    };
  }

  private static posToKey(pos: Position): string {
    const g = this.posToGlobal(pos);
    return `${g.x},${g.z}`;
  }

  private static keyToPos(key: string): Position {
    const [gx, gz] = key.split(',').map(Number);
    return this.globalToPos(gx, gz);
  }
}
