// Unconditionally mock localStorage for Node.js test execution
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
})();
(global as any).localStorage = mockLocalStorage;

import { runFullGameLoopTest } from './src/testing/integrationTests';
import { runBlessingMechanicsTests } from './src/testing/blessing-mechanics-tests';
import { runEncounterLoggingTests } from './src/testing/test_encounter_logging';
import { runVillainPhaseTests } from './src/testing/test-villain-phase';
import { runDiceTimeoutTests } from './src/testing/test_dice_timeout';
import { runBonePileTests } from './src/testing/test_bone_pile';

console.log('Starting integration tests in Node...');
runFullGameLoopTest().then(async success => {
  if (success) {
    try {
        await runBlessingMechanicsTests();
        await runEncounterLoggingTests();
        await runVillainPhaseTests();
        await runDiceTimeoutTests();
        await runBonePileTests();
        console.log('ALL TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (e) {
        console.error('TESTS FAILED:', e);
        process.exit(1);
    }
  } else {
    console.error('SOME TESTS FAILED!');
    process.exit(1);
  }
}).catch(err => {
  console.error('Error executing tests:', err);
  process.exit(1);
});
