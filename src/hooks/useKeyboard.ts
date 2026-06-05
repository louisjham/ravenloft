import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { useTilePlacement } from '../contexts/TilePlacementContext'
import { useDiceStore } from '../store/diceStore'

export const useKeyboard = () => {
  const { isPaused, pauseGame, unpauseGame, endTurn, gameState } = useGameStore()
  const { showModal, activeModal, hideModal, setInteractionMode, interactionMode } = useUIStore()
  const { confirmPlacement, cancelPlacement } = useTilePlacement()

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
          setInteractionMode('none');
        }
      }

      // Game state dependent shortcuts
      if (isPaused || activeModal !== 'none') return;

      const { showTilePlacer, rotatePendingTile } = useUIStore.getState();

      if (showTilePlacer) {
        if (event.key.toLowerCase() === 'r') {
          rotatePendingTile();
          return;
        } else if (event.key === 'Escape') {
          // Trigger cancel event
          cancelPlacement();
          return;
        } else if (event.key === 'Enter' || event.key === ' ') {
          // Trigger confirm event
          confirmPlacement();
          return;
        }
      }

      // Action shortcuts
      if (gameState?.phase === 'hero') {
        switch (event.key.toLowerCase()) {
          case 'm':
            setInteractionMode(interactionMode === 'move' ? 'none' : 'move');
            break;
          case 'a':
            setInteractionMode(interactionMode === 'attack' ? 'none' : 'attack');
            break;
          case 'e':
            setInteractionMode(interactionMode === 'explore' ? 'none' : 'explore');
            break;
          case ' ':
            // End Turn on space if no tile is being placed AND no dice roll is waiting
            if (!showTilePlacer) {
              // We need to dynamically check the dice store here because we don't want to add it to dependencies and cause re-renders
              const isDiceActive = useDiceStore.getState().isActive();
              if (!isDiceActive) {
                endTurn();
                setInteractionMode('none');
              }
            }
            break;
          case 't':
            // Toggle treasure/end turn legacy
            endTurn();
            setInteractionMode('none');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, pauseGame, unpauseGame, endTurn, gameState, activeModal, showModal, hideModal, interactionMode, setInteractionMode]);
}
