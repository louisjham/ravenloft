import { useGameStore } from '../src/store/gameStore';

// Instrument every setState to catch heroes shrinking, with stack
const origSetState = useGameStore.setState.bind(useGameStore);
(useGameStore as any).setState = (...args: any[]) => {
  const before = useGameStore.getState().gameState?.heroes.length;
  const beforeIds = useGameStore.getState().gameState?.heroes.map((h: any) => h.id);
  (origSetState as any)(...args);
  const afterState = useGameStore.getState().gameState;
  const after = afterState?.heroes.length;
  if (before !== after) {
    console.log(`\n!!! HEROES LENGTH CHANGED: ${before} -> ${after}`);
    console.log('beforeIds:', beforeIds);
    console.log('afterIds:', afterState?.heroes.map((h: any) => h.id));
    console.log('currentHeroId:', afterState?.currentHeroId);
    console.log(new Error('corruption trace').stack);
    console.log('!!!\n');
  }
};

const store = useGameStore.getState();
const heroIds = ['hero_arjhan', 'hero_immeril', 'hero_kat', 'hero_thorgrim', 'hero_alissa'];

console.log('--- startNewGame (adventure_01, 5 heroes) ---');
store.startNewGame('adventure_01', heroIds);
heroIds.forEach(hId => { store.autoSelectPowers(hId); store.confirmHeroSelection(hId); });
store.beginAdventure();
let gs = useGameStore.getState().gameState!;
console.log('heroes:', gs.heroes.length, 'turnOrder:', gs.turnOrder.length, 'current:', gs.currentHeroId);
console.log('monsters:', gs.monsters.map((m: any) => `${m.name}(${m.id}) hp=${m.hp}`));

// Spawn a test monster adjacent to Immeril so we can attack it
gs = useGameStore.getState().gameState!;
const immeril = gs.heroes.find((h: any) => h.id === 'hero_immeril')!;
const testMonster: any = {
  id: 'test_gargoyle_1',
  templateId: 'monster_gargoyle',
  name: 'Gargoyle',
  type: 'monster',
  hp: 2, maxHp: 2, ac: 14,
  position: { x: immeril.position.x, z: immeril.position.z, sqX: immeril.position.sqX + 1, sqZ: immeril.position.sqZ },
  isDefeated: false, ownedByHeroId: null, isBoss: false,
  abilities: [], conditions: [], experienceValue: 1, monsterType: 'gargoyle',
};
store.setGameState({ ...gs, monsters: [...gs.monsters, testMonster] });
console.log('spawned test gargoyle adjacent to Immeril');

// Arjhan ends turn -> villain phase -> Immeril's turn
console.log('\n--- Arjhan endTurn ---');
await store.endTurn();
gs = useGameStore.getState().gameState!;
console.log('current:', gs.currentHeroId, 'heroes:', gs.heroes.length);

// Fast-forward: set current hero to Immeril if not already
if (gs.currentHeroId !== 'hero_immeril') {
  console.log('(not Immeril turn, forcing for test)');
  store.setGameState({ ...gs, currentHeroId: 'hero_immeril' });
  gs = useGameStore.getState().gameState!;
}

// Immeril attacks the gargoyle (like the real game: 1 damage)
console.log('\n--- Immeril attackMonster ---');
await store.attackMonster('test_gargoyle_1');
gs = useGameStore.getState().gameState!;
console.log('after attack: heroes:', gs.heroes.length, 'current:', gs.currentHeroId);
console.log('gargoyle hp:', gs.monsters.find((m: any) => m.id === 'test_gargoyle_1')?.hp);

// Immeril ends turn -> villain phase -> Kat's turn
console.log('\n--- Immeril endTurn ---');
await store.endTurn();
gs = useGameStore.getState().gameState!;
console.log('after endTurn: heroes:', gs.heroes.length, 'current:', gs.currentHeroId, 'phase:', gs.phase);

const kat = gs.heroes.find((h: any) => h.id === 'hero_kat');
console.log('\nKat lookup:', kat ? `FOUND (${kat.name}, speed ${kat.speed})` : 'NOT FOUND <-- BUG');
console.log('DONE');
