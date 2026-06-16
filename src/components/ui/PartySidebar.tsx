import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { Hero } from '../../game/types';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';

export const PartySidebar: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const currentHeroId = gameState?.currentHeroId;
  const heroes = gameState?.heroes ?? [];

  if (heroes.length === 0) return null;

  const portraitMap: Record<string, string> = {
    'Arjhan': '/ui/arjhan-figure.png',
    'Immeril': '/ui/immeril-figure.png',
    'Kat': '/ui/kat-figure.png',
    'Thorgrim': '/ui/thorgrim-figure.png',
    'Alanni': '/ui/alanni-figure.png',
  };

  const handleHealingSurge = (hero: Hero) => {
    if (!gameState || gameState.healingSurges <= 0 || hero.hp >= hero.maxHp) return;
    const surgeHeal = ExperienceSystem.getSurgeValue(hero);
    const newHp = Math.min(hero.maxHp, hero.hp + surgeHeal);
    const newState = {
      ...gameState,
      healingSurges: gameState.healingSurges - 1,
      heroes: gameState.heroes.map(h =>
        h.id === hero.id ? { ...h, hp: newHp } : h
      )
    };
    useGameStore.getState().setGameState(newState);
  };

  return (
    <div className="party-sidebar" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '6px',
      width: '100%',
      pointerEvents: 'auto'
    }}>
      {heroes.map((hero) => {
        const isCurrent = hero.id === currentHeroId;
        const hpPercent = (hero.hp / hero.maxHp) * 100;
        const isLow = (hero.hp / hero.maxHp) < 0.3;
        const canSurge = isCurrent && gameState && gameState.healingSurges > 0 && hero.hp < hero.maxHp;

        return (
          <div
            key={hero.id}
            className={`hero-tile gothic-panel ${isCurrent ? 'active' : ''}`}
            style={{
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              border: isCurrent ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
              boxShadow: isCurrent ? '0 0 10px rgba(192, 160, 96, 0.2)' : 'none',
              opacity: isCurrent ? 1 : 0.6,
              transform: isCurrent ? 'translateX(6px)' : 'none',
              background: isCurrent ? 'rgba(20, 20, 30, 0.9)' : 'rgba(10, 10, 15, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '3px',
                overflow: 'hidden',
                border: '1px solid #444',
                background: '#000',
                flexShrink: 0
              }}>
                <img
                  src={portraitMap[hero.name] || '/ui/arjhan.png'}
                  alt={hero.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-gothic)',
                  color: isCurrent ? 'var(--color-gold)' : 'white',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {hero.name}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-dim)' }}>
                  LV{hero.level || 1} {hero.heroClass}
                </div>
              </div>
            </div>

            <div style={{ height: '4px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${hpPercent}%`,
                height: '100%',
                background: isLow ? '#ff4444' : 'var(--color-accent)',
                transition: 'width 0.5s ease-out',
                boxShadow: isLow ? '0 0 4px #ff0000' : 'none'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6rem', color: 'var(--color-text-dim)' }}>
              <span style={{ color: isLow ? '#ff4444' : 'white' }}>{hero.hp}/{hero.maxHp}</span>
              {canSurge && (
                <button
                  onClick={() => handleHealingSurge(hero)}
                  style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '0.55rem',
                    padding: '1px 5px',
                    background: 'rgba(0, 255, 0, 0.15)',
                    border: '1px solid rgba(0, 255, 0, 0.4)',
                    color: '#66ff66',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    lineHeight: '1.2'
                  }}
                  title={`Healing Surge (${gameState?.healingSurges} remaining)`}
                >
                  +Surge
                </button>
              )}
            </div>

            {hero.conditions && hero.conditions.length > 0 && (
              <div style={{ display: 'flex', gap: '2px', marginTop: '1px' }}>
                {hero.conditions.map((c, i) => (
                  <div
                    key={i}
                    title={c.type}
                    style={{
                      width: '5px',
                      height: '5px',
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
