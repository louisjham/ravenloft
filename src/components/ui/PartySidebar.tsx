import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { Hero } from '../../game/types';

export const PartySidebar: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const currentHeroId = gameState?.currentHeroId;
  const heroes = gameState?.heroes ?? [];

  if (heroes.length === 0) return null;

  const portraitMap: Record<string, string> = {
    'Arjhan': '/ui/arjhan.png',
    'Immeril': '/ui/immeril.png',
    'Kat': '/ui/kat.png',
    'Thorgrim': '/ui/thorgrim.png',
    'Vani': '/ui/vani.png',
  };

  return (
    <div className="party-sidebar" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '10px',
      width: '180px',
      pointerEvents: 'auto'
    }}>
      {heroes.map((hero) => {
        const isCurrent = hero.id === currentHeroId;
        const hpPercent = (hero.hp / hero.maxHp) * 100;
        const isLow = (hero.hp / hero.maxHp) < 0.3;
        
        return (
          <div 
            key={hero.id} 
            className={`hero-tile gothic-panel ${isCurrent ? 'active' : ''}`}
            style={{
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              border: isCurrent ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
              boxShadow: isCurrent ? '0 0 15px rgba(192, 160, 96, 0.3)' : 'none',
              transition: 'all 0.3s ease',
              opacity: isCurrent ? 1 : 0.8,
              transform: isCurrent ? 'translateX(10px)' : 'none',
              background: isCurrent ? 'rgba(20, 20, 30, 0.95)' : 'rgba(10, 10, 15, 0.85)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #444',
                background: '#000'
              }}>
                <img 
                  src={portraitMap[hero.name] || '/ui/arjhan.png'} 
                  alt={hero.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: '0.8rem', 
                  fontFamily: 'var(--font-gothic)',
                  color: isCurrent ? 'var(--color-gold)' : 'white',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {hero.name}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>
                  Level {hero.level || 1}
                </div>
              </div>
            </div>

            {/* HP Bar */}
            <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${hpPercent}%`,
                height: '100%',
                background: isLow ? '#ff4444' : 'var(--color-accent)',
                transition: 'width 0.5s ease-out',
                boxShadow: isLow ? '0 0 5px #ff0000' : 'none'
              }} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>
              <span>HP</span>
              <span style={{ color: isLow ? '#ff4444' : 'white' }}>{hero.hp}/{hero.maxHp}</span>
            </div>

            {/* Condition Dots */}
            {hero.conditions && hero.conditions.length > 0 && (
               <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                 {hero.conditions.map((c, i) => (
                   <div 
                    key={i} 
                    title={c.type}
                    style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: 'var(--color-accent)',
                      border: '1px solid #fff3'
                    }} 
                   />
                 ))}
               </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
