import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const CardHand: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const currentHero = gameState?.heroes?.find(h => h.id === gameState?.currentHeroId);
  
  // Mock cards if hand is empty for visualization
  const hand = currentHero?.hand.length ? currentHero.hand : ['c1', 'c2', 'c3'];

  return (
    <div className="card-hand" style={{ 
      gridArea: 'bot', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'flex-end',
      paddingBottom: '20px',
      gap: '10px'
    }}>
      {hand.map((cardId, index) => (
        <div key={`${cardId}-${index}`} className="card-item gothic-panel" style={{ 
          width: '120px',
          height: '180px',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: `translateY(${gameState?.phase === 'hero' ? '0' : '40px'}) rotate(${(index - (hand.length-1)/2) * 5}deg)`,
          background: 'url(/ui/card_back.png)',
          backgroundSize: 'cover',
          border: '1px solid var(--color-gold)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '10px',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = `translateY(-50px) scale(1.2) rotate(0deg)`;
          e.currentTarget.style.zIndex = '100';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = `translateY(${gameState?.phase === 'hero' ? '0' : '40px'}) rotate(${(index - (hand.length-1)/2) * 5}deg)`;
          e.currentTarget.style.zIndex = '1';
        }}
        >
          <div className="card-name" style={{ 
            fontSize: '0.7rem', 
            fontFamily: 'var(--font-gothic)', 
            color: 'var(--color-gold)',
            background: 'rgba(0,0,0,0.8)',
            padding: '2px 4px',
            textAlign: 'center'
          }}>
            Magic Missile
          </div>
        </div>
      ))}
    </div>
  );
};
