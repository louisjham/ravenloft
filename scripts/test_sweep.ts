import { useGameStore } from '../src/store/gameStore';
import { DataLoader } from '../src/game/dataLoader';

// Catch the corrupting set with a stack trace
const origSetState = useGameStore.setState.bind(useGameStore);
let corruptionStack = '';
(useGameStore as any).setState = (...args: any[]) => {
  const before = useGameStore.getState().gameState?.heroes.length;
  (origSetState as any)(...args);
  const after = useGameStore.getState().gameState?.heroes.length;
  if (before !== after && before !== undefined) {
    corruptionStack = new Error('trace').stack || '';
    (global as any).__corruptInfo = {
      before, after,
      afterIds: useGameStore.getState().gameState?.heroes.map((h: any) => h.id),
      currentHeroId: useGameStore.getState().gameState?.currentHeroId,
    };
  }
};

const heroIds = ['hero_arjhan', 'hero_immeril', 'hero_kat', 'hero_thorgrim', 'hero_alissa'];
const cards = DataLoader.getInstance().getAllCards().filter((c: any) => c.type === 'encounter');
console.log(`Sweeping ${cards.length} encounter cards...`);

const bad: string[] = [];
for (const card of cards) {
  (global as any).__corruptInfo = null;
  corruptionStack = '';
  const store = useGameStore.getState();
  store.startNewGame('adventure_01', heroIds);
  heroIds.forEach(hId => { store.autoSelectPowers(hId); store.confirmHeroSelection(hId); });
  store.beginAdventure();
  let gs = useGameStore.getState().gameState!;
  // rig the deck: this card on top
  store.setGameState({ ...gs, encounterDeck: [card.id] });
  await store.endTurn();
  gs = useGameStore.getState().gameState!;
  // resolve the encounter like the UI would
  let guard = 0;
  while (gs.pendingEncounter && guard++ < 20) {
    let inner = 0;
    while (gs.cardResolution && gs.cardResolution.phase !== 'complete' && gs.cardResolution.phase !== 'idle' && inner++ < 20) {
      store.advanceCardResolution();
      gs = useGameStore.getState().gameState!;
    }
    store.dismissCardResolution();
    gs = useGameStore.getState().gameState!;
  }
  if (gs.heroes.length !== 5) {
    bad.push(`${card.id} (${card.name}): heroes=${gs.heroes.length}`);
    console.log(`\nBAD CARD: ${card.id} (${card.name}) heroes=${gs.heroes.length}`);

    // continue sweeping all cards
  }
}
if (bad.length === 0) console.log('No shrinking card found in sweep.');
console.log('SWEEP DONE');
