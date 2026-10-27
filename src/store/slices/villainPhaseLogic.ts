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
import { SoundLibrary } from '../../audio/SoundLibrary';
import { addLogEntry } from '../../game/engine/LogUtils';
import { resetHeroTurnFlags } from '../../game/engine/HeroTurnUtils';
import { useUIStore } from '../uiStore';
import { GameStore } from '../storeTypes';

export function buildVillainQueue(
  state: GameState,
  activeHeroId: string
): string[] {
  // Use a Set for O(1) deduplication instead of O(n) Array.includes inside loops
  const queueSet = new Set<string>();
  const queue: string[] = [];

  const addToQueue = (id: string) => {
    if (!queueSet.has(id)) {
      queueSet.add(id);
      queue.push(id);
    }
  };

  // Step 1: collect monsters owned by the active hero (alive only, insertion order)
  const ownedMonsters = state.monsters.filter(
    m => m.hp > 0 && m.ownedByHeroId === activeHeroId
  );
  for (const m of ownedMonsters) {
    addToQueue(m.id);
    if (state.frenzyActiveThisTurn) {
      // Frenzy adds the monster a second time; bypass dedup by pushing directly
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
      queuedNames.has(monster.name)
    ) {
      addToQueue(monster.id);
    }
  }

  // Add unowned boss monsters (they act every villain phase regardless of whose turn it is)
  for (const monster of state.monsters) {
    if (monster.hp > 0 && monster.ownedByHeroId === null && monster.isBoss) {
      addToQueue(monster.id);
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
    const dazedState: GameState = {
      ...newState,
      monsters: newState.monsters.map(m =>
        m.id === monsterId
          ? { ...m, skipActivations: m.skipActivations! - 1 }
          : m
      )
    };
    return addLogEntry(
      dazedState,
      `${monster.name} is dazed and skips its activation!`,
      'combat'
    );
  }

  // Phase transition check BEFORE calling resolveTactic
  if (monster.isBoss && BossPhases.shouldTransitionPhase(monster, newState)) {
    newState = BossPhases.transitionPhase(monster, newState);
    // Re-fetch monster from newState after transition so resolveTactic sees the updated currentPhase
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

    // 1. Resolve monster movement
    if (result.action === 'move' || result.action === 'move_then_attack') {
      newState = resolveMonsterMovement(newState, monster, result);
      // Re-fetch after movement so subsequent steps see the updated position
      const movedMonster = newState.monsters.find(m => m.id === monsterId);
      if (movedMonster) monster = movedMonster;
    }

    // 2. Resolve monster attacks
    if (result.action === 'attack' || result.action === 'move_then_attack') {
      const targetTileX = (result.action === 'move_then_attack') ? result.path[result.path.length - 1].x : monster.position.x;
      const targetTileZ = (result.action === 'move_then_attack') ? result.path[result.path.length - 1].z : monster.position.z;
      
      const isSkullLord = monster.name.toLowerCase() === 'skull lord';
      const attackLoopCount = isSkullLord ? Math.max(1, monster.hp) : 1;

      newState = resolveMonsterAttacks(
        newState,
        monsterId,
        result,
        monster,
        targetTileX,
        targetTileZ,
        isSkullLord,
        attackLoopCount
      );
    }

    // 3. Handle 'use_ability' action
    if (result.action === 'use_ability') {
      const ability = monster.abilities?.find(
        a => a.id === result.abilityId
      );
      if (ability) {
        newState = AbilitySystem.executeAbility(ability, monster, newState);
      }
    }

    // 4. Death check after each ability or attack resolves
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

    // 5. Cooldown processing at end of each monster's activation
    newState = AbilitySystem.processCooldowns(monster, newState);

    // 6. Passive aura processing for each monster (regeneration etc.)
    newState = resolveMonsterTurnStartPassives(newState, monsterId, monster);

    // 7. Special tactics (teleport, bat exploration, acolyte healing, card passing)
    newState = resolveSpecialMonsterTactics(newState, monsterId, monster, result, monsterTile);
  }

  return newState;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTED HELPER MODULES
// ─────────────────────────────────────────────────────────────────────────────

function resolveMonsterMovement(state: GameState, monster: Monster, result: any): GameState {
  const lastTile = result.path[result.path.length - 1];
  const targetHero = result.action === 'move_then_attack'
    ? state.heroes.find(h => h.id === result.targetHeroId)
    : null;
    
  const bestSq = findBestLandingSquare(
    monster,
    targetHero || null,
    lastTile,
    result.action === 'move_then_attack',
    state
  );

  return {
    ...state,
    monsters: state.monsters.map(m =>
      m.id === monster.id
        ? { ...m, position: { x: lastTile.x, z: lastTile.z, sqX: bestSq.sqX, sqZ: bestSq.sqZ } }
        : m
    )
  };
}

function resolveMonsterAttacks(
  state: GameState,
  monsterId: string,
  result: any,
  monster: Monster,
  targetTileX: number,
  targetTileZ: number,
  isSkullLord: boolean,
  attackLoopCount: number
): GameState {
  let newState = state;

  for (let aIdx = 0; aIdx < attackLoopCount; aIdx++) {
    let currentMonster = newState.monsters.find(m => m.id === monsterId) || monster;
    if (currentMonster.hp <= 0 || currentMonster.isDefeated) break;

    const targetHeroes = result.multiTarget
      ? newState.heroes.filter(h => h.position.x === targetTileX && h.position.z === targetTileZ)
      : [newState.heroes.find(h => h.id === result.targetHeroId)].filter((h): h is Hero => !!h);

    for (const tHero of targetHeroes) {
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

          newState = {
            ...newState,
            heroes: newState.heroes.map(h => h.id === updatedTargetHeroFlipped.id ? updatedTargetHeroFlipped : h)
          };
          targetHero = updatedTargetHeroFlipped;
        } else {
          const targetTile = newState.tiles.find(t => t.x === targetHero!.position.x && t.z === targetHero!.position.z);
          
          // Find bodyguard hero (another hero within 1 tile with bodyguard available)
          const bodyguardHero = newState.heroes.find(h => {
            if (h.id === targetHero!.id) return false;
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

            newState = {
              ...newState,
              heroes: newState.heroes.map(h => {
                if (h.id === updatedTargetHero.id) return updatedTargetHero;
                if (h.id === updatedBodyguardHero.id) return updatedBodyguardHero;
                return h;
              })
            };
            targetHero = updatedTargetHero;
          }
        }

        // Check for Unbalancing Parry
        let currentTarget = newState.heroes.find(h => h.id === targetHero!.id) ?? targetHero;
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
                  newState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
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
            currentMonster = updatedMonster;
          }

          const updatedTargetHero = {
            ...currentTarget,
            flippedPowerIds: [...(currentTarget.flippedPowerIds ?? []), 'ranger_unbalancing_parry']
          };
          newState = {
            ...newState,
            heroes: newState.heroes.map(h => h.id === updatedTargetHero.id ? updatedTargetHero : h)
          };
          targetHero = updatedTargetHero;
        }

        // Check for Yield Ground
        currentTarget = newState.heroes.find(h => h.id === targetHero!.id) ?? targetHero;
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
                    newState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
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

          const resolvedTarget = newState.heroes.find(h => h.id === currentTarget.id) || currentTarget;
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
          newState = {
            ...newState,
            heroes: newState.heroes.map(h => h.id === updatedTargetHero.id ? updatedTargetHero : h)
          };
          targetHero = updatedTargetHero;
        }
      }

      const resolvedTargetHero = newState.heroes.find(h => h.id === targetHero!.id) || targetHero;
      let updatedHero = CombatSystem.applyDamage(resolvedTargetHero, finalDamage, newState);

      if (attackResult.hit && result.statusEffect && finalDamage > 0) {
        updatedHero = ConditionSystem.applyCondition(updatedHero, result.statusEffect, currentMonster.id, 1);
      }

      // Mummy Rot application
      if (attackResult.hit && currentMonster.name.toLowerCase() === 'mummy' && finalDamage > 0) {
        updatedHero = ConditionSystem.applyCondition(updatedHero, 'mummy_rot', currentMonster.id, -1);
      }

      newState = {
        ...newState,
        heroes: newState.heroes.map(h => h.id === targetHero!.id ? updatedHero : h)
      };
      targetHero = updatedHero;

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

      newState = addLogEntry(newState, logMessage, 'combat');

      // Check for Riposte Strike
      const hasRiposte = (targetHero.abilities.includes('rogue_riposte_strike') || targetHero.hand.includes('rogue_riposte_strike')) &&
                         !(targetHero.flippedPowerIds ?? []).includes('rogue_riposte_strike');
      
      const hAbsX = targetHero.position.x * 4 + targetHero.position.sqX;
      const hAbsZ = targetHero.position.z * 4 + targetHero.position.sqZ;
      const mAbsX = currentMonster.position.x * 4 + currentMonster.position.sqX;
      const mAbsZ = currentMonster.position.z * 4 + currentMonster.position.sqZ;
      const isAdjacent = Math.abs(hAbsX - mAbsX) + Math.abs(hAbsZ - mAbsZ) === 1;

      if (hasRiposte && isAdjacent && currentMonster.hp > 0 && !currentMonster.isDefeated) {
        const riposteResult = CombatSystem.resolveAttack(
          targetHero,
          currentMonster,
          7, // attackBonus
          2, // damage
          0,
          undefined,
          newState
        );

        let riposteLog = '';
        let updatedHeroAfterRiposte = targetHero;

        if (riposteResult.hit) {
          SoundLibrary.Combat.hit();
          if (currentMonster.hp - riposteResult.damage <= 0) {
            SoundLibrary.Combat.death();
          }
          const updatedMonster = CombatSystem.applyDamage(currentMonster, riposteResult.damage, newState);
          newState = {
            ...newState,
            monsters: newState.monsters.map(m => m.id === currentMonster!.id ? updatedMonster : m)
          };
          currentMonster = updatedMonster;
          
          updatedHeroAfterRiposte = {
            ...(targetHero as Hero),
            flippedPowerIds: [...((targetHero as Hero).flippedPowerIds ?? []), 'rogue_riposte_strike']
          };
          newState = {
            ...newState,
            heroes: newState.heroes.map(h => h.id === updatedHeroAfterRiposte.id ? (updatedHeroAfterRiposte as Hero) : h)
          };
          targetHero = updatedHeroAfterRiposte;

          riposteLog = `${targetHero.name} triggers Riposte Strike, counterattacking ${currentMonster.name} and HITS (Roll: ${riposteResult.roll}, Total: ${riposteResult.total}) for ${riposteResult.damage} damage. Riposte Strike flips face-down.`;
        } else {
          riposteLog = `${targetHero.name} triggers Riposte Strike, counterattacking ${currentMonster.name} and MISSES (Roll: ${riposteResult.roll}, Total: ${riposteResult.total}). Card does not flip.`;
        }

        newState = addLogEntry(newState, riposteLog, 'combat');
      }
    }
  }

  return newState;
}

function resolveMonsterTurnStartPassives(state: GameState, monsterId: string, monster: Monster): GameState {
  let newState = state;
  const freshMonster = newState.monsters.find(m => m.id === monsterId) || monster;
  if (freshMonster.abilities && freshMonster.hp > 0 && !freshMonster.isDefeated) {
    for (const passive of freshMonster.abilities) {
      if (passive.type === 'passive' && passive.trigger === 'on_turn_start') {
        if (passive.id === 'regeneration' && freshMonster.regenerationDisabled === true) {
          newState = addLogEntry(
            newState,
            `♻️ ${freshMonster.name}'s Regeneration is disabled and does not heal.`,
            'combat'
          );
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
  return newState;
}

function resolveSpecialMonsterTactics(
  state: GameState,
  monsterId: string,
  monster: Monster,
  result: any,
  monsterTile: Tile
): GameState {
  let newState = state;
  const freshMonster = newState.monsters.find(m => m.id === monsterId) || monster;

  // Teleportation handling
  if (result.teleportToTileId) {
    const targetTile = newState.tiles.find(t => t.id === result.teleportToTileId);
    if (targetTile) {
      const bestSq = findBestLandingSquare(freshMonster, null, targetTile, false, newState);
      newState = {
        ...newState,
        monsters: newState.monsters.map(m =>
          m.id === monsterId
            ? { ...m, position: { x: targetTile.x, z: targetTile.z, sqX: bestSq.sqX, sqZ: bestSq.sqZ } }
            : m
        )
      };
      newState = addLogEntry(
        newState,
        `${freshMonster.name} teleports to ${targetTile.name || targetTile.id}!`,
        'system'
      );
    }
  }

  // Vampire Bat tile exploration
  if (result.revealTiles) {
    const unexploredPoints = TileSystem.getExplorationPoints(newState.tiles).filter(p => p.tileId === monsterTile.id);
    for (const pt of unexploredPoints) {
      const tileCountBefore = newState.tiles.length;
      newState = TileSystem.placeTileFromBottom(newState, pt);
      
      if (newState.tiles.length > tileCountBefore) {
        const placedTile = newState.tiles[newState.tiles.length - 1];
        newState = TileSystem.spawnMonsterForExploration(newState, placedTile);
        
        newState = addLogEntry(
          newState,
          `${freshMonster.name} reveals a tile from the bottom of the deck at ${pt.edge} edge.`,
          'system'
        );
      }
    }
  }

  // Dark Chant (Dark Acolyte Undead heal)
  if (result.acolyteDidNotAttack) {
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
          )
        };
        newState = addLogEntry(
          newState,
          `Dark Chant: ${freshMonster.name} heals the closest wounded Undead (${closestUndead.name}) for 1 HP.`,
          'combat'
        );
      }
    }
  }

  // Card Passing (pass to 2nd player on left)
  if (result.passCard) {
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
        )
      };
      newState = addLogEntry(
        newState,
        `${freshMonster.name} card passed from ${ownerHero?.name || currentOwnerId} to ${nextOwnerHero?.name || nextOwnerId}.`,
        'system'
      );
    }
  }

  return newState;
}

export function activateVillainEntity(state: GameState, villainId: string): GameState {
  let newState: GameState = {
    ...state,
    activeVillainId: villainId
  };

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

  return newState;
}

export function advanceToNextHeroTurn(state: GameState): GameState {
  const validTurnOrder = state.turnOrder.filter(id => state.heroes.some(h => h.id === id));
  const effectiveTurnOrder = validTurnOrder.length > 0 ? validTurnOrder : state.heroes.map(h => h.id);
  const currentIndex = effectiveTurnOrder.indexOf(state.currentHeroId);
  const nextIndex = (currentIndex + 1) % effectiveTurnOrder.length;
  const nextId = effectiveTurnOrder[nextIndex] || state.heroes[0]?.id;

  const stateAfterTurnStart = ConditionSystem.processTurnStart(state, nextId);

  const postVillainDefeated = state.phase !== 'setup' && ScenarioManager.checkDefeat(state);
  const nextTurnDefeated = !postVillainDefeated && ScenarioManager.checkDefeat({ ...stateAfterTurnStart, currentHeroId: nextId });
  const nextPhase = (postVillainDefeated || nextTurnDefeated) ? ('defeat' as const) : ('hero' as const);

  const nextHero = stateAfterTurnStart.heroes.find(h => h.id === nextId);
  const newTurnNum = stateAfterTurnStart.turnCount + (nextIndex === 0 ? 1 : 0);
  const stateWithTurnLog = addLogEntry(
    stateAfterTurnStart,
    `── Turn ${newTurnNum}: ${nextHero ? nextHero.name : nextId}'s turn begins (${nextHero?.hp ?? 0}/${nextHero?.maxHp ?? 0} HP, ${stateAfterTurnStart.healingSurges} Surges) ──`,
    'system'
  );

  return {
    ...stateWithTurnLog,
    currentHeroId: nextId,
    phase: nextPhase,
    hasExploredThisTurn: false,
    exploredThisTurn: false,
    hasAttackedThisTurn: false,
    lastPlacedTileEncounterType: null,
    lastPlacedTileId: null,
    turnCount: newTurnNum,
    pendingAITurnApproval: null,
    heroes: stateWithTurnLog.heroes.map(h => {
      const resetH = resetHeroTurnFlags(h);
      let startedTurnAdjacentToDreadWarriorIds: string[] = [];
      if (h.id === nextId) {
        const dreadWarriors = stateAfterTurnStart.monsters.filter(
          m => !m.isDefeated && m.hp > 0 && m.name.toLowerCase() === 'dread warrior'
        );
        for (const dw of dreadWarriors) {
          const hAbsX = h.position.x * 4 + h.position.sqX;
          const hAbsZ = h.position.z * 4 + h.position.sqZ;
          const dwAbsX = dw.position.x * 4 + dw.position.sqX;
          const dwAbsZ = dw.position.z * 4 + dw.position.sqZ;
          if (Math.abs(hAbsX - dwAbsX) + Math.abs(hAbsZ - dwAbsZ) === 1) {
            startedTurnAdjacentToDreadWarriorIds.push(dw.id);
          }
        }
      }
      return {
        ...resetH,
        startedTurnAdjacentToDreadWarriorIds
      };
    })
  };
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

  // 2. Process each entry in the queue sequentially
  for (const villainId of villainPhaseQueue) {
    newState = activateVillainEntity(newState, villainId);
  }

  // 3. After queue is fully consumed
  newState = {
    ...newState,
    activeVillainId: null,
    villainPhaseQueue: [],
    villainQueueIndex: undefined,
    frenzyActiveThisTurn: false // Reset Frenzy
  };

  // 4. Return the final state with experience and treasures processed
  return TreasureSystem.processDefeatedMonsters(newState);
}

export async function executeVillainPhaseStaged(
  startState: GameState,
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  options?: { cardDisplayDelayMs?: number; actionDelayMs?: number }
): Promise<void> {
  const isBrowser = typeof window !== 'undefined';
  const cardDelay = options?.cardDisplayDelayMs ?? (isBrowser ? 2200 : 0);
  const actionDelay = options?.actionDelayMs ?? (isBrowser ? 1000 : 0);

  // 1. Build the villain queue
  const queue = buildVillainQueue(startState, startState.currentHeroId);

  // Mark pre-existing defeated monsters
  let currentState: GameState = {
    ...startState,
    phase: 'villain' as const,
    villainPhaseQueue: queue,
    activeVillainId: null,
    villainQueueIndex: undefined,
    monsters: startState.monsters.map(m =>
      m.hp <= 0 ? { ...m, isDefeated: true } : m
    )
  };

  // If queue is empty: notify, finalize defeated monsters, and advance turn
  if (queue.length === 0) {
    useUIStore.getState().addNotification('Villain Phase: No monster attacks.', 'info', 2000);
    const cleanedState: GameState = {
      ...currentState,
      activeVillainId: null,
      villainPhaseQueue: [],
      villainQueueIndex: undefined,
      frenzyActiveThisTurn: false
    };
    const processedState = TreasureSystem.processDefeatedMonsters(cleanedState);
    const nextTurnState = advanceToNextHeroTurn(processedState);
    if (nextTurnState.phase === 'defeat') {
      useUIStore.getState().showModal('defeat');
    }
    set({ gameState: nextTurnState });
    return;
  }

  // Set initial villain phase state with populated queue
  set({ gameState: currentState });

  // 2. Stage each entity one at a time
  for (let qIdx = 0; qIdx < queue.length; qIdx++) {
    const villainId = queue[qIdx];

    // Check eligibility
    const monster = currentState.monsters.find(m => m.id === villainId);
    const trap = currentState.traps.find(t => t.id === villainId);
    if (monster && (monster.hp <= 0 || monster.isDefeated)) continue;
    if (trap && trap.isDisabled) continue;
    if (!monster && !trap) continue;

    // STEP A: Show AI card (Telegraph)
    currentState = {
      ...currentState,
      activeVillainId: villainId,
      villainQueueIndex: qIdx
    };
    set({ gameState: currentState });

    if (cardDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, cardDelay));
    }

    // Guard: check if game state was reset or phase changed while waiting
    const liveState = get().gameState;
    if (!liveState || liveState.phase !== 'villain') return;

    // STEP B: Entity Acts
    const preLogCount = currentState.log.length;
    currentState = activateVillainEntity(currentState, villainId);

    // Audio & notifications for new combat logs
    const newLogs = currentState.log.slice(preLogCount);
    const combatEntries = newLogs.filter(e => e.type === 'combat');
    if (combatEntries.length > 0) {
      for (const entry of combatEntries) {
        const isHit = entry.message.includes('HITS');
        if (isHit) {
          SoundLibrary.Combat.hit();
          SoundLibrary.Combat.hurt();
        }
        useUIStore.getState().addNotification(
          entry.message,
          isHit ? 'error' : 'info',
          3500
        );
      }
    }

    // During the action on board, clear activeVillainId so the card fades and table is visible
    currentState = {
      ...currentState,
      activeVillainId: null
    };
    set({ gameState: currentState });

    if (actionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, actionDelay));
    }

    // Check defeat condition early (if all heroes were killed)
    if (ScenarioManager.checkDefeat(currentState)) {
      break;
    }
  }

  // 3. Queue finished — finalize villain phase
  currentState = {
    ...currentState,
    activeVillainId: null,
    villainPhaseQueue: [],
    villainQueueIndex: undefined,
    frenzyActiveThisTurn: false
  };

  const processedState = TreasureSystem.processDefeatedMonsters(currentState);
  const nextTurnState = advanceToNextHeroTurn(processedState);

  if (nextTurnState.phase === 'defeat') {
    useUIStore.getState().showModal('defeat');
  }

  set({ gameState: nextTurnState });
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
}
