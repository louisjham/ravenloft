import { useGameStore } from '../src/store/gameStore';

let failures = 0;
let turns = 0;

// The exact lookup the UI does
function checkLookup(step: string) {
  const gs = useGameStore.getState().gameState!;
  const hero = gs.heroes.find(h => h.id === gs.currentHeroId);
  const ok = !!hero;
  if (!ok) {
    failures++;
    console.log(`FAIL [${step}]: currentHeroId=${gs.currentHeroId} NOT FOUND. heroes=[${gs.heroes.map(h => h.id)}] turnOrder=[${gs.turnOrder}] phase=${gs.phase}`);
  }
  return ok;
}

const store = useGameStore.getState();
const heroIds = ['hero_arjhan', 'hero_immeril', 'hero_kat', 'hero_thorgrim', 'hero_alissa'];

store.startNewGame('adventure_01', heroIds);
heroIds.forEach(hId => { store.autoSelectPowers(hId); store.confirmHeroSelection(hId); });
store.beginAdventure();
checkLookup('game start');

// Play 10 full turns: endTurn -> resolve any encounter -> check lookup
for (let t = 0; t < 10; t++) {
  let gs = useGameStore.getState().gameState!;
  if (!gs || gs.phase === 'defeat' || gs.phase === 'victory') { console.log(`game ended: ${gs?.phase}`); break; }

  await store.endTurn();
  gs = useGameStore.getState().gameState!;

  // If an encounter was drawn, resolve it like the UI would
  let guard = 0;
  while (gs.pendingEncounter && guard++ < 20) {
    // advance resolution until complete/idle
    let inner = 0;
    while (gs.cardResolution && gs.cardResolution.phase !== 'complete' && gs.cardResolution.phase !== 'idle' && inner++ < 20) {
      store.advanceCardResolution();
      gs = useGameStore.getState().gameState!;
    }
    store.dismissCardResolution();
    gs = useGameStore.getState().gameState!;
  }

  turns++;
  const ok = checkLookup(`turn ${t + 1} (current=${gs.currentHeroId})`);
  if (ok) console.log(`turn ${t + 1}: OK (${gs.currentHeroId}, heroes=${gs.heroes.length})`);
}

console.log(`\n${turns} turns played, ${failures} lookup failures`);
console.log(failures === 0 ? 'VERIFY: PASS' : 'VERIFY: FAIL');
