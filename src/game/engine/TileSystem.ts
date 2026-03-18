import { Tile, Position, TileConnection, Direction, Rotation, GameState, ExplorationPoint } from '../types';
import { GAME_CONSTANTS } from '../constants';
import { DataLoader } from '../dataLoader';

/**
 * Handles tile placement, exploration edge detection, and grid management.
 */
export class TileSystem {

  private static getOccupiedKeys(tiles: Tile[]): Set<string> {
    return new Set(tiles.map(t => `${t.x},${t.z}`));
  }

  public static canPlaceTile(
    tiles: Tile[],
    targetX: number,
    targetZ: number
  ): boolean {
    const occupied = TileSystem.getOccupiedKeys(tiles);
    return !occupied.has(`${targetX},${targetZ}`);
  }

  /**
   * Orchestrates the standard tile placement workflow:
   * Draw -> Assign Coords -> Check Overlap -> Rotate -> Connect -> Return state.
   */
  public static placeTile(
    gameState: GameState,
    explorationPoint: { tileId: string; edge: Direction },
    chosenRotation: Rotation
  ): GameState {
    // 1. Draw from deck
    const drawResult = TileSystem.drawAndPlace(gameState, explorationPoint);
    if (drawResult.exhausted || !drawResult.tile) {
      console.warn('[TileSystem] drawAndPlace exhausted or no tile found.');
      return gameState;
    }

    // 2. Identify parent tile
    const parentTile = gameState.tiles.find(t => t.id === explorationPoint.tileId);
    if (!parentTile) {
      console.warn(`[TileSystem] Parent tile not found for ID: ${explorationPoint.tileId}`);
      return gameState;
    }

    // 3. Assign spatial coords relative to parent edge
    const tile = TileSystem.assignPlacementCoords(
      drawResult.tile,
      parentTile,
      explorationPoint.edge
    );

    // 4. Overlap bounds check
    if (!TileSystem.canPlaceTile(gameState.tiles, tile.x, tile.z)) {
      console.warn(`[TileSystem] Placement overlap detected at (${tile.x}, ${tile.z}).`);
      return gameState;
    }

    // 5. Rotate edges
    tile.connections = TileSystem.rotateConnections(tile.connections, chosenRotation);

    // 6. Rotate bone square offset
    if (tile.boneSquare) {
      tile.boneSquare = TileSystem.rotateBoneSquare(
        tile.boneSquare.sqX,
        tile.boneSquare.sqZ,
        chosenRotation
      );
    }

    // 7. Graph connections linkage (returns updated tiles array containing new tile)
    const newTiles = TileSystem.connectTiles(
      gameState.tiles,
      parentTile,
      tile,
      explorationPoint.edge
    );

    // 8. Yield functional state payload
    return {
      ...gameState,
      tiles: newTiles,
      dungeonDeck: drawResult.remainingDeck
    };
  }

  // -------------------------------------------------------------------------
  // Private static data
  // -------------------------------------------------------------------------

  /**
   * Clockwise-rotation lookup for cardinal edge labels.
   *
   * ROTATION_MAP[edge][rotation] → the edge that `edge` becomes after
   * `rotation` degrees of clockwise rotation.
   *
   *   0°   → no change
   *   90°  → north→east→south→west (cycle)
   *   180° → north↔south, east↔west
   *   270° → north→west→south→east (cycle)
   */
  private static readonly ROTATION_MAP: Record<Direction, Record<Rotation, Direction>> = {
    north: { 0: 'north', 90: 'east',  180: 'south', 270: 'west'  },
    east:  { 0: 'east',  90: 'south', 180: 'west',  270: 'north' },
    south: { 0: 'south', 90: 'west',  180: 'north', 270: 'east'  },
    west:  { 0: 'west',  90: 'north', 180: 'east',  270: 'south' },
  };

  /** All valid rotation values, kept DRY for iteration. */
  private static readonly ALL_ROTATIONS: Rotation[] = [0, 90, 180, 270];

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Returns the opposite cardinal direction.
   */
  private static opposite(edge: Direction): Direction {
    switch (edge) {
      case 'north': return 'south';
      case 'south': return 'north';
      case 'east':  return 'west';
      case 'west':  return 'east';
    }
  }

  /**
   * Returns the dungeon-grid coordinate of the cell adjacent to (parentX, parentZ)
   * on the given edge.
   *
   *   north → z − 1   south → z + 1
   *   east  → x + 1   west  → x − 1
   *
   * Named `getTargetCoords` (not `getTargetPosition`) to avoid colliding with
   * the public method of that name which operates on the full Position type.
   */
  private static getTargetCoords(
    parentX: number,
    parentZ: number,
    edge: Direction,
  ): { x: number; z: number } {
    switch (edge) {
      case 'north': return { x: parentX,     z: parentZ - 1 };
      case 'south': return { x: parentX,     z: parentZ + 1 };
      case 'east':  return { x: parentX + 1, z: parentZ     };
      case 'west':  return { x: parentX - 1, z: parentZ     };
    }
  }

  /**
   * Looks up a Tile template by ID from the DataLoader catalogue.
   * Returns `undefined` when the ID is unknown (missing data).
   */
  private static getTileTemplate(cardId: string): Tile | undefined {
    return DataLoader.getInstance().getTileById(cardId);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Finds all exploration edges (arrows) on revealed tiles that don't yet have
   * a connected tile. Excludes edges that face an already-occupied cell.
   * Returns precise world midpoint coordinates for UI rendering.
   */
  public static getExplorationPoints(tiles: Tile[]): ExplorationPoint[] {
    const points: ExplorationPoint[] = [];

    tiles.forEach(tile => {
      if (!tile.isRevealed) return;

      tile.connections.forEach(conn => {
        if (conn.isOpen && !conn.connectedTileId) {
          const edge = conn.edge as Direction;
          
          // Determine adjacent grid cell coordinate
          const targetCoords = TileSystem.getTargetCoords(tile.x, tile.z, edge);
          
          // Only add point if the adjacent space is empty
          if (TileSystem.canPlaceTile(tiles, targetCoords.x, targetCoords.z)) {
            let worldX = tile.x;
            let worldZ = tile.z;

            switch (edge) {
              case 'north': worldZ -= 0.5; break;
              case 'south': worldZ += 0.5; break;
              case 'east':  worldX += 0.5; break;
              case 'west':  worldX -= 0.5; break;
            }

            points.push({ tileId: tile.id, edge, worldX, worldZ });
          }
        }
      });
    });

    return points;
  }

  /**
   * Returns the Position adjacent to `currentPos` in the given direction.
   * Operates on tile-grid coordinates (not world/pixel space).
   */
  public static getTargetPosition(currentPos: Position, direction: Direction): Position {
    const nextPos = { ...currentPos };
    switch (direction) {
      case 'north': nextPos.z -= 1; break;
      case 'south': nextPos.z += 1; break;
      case 'east':  nextPos.x += 1; break;
      case 'west':  nextPos.x -= 1; break;
    }
    return nextPos;
  }

  /**
   * Returns true when the Manhattan distance between `from` and `to`
   * (in squares) is within the hero's speed.
   */
  public static isValidSquareMove(from: Position, to: Position, speed: number): boolean {
    const fromGlobalX = from.x * GAME_CONSTANTS.TILE_SIZE_SQUARES + from.sqX;
    const fromGlobalZ = from.z * GAME_CONSTANTS.TILE_SIZE_SQUARES + from.sqZ;
    const toGlobalX   = to.x   * GAME_CONSTANTS.TILE_SIZE_SQUARES + to.sqX;
    const toGlobalZ   = to.z   * GAME_CONSTANTS.TILE_SIZE_SQUARES + to.sqZ;

    const distance = Math.abs(fromGlobalX - toGlobalX) + Math.abs(fromGlobalZ - toGlobalZ);
    return distance <= speed;
  }

  /** Returns tiles directly connected to `tile` via its connection graph. */
  public static getAdjacentTiles(tile: Tile, allTiles: Tile[]): Tile[] {
    return allTiles.filter(t =>
      tile.connections.some(conn => conn.connectedTileId === t.id)
    );
  }

  /**
   * Returns a NEW Tile with x and z set to the given grid coordinates.
   * Pure function — original tile is never mutated.
   */
  public static assignTileCoords(tile: Tile, x: number, z: number): Tile {
    return { ...tile, x, z };
  }

  /**
   * Returns a NEW Tile positioned adjacent to `parentTile` on `openEdge`,
   * with `isRevealed` forced to `true`.
   *
   * Pure function — neither `tile` nor `parentTile` is mutated.
   */
  public static assignPlacementCoords(
    tile: Tile,
    parentTile: Tile,
    openEdge: Direction,
  ): Tile {
    const { x, z } = TileSystem.getTargetCoords(parentTile.x, parentTile.z, openEdge);
    return { ...tile, x, z, isRevealed: true };
  }

  /**
   * Returns a NEW connections array with each edge label rotated clockwise by
   * `rotation` degrees.
   *
   * Pure function — the input array and its objects are never mutated.
   * Uses `ROTATION_MAP` (lookup table, no trigonometry).
   */
  public static rotateConnections(
    connections: TileConnection[],
    rotation: Rotation,
  ): TileConnection[] {
    return connections.map(conn => ({
      ...conn,
      edge: TileSystem.ROTATION_MAP[conn.edge as Direction][rotation],
    }));
  }

  /**
   * Rotates a 0-indexed bone pile square (sqX, sqZ max 3) clockwise.
   */
  public static rotateBoneSquare(
    sqX: number,
    sqZ: number,
    rotation: Rotation
  ): { sqX: number; sqZ: number } {
    const N = 3;
    switch (rotation) {
      case 0:   return { sqX, sqZ };
      case 90:  return { sqX: N - sqZ, sqZ: sqX };
      case 180: return { sqX: N - sqX, sqZ: N - sqZ };
      case 270: return { sqX: sqZ,     sqZ: N - sqX };
    }
  }

  /**
   * Returns every rotation value at which `tile` exposes an open edge on the
   * face opposite to `incomingEdge`.
   *
   * Pure function. Returns `[]` if no legal rotation exists (caller must
   * handle the deadlock scenario — do not throw from here).
   */
  public static getValidRotations(tile: Tile, incomingEdge: Direction): Rotation[] {
    const neededEdge = TileSystem.opposite(incomingEdge);

    return TileSystem.ALL_ROTATIONS.filter(rotation => {
      const rotated = TileSystem.rotateConnections(tile.connections, rotation);
      return rotated.some(conn => conn.edge === neededEdge && conn.isOpen);
    });
  }

  /**
   * Scans the dungeon deck for the first tile that can legally connect to
   * `explorationPoint` and returns it together with its valid rotations.
   *
   * Algorithm (no mutation of `gameState`):
   *   1. Copy `gameState.dungeonDeck` into a local array.
   *   2. Iterate over the copy by index.
   *   3. For each cardId, look up the Tile template via `getTileTemplate`.
   *      Unknown IDs are skipped silently (missing data guard).
   *   4. Call `getValidRotations(candidate, explorationPoint.edge)`.
   *   5. On the first match, return the tile, its valid rotations, and a
   *      NEW deck array with that card removed (`remainingDeck`).
   *   6. If no card in the deck fits, return `exhausted: true` with
   *      `tile: null` and the original deck unchanged.
   *      The caller should log a warning and skip the exploration step —
   *      this method never throws.
   *
   * @param gameState        - Current, unmodified game state.
   * @param explorationPoint - The open edge that triggered exploration.
   * @returns DrawResult with the matched tile (or null), valid rotations,
   *          remaining deck, and exhausted flag.
   */
  public static drawAndPlace(
    gameState: GameState,
    explorationPoint: { tileId: string; edge: Direction },
  ): {
    tile: Tile | null;
    validRotations: Rotation[];
    remainingDeck: string[];
    exhausted: boolean;
  } {
    const deck = [...gameState.dungeonDeck]; // local copy — never mutate gameState

    for (let i = 0; i < deck.length; i++) {
      const cardId = deck[i];
      const candidate = TileSystem.getTileTemplate(cardId);

      // Skip IDs that don't resolve to a known tile (data gap).
      if (!candidate) continue;

      const validRotations = TileSystem.getValidRotations(candidate, explorationPoint.edge);

      if (validRotations.length > 0) {
        const remainingDeck = [...deck.slice(0, i), ...deck.slice(i + 1)];
        return { tile: candidate, validRotations, remainingDeck, exhausted: false };
      }
    }

    // No tile in the deck fits this exploration point.
    return { tile: null, validRotations: [], remainingDeck: deck, exhausted: true };
  }

  /**
   * Connects a newly placed tile to the existing grid.
   * Modifies copies of the affected tiles and returns an array of all tiles.
   * 
   * Actions:
   * 1. Connect parent to newTile on parentEdge.
   * 2. Connect newTile to parent on opposite(parentEdge).
   * 3. For every remaining edge on newTile, check if an existing tile occupies that world grid space.
   *    If so, check its corresponding face:
   *     - If open, connect both.
   *     - If closed, close newTile's edge permanently.
   */
  public static connectTiles(
    tiles: Tile[],
    parentTile: Tile,
    newTile: Tile,
    parentEdge: Direction
  ): Tile[] {
    const updatedTilesMap = new Map<string, Tile>();

    const getMutableTile = (id: string, original: Tile) => {
      if (!updatedTilesMap.has(id)) {
        updatedTilesMap.set(id, {
          ...original,
          connections: original.connections.map(c => ({ ...c }))
        });
      }
      return updatedTilesMap.get(id)!;
    };

    const mutableParent = getMutableTile(parentTile.id, parentTile);
    const mutableNewTile = getMutableTile(newTile.id, newTile);

    const parentConn = mutableParent.connections.find(c => c.edge === parentEdge);
    if (parentConn) parentConn.connectedTileId = newTile.id;

    const oppositeEdge = TileSystem.opposite(parentEdge);
    const newTilePrimaryConn = mutableNewTile.connections.find(c => c.edge === oppositeEdge);
    if (newTilePrimaryConn) newTilePrimaryConn.connectedTileId = parentTile.id;

    const remainingEdges = mutableNewTile.connections.filter(c => c.edge !== oppositeEdge);

    for (const newTileConn of remainingEdges) {
      const neighborCoords = TileSystem.getTargetCoords(newTile.x, newTile.z, newTileConn.edge as Direction);
      
      const neighbor = tiles.find(t => t.x === neighborCoords.x && t.z === neighborCoords.z);
      if (!neighbor) continue;

      const neighborLookingBackEdge = TileSystem.opposite(newTileConn.edge as Direction);
      const mutableNeighbor = getMutableTile(neighbor.id, neighbor);
      const neighborConn = mutableNeighbor.connections.find(c => c.edge === neighborLookingBackEdge);

      if (neighborConn) {
        if (neighborConn.isOpen) {
          newTileConn.connectedTileId = neighbor.id;
          neighborConn.connectedTileId = newTile.id;
        } else {
          newTileConn.isOpen = false;
        }
      }
    }

    const resultTiles = tiles.map(t => updatedTilesMap.has(t.id) ? updatedTilesMap.get(t.id)! : t);
    
    if (!resultTiles.find(t => t.id === newTile.id)) {
      resultTiles.push(updatedTilesMap.get(newTile.id)!);
    }

    return resultTiles;
  }
}
