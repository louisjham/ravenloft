import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

export const TRANSITION_DURATION_MS = 1500;

export function useGameTransition() {
  const startNewGame = useGameStore((state) => state.startNewGame);
  const isTransitioning = useUIStore((state) => state.isTransitioning);
  const startTransition = useUIStore((state) => state.startTransition);
  const endTransition = useUIStore((state) => state.endTransition);
  const hideModal = useUIStore((state) => state.hideModal);

  const handleStartGame = useCallback((scenarioId: string, heroIds: string[]) => {
    console.log('[DEBUG] App.handleStartGame: Called with', scenarioId, heroIds);
    startTransition();
    startNewGame(scenarioId, heroIds);
    hideModal();
    setTimeout(() => endTransition(), TRANSITION_DURATION_MS);
  }, [startTransition, startNewGame, hideModal, endTransition]);

  return {
    isTransitioning,
    handleStartGame,
  };
}
