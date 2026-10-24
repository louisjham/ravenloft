import { useGameStore } from '../src/store/gameStore';
import { DataLoader } from '../src/game/dataLoader';

useGameStore.getState().startNewGame('s1', ['hero_arjhan', 'hero_immeril', 'hero_alissa', 'hero_kat']);
let gs = useGameStore.getState().gameState;
console.log('After startNewGame:');
console.log('phase:', gs?.phase);
console.log('heroes count:', gs?.heroes.length);
console.log('heroes:', gs?.heroes.map(h => ({ id: h.id, name: h.name, pos: h.position })));

// Confirm powers first
gs?.heroes.forEach(h => {
  useGameStore.getState().autoSelectPowers(h.id);
});
useGameStore.getState().beginAdventure();
gs = useGameStore.getState().gameState;
console.log('\nAfter autoSelect + beginAdventure:');
console.log('phase:', gs?.phase);
console.log('heroes count:', gs?.heroes.length);
console.log('heroes:', gs?.heroes.map(h => ({ id: h.id, pos: h.position })));

// Move hero 1
useGameStore.getState().moveHero({ x: 0, z: 0, sqX: 2, sqZ: 1 });
gs = useGameStore.getState().gameState;
console.log('\nAfter moveHero:');
console.log('phase:', gs?.phase);
console.log('heroes count:', gs?.heroes.length);
console.log('heroes:', gs?.heroes.map(h => ({ id: h.id, pos: h.position, isExhausted: h.isExhausted })));
console.log('hasAttackedThisTurn:', gs?.hasAttackedThisTurn);
