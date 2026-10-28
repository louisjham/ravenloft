import { useUIStore } from '../store/uiStore';

export async function runAREntryTests(): Promise<void> {
  console.log('--- RUNNING AR ENTRY TESTS ---');

  // 1. Check initial store state
  const store = useUIStore.getState();
  console.log('1. Initial AR Entry stage:', store.arEntryStage);
  if (store.arEntryStage !== 'idle') throw new Error('Expected initial arEntryStage to be idle');
  if (store.arDirectionDismissed !== false) throw new Error('Expected arDirectionDismissed to be false');

  // 2. Cold-enter AR
  console.log('2. Simulating cold-entry into AR (setIsXRPresenting true)...');
  useUIStore.getState().setIsXRPresenting(true);
  const presentingStore = useUIStore.getState();
  console.log('   arEntryStage after cold-enter:', presentingStore.arEntryStage);
  if (presentingStore.arEntryStage !== 'loading') throw new Error('Expected arEntryStage to transition to loading on cold enter');

  // 3. Test transition to transitioning
  console.log('3. Advancing to transition beat...');
  useUIStore.getState().setAREntryStage('transitioning');
  if (useUIStore.getState().arEntryStage !== 'transitioning') throw new Error('Expected arEntryStage to be transitioning');

  // 4. Test transition to guidance
  console.log('4. Advancing to first-time guidance step...');
  useUIStore.getState().setAREntryStage('guidance');
  if (useUIStore.getState().arEntryStage !== 'guidance') throw new Error('Expected arEntryStage to be guidance');

  // 5. Test direction dismissal
  console.log('5. Testing direction dismissal...');
  useUIStore.getState().dismissARDirection();
  if (useUIStore.getState().arDirectionDismissed !== true) throw new Error('Expected arDirectionDismissed to be true');

  // 6. Test reset on session end
  console.log('6. Testing reset on session end...');
  useUIStore.getState().setIsXRPresenting(false);
  if (useUIStore.getState().arEntryStage !== 'idle') throw new Error('Expected arEntryStage to reset to idle on session exit');

  console.log('ALL AR ENTRY STATE MACHINE TESTS PASSED!');
}
