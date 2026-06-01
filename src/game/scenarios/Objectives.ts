import { GameState, Hero, Monster, Tile, Objective } from '../types';

export class ObjectiveTracker {
  public static checkObjectives(gameState: GameState): Objective[] {
    return gameState.activeScenario.objectives.map(obj => {
      const updated = { ...obj };
      switch (obj.type) {
        case 'kill_boss':
          const boss = gameState.monsters.find(m => m.id === obj.targetId);
          if (boss && boss.hp <= 0) updated.isCompleted = true;
          break;
        case 'find_tile':
          const tile = gameState.tiles.find(t => t.id === obj.targetTileId && t.isRevealed);
          if (tile) updated.isCompleted = true;
          break;
        case 'all_at_position':
          const allAtPosition = gameState.heroes.every(h => 
            gameState.tiles.find(t => t.id === obj.targetTileId && t.x === h.position.x && t.z === h.position.z)
          );
          if (allAtPosition) updated.isCompleted = true;
          break;
        case 'escape_via_stairway':
          const currentHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
          if (currentHero) {
            const currentTile = gameState.tiles.find(
              t => t.x === currentHero.position.x && t.z === currentHero.position.z
            );
            if (currentTile && currentTile.id.startsWith('named_secret_stairway')) {
              updated.isCompleted = true;
            }
          }
          break;
        case 'possess_icon':
          const hasIcon = gameState.heroes.some(h => h.items.includes('treasure_icon_ravenloft'));
          if (hasIcon) updated.isCompleted = true;
          break;
        case 'clear_chapel_monsters':
          if (obj.targetIds && obj.targetIds.length > 0) {
            const anyGuardsAlive = obj.targetIds.some((monsterId: string) => {
              const guard = gameState.monsters.find(m => m.id === monsterId);
              return guard && guard.hp > 0 && !guard.isDefeated;
            });
            if (!anyGuardsAlive) updated.isCompleted = true;
          } else {
            updated.isCompleted = false;
          }
          break;
        case 'defeat_klak': {
          const klak = gameState.monsters.find(m => m.id.startsWith('monster_klak'));
          if (klak && klak.hp <= 0) updated.isCompleted = true;
          break;
        }
        case 'destroy_artifact': {
          const artifact = gameState.monsters.find(m => m.id.startsWith('monster_klaks_artifact'));
          if (artifact && artifact.hp <= 0) updated.isCompleted = true;
          break;
        }
        case 'escape_with_treasures': {
          const escapedHeroes = gameState.heroes.filter(h => h.escaped);
          const totalEscapedTreasures = escapedHeroes.reduce((sum, h) => {
            return sum + h.items.filter(itemId => itemId.startsWith('treasure_')).length;
          }, 0);
          
          updated.currentCount = totalEscapedTreasures;
          if (obj.count !== undefined && totalEscapedTreasures >= obj.count) {
            updated.isCompleted = true;
          }
          break;
        }
        case 'cure_kavan': {
          if (gameState.fountainTokens !== undefined) {
            updated.currentCount = Math.max(0, 5 - gameState.fountainTokens);
            updated.count = 5;
            if (gameState.fountainTokens === 0) {
              updated.isCompleted = true;
            }
          }
          break;
        }
        case 'defeat_gravestorm': {
          const gravestorm = gameState.monsters.find(m => m.id.startsWith('monster_gravestorm') || m.monsterType === 'Dracolich');
          if (gravestorm && gravestorm.hp <= 0) updated.isCompleted = true;
          break;
        }
        // Scenario 1 - Find Strahd's Coffin
        case 'find_coffin': {
          // Victory when Strahd's coffin token has been searched
          const strahdToken = gameState.strahdsCoffinTokenId
            ? gameState.tokens?.find(t => t.id === gameState.strahdsCoffinTokenId)
            : undefined;
          if (strahdToken?.isSearched && strahdToken?.metadata?.isStrahdsCoffin) {
            updated.isCompleted = true;
          }
          break;
        }
        // Scenario 2 - Reset the Beacon (interact with braziers)
        case 'interact': {
          // Count how many brazier tokens have been searched/activated
          if (obj.targetType === 'brazier') {
            const lit = (gameState.tokens || []).filter(
              t => t.type === 'brazier' && t.isSearched
            ).length;
            updated.currentCount = lit;
            if (obj.count !== undefined && lit >= obj.count) {
              updated.isCompleted = true;
            }
          }
          break;
        }
        // Scenario 4 - Hunt for the Crown (collect crown shards)
        case 'collect_items': {
          if (obj.targetAttribute === 'crown_shard') {
            const totalShards = gameState.heroes.reduce((sum, h) =>
              sum + h.items.filter(itemId => itemId.startsWith('item_crown_shard')).length, 0
            );
            updated.currentCount = totalShards;
            if (obj.count !== undefined && totalShards >= obj.count) {
              updated.isCompleted = true;
            }
          }
          break;
        }
        // Adventure 7 - Adventure Impossible (defeat villains)
        case 'defeat_villains': {
          const defeated = (gameState.defeatedVillainIds || []).length;
          updated.currentCount = defeated;
          if (obj.count !== undefined && defeated >= obj.count) {
            updated.isCompleted = true;
          }
          break;
        }
        // Scenario 5 - Rescue the Adventurer (find torture chamber)
        case 'find_event': {
          const eventTile = gameState.tiles.find(
            t => t.id === obj.targetTileId && t.isRevealed
          );
          if (eventTile) updated.isCompleted = true;
          break;
        }
        // Other types would be updated here as game logic progresses
      }
      return updated;
    });
  }
}
