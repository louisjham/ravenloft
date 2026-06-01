import { GameState } from '../../game/types';
import { BossPhases } from '../../game/ai/BossPhases';
import { resolveTactic, resolveTrap } from '../../game/engine/MonsterAI';
import { AbilitySystem } from '../../game/ai/AbilitySystem';

export function buildVillainQueue(
  state: GameState,
  activeHeroId: string
): string[] {
  const queue: string[] = [];

  // Add monsters owned by the active hero (alive only, insertion order)
  for (const monster of state.monsters) {
    if (monster.ownedByHeroId === activeHeroId && monster.hp > 0) {
      queue.push(monster.id);
    }
  }

  // Add traps owned by the active hero (insertion order)
  for (const trap of state.traps) {
    if (trap.ownedByHeroId === activeHeroId) {
      queue.push(trap.id);
    }
  }

  return queue;
}

export function executeVillainPhase(state: GameState): GameState {
  // 1. Build the villain queue
  const villainPhaseQueue = buildVillainQueue(state, state.currentHeroId);

  let newState = {
    ...state,
    villainPhaseQueue
  };

  // 2. Process each entry in the queue
  for (const villainId of villainPhaseQueue) {
    // a. Set activeVillainId
    newState = {
      ...newState,
      activeVillainId: villainId
    };

    // b. Determine if it's a Monster or Trap
    let monster = newState.monsters.find(m => m.id === villainId);
    const trap = newState.traps.find(t => t.id === villainId);

    if (monster) {
      // c. If Monster
      // Phase transition check BEFORE calling resolveTactic
      if (monster.isBoss && BossPhases.shouldTransitionPhase(monster, newState)) {
        newState = BossPhases.transitionPhase(monster, newState);
        // Re-fetch monster from newState after transition
        // so resolveTactic sees the updated currentPhase
        const updatedMonster = newState.monsters.find(m => m.id === monster!.id);
        if (updatedMonster) {
          monster = updatedMonster;
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
          newState = {
            ...newState,
            monsters: newState.monsters.map(m =>
              m.id === villainId
                ? { ...m, position: { x: lastTile.x, z: lastTile.z, sqX: m.position.sqX, sqZ: m.position.sqZ } }
                : m
            )
          };
        }

        if (result.action === 'attack' || result.action === 'move_then_attack') {
          // Reduce target hero hp by damage
          newState = {
            ...newState,
            heroes: newState.heroes.map(h =>
              h.id === result.targetHeroId
                ? { ...h, hp: Math.max(0, h.hp - result.damage) }
                : h
            )
          };
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
        // 'idle': no change

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

        // Handle undying ability for defeated monsters
        const defeatedMonster = newState.monsters.find(m => m.id === monster!.id && m.isDefeated);
        if (defeatedMonster) {
          const undyingAbility = defeatedMonster.abilities?.find(a => a.id === 'undying');
          if (undyingAbility) {
            newState = AbilitySystem.executeAbility(
              undyingAbility, defeatedMonster, newState
            );
          }
        }

        // Cooldown processing at end of each monster's activation
        newState = AbilitySystem.processCooldowns(monster, newState);

        // Passive aura processing for each monster
        if (monster.abilities) {
          for (const passive of monster.abilities) {
            if (passive.type === 'passive' && passive.trigger === 'on_turn_start') {
              for (const effect of passive.effects) {
                const targets = AbilitySystem.getAbilityTargets(
                  effect, monster, newState
                );
                newState = AbilitySystem.applyAbilityEffect(
                  effect, monster, targets, newState
                );
              }
            }
          }
        }
      }
    } else if (trap) {
      // d. If Trap
      // Find the tile where trap.tileId matches
      const trapTile = newState.tiles.find(tile => tile.id === trap.tileId);
      if (trapTile) {
        const result = resolveTrap(trap, trapTile, newState);
        if (result) {
          newState = applyTrapResult(newState, villainId, result as any);
        }
      }
    }
  }

  // 3. After queue is fully consumed
  newState = {
    ...newState,
    activeVillainId: null,
    villainPhaseQueue: []
  };

  // 4. Return the final state
  return newState;
}

export function applyTrapResult(
  state: GameState,
  trapId: string,
  result: NonNullable<ReturnType<typeof resolveTrap>>
): GameState {
  return {
    ...state,
    heroes: state.heroes.map(hero =>
      hero.id === result.targetHeroId
        ? { ...hero, hp: Math.max(0, hero.hp - result.damage) }
        : hero
    ),
    traps: state.traps.map(trap =>
      trap.id === trapId
        ? { ...trap, isTriggered: true }
        : trap
    )
  };
}
