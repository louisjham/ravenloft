import { Tile, Position, TileConnection, Direction, Rotation, GameState, ExplorationPoint, EdgeConflict, ValidationResult, Monster } from '../types';
import { GAME_CONSTANTS } from '../constants';
import { DataLoader } from '../dataLoader';
import { TokenSystem } from './TokenSystem';
import { getTileGraphDistance } from './MonsterAI';

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
   * Validates whether a tile can be placed at a position with given rotation.
   * Checks all edge alignments against existing neighbor tiles.
   *
   * @param tiles - Current placed tiles
   * @param newTile - Tile template to validate (will be cloned)
   * @param targetX - Target grid X position
   * @param targetZ - Target grid Z position
   * @param rotation - Rotation to apply (0, 90, 180, 270)
   * @param explorationEdge - The edge the player is exploring from (parent tile's edge)
   * @returns ValidationResult with valid flag, conflicts, and warnings
   */
  public static validateEdgeAlignment(
    tiles: Tile[],
    newTile: Tile,
    targetX: number,
    targetZ: number,
    rotation: Rotation,
    explorationEdge: Direction
  ): ValidationResult {
    const conflicts: EdgeConflict[] = [];
    const warnings: string[] = [];

    // Apply rotation to get the actual connections
    const rotatedConnections = TileSystem.rotateConnections(
      newTile.connections.map(c => ({ ...c })),
      rotation
    );

    // The edge on the NEW tile that must connect to the parent
    const requiredEdge = TileSystem.opposite(explorationEdge);

    // Check primary edge (must be open to connect to parent)
    const primaryConn = rotatedConnections.find(c => c.edge === requiredEdge);
    if (!primaryConn || !primaryConn.isOpen) {
      conflicts.push({
        edge: requiredEdge,
        issue: 'primary_blocked',
        description: `The ${requiredEdge} edge must be open to connect to the explored tile.`
      });
    }

    // Check all edges for neighbor compatibility
    for (const conn of rotatedConnections) {
      const edge = conn.edge as Direction;

      // Skip the primary edge (already checked)
      if (edge === requiredEdge) continue;

      // Get neighbor coordinates
      const neighborCoords = TileSystem.getTargetCoords(targetX, targetZ, edge);
      const neighbor = tiles.find(t => t.x === neighborCoords.x && t.z === neighborCoords.z);

      if (neighbor) {
        // There's a neighbor tile - check edge compatibility
        const neighborLookingBack = TileSystem.opposite(edge);
        const neighborConn = neighbor.connections.find(c => c.edge === neighborLookingBack);

        if (conn.isOpen && neighborConn && !neighborConn.isOpen) {
          // Open edge meets a wall
          conflicts.push({
            edge,
            issue: 'open_to_wall',
            neighborTileId: neighbor.id,
            description: `Open ${edge} edge meets a wall on ${neighbor.name || neighbor.id}.`
          });
        } else if (!conn.isOpen && neighborConn && neighborConn.isOpen) {
          // Wall meets an open edge - this is a warning, not an error
          warnings.push(
            `The ${edge} edge is closed but ${neighbor.name || neighbor.id} has an opening there. ` +
            `This will block the path.`
          );
        }
        // Open meets open = valid connection
        // Wall meets wall = valid (no connection needed)
      }
      // No neighbor = edge can be open or closed (creates exploration point if open)
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      warnings
    };
  }

  /**
   * Gets all neighbors of a grid position as a map of direction to tile (or null).
   */
  public static getNeighborTiles(
    tiles: Tile[],
    x: number,
    z: number
  ): Map<Direction, Tile | null> {
    const neighbors = new Map<Direction, Tile | null>();

    for (const edge of ['north', 'east', 'south', 'west'] as Direction[]) {
      const coords = TileSystem.getTargetCoords(x, z, edge);
      const neighbor = tiles.find(t => t.x === coords.x && t.z === coords.z) || null;
      neighbors.set(edge, neighbor);
    }

    return neighbors;
  }

  /**
   * Returns the current tile to the bottom of the deck and draws the next tile.
   * Used when player chooses "Draw Different Tile" after invalid placement.
   *
   * @param currentTileCardId - The card ID of the tile being returned
   * @param deck - Current dungeon deck
   * @param edgeDirection - The edge the tile is being placed against (to compute valid rotations)
   * @returns Object with new tile (or null if exhausted), card ID, updated deck, and valid rotations
   */
  public static returnAndDrawNext(
    currentTileCardId: string,
    deck: string[],
    edgeDirection: Direction
  ): { tile: Tile | null; cardId: string | null; remainingDeck: string[]; validRotations: Rotation[] } {
    // Put current tile at the bottom of the deck
    const deckWithReturned = [...deck, currentTileCardId];

    // Draw the next tile from the top
    if (deckWithReturned.length === 0) {
      return { tile: null, cardId: null, remainingDeck: [], validRotations: [] };
    }

    const nextCardId = deckWithReturned[0];
    const remainingDeck = deckWithReturned.slice(1);
    const tile = TileSystem.getTileTemplate(nextCardId);
    const validRotations = tile ? TileSystem.getValidRotations(tile, edgeDirection) : [];

    return { tile: tile || null, cardId: nextCardId, remainingDeck, validRotations };
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

    // 3. Assign spatial coords relative to parent edge AND generate unique ID
    const baseTile = drawResult.tile;
    const instanceId = `${baseTile.id}_${Math.random().toString(36).substr(2, 5)}`;
    const tileWithId = { ...baseTile, id: instanceId };

    const tile = TileSystem.assignPlacementCoords(
      tileWithId,
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

    // 8. Place coffin token on the new tile (for Scenario 1)
    const coffinResult = TokenSystem.placeCoffinOnNewTile(gameState, tile.id, tile.x, tile.z);

    // 9. Yield functional state payload
    const newState = {
      ...(coffinResult?.newState ?? gameState),
      tiles: newTiles,
      dungeonDeck: drawResult.remainingDeck
    };

    // Include tokens if a coffin was placed
    let finalTokens = coffinResult?.token ? [...(newState.tokens || []), coffinResult.token] : (newState.tokens || []);
    let finalState = {
      ...newState,
      tokens: finalTokens,
      strahdsCoffinTokenId: coffinResult?.token?.metadata?.isStrahdsCoffin
        ? coffinResult.token.id
        : newState.strahdsCoffinTokenId
    };

    // Tome of Strahd: drop facedown item token on black triangle tiles
    if (gameState.activeScenario.id === 'adventure_tome_of_strahd' && tile.encounterType === 'black') {
      const itemStack = finalState.tomeOfStrahdItemStack ? [...finalState.tomeOfStrahdItemStack] : [];
      if (itemStack.length > 0) {
        const poppedItemId = itemStack.shift();
        const itemToken: import('../types').GameToken = {
          id: `token_item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type: 'item',
          name: 'Mysterious Item',
          position: { x: tile.x, z: tile.z, sqX: 1, sqZ: 1 },
          tileId: tile.id,
          isRevealed: false,
          isSearched: false,
          metadata: { itemId: poppedItemId }
        };
        finalState = {
          ...finalState,
          tokens: [...finalState.tokens, itemToken],
          tomeOfStrahdItemStack: itemStack
        };
      }
    }

    return finalState;
  }

  /**
   * After a tile is placed during exploration, spawn a monster on it if the
   * tile has an encounterType. Draws from the monsterDeck, skipping (discarding)
   * any card whose monster type is already active on the board — per Castle
   * Ravenloft board game rule. Also handles Rogue Stealth.
   */
  public static spawnMonsterForExploration(gameState: GameState, tile: Tile): GameState {
    if (!tile.encounterType) return gameState;

    const activeHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    const hasStealth = activeHero && activeHero.heroClass === 'rogue' &&
                      (activeHero.abilities.includes('rogue_stealth') || activeHero.hand.includes('rogue_stealth')) &&
                      !(activeHero.flippedPowerIds ?? []).includes('rogue_stealth');

    // Build set of template IDs already active on the board.
    // Uses templateId when available (set by this function); falls back to m.id for
    // any monsters placed before this field was introduced.
    const activeTemplateIds = new Set(gameState.monsters.map(m => m.templateId ?? m.id));

    const deck = [...gameState.monsterDeck];
    if (deck.length === 0) return gameState;

    const discardedIds: string[] = [];
    let drawnTemplateId: string | undefined;
    let isTomeGuardian = false;
    let updatedVillainStack = gameState.tomeOfStrahdVillainStack ? [...gameState.tomeOfStrahdVillainStack] : [];

    if (gameState.activeScenario.id === 'adventure_tome_of_strahd' && tile.id === 'crypt_barov_ravenovia' && updatedVillainStack.length > 0) {
      drawnTemplateId = updatedVillainStack.shift();
      isTomeGuardian = true;
    } else {
      // Loop: discard already-controlled types, draw until we find a unique one
      while (deck.length > 0) {
        const candidateId = deck.pop()!;
        if (!activeTemplateIds.has(candidateId)) {
          drawnTemplateId = candidateId;
          break;
        }
        discardedIds.push(candidateId);
      }

      // Music of the Damned Environment Check
      if (gameState.activeEnvironmentCard === 'enc_music_of_the_damned' && drawnTemplateId && deck.length > 0) {
        let secondDrawnTemplateId: string | undefined;
        while (deck.length > 0) {
          const candidateId = deck.pop()!;
          if (!activeTemplateIds.has(candidateId)) {
            secondDrawnTemplateId = candidateId;
            break;
          }
          discardedIds.push(candidateId);
        }

        if (secondDrawnTemplateId) {
          const template1 = DataLoader.getInstance().getMonsterById(drawnTemplateId);
          const template2 = DataLoader.getInstance().getMonsterById(secondDrawnTemplateId);
          const xp1 = template1?.experienceValue ?? 1;
          const xp2 = template2?.experienceValue ?? 1;

          if (xp2 > xp1) {
            discardedIds.push(drawnTemplateId);
            drawnTemplateId = secondDrawnTemplateId;
          } else {
            discardedIds.push(secondDrawnTemplateId);
          }
        }
      }
    }

    // Build updated discard pile and base log entries for skipped cards
    const updatedDiscardPiles = discardedIds.length > 0
      ? { ...gameState.discardPiles, monster: [...gameState.discardPiles.monster, ...discardedIds] }
      : gameState.discardPiles;

    let currentCounter = gameState.logIdCounter ?? 0;
    let log = [...gameState.log];

    if (discardedIds.length > 0) {
      log.push({
        id: String(currentCounter),
        timestamp: new Date().toISOString(),
        message: `Monster draw: discarded [${discardedIds.join(', ')}] (already controlled) and redrew.`,
        type: 'system' as const
      });
      currentCounter++;
    }

    if (!drawnTemplateId) {
      // Deck exhausted — no eligible type found
      return {
        ...gameState,
        monsterDeck: deck,
        discardPiles: updatedDiscardPiles,
        log: log.slice(-100),
        logIdCounter: currentCounter
      };
    }

    // Rogue Stealth: discard the drawn card instead of placing the monster
    if (hasStealth && !isTomeGuardian) {
      const updatedHero = {
        ...activeHero!,
        flippedPowerIds: [...(activeHero!.flippedPowerIds ?? []), 'rogue_stealth']
      };
      log.push({
        id: String(currentCounter),
        timestamp: new Date().toISOString(),
        message: `${activeHero!.name} uses Stealth! Discards the drawn monster card (${drawnTemplateId}) instead of placing it. Stealth flips face-down.`,
        type: 'system' as const
      });
      currentCounter++;

      return {
        ...gameState,
        monsterDeck: deck,
        discardPiles: { ...updatedDiscardPiles, monster: [...updatedDiscardPiles.monster, drawnTemplateId] },
        heroes: gameState.heroes.map(h => h.id === updatedHero.id ? updatedHero : h),
        log: log.slice(-100),
        logIdCounter: currentCounter
      };
    }

    const template = DataLoader.getInstance().getMonsterById(drawnTemplateId);
    if (!template) {
      return {
        ...gameState,
        monsterDeck: deck,
        discardPiles: updatedDiscardPiles,
        log: log.slice(-100),
        logIdCounter: currentCounter
      };
    }

    const uniqueId = `monster_${drawnTemplateId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newMonster: Monster = {
      ...template,
      id: uniqueId,
      templateId: drawnTemplateId,
      // Per board game rules: the monster card drawn during exploration goes in front
      // of the active player — they control it and activate it in their Villain Phase.
      ownedByHeroId: gameState.currentHeroId,
      position: {
        x: tile.x,
        z: tile.z,
        sqX: 2,
        sqZ: 2
      },
      isExhausted: false,
      conditions: [],
      hp: template.hp,
      maxHp: template.maxHp
    };

    if (isTomeGuardian) {
      log.push({
        id: String(currentCounter),
        timestamp: new Date().toISOString(),
        message: `The guardian of the Tome of Strahd appears! ${newMonster.name} has been summoned!`,
        type: 'event' as const
      });
      currentCounter++;
    }

    return {
      ...gameState,
      monsterDeck: deck,
      tomeOfStrahdVillainStack: isTomeGuardian ? updatedVillainStack : gameState.tomeOfStrahdVillainStack,
      discardPiles: updatedDiscardPiles,
      monsters: [...gameState.monsters, newMonster],
      log: log.slice(-100),
      logIdCounter: currentCounter
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
    north: { 0: 'north', 90: 'east', 180: 'south', 270: 'west' },
    east: { 0: 'east', 90: 'south', 180: 'west', 270: 'north' },
    south: { 0: 'south', 90: 'west', 180: 'north', 270: 'east' },
    west: { 0: 'west', 90: 'north', 180: 'east', 270: 'south' },
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
      case 'east': return 'west';
      case 'west': return 'east';
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
  public static getTargetCoords(
    parentX: number,
    parentZ: number,
    edge: Direction,
  ): { x: number; z: number } {
    switch (edge) {
      case 'north': return { x: parentX, z: parentZ - 1 };
      case 'south': return { x: parentX, z: parentZ + 1 };
      case 'east': return { x: parentX + 1, z: parentZ };
      case 'west': return { x: parentX - 1, z: parentZ };
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
    let revealedTileCount = 0;
    // console.log(`[TileSystem] getExplorationPoints: checking ${tiles.length} tiles...`);

    tiles.forEach(tile => {
      if (!tile.isRevealed) {
        // console.log(`[TileSystem] Tile ${tile.id} not revealed, skipping`);
        return;
      }
      revealedTileCount++;

      tile.connections.forEach(conn => {
        if (conn.isOpen && !conn.connectedTileId) {
          const edge = conn.edge as Direction;

          // Determine adjacent grid cell coordinate
          const targetCoords = TileSystem.getTargetCoords(tile.x, tile.z, edge);

          // Only add point if the adjacent space is empty
          if (TileSystem.canPlaceTile(tiles, targetCoords.x, targetCoords.z)) {
            const TILE_SIZE = 4;
            const CENTER_OFFSET = 2.0; // TILE_SIZE / 2
            const EDGE_OFFSET = 2.0;   // TILE_SIZE / 2

            let worldX = tile.x * TILE_SIZE + CENTER_OFFSET;
            let worldZ = tile.z * TILE_SIZE + CENTER_OFFSET;

            switch (edge) {
              case 'north': worldZ -= EDGE_OFFSET; break;
              case 'south': worldZ += EDGE_OFFSET; break;
              case 'east': worldX += EDGE_OFFSET; break;
              case 'west': worldX -= EDGE_OFFSET; break;
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
      case 'east': nextPos.x += 1; break;
      case 'west': nextPos.x -= 1; break;
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
    const toGlobalX = to.x * GAME_CONSTANTS.TILE_SIZE_SQUARES + to.sqX;
    const toGlobalZ = to.z * GAME_CONSTANTS.TILE_SIZE_SQUARES + to.sqZ;

    const distance = Math.abs(fromGlobalX - toGlobalX) + Math.abs(fromGlobalZ - toGlobalZ);
    return distance <= speed;
  }

  /**
   * BFS from a hero's position to find all squares reachable within `speed` steps.
   * Returns a Set of "tileId:sqX:sqZ" keys for highlighting movable squares.
   */
  public static getReachableSquares(
    position: Position,
    tiles: Tile[],
    speed: number,
    blockedSquares: Set<string>
  ): Set<string> {
    const TS = GAME_CONSTANTS.TILE_SIZE_SQUARES;
    const tileSet = new Set(tiles.filter(t => t.isRevealed).map(t => `${t.x},${t.z}`));
    const tileMap = new Map(tiles.filter(t => t.isRevealed).map(t => [`${t.x},${t.z}`, t]));
    const result = new Set<string>();
    const visited = new Set<string>();

    const startGX = position.x * TS + position.sqX;
    const startGZ = position.z * TS + position.sqZ;
    const startKey = `${startGX},${startGZ}`;

    visited.add(startKey);

    const queue: { gx: number; gz: number; dist: number }[] = [{ gx: startGX, gz: startGZ, dist: 0 }];
    const directions = [
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
    ];

    while (queue.length > 0) {
      const { gx, gz, dist } = queue.shift()!;

      if (dist > 0) {
        const tx = Math.floor(gx / TS);
        const tz = Math.floor(gz / TS);
        const tile = tileMap.get(`${tx},${tz}`);
        if (tile) {
          result.add(`${tile.id}:${((gx % TS) + TS) % TS}:${((gz % TS) + TS) % TS}`);
        }
      }

      if (dist >= speed) continue;

      for (const dir of directions) {
        const ngx = gx + dir.dx;
        const ngz = gz + dir.dz;
        const nKey = `${ngx},${ngz}`;

        if (visited.has(nKey)) continue;

        const ntx = Math.floor(ngx / TS);
        const ntz = Math.floor(ngz / TS);
        if (!tileSet.has(`${ntx},${ntz}`)) continue;
        if (blockedSquares.has(nKey)) continue;

        visited.add(nKey);
        queue.push({ gx: ngx, gz: ngz, dist: dist + 1 });
      }
    }

    return result;
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
      case 0: return { sqX, sqZ };
      case 90: return { sqX: N - sqZ, sqZ: sqX };
      case 180: return { sqX: N - sqX, sqZ: N - sqZ };
      case 270: return { sqX: sqZ, sqZ: N - sqX };
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
   * Draws a tile from the bottom of the Dungeon Tile stack (end of the array)
   * and returns it together with its valid rotations.
   */
  public static drawAndPlaceFromBottom(
    gameState: GameState,
    explorationPoint: { tileId: string; edge: Direction },
  ): {
    tile: Tile | null;
    validRotations: Rotation[];
    remainingDeck: string[];
    exhausted: boolean;
  } {
    const deck = [...gameState.dungeonDeck]; // local copy — never mutate gameState

    for (let i = deck.length - 1; i >= 0; i--) {
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

  /**
   * Returns the explored tile with maximum graph distance from a given origin tile.
   * If there is a tie, applies the tiebreaker: highest x, then z coordinate.
   */
  public static getFarthestTile(fromTileId: string, gameState: GameState): Tile | null {
    const originTile = gameState.tiles.find(t => t.id === fromTileId);
    if (!originTile) return null;

    let bestTile: Tile | null = null;
    let maxDist = -1;

    for (const t of gameState.tiles) {
      if (!t.isRevealed) continue;
      const dist = getTileGraphDistance(originTile, t, gameState.tiles);
      if (dist === 999) continue; // Unreachable

      if (dist > maxDist) {
        maxDist = dist;
        bestTile = t;
      } else if (dist === maxDist && bestTile) {
        // Tiebreaker: highest x, then z coordinate
        if (t.x > bestTile.x) {
          bestTile = t;
        } else if (t.x === bestTile.x && t.z > bestTile.z) {
          bestTile = t;
        }
      }
    }
    return bestTile;
  }
}

export const OPPOSITE_EDGE: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east'
};

export const ROTATION_ORDER: Direction[] = ['north', 'east', 'south', 'west'];

export function getEffectiveOpenEdges(openEdges: Direction[], rotation: number): Direction[] {
  const steps = rotation / 90;
  return openEdges.map(edge => {
    const currentIndex = ROTATION_ORDER.indexOf(edge);
    const newIndex = (currentIndex + steps) % 4;
    return ROTATION_ORDER[newIndex];
  });
}

export function isPlacementValid(
  candidateOpenEdges: Direction[],
  candidateRotation: number,
  targetX: number,
  targetY: number,
  board: Map<string, { openEdges: Direction[], rotation: number }>
): { valid: boolean; reason?: string } {
  const key = `${targetX},${targetY}`;
  if (board.has(key)) {
    return { valid: false, reason: "A tile already exists here." };
  }

  const effectiveEdges = getEffectiveOpenEdges(candidateOpenEdges, candidateRotation);
  let hasNeighbor = false;

  for (const direction of ROTATION_ORDER) {
    let neighborX = targetX;
    let neighborY = targetY;

    if (direction === 'north') neighborY -= 1;
    if (direction === 'south') neighborY += 1;
    if (direction === 'east') neighborX += 1;
    if (direction === 'west') neighborX -= 1;

    const neighborKey = `${neighborX},${neighborY}`;
    const neighbor = board.get(neighborKey);

    if (neighbor) {
      hasNeighbor = true;
      const neighborEffectiveEdges = getEffectiveOpenEdges(neighbor.openEdges, neighbor.rotation);

      const candidateIsOpen = effectiveEdges.includes(direction);
      const oppositeDir = OPPOSITE_EDGE[direction];
      const neighborIsOpen = neighborEffectiveEdges.includes(oppositeDir);

      if (candidateIsOpen !== neighborIsOpen) {
        return { valid: false, reason: `Edge mismatch on the ${direction} side.` };
      }
    }
  }

  if (!hasNeighbor) {
    return { valid: false, reason: "Tile must be placed adjacent to an existing tile." };
  }

  return { valid: true };
}
