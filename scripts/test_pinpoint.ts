import { useGameStore } from '../src/store/gameStore';

const store = useGameStore.getState();
const heroIds = ['hero_arjhan', 'hero_immeril', 'hero_kat', 'hero_thorgrim', 'hero_alissa'];
store.startNewGame('adventure_01', heroIds);
heroIds.forEach(hId => { store.autoSelectPowers(hId); store.confirmHeroSelection(hId); });
store.beginAdventure();
let gs = useGameStore.getState().gameState!;
console.log('after beginAdventure: heroes =', gs.heroes.length);

store.setGameState({ ...gs, encounterDeck: ['enc_bat_swarm'] });
await store.endTurn();
gs = useGameStore.getState().gameState!;
console.log('after endTurn (encounter drawn): heroes =', gs.heroes.length,
  '| card =', gs.cardResolution?.cardId, '| phase =', gs.cardResolution?.phase);

store.advanceCardResolution(); // revealing -> resolving
gs = useGameStore.getState().gameState!;
console.log('after advance #1:', gs.cardResolution?.phase, '| heroes =', gs.heroes.length);

store.advanceCardResolution(); // resolving: applies the passive effect
gs = useGameStore.getState().gameState!;
console.log('after advance #2:', gs.cardResolution?.phase, '| heroes =', gs.heroes.length,
  '| ids =', gs.heroes.map((h: any) => h.id).join(','));

store.dismissCardResolution();
gs = useGameStore.getState().gameState!;
console.log('after dismiss: heroes =', gs.heroes.length, '| current =', gs.currentHeroId);
const kat = gs.heroes.find((h: any) => h.id === 'hero_kat');
console.log('Kat lookup:', kat ? 'FOUND' : 'NOT FOUND <-- BUG REPRODUCED');
