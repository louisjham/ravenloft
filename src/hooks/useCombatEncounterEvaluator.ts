import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * Hook that listens to hero and monster updates in the game state
 * and triggers the combat encounter evaluation to automatically
 * enter or exit Combat Mode.
 */
export function useCombatEncounterEvaluator() {
  useEffect(() => {
    // We subscribe to the store directly to avoid causing re-renders
    // of the component that mounts this hook (e.g., App or GameController)
    const unsubscribe = useGameStore.subscribe(
      (state) => ({
        heroes: state.gameState?.heroes,
        monsters: state.gameState?.monsters,
        phase: state.gameState?.phase
      }),
      (currentState, previousState) => {
        // Skip evaluation if the game hasn't started or is over
        if (!currentState.phase || currentState.phase === 'setup' || currentState.phase === 'victory' || currentState.phase === 'defeat') {
          return;
        }

        // Only evaluate if heroes or monsters actually changed reference
        // (which happens on move, damage, spawn, defeat, etc.)
        if (
          currentState.heroes !== previousState.heroes ||
          currentState.monsters !== previousState.monsters
        ) {
          useGameStore.getState().evaluateCombatEncounter();
        }
      },
      {
        // Simple equality check since Zustand creates new array refs on updates
        equalityFn: (a, b) => a.heroes === b.heroes && a.monsters === b.monsters && a.phase === b.phase
      }
    );

    return () => unsubscribe();
  }, []);
}
