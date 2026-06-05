/**
 * Helper function to build the Villain Phase queue.
 * Returns an ordered array of ids where:
 * - All monsters with ownedByHeroId === activeHeroId come first (sorted by insertion order)
 * - All traps with ownedByHeroId === activeHeroId follow
 * - Skip any monster with hp <= 0
 */
export function buildVillainQueue(state: GameState, activeHeroId: string): string[] {
  const monsterIds = state.monsters
    .filter((m: Monster) => m.ownedByHeroId === activeHeroId && m.hp > 0)
    .map((m: Monster) => m.id);
  const trapIds = state.traps
    .filter((t: Trap) => t.ownedByHeroId === activeHeroId && !t.isTriggered && !t.disabled)
    .map((t: Trap) => t.id);
  return [...monsterIds, ...trapIds];
}

/**
 * Pure function that returns a new GameState where:
 * 1) If the villain phase queue is empty, it populates it
 * 2) Pops one entity and executes its logic
 */
export function executeVillainPhase(state: GameState): GameState {
  let newState = { ...state, log: [...state.log], traps: [...state.traps], heroes: [...state.heroes], monsters: [...state.monsters] };
  
  if (!newState.villainPhaseQueue || newState.villainPhaseQueue.length === 0) {
    newState.villainPhaseQueue = buildVillainQueue(newState, newState.currentHeroId);
  } else {
    newState.villainPhaseQueue = [...newState.villainPhaseQueue];
  }
  
  if (newState.villainPhaseQueue.length > 0) {
    const entityId = newState.villainPhaseQueue.shift()!;
    const monster = newState.monsters.find((m: Monster) => m.id === entityId);
    if (monster) {
      // Process monster tactic
      const tileId = `${monster.position.x},${monster.position.z}`;
      const monsterTile = newState.tiles.find((t: Tile) => `${t.x},${t.z}` === tileId) || newState.tiles[0];
      const tactic = resolveTactic(monster, monsterTile, newState);
      if (tactic) {
        if ('damage' in tactic && (tactic.damage as number) > 0 && 'targetHeroId' in tactic) {
          const tid = tactic.targetHeroId as string;
          newState.heroes = newState.heroes.map((h: Hero) => 
            h.id === tid ? { ...h, hp: Math.max(0, h.hp - (tactic.damage as number)) } : h
          );
        }
        if ('path' in tactic && Array.isArray(tactic.path) && tactic.path.length > 0) {
           const targetTile = tactic.path[tactic.path.length - 1];
           newState.monsters = newState.monsters.map((m: Monster) => 
             m.id === monster.id ? { ...m, position: { x: targetTile.x, z: targetTile.z, sqX: monster.position.sqX, sqZ: monster.position.sqZ } } : m
           );
        }
      }
    } else {
      const trap = newState.traps.find((t: Trap) => t.id === entityId);
      if (trap) {
        const trapResult = resolveTrap(newState, trap);
        if (trapResult) {
            newState = applyTrapResult(newState, trap.id, trapResult);
        }
      }
    }
  }
  return newState;
}

export function applyTrapResult(
  state: GameState,
  trapId: string,
  result: NonNullable<ReturnType<typeof import('../game/engine/MonsterAI').resolveTrap>>
): GameState {
  return {
    ...state,
    heroes: state.heroes.map((hero: Hero) =>
      hero.id === result.targetHeroId
        ? { ...hero, hp: Math.max(0, hero.hp - result.damage) }
        : hero
    ),
    traps: state.traps.map((trap: Trap) =>
      trap.id === trapId
        ? { ...trap, isTriggered: true }
        : trap
    )
  };
}
