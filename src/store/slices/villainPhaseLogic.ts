import { GameState, GameLogEntry, Monster, Hero, Tile } from '../../game/types';
import { BossPhases } from '../../game/ai/BossPhases';
import { resolveTactic, resolveTrap, getTileGraphDistance, findBestLandingSquare } from '../../game/engine/MonsterAI';
import { TileSystem } from '../../game/engine/TileSystem';
import { ScenarioManager } from '../../game/scenarios/ScenarioManager';
import { AbilitySystem } from '../../game/ai/AbilitySystem';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { EncounterSystem } from '../../game/engine/EncounterSystem';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { DataLoader } from '../../game/dataLoader';


export function buildVillainQueue(
  state: GameState,
  activeHeroId: string
): string[] {
  const queue: string[] = [];

  // Step 1: collect monsters owned by the active hero (alive only, insertion order)
  const ownedMonsters = state.monsters.filter(
    m => m.hp > 0 && m.ownedByHeroId === activeHeroId
  );
  for (const m of ownedMonsters) {
    queue.push(m.id);
    if (state.frenzyActiveThisTurn) {
      queue.push(m.id);
    }
  }


  // Step 2: for each queued monster name, also activate same-named monsters from OTHER owners
  const queuedNames = new Set(
    ownedMonsters.map(m => m.name).filter((name): name is string => typeof name === 'string' && name.trim() !== '')
  );

  for (const monster of state.monsters) {
    if (
      monster.hp > 0 &&
      monster.ownedByHeroId !== activeHeroId &&
      monster.ownedByHeroId !== null &&
      !monster.isBoss &&
      monster.name &&
      queuedNames.has(monster.name) &&
      !queue.includes(monster.id)
    ) {
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

  // Add traps owned by the active hero that haven't been disabled (insertion order)
  for (const trap of state.traps) {
    if (trap.ownedByHeroId === activeHeroId && !trap.isDisabled) {
      queue.push(trap.id);
    }
  }

  return queue;
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
      
      const isSkullLord = monster.name.toLowerCase() === 'skull lord';
      const attackLoopCount = isSkullLord ? Math.max(1, monster.hp) : 1;

      for (let aIdx = 0; aIdx < attackLoopCount; aIdx++) {
        // Re-fetch monster in case its state changed
        const currentMonster = newState.monsters.find(m => m.id === monsterId) || monster;
        if (currentMonster.hp <= 0 || currentMonster.isDefeated) break;

        const targetHeroes = result.multiTarget
          ? newState.heroes.filter(h => h.position.x === targetTileX && h.position.z === targetTileZ)
          : [newState.heroes.find(h => h.id === result.targetHeroId)].filter((h): h is Hero => !!h);

        for (const tHero of targetHeroes) {
          // Re-fetch targetHero in case they were updated in a previous iteration of the loop (e.g. bodyguard swaps)
          let targetHero = newState.heroes.find(h => h.id === tHero.id);
          
          // If the target is defeated, choose another living hero within 1 tile
          if (isSkullLord && (!targetHero || targetHero.hp <= 0 || targetHero.isDefeated)) {
            const mTile = newState.tiles.find(t => t.x === currentMonster.position.x && t.z === currentMonster.position.z);
            if (mTile) {
              const nearbyHero = newState.heroes.find(h => {
                if (h.hp <= 0 || h.isDefeated) return false;
                const hTile = newState.tiles.find(t => t.x === h.position.x && t.z === h.position.z);
                return hTile && getTileGraphDistance(mTile, hTile, newState.tiles) <= 1;
              });
              if (nearbyHero) {
                targetHero = nearbyHero;
              }
            }
          }

          if (!targetHero || targetHero.hp <= 0 || targetHero.isDefeated) continue;

          // Apply tactic overrides for attack bonus, damage, and miss damage if defined
          const attackBonus = (result.attackBonus !== undefined) ? result.attackBonus : (currentMonster.attackBonus ?? 0);
          const damage = (result.damage !== undefined) ? result.damage : (currentMonster.damage ?? 1);
          const missDamage = (result.missDamage !== undefined) ? result.missDamage : (currentMonster.missDamage ?? 0);

          const attackResult = CombatSystem.resolveAttack(
            currentMonster,
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
            let currentTarget = updatedHeroesList.find(h => h.id === targetHero.id) ?? targetHero;
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
                  ...currentMonster,
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
            currentTarget = updatedHeroesList.find(h => h.id === targetHero.id) ?? targetHero;
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
            updatedHero = ConditionSystem.applyCondition(updatedHero, result.statusEffect, currentMonster.id, 1);
          }

          // Mummy Rot application
          if (attackResult.hit && currentMonster.name.toLowerCase() === 'mummy' && finalDamage > 0) {
            updatedHero = ConditionSystem.applyCondition(updatedHero, 'mummy_rot', currentMonster.id, -1);
          }

          updatedHeroesList = updatedHeroesList.map(h => h.id === targetHero.id ? updatedHero : h);

          let statusSuffix = '';
          if (attackResult.hit && result.statusEffect && finalDamage > 0) {
            statusSuffix = ` Hero is ${result.statusEffect.toUpperCase()}.`;
          }
          if (attackResult.hit && currentMonster.name.toLowerCase() === 'mummy' && finalDamage > 0) {
            statusSuffix += ` Hero has MUMMY ROT (healing blocked).`;
          }

          const logMessage = attackResult.hit
            ? `${currentMonster.name} attacks ${targetHero.name} (+${attackBonus} vs AC ${targetHero.ac}) and HITS (Roll: ${attackResult.roll}, Total: ${attackResult.total}) for ${attackResult.damage} damage.${statusSuffix}${logSuffix}`
            : `${currentMonster.name} attacks ${targetHero.name} (+${attackBonus} vs AC ${targetHero.ac}) and MISSES (Roll: ${attackResult.roll}, Total: ${attackResult.total}).${attackResult.damage > 0 ? ` Deals ${attackResult.damage} miss damage.${statusSuffix}` : ''}`;

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
          const mAbsX = currentMonster.position.x * 4 + currentMonster.position.sqX;
          const mAbsZ = currentMonster.position.z * 4 + currentMonster.position.sqZ;
          const isAdjacent = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ) === 1;

          if (hasRiposte && isAdjacent && currentMonster.hp > 0 && !currentMonster.isDefeated) {
            const riposteResult = CombatSystem.resolveAttack(
              updatedHero,
              currentMonster,
              7, // attackBonus
              2, // damage
              0,
              undefined,
              newState
            );

            let riposteLog = '';
            let updatedHeroAfterRiposte = updatedHero;

            if (riposteResult.hit) {
              const updatedMonster = CombatSystem.applyDamage(currentMonster, riposteResult.damage, newState);
              newState = {
                ...newState,
                monsters: newState.monsters.map(m => m.id === currentMonster!.id ? updatedMonster : m)
              };
              updatedHeroAfterRiposte = {
                ...(updatedHero as Hero),
                flippedPowerIds: [...((updatedHero as Hero).flippedPowerIds ?? []), 'rogue_riposte_strike']
              };
              updatedHeroesList = updatedHeroesList.map(h => h.id === updatedHeroAfterRiposte.id ? (updatedHeroAfterRiposte as Hero) : h);
              riposteLog = `${updatedHero.name} triggers Riposte Strike, counterattacking ${currentMonster.name} and HITS (Roll: ${riposteResult.roll}, Total: ${riposteResult.total}) for ${riposteResult.damage} damage. Riposte Strike flips face-down.`;
            } else {
              riposteLog = `${updatedHero.name} triggers Riposte Strike, counterattacking ${currentMonster.name} and MISSES (Roll: ${riposteResult.roll}, Total: ${riposteResult.total}). Card does not flip.`;
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
          if (passive.id === 'regeneration' && freshMonster.regenerationDisabled === true) {
            newState = {
              ...newState,
              log: [
                ...newState.log,
                {
                  id: String((newState.logIdCounter ?? 0) + 1),
                  timestamp: new Date().toISOString(),
                  message: `♻️ ${freshMonster.name}'s Regeneration is disabled and does not heal.`,
                  type: 'combat' as const
                }
              ].slice(-100),
              logIdCounter: (newState.logIdCounter ?? 0) + 1
            };
            continue;
          }
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

    // Teleportation handling
    if ((result as any).teleportToTileId) {
      const targetTile = newState.tiles.find(t => t.id === (result as any).teleportToTileId);
      if (targetTile) {
        const bestSq = findBestLandingSquare(freshMonster, null, targetTile, false, newState);
        newState = {
          ...newState,
          monsters: newState.monsters.map(m =>
            m.id === monsterId
              ? { ...m, position: { x: targetTile.x, z: targetTile.z, sqX: bestSq.sqX, sqZ: bestSq.sqZ } }
              : m
          ),
          log: [
            ...newState.log,
            {
              id: String((newState.logIdCounter ?? 0) + 1),
              timestamp: new Date().toISOString(),
              message: `${freshMonster.name} teleports to ${targetTile.name || targetTile.id}!`,
              type: 'system' as const
            }
          ].slice(-100),
          logIdCounter: (newState.logIdCounter ?? 0) + 1
        };
      }
    }

    // Vampire Bat tile exploration
    if ((result as any).revealTiles) {
      const unexploredPoints = TileSystem.getExplorationPoints(newState.tiles).filter(p => p.tileId === monsterTile.id);
      for (const pt of unexploredPoints) {
        const tileCountBefore = newState.tiles.length;
        newState = TileSystem.placeTileFromBottom(newState, pt);
        
        if (newState.tiles.length > tileCountBefore) {
          const placedTile = newState.tiles[newState.tiles.length - 1];
          newState = TileSystem.spawnMonsterForExploration(newState, placedTile);
          
          newState = {
            ...newState,
            log: [
              ...newState.log,
              {
                id: String((newState.logIdCounter ?? 0) + 1),
                timestamp: new Date().toISOString(),
                message: `${freshMonster.name} reveals a tile from the bottom of the deck at ${pt.edge} edge.`,
                type: 'system' as const
              }
            ].slice(-100),
            logIdCounter: (newState.logIdCounter ?? 0) + 1
          };
        }
      }
    }

    // Dark Chant (Dark Acolyte Undead heal)
    if ((result as any).acolyteDidNotAttack) {
      const woundedUndeadList = newState.monsters.filter(m =>
        m.id !== monsterId &&
        !m.isDefeated &&
        m.hp > 0 &&
        m.hp < m.maxHp &&
        m.monsterType?.toLowerCase() === 'undead'
      );
      
      if (woundedUndeadList.length > 0) {
        let closestUndead: Monster | null = null;
        let minDist = Infinity;
        for (const und of woundedUndeadList) {
          const undTile = newState.tiles.find(t => t.x === und.position.x && t.z === und.position.z);
          if (undTile) {
            const dist = getTileGraphDistance(monsterTile, undTile, newState.tiles);
            if (dist < minDist) {
              minDist = dist;
              closestUndead = und;
            }
          }
        }
        
        if (closestUndead) {
          const healedHp = Math.min(closestUndead.maxHp, closestUndead.hp + 1);
          newState = {
            ...newState,
            monsters: newState.monsters.map(m =>
              m.id === closestUndead!.id ? { ...m, hp: healedHp } : m
            ),
            log: [
              ...newState.log,
              {
                id: String((newState.logIdCounter ?? 0) + 1),
                timestamp: new Date().toISOString(),
                message: `Dark Chant: ${freshMonster.name} heals the closest wounded Undead (${closestUndead.name}) for 1 HP.`,
                type: 'combat' as const
              }
            ].slice(-100),
            logIdCounter: (newState.logIdCounter ?? 0) + 1
          };
        }
      }
    }

    // Card Passing (pass to 2nd player on left)
    if ((result as any).passCard) {
      const currentOwnerId = freshMonster.ownedByHeroId || newState.currentHeroId;
      const ownerIndex = newState.turnOrder.indexOf(currentOwnerId);
      if (ownerIndex !== -1 && newState.turnOrder.length > 1) {
        const nextIndex = (ownerIndex + 2) % newState.turnOrder.length;
        const nextOwnerId = newState.turnOrder[nextIndex];
        const nextOwnerHero = newState.heroes.find(h => h.id === nextOwnerId);
        const ownerHero = newState.heroes.find(h => h.id === currentOwnerId);
        
        newState = {
          ...newState,
          monsters: newState.monsters.map(m =>
            m.id === monsterId ? { ...m, ownedByHeroId: nextOwnerId } : m
          ),
          log: [
            ...newState.log,
            {
              id: String((newState.logIdCounter ?? 0) + 1),
              timestamp: new Date().toISOString(),
              message: `${freshMonster.name} card passed from ${ownerHero?.name || currentOwnerId} to ${nextOwnerHero?.name || nextOwnerId}.`,
              type: 'system' as const
            }
          ].slice(-100),
          logIdCounter: (newState.logIdCounter ?? 0) + 1
        };
      }
    }
  }

  return newState;
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
    const monster = newState.monsters.find(m => m.id === villainId);
    const trap = newState.traps.find(t => t.id === villainId);

    if (monster) {
      newState = activateMonsterEntity(newState, villainId);
    } else if (trap) {
      const trapTile = newState.tiles.find(tile => tile.id === trap.tileId);
      if (trapTile) {
        const trapCard = DataLoader.getInstance().getCardById(trap.cardId);
        if (trapCard) {
          const trapResult = EncounterSystem.activateTrap(newState, trap, trapCard);
          if (trapResult.success) {
            newState = trapResult.gameState;
          }
        }
      }
    }
  }

  // 3. After queue is fully consumed
  newState = {
    ...newState,
    activeVillainId: null,
    villainPhaseQueue: [],
    frenzyActiveThisTurn: false // Reset Frenzy
  };

  // NOTE: Encounter-card drawing is intentionally NOT done here.
  // endTurn() (coreSlice) is the sole entry point responsible for drawing encounter
  // cards with full UI (card reveal, dismiss, XP cancel). When an encounter is drawn
  // there, endTurn() returns early and sets pendingEncounter=true. dismissCardResolution
  // (cardSlice) then calls executeVillainPhase() to activate monsters AFTER the
  // encounter is resolved. Having a second draw here would either double-draw or
  // silently bypass the card UI entirely.

  // 4. Return the final state with experience and treasures processed
  return TreasureSystem.processDefeatedMonsters(newState);
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
    )
  };
};
