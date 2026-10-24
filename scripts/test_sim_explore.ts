import { useGameStore } from '../src/store/gameStore';
import { DataLoader } from '../src/game/dataLoader';
import { TileSystem } from '../src/game/engine/TileSystem';
import { ScenarioManager } from '../src/game/scenarios/ScenarioManager';

const dataLoader = DataLoader.getInstance();
const allHeroes = dataLoader.getHeroes();
const store = useGameStore.getState();

store.startNewGame('s1', ['hero_arjhan', 'hero_immeril', 'hero_alissa', 'hero_kat']);
store.gameState?.heroes.forEach(h => store.autoSelectPowers(h.id));
store.beginAdventure();

let gs = useGameStore.getState().gameState!;
console.log('--- Initial State ---');
console.log('Heroes:', gs.heroes.map(h => ({ id: h.id, pos: h.position })));

// Test Move to edge square: sqX: 3, sqZ: 1 (east edge of start tile)
const targetPosition = { x: 0, z: 0, sqX: 3, sqZ: 1 };
store.moveHero(targetPosition);

gs = useGameStore.getState().gameState!;
console.log('--- After moveHero to edge ---');
console.log('Heroes count:', gs.heroes.length);
console.log('Heroes:', gs.heroes.map(h => ({ id: h.id, pos: h.position })));

// Now simulate the auto-explore in useGameActions.ts
const points = TileSystem.getExplorationPoints(gs.tiles);
const explorablePoint = points.find(p => p.tileId === 'start-tile' && p.edge === 'east');
console.log('Explorable point:', explorablePoint);

if (explorablePoint) {
  const drawResult = TileSystem.drawAndPlace(gs, explorablePoint);
  console.log('Draw result tile:', drawResult.tile?.id, 'rotations:', drawResult.validRotations);
  if (drawResult.tile && drawResult.validRotations.length > 0) {
    const autoRotation = drawResult.validRotations[0];
    const finalState = TileSystem.placeTile(gs, explorablePoint, autoRotation);
    console.log('After placeTile, heroes count:', finalState.heroes.length);
    const placedTile = finalState.tiles.find(t => t.x === 1 && t.z === 0);
    if (placedTile) {
      const stateWithMonster = TileSystem.spawnMonsterForExploration(finalState, placedTile);
      console.log('After spawnMonster, heroes count:', stateWithMonster.heroes.length);
      const stateWithRules = ScenarioManager.processPostExplore(stateWithMonster, placedTile);
      console.log('After processPostExplore, heroes count:', stateWithRules.heroes.length);
      useGameStore.getState().setGameState({
        ...stateWithRules,
        hasExploredThisTurn: true,
        exploredThisTurn: true,
        lastPlacedTileEncounterType: placedTile.encounterType ?? null,
        lastPlacedTileId: placedTile.id
      });
      console.log('Final store heroes count:', useGameStore.getState().gameState?.heroes.length);
      console.log('Final store monsters count:', useGameStore.getState().gameState?.monsters.length);
    }
  }
}
