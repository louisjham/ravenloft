import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { Hero } from '../../game/types';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';

export const PartySidebar: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const settings = useGameStore((state) => state.settings);
  const setAIControlMode = useGameStore((state) => state.setAIControlMode);
  const approveAITurn = useGameStore((state) => state.approveAITurn);
  const currentHeroId = gameState?.currentHeroId;
  const heroes = gameState?.heroes ?? [];

  if (heroes.length === 0) return null;

  const portraitMap: Record<string, string> = {
    'Arjhan': '/ui/arjhan-figure.png',
    'Immeril': '/ui/immeril-figure.png',
    'Kat': '/ui/kat-figure.png',
    'Thorgrim': '/ui/thorgrim-figure.png',
    'Alissa': '/ui/alissa-figure.png',
  };

  const handleHealingSurge = (hero: Hero) => {
    if (!gameState || gameState.healingSurges <= 0) return;
    const hasMummyRot = hero.conditions?.some(c => c.type === 'mummy_rot');
    if (!hasMummyRot && hero.hp >= hero.maxHp) return;

    const surgeHeal = ExperienceSystem.getSurgeValue(hero);
    const updatedConditions = hasMummyRot
      ? (hero.conditions || []).filter(c => c.type !== 'mummy_rot')
      : hero.conditions;
    const newHp = hasMummyRot ? hero.hp : Math.min(hero.maxHp, hero.hp + surgeHeal);

    const newState = {
      ...gameState,
      healingSurges: gameState.healingSurges - 1,
      heroes: gameState.heroes.map(h =>
        h.id === hero.id ? { ...h, hp: newHp, conditions: updatedConditions } : h
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
      {/* Quick Party AI Mode Selector */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '3px 4px',
        background: 'rgba(15, 15, 25, 0.85)',
        borderRadius: '4px',
        border: '1px solid #3a3a4e'
      }}>
        {[
          { id: 'solo', label: 'Solo' },
          { id: 'all_ai', label: 'All AI' },
          { id: 'manual', label: 'Manual' },
        ].map((m) => {
          const isSelected = settings?.aiControlMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setAIControlMode(m.id as any)}
              style={{
                flex: 1,
                fontSize: '0.62rem',
                fontFamily: 'var(--font-body)',
                padding: '2px 0',
                background: isSelected ? 'var(--color-accent)' : 'transparent',
                border: isSelected ? '1px solid var(--color-gold)' : '1px solid transparent',
                color: isSelected ? '#ffffff' : '#888888',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
              title={`Switch party control to ${m.label}`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {heroes.map((hero) => {
        const isCurrent = hero.id === currentHeroId;
        const hpPercent = (hero.hp / hero.maxHp) * 100;
        const isLow = (hero.hp / hero.maxHp) < 0.3;
        const canSurge = isCurrent && gameState && gameState.healingSurges > 0 && (hero.hp < hero.maxHp || hero.conditions?.some(c => c.type === 'mummy_rot'));
        const isPendingHeroApproval = gameState?.pendingAITurnApproval?.heroId === hero.id;

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
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => useGameStore.getState().toggleAutoFollow(hero.id)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.55rem',
                    padding: '1px 5px',
                    background: hero.isAutoFollow ? 'rgba(100, 150, 255, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                    border: hero.isAutoFollow ? '1px solid rgba(100, 150, 255, 0.5)' : '1px solid rgba(100, 100, 100, 0.5)',
                    color: hero.isAutoFollow ? '#88ccff' : '#aaa',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    lineHeight: '1.2'
                  }}
                  title={hero.isAutoFollow ? 'Auto-follow is ON (AI handles turn)' : 'Auto-follow is OFF (Manual control)'}
                >
                  {hero.isAutoFollow ? '🤖 Auto' : '👤 Manual'}
                </button>
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
            </div>

            {isPendingHeroApproval && (
              <button
                onClick={() => approveAITurn()}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'bold',
                  fontSize: '0.62rem',
                  padding: '4px 6px',
                  background: 'linear-gradient(135deg, rgba(20, 100, 40, 0.95), rgba(40, 160, 70, 0.95))',
                  border: '1px solid #55ffaa',
                  color: '#ffffff',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: '0 0 8px rgba(85, 255, 170, 0.6)',
                  marginTop: '2px'
                }}
              >
                ✅ Approve Turn & Advance
              </button>
            )}

            {isCurrent && gameState?.phase === 'hero' && (
              <div style={{ display: 'flex', gap: '4px', fontSize: '0.55rem', marginTop: '2px' }}>
                <span style={{
                  padding: '1px 4px',
                  borderRadius: '2px',
                  background: !hero.isExhausted ? 'rgba(0, 255, 128, 0.15)' : !gameState.hasAttackedThisTurn ? 'rgba(255, 192, 0, 0.15)' : 'rgba(100, 100, 100, 0.2)',
                  color: !hero.isExhausted ? '#55ffaa' : !gameState.hasAttackedThisTurn ? '#ffcc00' : '#888',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  👟 {!hero.isExhausted ? 'Move Ready' : !gameState.hasAttackedThisTurn ? 'Double Move' : 'Move Used'}
                </span>
                <span style={{
                  padding: '1px 4px',
                  borderRadius: '2px',
                  background: !gameState.hasAttackedThisTurn ? 'rgba(255, 80, 80, 0.15)' : 'rgba(100, 100, 100, 0.2)',
                  color: !gameState.hasAttackedThisTurn ? '#ff7777' : '#888',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  ⚔️ {!gameState.hasAttackedThisTurn ? 'Attack Ready' : 'Attack Used'}
                </span>
              </div>
            )}

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
