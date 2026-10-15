import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const TurnIndicator: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);

  if (!gameState) return null;

  const isVillainPhase = gameState.phase === 'villain' || gameState.phase === 'monster';

  const getPhaseName = () => {
    switch (gameState.phase) {
      case 'hero': return 'Hero Phase';
      case 'exploration': return 'Exploration Phase';
      case 'villain': return 'Villain Phase';
      case 'monster': return 'Villain Phase';
      default: return 'Setup Phase';
    }
  };

  const currentHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);

  return (
    <div className="turn-indicator" style={{
      gridArea: 'top',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px'
    }}>
      <div className="phase-badge" style={{
        padding: '3px 14px',
        fontSize: '0.75rem',
        color: isVillainPhase ? '#ff4444' : 'var(--color-gold)',
        background: isVillainPhase ? 'rgba(139, 0, 0, 0.6)' : 'rgba(5, 5, 10, 0.5)',
        border: isVillainPhase ? '1px solid #ff4444' : '1px solid rgba(192, 160, 96, 0.3)',
        borderRadius: '3px',
        fontFamily: 'var(--font-gothic)',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        backdropFilter: 'blur(4px)',
        boxShadow: isVillainPhase ? '0 0 10px rgba(255, 0, 0, 0.4)' : 'none'
      }}>
        {getPhaseName()}
      </div>
      <div style={{ fontSize: '0.65rem', color: isVillainPhase ? '#ffbbbb' : 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)' }}>
        {isVillainPhase ? 'Monsters & Traps' : currentHero?.name}
      </div>
      <div className="turn-order" style={{ display: 'flex', gap: '3px' }}>
        {gameState.turnOrder.map((id) => (
          <div key={id} style={{
            width: '16px', height: '16px', borderRadius: '50%',
            background: id === gameState.currentHeroId ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(192, 160, 96, 0.3)',
            fontSize: '0.45rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: id === gameState.currentHeroId ? 1 : 0.4,
            color: id === gameState.currentHeroId ? '#fff' : 'rgba(255,255,255,0.5)'
          }}>
            {id.startsWith('h') ? 'H' : 'M'}
          </div>
        ))}
      </div>
    </div>
  );
};
