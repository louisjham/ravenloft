import { GameState, ActiveCombatEncounter, Hero, Monster, Tile } from '../types';
import { getTileGraphDistance } from './MonsterAI';

/**
 * Manages the high-level Combat Encounter Phase state transitions.
 * Evaluates whether heroes and monsters are engaged in local combat,
 * and handles transitions to victory, defeat, or retreat (fled) states.
 */
export class CombatEncounterSystem {
  /**
   * Evaluates the current game state and updates the activeCombatEncounter
   * field based on the positions of heroes and monsters.
   * 
   * - Triggers combat when a hero and monster are on the same or adjacent tiles.
   * - Ends combat in Victory if all engaged monsters are defeated.
   * - Ends combat in Defeat if all heroes are defeated.
   * - Ends combat in Retreat (fled) if all surviving heroes are 2+ tiles away from all engaged monsters.
   */
  public static evaluateState(gameState: GameState): GameState {
    const { heroes, monsters, tiles, activeCombatEncounter } = gameState;

    // Check base defeat condition first
    const allHeroesDefeated = heroes.every(h => h.isDefeated || h.escaped || h.hp <= 0);
    if (allHeroesDefeated && activeCombatEncounter?.isActive) {
      return {
        ...gameState,
        activeCombatEncounter: {
          ...activeCombatEncounter,
          status: 'defeat',
          isActive: false
        }
      };
    }

    const undefeatedMonsters = monsters.filter(m => !m.isDefeated && m.hp > 0);
    
    // If no monsters remain on the board at all, any active combat is a victory.
    if (undefeatedMonsters.length === 0) {
      if (activeCombatEncounter?.isActive) {
        return {
          ...gameState,
          activeCombatEncounter: {
            ...activeCombatEncounter,
            status: 'victory',
            isActive: false
          }
        };
      }
      return gameState;
    }

    // Map entities to their tiles
    const heroTiles = new Map<string, Tile | undefined>();
    for (const hero of heroes) {
      if (!hero.isDefeated && !hero.escaped && hero.hp > 0) {
        heroTiles.set(hero.id, tiles.find(t => t.x === hero.position.x && t.z === hero.position.z));
      }
    }

    const monsterTiles = new Map<string, Tile | undefined>();
    for (const monster of undefeatedMonsters) {
      monsterTiles.set(monster.id, tiles.find(t => t.x === monster.position.x && t.z === monster.position.z));
    }

    // Determine currently engaged pairs (distance <= 1)
    const newlyEngagedHeroes = new Set<string>();
    const newlyEngagedMonsters = new Set<string>();

    for (const [heroId, hTile] of heroTiles.entries()) {
      for (const [monsterId, mTile] of monsterTiles.entries()) {
        if (hTile && mTile) {
          const dist = getTileGraphDistance(hTile, mTile, tiles);
          if (dist <= 1) {
            newlyEngagedHeroes.add(heroId);
            newlyEngagedMonsters.add(monsterId);
          }
        }
      }
    }

    // If no active encounter exists, but there are engaged entities, start one.
    if (!activeCombatEncounter || !activeCombatEncounter.isActive) {
      if (newlyEngagedHeroes.size > 0 && newlyEngagedMonsters.size > 0) {
        return {
          ...gameState,
          activeCombatEncounter: {
            isActive: true,
            status: 'ongoing',
            engagedHeroIds: Array.from(newlyEngagedHeroes),
            engagedMonsterIds: Array.from(newlyEngagedMonsters)
          }
        };
      }
      return gameState; // No combat to start
    }

    // If combat IS active, update it.
    let updatedEngagedHeroes = new Set(activeCombatEncounter.engagedHeroIds);
    let updatedEngagedMonsters = new Set(activeCombatEncounter.engagedMonsterIds);

    // Filter out defeated/escaped entities from tracking
    updatedEngagedHeroes = new Set(Array.from(updatedEngagedHeroes).filter(id => {
      const h = heroes.find(hero => hero.id === id);
      return h && !h.isDefeated && !h.escaped && h.hp > 0;
    }));
    updatedEngagedMonsters = new Set(Array.from(updatedEngagedMonsters).filter(id => {
      const m = monsters.find(monster => monster.id === id);
      return m && !m.isDefeated && m.hp > 0;
    }));

    // Add newly engaged
    newlyEngagedHeroes.forEach(id => updatedEngagedHeroes.add(id));
    newlyEngagedMonsters.forEach(id => updatedEngagedMonsters.add(id));

    // Victory check: Are all previously engaged monsters dead?
    if (updatedEngagedMonsters.size === 0) {
      return {
        ...gameState,
        activeCombatEncounter: {
          ...activeCombatEncounter,
          status: 'victory',
          isActive: false
        }
      };
    }

    // Retreat (Fled) check: Are ALL surviving engaged heroes >= 2 tiles away from ALL engaged monsters?
    let allHeroesFled = true;
    for (const heroId of updatedEngagedHeroes) {
      const hTile = heroTiles.get(heroId);
      if (!hTile) continue;

      let isSafe = true;
      for (const monsterId of updatedEngagedMonsters) {
        const mTile = monsterTiles.get(monsterId);
        if (mTile) {
          const dist = getTileGraphDistance(hTile, mTile, tiles);
          // If a hero is within 1 tile of ANY engaged monster, they haven't fled
          if (dist <= 1) {
            isSafe = false;
            break;
          }
        }
      }

      if (!isSafe) {
        allHeroesFled = false;
        break;
      }
    }

    if (updatedEngagedHeroes.size > 0 && allHeroesFled) {
      return {
        ...gameState,
        activeCombatEncounter: {
          ...activeCombatEncounter,
          engagedHeroIds: Array.from(updatedEngagedHeroes),
          engagedMonsterIds: Array.from(updatedEngagedMonsters),
          status: 'fled',
          isActive: false
        }
      };
    }

    // Still ongoing, just update the engaged lists
    return {
      ...gameState,
      activeCombatEncounter: {
        ...activeCombatEncounter,
        engagedHeroIds: Array.from(updatedEngagedHeroes),
        engagedMonsterIds: Array.from(updatedEngagedMonsters)
      }
    };
  }
}
