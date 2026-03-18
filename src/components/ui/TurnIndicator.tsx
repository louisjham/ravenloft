import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const TurnIndicator: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);

  if (!gameState) return null;

  const getPhaseName = () => {
    switch (gameState.phase) {
      case 'hero': return 'Hero Phase';
      case 'exploration': return 'Exploration Phase';
      case 'monster': return 'Monster Phase';
      default: return 'Setup Phase';
    }
  };

  const currentHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);

  return (
    <div className="turn-indicator" style={{ 
      gridArea: 'top', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px'
    }}>
      <div className="phase-badge gothic-panel" style={{ 
        padding: '5px 20px', 
        fontSize: '1rem', 
        color: 'var(--color-gold)',
        borderBottom: '2px solid var(--color-accent)'
      }}>
        {getPhaseName()}
      </div>
      <div className="active-turn gothic-title" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
        Currently Acting: <span style={{ color: 'white' }}>{gameState.phase === 'monster' ? 'The Monsters' : currentHero?.name}</span>
      </div>
      
      <div className="turn-order" style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
        {gameState.turnOrder.map((id) => (
          <div key={id} className={`order-tag ${id === gameState.currentHeroId ? 'active' : ''}`} style={{ 
            width: '24px', 
            height: '24px', 
            borderRadius: '50%', 
            background: id === gameState.currentHeroId ? 'var(--color-accent)' : '#222',
            border: '1px solid var(--color-gold)',
            fontSize: '0.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: id === gameState.currentHeroId ? 1 : 0.4
          }}>
            {id.startsWith('h') ? 'H' : 'M'}
          </div>
        ))}
      </div>
    </div>
  );
};
