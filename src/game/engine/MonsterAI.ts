/**
 * Distance & Line-of-Sight Evaluators for Monster AI
 *
 * Pure functions with no mutation, no side effects, no UI.
 */

import { Tile, Hero, Monster, GameState, Trap, TacticResult, MonsterAbility, AbilityEffect, Position, GameLogEntry } from '../types';
import AbilitySystem from '../ai/AbilitySystem';
import BossPhases from '../ai/BossPhases';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';

import { ABILITY_LIBRARY } from '../ai/behaviors/AbilityLibrary';
import { DataLoader } from '../dataLoader';
import { isDev } from '../../utils/devEnv';

/**
 * Calculate Manhattan distance between two positions.
 * Returns |ax - bx| + |az - bz|
 */
export function manhattanDistance(
  ax: number, az: number,
  bx: number, bz: number
): number {
  return Math.abs(ax - bx) + Math.abs(az - bz);
}

/**
 * Calculate the shortest path distance in the tile connection graph.
 * Returns the number of edges (steps) in the shortest path using BFS.
 * Returns 999 if the tiles are not connected.
 */
export function getTileGraphDistance(
  fromTile: Tile,
  toTile: Tile,
  allTiles: Tile[]
): number {
  if (fromTile.id === toTile.id) return 0;

  const tileMap = new Map<string, Tile>();
  for (const t of allTiles) {
    tileMap.set(t.id, t);
  }

  const visited = new Set<string>();
  const queue: { tile: Tile; dist: number }[] = [{ tile: fromTile, dist: 0 }];
  visited.add(fromTile.id);

  while (queue.length > 0) {
    const { tile: current, dist } = queue.shift()!;

    if (current.id === toTile.id) {
      return dist;
    }

    const adjacentIds = getAdjacentTileIds(current, allTiles);
    for (const adjacentId of adjacentIds) {
      if (!visited.has(adjacentId)) {
        const adjacentTile = tileMap.get(adjacentId);
        if (adjacentTile) {
          visited.add(adjacentId);
          queue.push({ tile: adjacentTile, dist: dist + 1 });
        }
      }
    }
  }

  return 999; // No path found in connection graph
}

/**
 * Get IDs of all tiles directly connected to this tile.
 * Uses the bidirectional graph built by connectTiles.
 * Returns only connections where isOpen === true and connectedTileId is not null.
 */
export function getAdjacentTileIds(
  tile: Tile,
  allTiles: Tile[]
): string[] {
  const adjacentIds: string[] = [];

  for (const connection of tile.connections) {
    if (connection.isOpen && connection.connectedTileId) {
      adjacentIds.push(connection.connectedTileId);
    }
  }

  return adjacentIds;
}

/**
 * Check if there is line of sight between two tiles.
 * 
 * Two tiles have line of sight if there is a connected path between them
 * with NO tile flagged as blocksLineOfSight.
 * 
 * For MVP: if blocksLineOfSight does not exist on Tile type (undefined),
 * treat all corridors as clear — return true for all connected tiles,
 * false for disconnected tiles.
 */
export function hasLineOfSight(
  fromTile: Tile,
  toTile: Tile,
  allTiles: Tile[]
): boolean {
  // Create a map for O(1) tile lookup by ID
  const tileMap = new Map<string, Tile>();
  for (const tile of allTiles) {
    tileMap.set(tile.id, tile);
  }

  // BFS to find a path from fromTile to toTile
  // Tiles that block LoS can be seen (if they are the destination) but cannot be seen through
  const visited = new Set<string>();
  const queue: Tile[] = [fromTile];
  visited.add(fromTile.id);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.id === toTile.id) {
      return true;
    }

    const adjacentIds = getAdjacentTileIds(current, allTiles);
    for (const adjacentId of adjacentIds) {
      if (visited.has(adjacentId)) continue;

      const adjacentTile = tileMap.get(adjacentId);
      if (!adjacentTile) continue;

      visited.add(adjacentId);
      // Skip tiles that block line of sight, UNLESS they are the destination
      if (adjacentTile.blocksLineOfSight === true && adjacentId !== toTile.id) {
        continue;
      }
      queue.push(adjacentTile);
    }
  }

  return false;
}

/**
 * Find the closest hero to a given tile using Manhattan distance.
 * Returns null if heroes array is empty.
 */
export function findClosestHero(
  fromTile: Tile,
  heroes: Hero[],
  allTiles: Tile[],
  monsterPosition?: Position
): { hero: Hero; distance: number; tile: Tile } | null {
  if (heroes.length === 0) {
    return null;
  }

  let closest: { hero: Hero; distance: number; tile: Tile } | null = null;

  for (const hero of heroes) {
    // Find the tile by coordinates since hero.position.x/z are tile coordinates
    const heroTileByCoords = allTiles.find(t => t.x === hero.position.x && t.z === hero.position.z);

    if (heroTileByCoords) {
      const distance = getTileGraphDistance(
        fromTile,
        heroTileByCoords,
        allTiles
      );

      let isCloser = false;
      if (closest === null) {
        isCloser = true;
      } else if (distance < closest.distance) {
        isCloser = true;
      } else if (distance === closest.distance && monsterPosition) {
        const currentSqDist = Math.abs(hero.position.sqX - monsterPosition.sqX) +
                             Math.abs(hero.position.sqZ - monsterPosition.sqZ);
        const closestSqDist = Math.abs(closest.hero.position.sqX - monsterPosition.sqX) +
                             Math.abs(closest.hero.position.sqZ - monsterPosition.sqZ);
        if (currentSqDist < closestSqDist) {
          isCloser = true;
        }
      }

      if (isCloser) {
        closest = {
          hero,
          distance,
          tile: heroTileByCoords
        };
      }
    } else if (isDev()) {
      console.warn(`[MonsterAI] Hero "${hero.name}" (${hero.id}) has position (${hero.position.x}, ${hero.position.z}) that matches no tile — excluded from targeting`);
    }
  }

  return closest;
}

/**
 * Find the best unoccupied square on a landing tile.
 * If adjacentOnly is true, it prioritizes a square adjacent (Manhattan square distance = 1) to the targetHero.
 * Otherwise, it finds the unoccupied square on the landing tile closest to targetHero (or center of the tile).
 */
export function findBestLandingSquare(
  monster: Monster,
  targetHero: Hero | null,
  landingTile: Tile,
  adjacentOnly: boolean,
  gameState: GameState
): { sqX: number; sqZ: number } {
  const targetHeroPos = targetHero?.position;
  
  if (adjacentOnly && targetHeroPos) {
    const targetAbsX = targetHeroPos.x * 4 + targetHeroPos.sqX;
    const targetAbsZ = targetHeroPos.z * 4 + targetHeroPos.sqZ;
    
    let bestSq: { sqX: number; sqZ: number } | null = null;
    let minSquareDist = 999;
    const monsterAbsX = monster.position.x * 4 + monster.position.sqX;
    const monsterAbsZ = monster.position.z * 4 + monster.position.sqZ;

    for (let sqX = 0; sqX < 4; sqX++) {
      for (let sqZ = 0; sqZ < 4; sqZ++) {
        const absX = landingTile.x * 4 + sqX;
        const absZ = landingTile.z * 4 + sqZ;
        const squareDistToHero = Math.abs(absX - targetAbsX) + Math.abs(absZ - targetAbsZ);
        
        if (squareDistToHero === 1) {
          const occupied = 
            gameState.heroes.some(h => h.position.x === landingTile.x && h.position.z === landingTile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
            gameState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.id !== monster.id && m.position.x === landingTile.x && m.position.z === landingTile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);
          
          if (!occupied) {
            const squareDistToMonster = Math.abs(absX - monsterAbsX) + Math.abs(absZ - monsterAbsZ);
            if (squareDistToMonster < minSquareDist) {
              minSquareDist = squareDistToMonster;
              bestSq = { sqX, sqZ };
            }
          }
        }
      }
    }
    if (bestSq) return bestSq;
  }

  // Fallback: Find any unoccupied square on landingTile closest to the target hero
  let bestSq: { sqX: number; sqZ: number } | null = null;
  let minSquareDist = 999;
  const targetAbsX = targetHeroPos ? targetHeroPos.x * 4 + targetHeroPos.sqX : landingTile.x * 4 + 2;
  const targetAbsZ = targetHeroPos ? targetHeroPos.z * 4 + targetHeroPos.sqZ : landingTile.z * 4 + 2;

  for (let sqX = 0; sqX < 4; sqX++) {
    for (let sqZ = 0; sqZ < 4; sqZ++) {
      const absX = landingTile.x * 4 + sqX;
      const absZ = landingTile.z * 4 + sqZ;
      
      const occupied = 
        gameState.heroes.some(h => h.position.x === landingTile.x && h.position.z === landingTile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
        gameState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.id !== monster.id && m.position.x === landingTile.x && m.position.z === landingTile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);
      
      if (!occupied) {
        const squareDistToTarget = Math.abs(absX - targetAbsX) + Math.abs(absZ - targetAbsZ);
        if (squareDistToTarget < minSquareDist) {
          minSquareDist = squareDistToTarget;
          bestSq = { sqX, sqZ };
        }
      }
    }
  }

  if (bestSq) return bestSq;

  return { sqX: monster.position.sqX, sqZ: monster.position.sqZ };
}

/**

 * Find a path from fromTile toward toTile through the connection graph.
 * Uses BFS (no A* required for MVP tile-graph pathing).
 *
 * Returns an array of up to `steps` tiles representing the path.
 * Never includes fromTile itself.
 * Never exceeds steps length.
 * Returns [] if no path exists.
 */
export function getPathToward(
  fromTile: Tile,
  toTile: Tile,
  allTiles: Tile[],
  steps: number
): Tile[] {
  if (steps <= 0) {
    return [];
  }

  // Create a map for O(1) tile lookup by ID
  const tileMap = new Map<string, Tile>();
  for (const tile of allTiles) {
    tileMap.set(tile.id, tile);
  }

  // BFS with parent map — O(n) memory instead of O(n²) per-node path arrays
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: string[] = [fromTile.id];
  visited.add(fromTile.id);
  parent.set(fromTile.id, null);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentTile = tileMap.get(currentId)!;

    if (currentId === toTile.id) {
      // Reconstruct path by walking parent map from destination back to source
      const path: Tile[] = [];
      let node: string | null = toTile.id;
      while (node !== null && node !== fromTile.id) {
        const t = tileMap.get(node);
        if (t) path.unshift(t);
        node = parent.get(node) ?? null;
      }
      return path.slice(0, steps);
    }

    const adjacentIds = getAdjacentTileIds(currentTile, allTiles);

    // Sort adjacent tiles by lexicographic order (x, then z) to ensure deterministic behavior.
    // This is critical for test repeatability: when multiple paths of equal length exist,
    // the BFS will always explore tiles in the same order, producing identical results
    // across multiple test runs. Without this sorting, the order depends on the order
    // of connections in the tile's connections array, which can cause test flakiness.
    const sortedAdjacentTiles = adjacentIds
      .map(id => tileMap.get(id))
      .filter((tile): tile is Tile => tile !== undefined)
      .sort((a, b) => {
        if (a.x !== b.x) return a.x - b.x;
        return a.z - b.z;
      });

    for (const adjacentTile of sortedAdjacentTiles) {
      if (!visited.has(adjacentTile.id)) {
        visited.add(adjacentTile.id);
        parent.set(adjacentTile.id, currentId);
        queue.push(adjacentTile.id);
      }
    }
  }

  return [];
}

/**
 * Evaluate a condition string for monster AI tactics.
 * Pure function with no side effects.
 */
function evaluateCondition(
  condition: string,
  monster: Monster,
  monsterTile: Tile,
  gameState: GameState
): boolean {
  switch (condition) {
    case 'always':
    case 'default':
      return true;

    case 'hp_full':
      return monster.hp === monster.maxHp;

    case 'hp_low':
      return monster.hp / monster.maxHp < 1 / 3;

    case 'adjacent_to_hero':
    case 'within_1_tile_of_hero':
    case 'heroes_adjacent': {
      const closestHero = findClosestHero(monsterTile, gameState.heroes, gameState.tiles, monster.position);
      if (closestHero === null) {
        return false;
      }
      const distance = getTileGraphDistance(
        monsterTile,
        closestHero.tile,
        gameState.tiles
      );
      return distance === 1;
    }

    case 'heroes_near': {
      const closestHero = findClosestHero(monsterTile, gameState.heroes, gameState.tiles, monster.position);
      return closestHero !== null && closestHero.distance <= 2;
    }

    case 'surrounded': {
      // NOTE: This runs a full BFS (getTileGraphDistance) per hero, on top of
      // the findClosestHero call already made in resolveTactic. For a monster
      // with many heroes nearby, this is several full graph traversals per
      // activation. Acceptable for MVP dungeon sizes; cache distances if this
      // becomes a hotspot.
      let adjacentCount = 0;
      for (const hero of gameState.heroes) {
        const heroTile = gameState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
        if (heroTile) {
          const dist = getTileGraphDistance(monsterTile, heroTile, gameState.tiles);
          if (dist <= 1) {
            adjacentCount++;
          }
        }
      }
      return adjacentCount >= 2;
    }

    case 'hp_below_50_percent':
      return monster.hp / monster.maxHp < 0.5;

    case 'hp_below_30_percent':
      return monster.hp / monster.maxHp < 0.3;

    default:
      console.warn(`MonsterAI: Unrecognised condition string "${condition}"`);
      return false;
  }
}

/**
 * Resolve the tactic for a monster during its activation.
 * This is a pure function that only reads, never writes to state.
 *
 * Logic:
 * Step 1 — Boss phase transition check:
 *   If monster.isBoss:
 *     If BossPhases.shouldTransitionPhase(monster, gameState):
 *       Return { action: 'idle' }
 *       (Caller in gameStore handles the actual transition before re-evaluating)
 *
 * Step 2 — Triggered abilities (on_turn_start):
 *   Find first ability in monster.abilities where
 *     type === 'triggered'
 *     trigger === 'on_turn_start'
 *     AbilitySystem.canUseAbility() returns true
 *   If found → return { action: 'use_ability', abilityId, effects }
 *
 * Step 3 — Boss phase tactics:
 *   If monster.isBoss:
 *     tactics = BossPhases.getPhaseTactics(monster, gameState)
 *     For each tactic in tactics:
 *       If evaluateCondition(tactic.condition, ...) is true:
 *         If tactic.ability is defined:
 *           ability = monster.abilities?.find(a => a.id === tactic.ability)
 *           If ability AND canUseAbility → return use_ability result
 *         Else if tactic.actions includes 'move_toward_closest_hero':
 *           fall through to existing move logic below
 *
 * Step 4 — Active abilities (non-boss):
 *   If NOT monster.isBoss:
 *     Find first ability where type === 'active' AND canUseAbility returns true
 *     If found → return use_ability result
 *
 * Steps 5+ — Existing move/attack logic (unchanged):
 *   1. Find closest hero using findClosestHero(). If null → return { action: 'idle' }
 *   2. Compute distance = manhattanDistance to hero's tile
 *   3. If distance === 0 (same tile) OR distance === 1 (adjacent):
 *        Check hasLineOfSight
 *        If true → return { action: 'attack', targetHeroId, damage }
 *   4. If distance > 1 (not adjacent):
 *        path = getPathToward(monsterTile, heroTile, tiles, monster.moveRange)
 *        If path is empty → return { action: 'idle' }
 *        landingTile = last tile in path
 *        newDistance = manhattanDistance(landingTile, heroTile)
 *        If newDistance <= 1 → return { action: 'move_then_attack', path, targetHeroId, damage }
 *        Else → return { action: 'move', path }
 *   5. Fallback → return { action: 'idle' }
 */
export function resolveTactic(
  monster: Monster,
  monsterTile: Tile,
  gameState: GameState
): TacticResult {
  const heroes = gameState.heroes.filter(h => !h.removedFromPlay);
  const tiles = gameState.tiles;

  // Custom Ghoul tactics override
  if (monster.name.toLowerCase() === 'ghoul') {
    const closestHero = findClosestHero(monsterTile, heroes, tiles, monster.position);
    if (closestHero !== null) {
      const { hero: closest, tile: heroTile } = closestHero;
      const tileDist = getTileGraphDistance(monsterTile, heroTile, tiles);
      
      const hAbsX = closest.position.x * 4 + closest.position.sqX;
      const hAbsZ = closest.position.z * 4 + closest.position.sqZ;
      const mAbsX = monster.position.x * 4 + monster.position.sqX;
      const mAbsZ = monster.position.z * 4 + monster.position.sqZ;
      const isSqAdjacent = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ) === 1;

      if (isSqAdjacent) {
        return {
          action: 'attack',
          targetHeroId: closest.id,
          damage: 3,
          attackBonus: 9
        };
      } else if (tileDist <= 1) {
        const path = getPathToward(monsterTile, heroTile, tiles, 1);
        return {
          action: 'move_then_attack',
          path: path.length > 0 ? path : [monsterTile],
          targetHeroId: closest.id,
          damage: 1,
          attackBonus: 7,
          statusEffect: 'immobilized'
        };
      } else {
        const path = getPathToward(monsterTile, heroTile, tiles, 1);
        if (path.length > 0) {
          return { action: 'move', path };
        }
      }
    }
    return { action: 'idle' };
  }

  // Custom Wolf tactics override
  if (monster.name.toLowerCase() === 'wolf') {
    const closestHero = findClosestHero(monsterTile, heroes, tiles, monster.position);
    if (closestHero !== null) {
      const { hero: closest, tile: heroTile } = closestHero;
      const tileDist = getTileGraphDistance(monsterTile, heroTile, tiles);
      
      const hAbsX = closest.position.x * 4 + closest.position.sqX;
      const hAbsZ = closest.position.z * 4 + closest.position.sqZ;
      const mAbsX = monster.position.x * 4 + monster.position.sqX;
      const mAbsZ = monster.position.z * 4 + monster.position.sqZ;
      const isSqAdjacent = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ) === 1;

      if (isSqAdjacent) {
        return {
          action: 'attack',
          targetHeroId: closest.id,
          damage: 2,
          attackBonus: 9
        };
      } else if (tileDist <= 2) {
        const path = getPathToward(monsterTile, heroTile, tiles, 2);
        return {
          action: 'move_then_attack',
          path: path.length > 0 ? path : [monsterTile],
          targetHeroId: closest.id,
          damage: 1,
          attackBonus: 7,
          statusEffect: 'slowed'
        };
      } else {
        const path = getPathToward(monsterTile, heroTile, tiles, 2);
        if (path.length > 0) {
          return { action: 'move', path };
        }
      }
    }
    return { action: 'idle' };
  }

  // Custom Kobold tactics override
  if (monster.name.toLowerCase() === 'kobold' || monster.name.toLowerCase() === 'kobold skirmisher') {
    const closestHero = findClosestHero(monsterTile, heroes, tiles, monster.position);
    if (closestHero !== null) {
      const { hero: closest, tile: heroTile } = closestHero;
      const tileDist = getTileGraphDistance(monsterTile, heroTile, tiles);

      if (tileDist <= 1) {
        return {
          action: 'attack',
          targetHeroId: closest.id,
          damage: 1,
          attackBonus: 9
        };
      } else {
        const path = getPathToward(monsterTile, heroTile, tiles, 1);
        if (path.length > 0) {
          return { action: 'move', path };
        }
      }
    }
    return { action: 'idle' };
  }

  // Custom Gargoyle tactics override
  if (monster.name.toLowerCase() === 'gargoyle') {
    const closestHero = findClosestHero(monsterTile, heroes, tiles, monster.position);
    if (closestHero !== null) {
      const { hero: closest, tile: heroTile } = closestHero;
      const tileDist = getTileGraphDistance(monsterTile, heroTile, tiles);

      if (tileDist <= 1) {
        const path = tileDist === 0 ? [] : getPathToward(monsterTile, heroTile, tiles, 1);
        return {
          action: 'move_then_attack',
          path: path.length > 0 ? path : [monsterTile],
          targetHeroId: closest.id,
          damage: 2,
          attackBonus: 8,
          missDamage: 1,
          statusEffect: 'slowed',
          multiTarget: true
        };
      } else {
        return { action: 'idle' };
      }
    }
    return { action: 'idle' };
  }

  // Custom Skeleton tactics override
  if (monster.name.toLowerCase() === 'skeleton') {
    const closestHero = findClosestHero(monsterTile, heroes, tiles, monster.position);
    if (closestHero !== null) {
      const { hero: closest, tile: heroTile } = closestHero;
      const tileDist = getTileGraphDistance(monsterTile, heroTile, tiles);
      
      const hAbsX = closest.position.x * 4 + closest.position.sqX;
      const hAbsZ = closest.position.z * 4 + closest.position.sqZ;
      const mAbsX = monster.position.x * 4 + monster.position.sqX;
      const mAbsZ = monster.position.z * 4 + monster.position.sqZ;
      const isSqAdjacent = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ) === 1;

      if (isSqAdjacent) {
        // Attack with SCIMITAR: +7 ATK, 1 DMG
        return {
          action: 'attack',
          targetHeroId: closest.id,
          damage: 1,
          attackBonus: 7
        };
      } else if (tileDist <= 1) {
        // Within 1 tile of hero: moves adjacent and attacks with charging SLICE (+9 ATK, 2 DMG)
        const path = getPathToward(monsterTile, heroTile, tiles, 1);
        return {
          action: 'move_then_attack',
          path: path.length > 0 ? path : [monsterTile],
          targetHeroId: closest.id,
          damage: 2,
          attackBonus: 9
        };
      } else {
        // Otherwise, moves one tile toward the closest hero
        const path = getPathToward(monsterTile, heroTile, tiles, 1);
        if (path.length > 0) {
          return { action: 'move', path };
        }
      }
    }
    return { action: 'idle' };
  }

  // Custom Zombie tactics override
  if (monster.name.toLowerCase() === 'zombie') {
    const closestHero = findClosestHero(monsterTile, heroes, tiles, monster.position);
    if (closestHero !== null) {
      const { hero: closest, tile: heroTile } = closestHero;
      const tileDist = getTileGraphDistance(monsterTile, heroTile, tiles);
      
      const hAbsX = closest.position.x * 4 + closest.position.sqX;
      const hAbsZ = closest.position.z * 4 + closest.position.sqZ;
      const mAbsX = monster.position.x * 4 + monster.position.sqX;
      const mAbsZ = monster.position.z * 4 + monster.position.sqZ;
      const isSqAdjacent = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ) === 1;

      if (tileDist <= 1) {
        // Within 1 tile of hero: moves adjacent and attacks with ROTTING FIST (+5 ATK, DMG: 1 for each monster on landing tile)
        const path = getPathToward(monsterTile, heroTile, tiles, 1);
        const landingTile = path.length > 0 ? path[path.length - 1] : monsterTile;
        
        // Count active monsters on landing tile
        const monstersOnLandingTile = gameState.monsters.filter(m => 
          !m.isDefeated && m.hp > 0 && m.position.x === landingTile.x && m.position.z === landingTile.z
        );
        let numMonsters = monstersOnLandingTile.length;
        if (landingTile.id !== monsterTile.id) {
          numMonsters += 1;
        }

        if (isSqAdjacent) {
          return {
            action: 'attack',
            targetHeroId: closest.id,
            damage: numMonsters,
            attackBonus: 5
          };
        } else {
          return {
            action: 'move_then_attack',
            path: path.length > 0 ? path : [monsterTile],
            targetHeroId: closest.id,
            damage: numMonsters,
            attackBonus: 5
          };
        }
      } else {
        // Otherwise, Zombie moves one tile toward the closest hero
        const path = getPathToward(monsterTile, heroTile, tiles, 1);
        if (path.length > 0) {
          return { action: 'move', path };
        }
      }
    }
    return { action: 'idle' };
  }

  // Step 1 — Boss phase transition check
  if (monster.isBoss) {
    if (BossPhases.shouldTransitionPhase(monster, gameState)) {
      return { action: 'idle' };
    }
  }

  // Step 2 — Triggered abilities (on_turn_start)
  if (monster.abilities) {
    const triggeredAbility = monster.abilities.find(
      ability =>
        ability.type === 'triggered' &&
        ability.trigger === 'on_turn_start' &&
        AbilitySystem.canUseAbility(ability, monster, gameState)
    );
    if (triggeredAbility) {
      return {
        action: 'use_ability',
        abilityId: triggeredAbility.id,
        effects: triggeredAbility.effects
      };
    }
  }

  // Step 3 — Boss phase tactics
  if (monster.isBoss) {
    const tactics = BossPhases.getPhaseTactics(monster, gameState);
    for (const tactic of tactics) {
      if (evaluateCondition(tactic.condition, monster, monsterTile, gameState)) {
        let abilityToUse = tactic.ability;
        if (!abilityToUse && tactic.actions && tactic.actions.length > 0) {
          const matchingAbility = monster.abilities?.find(a => tactic.actions.includes(a.id));
          if (matchingAbility) {
            abilityToUse = matchingAbility.id;
          }
        }

        if (abilityToUse) {
          const ability = monster.abilities?.find(a => a.id === abilityToUse);
          if (ability && AbilitySystem.canUseAbility(ability, monster, gameState)) {
            return {
              action: 'use_ability',
              abilityId: ability.id,
              effects: ability.effects
            };
          }
        } else if (tactic.actions.includes('move_toward_closest_hero')) {
          // Fall through: break out of the tactic loop into Steps 5+ (move/attack logic below).
          // This is the only action that intentionally falls through — all other actions
          // must produce a result within this loop body.
          break;
        } else {
          // If tactic condition matched but no ability or recognized action was found,
          // this is likely a configuration error in the phase tactics data.
          // The loop continues to check remaining tactics for this phase.
          if (isDev()) {
            console.warn(`[MonsterAI] Boss tactic matched condition "${tactic.condition}" but has no recognized action`, tactic.actions);
          }
        }
      }
    }
  }

  // Step 4 — Active abilities (non-boss)
  if (!monster.isBoss && monster.abilities) {
    const activeAbility = monster.abilities.find(
      ability =>
        ability.type === 'active' &&
        AbilitySystem.canUseAbility(ability, monster, gameState)
    );
    if (activeAbility) {
      return {
        action: 'use_ability',
        abilityId: activeAbility.id,
        effects: activeAbility.effects
      };
    }
  }

  // Steps 5+ — Existing move/attack logic (unchanged)
  // 1. Find closest hero
  const closestHero = findClosestHero(monsterTile, heroes, tiles, monster.position);
  if (closestHero === null) {
    return { action: 'idle' };
  }

  const { hero: closest, tile: heroTile } = closestHero;

  // 2. Compute distance
  const distance = getTileGraphDistance(monsterTile, heroTile, tiles);

  // 3. If same tile or adjacent, check line of sight and attack
  if (distance === 0 || distance === 1) {
    if (hasLineOfSight(monsterTile, heroTile, tiles)) {
      return {
        action: 'attack',
        targetHeroId: closest.id,
        damage: monster.damage ?? 1
      };
    }
  }

  // 4. If distance > 1 (not adjacent), try to move closer
  if (distance > 1) {
    const moveRange = monster.moveRange ?? 1;
    const path = getPathToward(monsterTile, heroTile, tiles, moveRange);

    if (path.length === 0) {
      return { action: 'idle' };
    }

    // Stop moving as soon as we become adjacent to the target hero.
    let slicedPath = [...path];
    for (let i = 0; i < path.length; i++) {
      const dist = getTileGraphDistance(path[i], heroTile, tiles);
      if (dist <= 1) {
        slicedPath = path.slice(0, i + 1);
        break;
      }
    }

    const landingTile = slicedPath[slicedPath.length - 1];
    const newDistance = getTileGraphDistance(landingTile, heroTile, tiles);

    if (distance <= moveRange && newDistance <= 1) {
      return {
        action: 'move_then_attack',
        path: slicedPath,
        targetHeroId: closest.id,
        damage: monster.damage ?? 1
      };
    } else {
      return { action: 'move', path: slicedPath };
    }
  }

  // 5. Fallback
  return { action: 'idle' };
}

/**
 * Resolve trap activation.
 *
 * Checks if a trap should trigger based on hero position and trap state.
 *
 * Logic:
 * - Find any Hero whose tile coordinates (position.x, position.z) match trapTile
 *   (Hero has no tileId field — coordinate match via position.x/z is used instead)
 * - If no hero on the trap tile → return null
 * - If trap.isTriggered === true → return null (already fired, do not re-trigger)
 * - Return { targetHeroId: hero.id, damage: trap.damage ?? 1 }
 *
 * @param trap - The trap to check
 * @param trapTile - The tile the trap is on
 * @param gameState - Current game state
 * @returns Object with targetHeroId and damage, or null if trap should not trigger
 */
export function resolveTrap(
  trap: Trap,
  trapTile: Tile,
  gameState: GameState
): { targetHeroId: string; damage: number } | null {
  // Check if trap is already triggered
  if (trap.isTriggered) {
    return null;
  }

  // Find any hero on the trap tile
  const heroOnTrap = gameState.heroes.find(hero => {
    if (hero.removedFromPlay) return false;
    const heroTile = gameState.tiles.find(tile =>
      tile.x === hero.position.x && tile.z === hero.position.z
    );
    return heroTile?.id === trapTile.id;
  });

  // If no hero on the trap tile, return null
  if (!heroOnTrap) {
    return null;
  }

  // Look up actual trap card damage; guard against non-number values in card data
  const trapCard = DataLoader.getInstance().getCardById(trap.cardId);
  const rawDamage = trapCard?.effects?.find(e => e.type === 'damage')?.value;
  const trapDamage = typeof rawDamage === 'number' ? rawDamage : 1;

  return {
    targetHeroId: heroOnTrap.id,
    damage: trapDamage
  };
}

export function activateMonsterEntity(state: GameState, monsterId: string): GameState {
  let newState: GameState = {
    ...state,
    activeVillainId: monsterId
  };

  let monster = newState.monsters.find(m => m.id === monsterId);
  if (!monster || monster.hp <= 0 || monster.isDefeated) {
    return newState;
  }

  // Fortune: Daze — skip this activation if skipActivations > 0
  if (monster.skipActivations && monster.skipActivations > 0) {
    return {
      ...newState,
      monsters: newState.monsters.map(m =>
        m.id === monsterId
          ? { ...m, skipActivations: m.skipActivations! - 1 }
          : m
      ),
      log: [
        ...newState.log,
        {
          id: String((newState.logIdCounter ?? 0) + 1),
          timestamp: new Date().toISOString(),
          message: `${monster.name} is dazed and skips its activation!`,
          type: 'combat' as const
        }
      ].slice(-100),
      logIdCounter: (newState.logIdCounter ?? 0) + 1,
    };
  }

  // Phase transition check BEFORE calling resolveTactic
  if (monster.isBoss && BossPhases.shouldTransitionPhase(monster, newState)) {
    newState = BossPhases.transitionPhase(monster, newState);
    // Re-fetch monster from newState after transition
    // so resolveTactic sees the updated currentPhase
    const updatedMonster = newState.monsters.find(m => m.id === monster!.id);
    if (updatedMonster) {
      monster = updatedMonster as Monster;
    }
  }

  // Find the tile where monster is located by position
  const monsterTile = newState.tiles.find(tile =>
    tile.x === monster!.position.x && tile.z === monster!.position.z
  );
  if (monsterTile) {
    const result = resolveTactic(monster, monsterTile, newState);

    // Apply result to state immutably
    if (result.action === 'move' || result.action === 'move_then_attack') {
      // Update monster.position to last tile in path
      const lastTile = result.path[result.path.length - 1];
      
      const targetHero = result.action === 'move_then_attack'
        ? newState.heroes.find(h => h.id === result.targetHeroId)
        : null;
        
      const bestSq = findBestLandingSquare(
        monster,
        targetHero || null,
        lastTile,
        result.action === 'move_then_attack',
        newState
      );

      newState = {
        ...newState,
        monsters: newState.monsters.map(m =>
          m.id === monsterId
            ? { ...m, position: { x: lastTile.x, z: lastTile.z, sqX: bestSq.sqX, sqZ: bestSq.sqZ } }
            : m
        )
      };
    }

    if (result.action === 'attack' || result.action === 'move_then_attack') {
      const targetTileX = (result.action === 'move_then_attack') ? result.path[result.path.length - 1].x : monster.position.x;
      const targetTileZ = (result.action === 'move_then_attack') ? result.path[result.path.length - 1].z : monster.position.z;
      const targetHeroes = result.multiTarget
        ? newState.heroes.filter(h => h.position.x === targetTileX && h.position.z === targetTileZ)
        : [newState.heroes.find(h => h.id === result.targetHeroId)].filter((h): h is Hero => !!h);

      for (const tHero of targetHeroes) {
        // Re-fetch targetHero in case they were updated in a previous iteration of the loop (e.g. bodyguard swaps)
        const targetHero = newState.heroes.find(h => h.id === tHero.id);
        if (!targetHero) continue;

        // Apply tactic overrides for attack bonus, damage, and miss damage if defined
        const attackBonus = (result.attackBonus !== undefined) ? result.attackBonus : (monster.attackBonus ?? 0);
        const damage = (result.damage !== undefined) ? result.damage : (monster.damage ?? 1);
        const missDamage = (result.missDamage !== undefined) ? result.missDamage : (monster.missDamage ?? 0);

        const attackResult = CombatSystem.resolveAttack(
          monster,
          targetHero,
          attackBonus,
          damage,
          0,
          undefined,
          newState,
          missDamage
        );

        let finalDamage = attackResult.damage;
        let logSuffix = '';
        let updatedHeroesList = [...newState.heroes];

        if (attackResult.hit) {
          // Check for Shield first (cancels any monster hit)
          const hasShield = targetHero.abilities.includes('wizard_shield') || targetHero.hand.includes('wizard_shield');
          const isShieldAvailable = !(targetHero.flippedPowerIds ?? []).includes('wizard_shield');

          if (hasShield && isShieldAvailable) {
            finalDamage = 0;
            logSuffix = ` Prevented by ${targetHero.name}'s Shield! The attack misses instead.`;

            // Apply +2 AC bonus condition to the hero until the end of their next Hero Phase (duration: 2)
            const updatedTargetHero = ConditionSystem.applyCondition(
              targetHero,
              'ac_bonus',
              'wizard_shield',
              2,
              2
            );

            // Flip the Shield card
            const updatedTargetHeroFlipped = {
              ...updatedTargetHero,
              flippedPowerIds: [...(updatedTargetHero.flippedPowerIds ?? []), 'wizard_shield']
            };

            updatedHeroesList = updatedHeroesList.map(h => h.id === updatedTargetHeroFlipped.id ? updatedTargetHeroFlipped : h);
          } else {
            const targetTile = newState.tiles.find(t => t.x === targetHero.position.x && t.z === targetHero.position.z);
            
            // Find bodyguard hero (another hero within 1 tile with bodyguard available)
            const bodyguardHero = updatedHeroesList.find(h => {
              if (h.id === targetHero.id) return false;
              const hasBodyguard = h.abilities.includes('fighter_bodyguard') || h.hand.includes('fighter_bodyguard');
              const isAvailable = !(h.flippedPowerIds ?? []).includes('fighter_bodyguard');
              if (hasBodyguard && isAvailable) {
                const hTile = newState.tiles.find(t => t.x === h.position.x && t.z === h.position.z);
                if (targetTile && hTile) {
                  return getTileGraphDistance(hTile, targetTile, newState.tiles) <= 1;
                }
              }
              return false;
            });

            if (bodyguardHero) {
              // Intercept the attack!
              finalDamage = 0;
              logSuffix = ` Intercepted by ${bodyguardHero.name}'s Bodyguard! The attack misses instead, and they swap positions.`;

              // Swap positions
              const tempPos = { ...targetHero.position };
              const updatedTargetHero = {
                ...targetHero,
                position: { ...bodyguardHero.position }
              };
              const updatedBodyguardHero = {
                ...bodyguardHero,
                position: tempPos,
                flippedPowerIds: [...(bodyguardHero.flippedPowerIds ?? []), 'fighter_bodyguard']
              };

              updatedHeroesList = updatedHeroesList.map(h => {
                if (h.id === updatedTargetHero.id) return updatedTargetHero;
                if (h.id === updatedBodyguardHero.id) return updatedBodyguardHero;
                return h;
              });
            }
          }

          // Check for Unbalancing Parry
          let currentTarget = updatedHeroesList.find(h => h.id === tHero.id) ?? targetHero;
          const hasUnbalancingParry = currentTarget.abilities.includes('ranger_unbalancing_parry') || currentTarget.hand.includes('ranger_unbalancing_parry');
          const isUnbalancingParryAvailable = !(currentTarget.flippedPowerIds ?? []).includes('ranger_unbalancing_parry');

          if (hasUnbalancingParry && isUnbalancingParryAvailable && finalDamage > 0) {
            finalDamage = 0;
            logSuffix += ` Deflected by ${currentTarget.name}'s Unbalancing Parry! The attack misses instead.`;

            const heroTile = newState.tiles.find(t => t.x === currentTarget.position.x && t.z === currentTarget.position.z);
            const validTiles = newState.tiles.filter(t => {
              if (!heroTile) return false;
              return getTileGraphDistance(heroTile, t, newState.tiles) <= 1;
            });

            let foundMonsterPos = null;
            for (const tile of validTiles) {
              for (let sqX = 0; sqX < 4; sqX++) {
                for (let sqZ = 0; sqZ < 4; sqZ++) {
                  const occupied = 
                    updatedHeroesList.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                    newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                  if (!occupied) {
                    foundMonsterPos = { x: tile.x, z: tile.z, sqX, sqZ };
                    break;
                  }
                }
                if (foundMonsterPos) break;
              }
              if (foundMonsterPos) break;
            }

            if (foundMonsterPos) {
              const updatedMonster = {
                ...monster,
                position: foundMonsterPos
              };
              newState = {
                ...newState,
                monsters: newState.monsters.map(m => m.id === monsterId ? updatedMonster : m)
              };
            }

            const updatedTargetHero = {
              ...currentTarget,
              flippedPowerIds: [...(currentTarget.flippedPowerIds ?? []), 'ranger_unbalancing_parry']
            };
            updatedHeroesList = updatedHeroesList.map(h => h.id === updatedTargetHero.id ? updatedTargetHero : h);
          }

          // Check for Yield Ground
          currentTarget = updatedHeroesList.find(h => h.id === tHero.id) ?? targetHero;
          const hasYieldGround = currentTarget.abilities.includes('ranger_yield_ground') || currentTarget.hand.includes('ranger_yield_ground');
          const isYieldGroundAvailable = !(currentTarget.flippedPowerIds ?? []).includes('ranger_yield_ground');

          if (hasYieldGround && isYieldGroundAvailable) {
            logSuffix += ` ${currentTarget.name} triggers Yield Ground and moves their speed!`;

            const heroTile = newState.tiles.find(t => t.x === currentTarget.position.x && t.z === currentTarget.position.z);
            const validTiles = newState.tiles.filter(t => {
              if (!heroTile) return false;
              return getTileGraphDistance(heroTile, t, newState.tiles) <= 1;
            });

            let foundHeroPos = null;
            for (const tile of validTiles) {
              for (let sqX = 0; sqX < 4; sqX++) {
                for (let sqZ = 0; sqZ < 4; sqZ++) {
                  let distance = 0;
                  if (tile.x === currentTarget.position.x && tile.z === currentTarget.position.z) {
                    distance = Math.abs(sqX - currentTarget.position.sqX) + Math.abs(sqZ - currentTarget.position.sqZ);
                  } else {
                    distance = 4 + Math.abs(sqX - currentTarget.position.sqX) + Math.abs(sqZ - currentTarget.position.sqZ);
                  }

                  if (distance <= 6) {
                    const occupied = 
                      updatedHeroesList.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                      newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                    if (!occupied) {
                      foundHeroPos = { x: tile.x, z: tile.z, sqX, sqZ };
                      break;
                    }
                  }
                }
                if (foundHeroPos) break;
              }
              if (foundHeroPos) break;
            }

            const resolvedTarget = updatedHeroesList.find(h => h.id === currentTarget.id) || currentTarget;
            const updatedTargetHero = {
              ...resolvedTarget,
              position: foundHeroPos ? {
                ...resolvedTarget.position,
                x: foundHeroPos.x,
                z: foundHeroPos.z,
                sqX: foundHeroPos.sqX,
                sqZ: foundHeroPos.sqZ
              } : resolvedTarget.position,
              flippedPowerIds: [...(resolvedTarget.flippedPowerIds ?? []), 'ranger_yield_ground']
            };
            updatedHeroesList = updatedHeroesList.map(h => h.id === updatedTargetHero.id ? updatedTargetHero : h);
          }
        }

        const resolvedTargetHero = updatedHeroesList.find(h => h.id === targetHero.id) || targetHero;
        let updatedHero = CombatSystem.applyDamage(resolvedTargetHero, finalDamage, newState);

        if (attackResult.hit && result.statusEffect && finalDamage > 0) {
          updatedHero = ConditionSystem.applyCondition(updatedHero, result.statusEffect, monster.id, 1);
        }

        updatedHeroesList = updatedHeroesList.map(h => h.id === targetHero.id ? updatedHero : h);

        let statusSuffix = '';
        if (attackResult.hit && result.statusEffect && finalDamage > 0) {
          statusSuffix = ` Hero is ${result.statusEffect.toUpperCase()}.`;
        }

        const logMessage = attackResult.hit
          ? `${monster.name} attacks ${targetHero.name} (+${attackBonus} vs AC ${targetHero.ac}) and HITS (Roll: ${attackResult.roll}, Total: ${attackResult.total}) for ${attackResult.damage} damage.${statusSuffix}${logSuffix}`
          : `${monster.name} attacks ${targetHero.name} (+${attackBonus} vs AC ${targetHero.ac}) and MISSES (Roll: ${attackResult.roll}, Total: ${attackResult.total}).${attackResult.damage > 0 ? ` Deals ${attackResult.damage} miss damage.${statusSuffix}` : ''}`;

        let currentCounter = newState.logIdCounter ?? 0;

        let updatedLog: GameLogEntry[] = [
          ...newState.log,
          {
            id: String(currentCounter),
            timestamp: new Date().toISOString(),
            message: logMessage,
            type: 'combat' as const
          }
        ].slice(-100);
        currentCounter++;

        // Check for Riposte Strike
        const hasRiposte = (updatedHero.abilities.includes('rogue_riposte_strike') || updatedHero.hand.includes('rogue_riposte_strike')) &&
                           !(updatedHero.flippedPowerIds ?? []).includes('rogue_riposte_strike');
        
        const hAbsX = updatedHero.position.x * 4 + updatedHero.position.sqX;
        const hAbsZ = updatedHero.position.z * 4 + updatedHero.position.sqZ;
        const mAbsX = monster.position.x * 4 + monster.position.sqX;
        const mAbsZ = monster.position.z * 4 + monster.position.sqZ;
        const isAdjacent = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ) === 1;

        if (hasRiposte && isAdjacent && monster.hp > 0 && !monster.isDefeated) {
          const riposteResult = CombatSystem.resolveAttack(
            updatedHero,
            monster,
            7, // attackBonus
            2, // damage
            0,
            undefined,
            newState
          );

          let riposteLog = '';
          let updatedHeroAfterRiposte = updatedHero;

          if (riposteResult.hit) {
            const updatedMonster = CombatSystem.applyDamage(monster, riposteResult.damage, newState);
            newState = {
              ...newState,
              monsters: newState.monsters.map(m => m.id === monster!.id ? updatedMonster : m)
            };
            updatedHeroAfterRiposte = {
              ...updatedHero,
              flippedPowerIds: [...(updatedHero.flippedPowerIds ?? []), 'rogue_riposte_strike']
            };
            updatedHeroesList = updatedHeroesList.map(h => h.id === updatedHeroAfterRiposte.id ? updatedHeroAfterRiposte : h);
            riposteLog = `${updatedHero.name} triggers Riposte Strike, counterattacking ${monster.name} and HITS (Roll: ${riposteResult.roll}, Total: ${riposteResult.total}) for ${riposteResult.damage} damage. Riposte Strike flips face-down.`;
          } else {
            riposteLog = `${updatedHero.name} triggers Riposte Strike, counterattacking ${monster.name} and MISSES (Roll: ${riposteResult.roll}, Total: ${riposteResult.total}). Card does not flip.`;
          }

          updatedLog.push({
            id: String(currentCounter),
            timestamp: new Date().toISOString(),
            message: riposteLog,
            type: 'combat' as const
          });
          currentCounter++;
        }

        newState = {
          ...newState,
          heroes: updatedHeroesList,
          log: updatedLog,
          logIdCounter: currentCounter
        };
      }
    }

    // Handle 'use_ability' action
    if (result.action === 'use_ability') {
      const ability = monster.abilities?.find(
        a => a.id === result.abilityId
      );
      if (ability) {
        newState = AbilitySystem.executeAbility(
          ability, monster, newState
        );
      }
    }

    // Death check after each ability or attack resolves
    newState = {
      ...newState,
      heroes: newState.heroes.map(h =>
        h.hp <= 0 ? { ...h, isDefeated: true } : h
      ),
      monsters: newState.monsters.map(m =>
        m.hp <= 0 ? { ...m, isDefeated: true } : m
      )
    };

    const hasDeadCrowd = newState.heroes.some(h => h.id === 'ally_illusionary_crowd' && h.hp <= 0);
    if (hasDeadCrowd) {
      newState = {
        ...newState,
        heroes: newState.heroes.filter(h => h.id !== 'ally_illusionary_crowd'),
        tokens: newState.tokens?.filter(t => t.id !== 'token_illusionary_crowd') ?? []
      };
    }

    // Cooldown processing at end of each monster's activation
    newState = AbilitySystem.processCooldowns(monster, newState);

    // Passive aura processing for each monster
    const freshMonster = newState.monsters.find(m => m.id === monsterId) || monster;
    if (freshMonster.abilities && freshMonster.hp > 0 && !freshMonster.isDefeated) {
      for (const passive of freshMonster.abilities) {
        if (passive.type === 'passive' && passive.trigger === 'on_turn_start') {
          for (const effect of passive.effects) {
            const targets = AbilitySystem.getAbilityTargets(
              effect, freshMonster, newState
            );
            newState = AbilitySystem.applyAbilityEffect(
              effect, freshMonster, targets, newState
            );
          }
        }
      }
    }
  }

  return newState;
}
