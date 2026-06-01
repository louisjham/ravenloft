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

console.log('Starting integration tests in Node...');
runFullGameLoopTest().then(success => {
  if (success) {
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED!');
    process.exit(1);
  }
}).catch(err => {
  console.error('Error executing tests:', err);
  process.exit(1);
});
