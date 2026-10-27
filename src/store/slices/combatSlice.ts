import { StateCreator } from 'zustand';
import { GameStore, CombatSlice } from '../storeTypes';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { CombatAdapter } from '../../game/engine/CombatAdapter';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { getTileGraphDistance, findBestLandingSquare } from '../../game/engine/MonsterAI';
import { DataLoader } from '../../game/dataLoader';
import { Position, GameLogEntry, GameState } from '../../game/types';
import { SoundLibrary } from '../../audio/SoundLibrary';
import { addLogEntry } from '../../game/engine/LogUtils';

export const createCombatSlice: StateCreator<GameStore, [], [], CombatSlice> = (set, get) => ({
  moveHero: (targetPosition: Position) => {
      const state = get().gameState;
      if (!state) return;

      // Bug 5: Target tile validation guard (tile exists and is revealed)
      const targetTile = state.tiles.find(t => t.x === targetPosition.x && t.z === targetPosition.z);
      if (!targetTile || !targetTile.isRevealed) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      let usedStandardActionForMove = false;
      const baseUpdatedHero = {
        ...hero,
        position: targetPosition,
        isExhausted: hero.isExhausted
      };

      if (!hero.isExhausted) {
        baseUpdatedHero.isExhausted = true;
      } else {
        usedStandardActionForMove = true;
      }

      // Tireless Pursuit trigger check
      const startedAdjacentDwIds = hero.startedTurnAdjacentToDreadWarriorIds ?? [];
      let updatedMonsters = [...state.monsters];
      let currentHeroRef = { ...baseUpdatedHero };
      let newStateForCombat = { ...state };
      const pursuitLogs: string[] = [];

      for (const dwId of startedAdjacentDwIds) {
        const dw = updatedMonsters.find(m => m.id === dwId && !m.isDefeated && m.hp > 0);
        if (!dw) continue;

        const dwAbsX = dw.position.x * 4 + dw.position.sqX;
        const dwAbsZ = dw.position.z * 4 + dw.position.sqZ;
        const targetAbsX = targetPosition.x * 4 + targetPosition.sqX;
        const targetAbsZ = targetPosition.z * 4 + targetPosition.sqZ;
        const stillAdjacent = Math.abs(dwAbsX - targetAbsX) + Math.abs(dwAbsZ - targetAbsZ) === 1;

        if (!stillAdjacent) {
          const heroTile = state.tiles.find(t => t.x === targetPosition.x && t.z === targetPosition.z);
          if (heroTile) {
            const bestSq = findBestLandingSquare(dw, currentHeroRef, heroTile, true, newStateForCombat);
            const nextDwPos = { x: heroTile.x, z: heroTile.z, sqX: bestSq.sqX, sqZ: bestSq.sqZ };

            updatedMonsters = updatedMonsters.map(m =>
              m.id === dwId ? { ...m, position: nextDwPos } : m
            );

            const currentDw = updatedMonsters.find(m => m.id === dwId)!;
            const attackResult = CombatSystem.resolveAttack(
              currentDw,
              currentHeroRef,
              6, // attackBonus
              2, // damage
              0,
              undefined,
              newStateForCombat,
              0 // missDamage
            );

            let finalDamage = attackResult.damage;
            let logSuffix = '';

            const hasShield = currentHeroRef.abilities.includes('wizard_shield') || currentHeroRef.hand.includes('wizard_shield');
            const isShieldAvailable = !(currentHeroRef.flippedPowerIds ?? []).includes('wizard_shield');

            if (attackResult.hit) {
              SoundLibrary.Combat.hit();
              if (hasShield && isShieldAvailable) {
                finalDamage = 0;
                logSuffix = ` Prevented by ${currentHeroRef.name}'s Shield! The attack misses instead.`;
                currentHeroRef = {
                  ...currentHeroRef,
                  flippedPowerIds: [...(currentHeroRef.flippedPowerIds ?? []), 'wizard_shield']
                };
              }
            }

            if (finalDamage > 0) {
              SoundLibrary.Combat.hurt();
            }

            currentHeroRef = CombatSystem.applyDamage(currentHeroRef, finalDamage, newStateForCombat);
            if (currentHeroRef.hp <= 0) {
              currentHeroRef.isDefeated = true;
            }

            pursuitLogs.push(
              `Tireless Pursuit! Dread Warrior pursues ${currentHeroRef.name} to tile (${targetPosition.x}, ${targetPosition.z}) and attacks (+6 vs AC ${currentHeroRef.ac}) - ${attackResult.hit ? `HITS for ${attackResult.damage} damage.${logSuffix}` : 'MISSES.'}`
            );
          }
        }
      }

      currentHeroRef.startedTurnAdjacentToDreadWarriorIds = [];

      const updatedHeroes = state.heroes.map(h => {
        if (h.id === state.currentHeroId) {
          return currentHeroRef;
        }
        return h;
      });

      let nextGameState: GameState = {
        ...state,
        heroes: updatedHeroes,
        monsters: updatedMonsters,
        hasAttackedThisTurn: usedStandardActionForMove ? true : state.hasAttackedThisTurn
      };

      // 1. Log movement first
      nextGameState = addLogEntry(
        nextGameState,
        `${hero.name} moves to [${targetTile.name || targetTile.id}] at (${targetPosition.x}, ${targetPosition.z}) square (${targetPosition.sqX}, ${targetPosition.sqZ})`,
        'action'
      );

      // 2. Log pursuit counter-attacks in order
      for (const pLog of pursuitLogs) {
        nextGameState = addLogEntry(nextGameState, pLog, 'combat');
      }

      set({ gameState: nextGameState });
    },

  attackMonster: async (monsterId: string) => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      const monster = state.monsters.find(m => m.id === monsterId);

      if (!hero || !monster) return;

      // Bug 2: Hero basic attack: use hero's actual damage stat
      const attackBonus = hero.attackBonus ?? 0;
      const damage = hero.damage ?? 1;
      const result = await CombatAdapter.resolveAttackAsync(hero, monster, attackBonus, damage, 0, state);

      // Re-fetch state after await in case it changed
      const currentState = get().gameState;
      if (!currentState) return;

      // Bug 4: Resolve currentMonster and currentHero from currentState to avoid stale reference
      const currentMonster = currentState.monsters.find(m => m.id === monsterId);
      const currentHero = currentState.heroes.find(h => h.id === currentState.currentHeroId);
      if (!currentMonster || !currentHero) return;

      const baseUpdatedHero = CombatSystem.applyAttackResultEffects(currentHero, result);

      // Cackling Skulls intercept
      let finalHero = baseUpdatedHero;
      let cacklingSkullsLog = '';
      if (!result.hit && currentMonster.name.toLowerCase() === 'skull lord') {
        const heroTile = currentState.tiles.find(t => t.x === baseUpdatedHero.position.x && t.z === baseUpdatedHero.position.z);
        const monsterTile = currentState.tiles.find(t => t.x === currentMonster.position.x && t.z === currentMonster.position.z);
        if (heroTile && monsterTile && getTileGraphDistance(heroTile, monsterTile, currentState.tiles) <= 1) {
          const flipped = baseUpdatedHero.flippedPowerIds ?? [];
          const unusedDailyOrUtility = baseUpdatedHero.abilities.filter(powerId => {
            const p = DataLoader.getInstance().getCardById(powerId);
            const isDailyOrUtility = p && (p.powerType === 'daily' || p.powerType === 'utility');
            return isDailyOrUtility && !flipped.includes(powerId);
          });

          if (unusedDailyOrUtility.length > 0) {
            const powerToFlipId = unusedDailyOrUtility[0];
            const powerToFlip = DataLoader.getInstance().getCardById(powerToFlipId);
            finalHero = {
              ...baseUpdatedHero,
              flippedPowerIds: [...flipped, powerToFlipId]
            };
            cacklingSkullsLog = `Cackling Skulls: ${baseUpdatedHero.name} missed Skull Lord from within 1 tile and flips daily/utility power (${powerToFlip?.name || powerToFlipId}) face down!`;
          } else {
            SoundLibrary.Combat.hurt();
            finalHero = CombatSystem.applyDamage(baseUpdatedHero, 1, currentState);
            cacklingSkullsLog = `Cackling Skulls: ${baseUpdatedHero.name} missed Skull Lord from within 1 tile, had no unused Daily/Utility powers, and takes 1 damage!`;
          }
        }
      }

      const updatedHeroes = currentState.heroes.map(h => h.id === finalHero.id ? finalHero : h);

      // Bug 3: Apply damage using CombatSystem.applyDamage instead of manual update
      const updatedMonsters = currentState.monsters.map(m => {
        if (m.id === monsterId) {
          return CombatSystem.applyDamage(m, result.damage, currentState);
        }
        return m;
      });

      const rollSummary = `🎲 Roll: ${result.roll} + ${attackBonus} = ${result.total} vs AC ${currentMonster.ac} ➔ ${result.critical ? 'CRITICAL HIT (Nat 20)!' : result.hit ? 'HIT!' : 'MISS!'}`;
      const damageStatus = result.hit ? `(${currentMonster.name} HP: ${Math.max(0, currentMonster.hp - result.damage)}/${currentMonster.maxHp})` : '';

      let runningState: GameState = {
        ...currentState,
        heroes: updatedHeroes,
        monsters: updatedMonsters,
        hasAttackedThisTurn: true
      };

      runningState = addLogEntry(
        runningState,
        `${currentHero.name} attacks ${currentMonster.name}! ${rollSummary} and deals ${result.damage} damage! ${damageStatus}`.trim(),
        'combat'
      );

      if (cacklingSkullsLog) {
        runningState = addLogEntry(runningState, cacklingSkullsLog, 'combat');
      }

      if (currentMonster.hp - result.damage <= 0) {
        SoundLibrary.Combat.death();
        runningState = addLogEntry(
          runningState,
          `💀 ${currentMonster.name} is defeated! +1 XP added to Experience Pile.`,
          'combat'
        );
      }

      const treasuresBefore = currentState.treasuresDrawnThisTurn;
      const finalStateAfterDefeat = TreasureSystem.processDefeatedMonsters(runningState);

      if (finalStateAfterDefeat.treasuresDrawnThisTurn > treasuresBefore) {
        SoundLibrary.Game.cardDraw();
      }

      set({
        gameState: finalStateAfterDefeat
      });
    },

});
