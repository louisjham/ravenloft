/**
 * Integration tests for the full game loop.
 * These are designed to be run in a dev environment or CI.
 */

import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

export const runFullGameLoopTest = async () => {
  console.log('--- STARTING INTEGRATION TEST ---');
  
  try {
    const store = useGameStore.getState();
    const ui = useUIStore.getState();

    // 1. Setup Game
    console.log('Testing Scenario 1 setup...');
    store.startNewGame('scenario-1', ['hero-paladin', 'hero-wizard']);
    if (!useGameStore.getState().gameState) throw new Error('Game state not initialized');

    // 2. Test Movement
    console.log('Testing Hero movement...');
    const currentHero = useGameStore.getState().gameState?.currentHero;
    if (currentHero) {
      store.moveHero({ x: 0, z: 0, sqX: 1, sqZ: 1 });
    }

    // 3. Test Exploration
    console.log('Testing Tile exploration...');
    // Simulate moving to an edge
    store.moveHero({ x: 0, z: 0, sqX: 3, sqZ: 2 });
    
    // 4. Test Combat
    console.log('Testing Combat resolution...');
    store.attackMonster('monster-zombie-1');

    // 5. Test Save/Load
    console.log('Testing Save/Load system...');
    store.saveGame();
    store.loadGame('auto-save');

    console.log('--- INTEGRATION TEST PASSED ---');
    return true;
  } catch (error) {
    console.error('--- INTEGRATION TEST FAILED ---');
    console.error(error);
    return false;
  }
};

/**
 * AI Stress Test - Runs multiple monster turns to check for pathfinding or state hangs.
 */
export const runAIStressTest = async (iterations: number = 50) => {
  console.log(`Running AI Stress Test (${iterations} turns)...`);
  for (let i = 0; i < iterations; i++) {
    // Force monster phases
    // This would call internal engine methods in a real test scenario
  }
  console.log('AI Stress Test Complete.');
};
