import { StateCreator } from 'zustand';
import { GameStore, CombatSlice } from '../storeTypes';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { CombatAdapter } from '../../game/engine/CombatAdapter';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { getTileGraphDistance, findBestLandingSquare } from '../../game/engine/MonsterAI';
import { DataLoader } from '../../game/dataLoader';
import { Position, GameLogEntry } from '../../game/types';

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
      let logIndex = state.logIdCounter ?? 0;
      let logsToAdd: GameLogEntry[] = [];
      let currentHeroRef = { ...baseUpdatedHero };
      let newStateForCombat = { ...state };

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
              if (hasShield && isShieldAvailable) {
                finalDamage = 0;
                logSuffix = ` Prevented by ${currentHeroRef.name}'s Shield! The attack misses instead.`;
                currentHeroRef = {
                  ...currentHeroRef,
                  flippedPowerIds: [...(currentHeroRef.flippedPowerIds ?? []), 'wizard_shield']
                };
              }
            }

            currentHeroRef = CombatSystem.applyDamage(currentHeroRef, finalDamage, newStateForCombat);
            if (currentHeroRef.hp <= 0) {
              currentHeroRef.isDefeated = true;
            }

            logsToAdd.push({
              id: String(logIndex++),
              timestamp: new Date().toISOString(),
              message: `Tireless Pursuit! Dread Warrior pursues ${currentHeroRef.name} to tile (${targetPosition.x}, ${targetPosition.z}) and attacks (+6 vs AC ${currentHeroRef.ac}) - ${attackResult.hit ? `HITS for ${attackResult.damage} damage.${logSuffix}` : 'MISSES.'}`,
              type: 'combat' as const
            });
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

      const updatedLog: GameLogEntry[] = [
        ...state.log,
        {
          id: String(logIndex++),
          timestamp: new Date().toISOString(),
          message: `${hero.name} moves to tile (${targetPosition.x}, ${targetPosition.z}) sq (${targetPosition.sqX}, ${targetPosition.sqZ})`,
          type: 'action' as const
        },
        ...logsToAdd
      ].slice(-100);

      set({
        gameState: {
          ...state,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          log: updatedLog,
          logIdCounter: logIndex,
          hasAttackedThisTurn: usedStandardActionForMove ? true : state.hasAttackedThisTurn
        }
      });
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

      // Bug 6: Use deterministic logIdCounter instead of crypto.randomUUID()
      const counter = currentState.logIdCounter ?? 0;
      let logIndex = counter;
      const updatedLog: GameLogEntry[] = [
        ...currentState.log,
        {
          id: String(logIndex++),
          timestamp: new Date().toISOString(),
          message: `${currentHero.name} attacks ${currentMonster.name} and deals ${result.damage} damage!`,
          type: 'combat' as const
        }
      ];

      if (cacklingSkullsLog) {
        updatedLog.push({
          id: String(logIndex++),
          timestamp: new Date().toISOString(),
          message: cacklingSkullsLog,
          type: 'combat' as const
        });
      }

      set({
        gameState: TreasureSystem.processDefeatedMonsters({
          ...currentState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          log: updatedLog.slice(-100),
          logIdCounter: logIndex,
          hasAttackedThisTurn: true
        })
      });
    },

});
