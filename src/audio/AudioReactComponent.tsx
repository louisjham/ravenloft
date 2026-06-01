import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { MusicSystem } from './MusicSystem';
import { AudioManager } from './AudioManager';

/**
 * Headless component that reacts to game state changes to trigger audio.
 */
export const AudioReactComponent: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const musicSystem = useRef(new MusicSystem());
  
  useEffect(() => {
    if (!gameState) return;

    const isBossActive = gameState.monsters.some(m => 
      m.monsterType.toLowerCase().includes('strahd') || 
      m.monsterType.toLowerCase().includes('vampire')
    );

    musicSystem.current.updateMusicForState(gameState.phase, isBossActive);
  }, [gameState?.phase, gameState?.monsters]);

  useEffect(() => {
    // Initial ambient sound
    AudioManager.getInstance().playAmbient('dungeon_loop');
  }, []);

  return null;
};
