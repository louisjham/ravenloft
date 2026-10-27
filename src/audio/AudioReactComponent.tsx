import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { MusicSystem } from './MusicSystem';
import { AudioManager } from './AudioManager';
import { SoundLibrary } from './SoundLibrary';

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
    const audioMgr = AudioManager.getInstance();
    audioMgr.playAmbient('dungeon_loop');

    const handleFirstGesture = () => {
      const ambient = audioMgr.getAmbientAudio();
      if (ambient && ambient.paused) {
        ambient.play().catch(e => console.warn('Ambient resume failed', e));
      }
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };

    window.addEventListener('pointerdown', handleFirstGesture);
    window.addEventListener('keydown', handleFirstGesture);

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [role="button"], .gothic-button, input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], select, .clickable')) {
        SoundLibrary.UI.click();
      }
    };

    let lastHovered: Element | null = null;
    const handleDocumentMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const hoverable = target?.closest('button, [role="button"], .gothic-button');
      if (hoverable && hoverable !== lastHovered) {
        lastHovered = hoverable;
        SoundLibrary.UI.hover();
      } else if (!hoverable) {
        lastHovered = null;
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('mouseover', handleDocumentMouseOver, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('mouseover', handleDocumentMouseOver, true);
    };
  }, []);

  return null;
};
