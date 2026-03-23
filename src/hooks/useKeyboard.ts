import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'

export const useKeyboard = () => {
  const { isPaused, pauseGame, unpauseGame, endTurn, gameState } = useGameStore()
  const { showModal, activeModal, hideModal } = useUIStore()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global shortcuts
      if (event.key === 'Escape') {
        if (activeModal !== 'none') {
          hideModal();
        } else if (!isPaused) {
          pauseGame();
          showModal('settings');
        } else {
          unpauseGame();
          hideModal();
        }
      }

      // Game state dependent shortcuts
      if (isPaused || activeModal !== 'none') return;

      const { showTilePlacer, rotatePendingTile, closeTilePlacer } = useUIStore.getState();

      if (showTilePlacer) {
        if (event.key.toLowerCase() === 'r') {
          rotatePendingTile();
          return;
        } else if (event.key === 'Escape') {
          // Trigger cancel event
          window.dispatchEvent(new CustomEvent('cancel-tile-placement'));
          return;
        } else if (event.key === 'Enter') {
          // Trigger confirm event
          window.dispatchEvent(new CustomEvent('confirm-tile-placement'));
          return;
        }
      }

      switch (event.key.toLowerCase()) {
        case 't':
          if (gameState?.phase === 'hero') {
            endTurn();
          }
          break;
        case 'm':
          // Shortcut for Move action
          console.log('Move shortcut');
          break;
        case 'a':
          // Shortcut for Attack action
          console.log('Attack shortcut');
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          // Select ability shortcuts
          console.log('Select ability:', event.key);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, pauseGame, unpauseGame, endTurn, gameState, activeModal, showModal, hideModal]);
}
