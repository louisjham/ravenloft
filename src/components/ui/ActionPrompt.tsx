import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

export const ActionPrompt: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const interactionMode = useUIStore((state) => state.interactionMode);

  if (!gameState) return null;

  const getPromptInfo = () => {
    const currentHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    const heroName = currentHero?.name || 'Hero';

    switch (gameState.phase) {
      case 'setup':
        return {
          title: '⚔️ Power Selection',
          message: 'Select your powers for each hero, then begin the adventure',
          action: 'Choose powers from the available cards',
          color: '#4a90e2'
        };

      case 'hero':
        // Check if hero has already explored this turn
        if (gameState.hasExploredThisTurn) {
          if (interactionMode === 'move') {
            return {
              title: `🎯 ${heroName}'s Turn - Moving`,
              message: 'Click a valid square to move',
              action: 'Click on the board or press [M] to cancel',
              color: '#44ff44'
            };
          } else if (interactionMode === 'attack') {
            return {
              title: `⚔️ ${heroName}'s Turn - Attacking`,
              message: 'Click a monster to attack',
              action: 'Click a monster or press [A] to cancel',
              color: '#ff4444'
            };
          } else if (interactionMode === 'ability') {
            return {
              title: `✨ ${heroName}'s Turn - Using Ability`,
              message: 'Select a power card and target',
              action: 'Choose from your hand or press [C] to cancel',
              color: '#ffaa00'
            };
          } else {
            return {
              title: `🎲 ${heroName}'s Turn`,
              message: 'Already explored this turn',
              action: 'Move, Attack, Use Ability, or End Turn',
              color: '#ffcc00'
            };
          }
        } else {
          // Hero hasn't explored yet
          if (interactionMode === 'explore') {
            return {
              title: `🗺️ ${heroName}'s Turn - Exploring`,
              message: 'Click a glowing arrow to explore a new tile',
              action: 'Click an exploration arrow or press [E] to cancel',
              color: '#00ffff'
            };
          } else if (interactionMode === 'move') {
            return {
              title: `🎯 ${heroName}'s Turn - Moving`,
              message: 'Click a valid square to move',
              action: 'Click on the board or press [M] to cancel',
              color: '#44ff44'
            };
          } else if (interactionMode === 'attack') {
            return {
              title: `⚔️ ${heroName}'s Turn - Attacking`,
              message: 'Click a monster to attack',
              action: 'Click a monster or press [A] to cancel',
              color: '#ff4444'
            };
          } else if (interactionMode === 'ability') {
            return {
              title: `✨ ${heroName}'s Turn - Using Ability`,
              message: 'Select a power card and target',
              action: 'Choose from your hand or press [C] to cancel',
              color: '#ffaa00'
            };
          } else {
            return {
              title: `🎲 ${heroName}'s Turn`,
              message: 'Take your actions',
              action: 'Explore, Move, Attack, Use Ability, or End Turn',
              color: '#ffcc00'
            };
          }
        }

      case 'exploration':
        return {
          title: '🗺️ Exploration Phase',
          message: 'Placing a new dungeon tile',
          action: 'Position the tile and confirm placement',
          color: '#00ffff'
        };

      case 'monster':
        return {
          title: '👹 Monster Phase',
          message: 'Monsters are taking their turns',
          action: 'Watch as monsters move and attack',
          color: '#ff4444'
        };

      case 'villain':
        const activeVillain = gameState.monsters.find(m => m.id === gameState.activeVillainId);
        return {
          title: `💀 Villain Phase - ${activeVillain?.name || 'Unknown'}`,
          message: 'The villain is activating',
          action: 'Resolve villain effects',
          color: '#8b0000'
        };

      default:
        return {
          title: '⏸️ Game Paused',
          message: 'Waiting for action',
          action: 'Resume the game',
          color: '#888888'
        };
    }
  };

  const prompt = getPromptInfo();

  return (
    <div 
      className="action-prompt gothic-panel"
      style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 900,
        padding: '15px 25px',
        minWidth: '400px',
        maxWidth: '600px',
        textAlign: 'center',
        background: 'rgba(10, 10, 10, 0.95)',
        border: `2px solid ${prompt.color}`,
        boxShadow: `0 0 20px ${prompt.color}40, inset 0 0 20px ${prompt.color}20`,
        animation: 'pulse-glow 2s ease-in-out infinite',
        pointerEvents: 'none'
      }}
    >
      <div 
        className="gothic-title" 
        style={{ 
          fontSize: '1.1rem', 
          marginBottom: '8px',
          color: prompt.color,
          textShadow: `0 0 10px ${prompt.color}`
        }}
      >
        {prompt.title}
      </div>
      <div 
        style={{ 
          fontSize: '0.9rem', 
          color: 'var(--color-text)',
          marginBottom: '5px',
          fontFamily: 'var(--font-body)'
        }}
      >
        {prompt.message}
      </div>
      <div 
        style={{ 
          fontSize: '0.75rem', 
          color: 'var(--color-text-dim)',
          fontStyle: 'italic',
          fontFamily: 'var(--font-body)'
        }}
      >
        {prompt.action}
      </div>
    </div>
  );
};

// Made with Bob
