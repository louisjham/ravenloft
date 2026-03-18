import { Tile, Position, TileConnection } from '../types';
import { GAME_CONSTANTS } from '../constants';

/**
 * Handles tile placement, exploration edge detection, and grid management.
 */
export class TileSystem {
  /**
   * Finds all exploration edges (arrows) on revealed tiles that don't have a connected tile yet.
   */
  public static getExplorationPoints(tiles: Tile[]): { tileId: string, edge: string }[] {
    const points: { tileId: string, edge: string }[] = [];
    
    tiles.forEach(tile => {
      tile.connections.forEach(conn => {
        if (conn.isOpen && !conn.connectedTileId) {
          points.push({ tileId: tile.id, edge: conn.edge });
        }
      });
    });
    
    return points;
  }

  /**
   * Calculates the world coordinates for a multi-tile layout.
   * Note: In this simplified 2D-logical version, we use tile coordinates (x, z).
   */
  public static getTargetPosition(currentPos: Position, direction: 'north' | 'south' | 'east' | 'west'): Position {
    const nextPos = { ...currentPos };
    switch (direction) {
      case 'north': nextPos.z -= 1; break;
      case 'south': nextPos.z += 1; break;
      case 'east': nextPos.x += 1; break;
      case 'west': nextPos.x -= 1; break;
    }
    return nextPos;
  }

  /**
   * Checks if a move between two squares is valid.
   * Speed in the board game is measured in squares.
   */
  public static isValidSquareMove(from: Position, to: Position, speed: number): boolean {
    // Manhattan distance on the square grid
    const fromGlobalX = from.x * GAME_CONSTANTS.TILE_SIZE_SQUARES + from.sqX;
    const fromGlobalZ = from.z * GAME_CONSTANTS.TILE_SIZE_SQUARES + from.sqZ;
    const toGlobalX = to.x * GAME_CONSTANTS.TILE_SIZE_SQUARES + to.sqX;
    const toGlobalZ = to.z * GAME_CONSTANTS.TILE_SIZE_SQUARES + to.sqZ;

    const distance = Math.abs(fromGlobalX - toGlobalX) + Math.abs(fromGlobalZ - toGlobalZ);
    return distance <= speed;
  }

  /**
   * Returns adjacent revealed tiles.
   */
  public static getAdjacentTiles(tile: Tile, allTiles: Tile[]): Tile[] {
    return allTiles.filter(t => 
      tile.connections.some(conn => conn.connectedTileId === t.id)
    );
  }
}
