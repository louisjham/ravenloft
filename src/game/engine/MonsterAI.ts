/**
 * Distance & Line-of-Sight Evaluators for Monster AI
 *
 * Pure functions with no mutation, no side effects, no UI.
 */

import { Tile, Hero, Monster, GameState, Trap, TacticResult, MonsterAbility, AbilityEffect } from '../types';
import AbilitySystem from '../ai/AbilitySystem';
import BossPhases from '../ai/BossPhases';
import { ABILITY_LIBRARY } from '../ai/behaviors/AbilityLibrary';
import { DataLoader } from '../dataLoader';

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

  return manhattanDistance(fromTile.x, fromTile.z, toTile.x, toTile.z);
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
  const visited = new Set<string>();
  const queue: Tile[] = [fromTile];
  visited.add(fromTile.id);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Check if we reached the target
    if (current.id === toTile.id) {
      return true;
    }

    // Check if current tile blocks line of sight
    if (current.blocksLineOfSight === true) {
      continue;
    }

    // Add adjacent tiles to queue
    const adjacentIds = getAdjacentTileIds(current, allTiles);
    for (const adjacentId of adjacentIds) {
      if (!visited.has(adjacentId)) {
        const adjacentTile = tileMap.get(adjacentId);
        if (adjacentTile) {
          visited.add(adjacentId);
          queue.push(adjacentTile);
        }
      }
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
  allTiles: Tile[]
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

      if (closest === null || distance < closest.distance) {
        closest = {
          hero,
          distance,
          tile: heroTileByCoords
        };
      }
    }
  }

  return closest;
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

  // BFS to find shortest path
  const visited = new Set<string>();
  const queue: { tile: Tile; path: Tile[] }[] = [{ tile: fromTile, path: [] }];
  visited.add(fromTile.id);

  while (queue.length > 0) {
    const { tile: current, path } = queue.shift()!;

    // Check if we reached the target
    if (current.id === toTile.id) {
      return path.slice(0, steps);
    }

    // Add adjacent tiles to queue
    const adjacentIds = getAdjacentTileIds(current, allTiles);

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
        const newPath = [...path, adjacentTile];
        queue.push({ tile: adjacentTile, path: newPath });
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
      return monster.hp / monster.maxHp < 0.5;

    case 'adjacent_to_hero':
    case 'within_1_tile_of_hero':
    case 'heroes_adjacent': {
      const closestHero = findClosestHero(monsterTile, gameState.heroes, gameState.tiles);
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
      const closestHero = findClosestHero(monsterTile, gameState.heroes, gameState.tiles);
      return closestHero !== null && closestHero.distance <= 2;
    }

    case 'surrounded': {
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
  const { heroes, tiles } = gameState;

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
          // Fall through to existing move logic below
          break;
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
  const closestHero = findClosestHero(monsterTile, heroes, tiles);
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
 * - Find any Hero whose current tile matches trapTile (hero.tileId === trapTile.id)
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
    const heroTile = gameState.tiles.find(tile =>
      tile.x === hero.position.x && tile.z === hero.position.z
    );
    return heroTile?.id === trapTile.id;
  });

  // If no hero on the trap tile, return null
  if (!heroOnTrap) {
    return null;
  }

  // Look up actual trap card damage
  const trapCard = DataLoader.getInstance().getCardById(trap.cardId);
  const trapDamage = trapCard?.effects?.find(e => e.type === 'damage')?.value ?? 1;

  return {
    targetHeroId: heroOnTrap.id,
    damage: trapDamage
  };
}
