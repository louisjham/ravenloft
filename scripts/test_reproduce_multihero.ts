import { useGameStore } from '../src/store/gameStore';
import { DataLoader } from '../src/game/dataLoader';
import { TileSystem } from '../src/game/engine/TileSystem';
import { ScenarioManager } from '../src/game/scenarios/ScenarioManager';

const store = useGameStore.getState();
const selectedScenarioId = 's1';
const selectedHeroIds = ['hero_arjhan', 'hero_immeril', 'hero_kat', 'hero_thorgrim'];

console.log('--- Step 1: startNewGame ---');
store.startNewGame(selectedScenarioId, selectedHeroIds);
let gs = useGameStore.getState().gameState!;
console.log('Heroes in startNewGame:', gs.heroes.map(h => ({ id: h.id, name: h.name, isAuto: h.isAutoFollow })));
console.log('turnOrder in startNewGame:', gs.turnOrder);
console.log('currentHeroId in startNewGame:', gs.currentHeroId);

// Power selection
selectedHeroIds.forEach(hId => {
  store.autoSelectPowers(hId);
  store.confirmHeroSelection(hId);
});

console.log('\n--- Step 2: beginAdventure ---');
store.beginAdventure();
gs = useGameStore.getState().gameState!;
console.log('Phase:', gs.phase);
console.log('Heroes in beginAdventure:', gs.heroes.map(h => ({ id: h.id, name: h.name, isAuto: h.isAutoFollow })));
console.log('turnOrder:', gs.turnOrder);
console.log('currentHeroId:', gs.currentHeroId);

console.log('\n--- Step 3: Move hero 1 to non-edge square (sqX: 2, sqZ: 1) ---');
store.moveHero({ x: 0, z: 0, sqX: 2, sqZ: 1 });
gs = useGameStore.getState().gameState!;
console.log('Heroes after non-edge move:', gs.heroes.map(h => ({ id: h.id, name: h.name, pos: h.position })));
console.log('currentHeroId:', gs.currentHeroId);
console.log('turnOrder:', gs.turnOrder);

console.log('\n--- Step 4: What if hero moved to edge square (sqX: 3, sqZ: 1)? ---');
const points = TileSystem.getExplorationPoints(gs.tiles);
console.log('Exploration points on start-tile:', points);
const explorablePoint = points.find(p => p.tileId === 'start-tile' && p.edge === 'east');
if (explorablePoint) {
  const drawResult = TileSystem.drawAndPlace(gs, explorablePoint);
  if (drawResult.tile && drawResult.validRotations.length > 0) {
    const autoRotation = drawResult.validRotations[0];
    const finalState = TileSystem.placeTile(gs, explorablePoint, autoRotation);
    const placedTile = finalState.tiles.find(t => t.x === 1 && t.z === 0)!;
    const stateWithMonster = TileSystem.spawnMonsterForExploration(finalState, placedTile);
    const stateWithRules = ScenarioManager.processPostExplore(stateWithMonster, placedTile);
    useGameStore.getState().setGameState({
      ...stateWithRules,
      hasExploredThisTurn: true,
      exploredThisTurn: true,
      lastPlacedTileEncounterType: placedTile.encounterType ?? null,
      lastPlacedTileId: placedTile.id
    });
  }
}

gs = useGameStore.getState().gameState!;
console.log('Heroes after edge explore:', gs.heroes.map(h => ({ id: h.id, name: h.name })));
console.log('currentHeroId:', gs.currentHeroId);
console.log('turnOrder:', gs.turnOrder);

console.log('\n--- Step 5: What happens when endTurn() is called for hero 1? ---');
store.endTurn();
gs = useGameStore.getState().gameState!;
console.log('Phase after endTurn:', gs.phase);
console.log('pendingEncounter:', gs.pendingEncounter);
console.log('cardResolution phase:', gs.cardResolution?.phase);
console.log('currentHeroId after endTurn:', gs.currentHeroId);
console.log('Heroes count after endTurn:', gs.heroes.length);
console.log('Heroes after endTurn:', gs.heroes.map(h => ({ id: h.id, name: h.name })));
console.log('turnOrder after endTurn:', gs.turnOrder);

if (gs.pendingEncounter) {
  console.log('\n--- Step 6: Dismissing encounter card resolution ---');
  store.dismissCardResolution();
  gs = useGameStore.getState().gameState!;
  console.log('Phase after dismissCardResolution:', gs.phase);
  console.log('currentHeroId after dismiss:', gs.currentHeroId);
  console.log('Heroes count after dismiss:', gs.heroes.length);
  console.log('Heroes after dismiss:', gs.heroes.map(h => ({ id: h.id, name: h.name })));
  console.log('turnOrder after dismiss:', gs.turnOrder);
}
