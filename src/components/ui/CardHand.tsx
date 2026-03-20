import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getPowerCard } from '../../data/powerCardLoader';
import { PowerCardDisplay } from './PowerCardDisplay';
import type { Card } from '../../game/types';

export const CardHand: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const currentHero = gameState?.heroes?.find(h => h.id === gameState?.currentHeroId);

  // Mock cards if hand is empty for visualization
  const hand = currentHero?.hand.length ? currentHero.hand : ['c1', 'c2', 'c3'];

  // Power selection integration
  const selectedPowerIds = currentHero?.selectedPowerIds ?? [];

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
          transform: `translateY(${gameState?.phase === 'hero' ? '0' : '40px'}) rotate(${(index - (hand.length - 1) / 2) * 5}deg)`,
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
            e.currentTarget.style.transform = `translateY(${gameState?.phase === 'hero' ? '0' : '40px'}) rotate(${(index - (hand.length - 1) / 2) * 5}deg)`;
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
      {selectedPowerIds.length > 0 && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #444' }}>
          <div style={{ fontSize: '12px', color: '#aaa' }}>Powers</div>
          {selectedPowerIds.map(id => {
            let card: Card | null = null;
            try { card = getPowerCard(id); } catch { return null; }
            if (!card) return null;
            return (
              <PowerCardDisplay
                key={id}
                card={card}
                isSelected={false}
                isDisabled={false}
                showDetails={false}
                onSelect={() => {/* Hero power usage wired in PSS-7 Integration 2 */ }}
                onDeselect={() => { }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
