import { GameState, GameLogEntry, Monster } from '../../game/types';
import { BossPhases } from '../../game/ai/BossPhases';
import { resolveTactic, resolveTrap, getTileGraphDistance } from '../../game/engine/MonsterAI';
import { AbilitySystem } from '../../game/ai/AbilitySystem';
import { CombatSystem } from '../../game/engine/CombatSystem';

export function buildVillainQueue(
  state: GameState,
  activeHeroId: string
): string[] {
  const queue: string[] = [];

  // Add monsters owned by the active hero (alive only, insertion order)
  for (const monster of state.monsters) {
    if (monster.hp > 0 && monster.ownedByHeroId === activeHeroId) {
      queue.push(monster.id);
    }
  }

  // Add unowned boss monsters (they act every villain phase regardless of whose turn it is)
  for (const monster of state.monsters) {
    if (monster.hp > 0 && monster.ownedByHeroId === null && monster.isBoss) {
      if (!queue.includes(monster.id)) {
        queue.push(monster.id);
      }
    }
  }

  // Add traps owned by the active hero that haven't been triggered or disabled (insertion order)
  for (const trap of state.traps) {
    if (trap.ownedByHeroId === activeHeroId && !trap.isTriggered && !trap.isDisabled) {
      queue.push(trap.id);
    }
  }

  return queue;
}

export function executeVillainPhase(state: GameState): GameState {
  // 1. Build the villain queue
  const villainPhaseQueue = buildVillainQueue(state, state.currentHeroId);

  // Mark any pre-existing defeated monsters before queue processing
  // so on_death abilities (e.g. undying) can fire
  let newState = {
    ...state,
    villainPhaseQueue,
    monsters: state.monsters.map(m =>
      m.hp <= 0 ? { ...m, isDefeated: true } : m
    )
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
          const targetHero = newState.heroes.find(h => h.id === result.targetHeroId);
          if (targetHero) {
            const attackBonus = monster.attackBonus ?? 0;
            const damage = monster.damage ?? 1;
            const missDamage = monster.missDamage ?? 0;

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

              // Check for Unbalancing Parry
              const hasUnbalancingParry = targetHero.abilities.includes('ranger_unbalancing_parry') || targetHero.hand.includes('ranger_unbalancing_parry');
              const isUnbalancingParryAvailable = !(targetHero.flippedPowerIds ?? []).includes('ranger_unbalancing_parry');

              if (hasUnbalancingParry && isUnbalancingParryAvailable && finalDamage > 0) {
                finalDamage = 0;
                logSuffix += ` Deflected by ${targetHero.name}'s Unbalancing Parry! The attack misses instead.`;

                const heroTile = newState.tiles.find(t => t.x === targetHero.position.x && t.z === targetHero.position.z);
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
                    monsters: newState.monsters.map(m => m.id === monster!.id ? updatedMonster : m)
                  };
                }

                const updatedTargetHero = {
                  ...targetHero,
                  flippedPowerIds: [...(targetHero.flippedPowerIds ?? []), 'ranger_unbalancing_parry']
                };
                updatedHeroesList = updatedHeroesList.map(h => h.id === updatedTargetHero.id ? updatedTargetHero : h);
              }

              // Check for Yield Ground
              const hasYieldGround = targetHero.abilities.includes('ranger_yield_ground') || targetHero.hand.includes('ranger_yield_ground');
              const isYieldGroundAvailable = !(targetHero.flippedPowerIds ?? []).includes('ranger_yield_ground');

              if (hasYieldGround && isYieldGroundAvailable) {
                logSuffix += ` ${targetHero.name} triggers Yield Ground and moves their speed!`;

                const heroTile = newState.tiles.find(t => t.x === targetHero.position.x && t.z === targetHero.position.z);
                const validTiles = newState.tiles.filter(t => {
                  if (!heroTile) return false;
                  return getTileGraphDistance(heroTile, t, newState.tiles) <= 1;
                });

                let foundHeroPos = null;
                for (const tile of validTiles) {
                  for (let sqX = 0; sqX < 4; sqX++) {
                    for (let sqZ = 0; sqZ < 4; sqZ++) {
                      let distance = 0;
                      if (tile.x === targetHero.position.x && tile.z === targetHero.position.z) {
                        distance = Math.abs(sqX - targetHero.position.sqX) + Math.abs(sqZ - targetHero.position.sqZ);
                      } else {
                        distance = 4 + Math.abs(sqX - targetHero.position.sqX) + Math.abs(sqZ - targetHero.position.sqZ);
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

                const resolvedTarget = updatedHeroesList.find(h => h.id === targetHero.id) || targetHero;
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
            const updatedHero = CombatSystem.applyDamage(resolvedTargetHero, finalDamage, newState);

            updatedHeroesList = updatedHeroesList.map(h => h.id === targetHero.id ? updatedHero : h);

            const logMessage = attackResult.hit
              ? `${monster.name} attacks ${targetHero.name} (+${attackBonus} vs AC ${targetHero.ac}) and HITS (Roll: ${attackResult.roll}, Total: ${attackResult.total}) for ${attackResult.damage} damage.${logSuffix}`
              : `${monster.name} attacks ${targetHero.name} (+${attackBonus} vs AC ${targetHero.ac}) and MISSES (Roll: ${attackResult.roll}, Total: ${attackResult.total}).${attackResult.damage > 0 ? ` Deals ${attackResult.damage} miss damage.` : ''}`;

            let updatedLog: GameLogEntry[] = [
              ...newState.log,
              {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                message: logMessage,
                type: 'combat' as const
              }
            ].slice(-100);

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
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                message: riposteLog,
                type: 'combat' as const
              });
            }

            newState = {
              ...newState,
              heroes: updatedHeroesList,
              log: updatedLog
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
        // Note: 'on_turn_start' passives fire here during the villain phase activation,
        // not at the literal start of the entity's turn. This is intentional — the
        // trigger value represents "on activation" in the villain phase context.
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
