import { GameState, Scenario, Tile, TokenType } from '../types';
import { ObjectiveTracker } from './Objectives';
import { DataLoader } from '../dataLoader';

export class ScenarioManager {

  /**
   * Process special rules after a tile is placed.
   * Returns a new GameState with any modifications applied.
   */
  public static processPostExplore(gameState: GameState, placedTile: Tile): GameState {
    let state = { ...gameState };
    const rules = state.activeScenario.specialRules || [];

    // Check for time track advancement (sunset mechanics)
    const timeTrack = state.timeTrack;
    if (timeTrack && placedTile.encounterType === 'white') {
      const newCurrent = timeTrack.current + 1;
      state = {
        ...state,
        timeTrack: { ...timeTrack, current: newCurrent },
        log: [
          ...state.log,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: `☀️ Time advances: ${newCurrent}/${timeTrack.max} (${placedTile.name} explored)`,
            type: 'system' as const
          }
        ]
      };

      // Check if time track is exhausted
      if (newCurrent >= timeTrack.max && !state.strahdAwakened) {
        state = ScenarioManager.triggerStrahdAwakening(state);
      }
    }

    // Check for lair tile reveals (Adventure 7)
    if (state.activeScenario.villainLairPairings) {
      const lairPairing = state.activeScenario.villainLairPairings.find(
        p => placedTile.id.startsWith(p.lairTileId)
      );
      if (lairPairing) {
        state = ScenarioManager.spawnLairVillain(state, lairPairing);
      }
    }

    // Check for Arcane Circle reveal (Adventure 6)
    const hasArcaneRule = rules.some(r => String(r.id ?? '') === 'arcane_circle_spawns');
    if (hasArcaneRule && placedTile.id.startsWith('named_arcane_circle') && placedTile.isRevealed) {
      state = ScenarioManager.handleArcaneCircleReveal(state);
    }

    // Check for Chapel reveal (Adventure 2)
    if (placedTile.id.startsWith('named_chapel') && placedTile.isRevealed) {
      state = {
        ...state,
        chapelRevealed: true,
        log: [
          ...state.log,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: '⛪ The Chapel of Ravenloft has been discovered!',
            type: 'system' as const
          }
        ]
      };
    }

    return state;
  }

  private static triggerStrahdAwakening(state: GameState): GameState {
    const strahdMonster = DataLoader.getInstance().getMonsterById('monster_strahd');

    if (!strahdMonster) {
      console.warn('[ScenarioManager] Cannot spawn Strahd: monster data not found');
      return state;
    }

    const newMonster = {
      ...strahdMonster,
      id: `monster_strahd_${crypto.randomUUID().slice(0, 8)}`,
      position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
      hp: strahdMonster.maxHp || strahdMonster.hp,
      conditions: [],
      usedPowers: [],
      ownedByHeroId: null,
      isBoss: true
    };

    // Place Strahd on the start tile's bone pile
    const startTile = state.tiles.find(t => t.isStart);
    if (startTile) {
      newMonster.position = {
        x: startTile.x,
        z: startTile.z,
        sqX: startTile.boneSquare?.sqX ?? 0,
        sqZ: startTile.boneSquare?.sqZ ?? 0
      };

      return {
        ...state,
        monsters: [...state.monsters, newMonster as any],
        strahdAwakened: true,
        villainPhaseQueue: [...state.villainPhaseQueue, newMonster.id],
        log: [
          ...state.log,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: '🧛 Count Strahd has AWAKENED and entered the crypts!',
            type: 'system' as const
          }
        ]
      };
    }

    return { ...state, strahdAwakened: true };
  }

  private static spawnLairVillain(
    state: GameState,
    pairing: { lairTileId: string; villainMonsterId: string; villainName: string }
  ): GameState {
    const villainData = DataLoader.getInstance().getMonsterById(pairing.villainMonsterId);
    if (!villainData) {
      console.warn(`[ScenarioManager] Cannot spawn villain ${pairing.villainName}: data not found`);
      return state;
    }

    const newVillain = {
      ...villainData,
      id: `villain_${crypto.randomUUID().slice(0, 8)}`,
      position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
      hp: villainData.maxHp || villainData.hp,
      conditions: [],
      usedPowers: [],
      ownedByHeroId: null,
      isBoss: true
    };

    // Place villain on the lair tile's bone pile
    const lairTile = state.tiles.find(t => t.id === pairing.lairTileId);
    if (lairTile) {
      newVillain.position = {
        x: lairTile.x,
        z: lairTile.z,
        sqX: lairTile.boneSquare?.sqX ?? 0,
        sqZ: lairTile.boneSquare?.sqZ ?? 0
      };
    }

    return {
      ...state,
      monsters: [...state.monsters, newVillain as any],
      villainPhaseQueue: [...state.villainPhaseQueue, newVillain.id],
      log: [
        ...state.log,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          message: `👹 ${pairing.villainName} emerges from their lair!`,
          type: 'system' as const
        }
      ]
    };
  }

  private static handleArcaneCircleReveal(state: GameState): GameState {
    // Spawn Gravestorm on the Arcane Circle
    const gravestormData = DataLoader.getInstance().getMonsterById('villain_gravestorm');
    const stateWithGravestorm = gravestormData
      ? ScenarioManager.spawnLairVillain(state, {
          lairTileId: 'named_arcane_circle',
          villainMonsterId: 'villain_gravestorm',
          villainName: 'Gravestorm the Dracolich'
        })
      : state;

    // Place the Laboratory tile 4+ tiles away from the Arcane Circle
    const arcaneTile = stateWithGravestorm.tiles.find(t => t.id === 'named_arcane_circle');
    const labTileTemplate = DataLoader.getInstance().getTileById('named_laboratory');

    if (arcaneTile && labTileTemplate) {
      // Place laboratory at a distance: 4 tiles east of the arcane circle
      const labX = arcaneTile.x + 4;
      const labZ = arcaneTile.z;

      const labTile: Tile = {
        ...labTileTemplate,
        x: labX,
        z: labZ,
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: [],
        blocksLineOfSight: false
      };

      return {
        ...stateWithGravestorm,
        tiles: [...stateWithGravestorm.tiles, labTile],
        laboratoryRevealed: true,
        log: [
          ...stateWithGravestorm.log,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: '🔮 The Arcane Circle pulses with energy! Gravestorm has been summoned!',
            type: 'system' as const
          },
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: '⚗️ The Laboratory manifests nearby, containing Gravestorm\'s Phylactery!',
            type: 'system' as const
          }
        ]
      };
    }

    return stateWithGravestorm;
  }

  public static checkVictory(gameState: GameState): boolean {
    const objectives = ObjectiveTracker.checkObjectives(gameState);
    return objectives.every(obj => obj.isCompleted);
  }

  public static checkDefeat(gameState: GameState): boolean {
    const allNonEscapedDead = gameState.heroes.every(h => h.escaped || h.hp <= 0);
    const anyHeroDownNoSurges = gameState.healingSurges <= 0 && gameState.heroes.some(h => !h.escaped && h.hp <= 0);
    return allNonEscapedDead || anyHeroDownNoSurges;
  }
}
