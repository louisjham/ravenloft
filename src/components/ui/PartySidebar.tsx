import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { Hero } from '../../game/types';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';
import { MovablePanel } from './MovablePanel';

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
    <MovablePanel
      id="party-sidebar"
      title={`PARTY (${heroes.length})`}
      icon="👥"
      defaultCollapsed={false}
      width={185}
      maxHeight="calc(70vh - 120px)"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '2px',
        width: '100%',
      }}>
        {/* Quick Party AI Mode Selector */}
        <div style={{
          display: 'flex',
          gap: '3px',
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
                padding: '5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                border: isCurrent ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                boxShadow: isCurrent ? '0 0 8px rgba(192, 160, 96, 0.3)' : 'none',
                opacity: isCurrent ? 1 : 0.7,
                background: isCurrent ? 'rgba(25, 22, 35, 0.95)' : 'rgba(12, 10, 18, 0.75)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
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
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline'
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-gothic)',
                      fontSize: '0.68rem',
                      color: isCurrent ? 'var(--color-gold)' : 'var(--color-text)',
                      fontWeight: isCurrent ? 'bold' : 'normal',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {hero.name}
                    </span>
                    <span style={{
                      fontSize: '0.62rem',
                      color: isLow ? '#ff4444' : 'var(--color-text-dim)',
                      fontWeight: 'bold'
                    }}>
                      {hero.hp}/{hero.maxHp}
                    </span>
                  </div>

                  {/* HP Bar */}
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: '#222',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    marginTop: '2px'
                  }}>
                    <div style={{
                      width: `${hpPercent}%`,
                      height: '100%',
                      background: isLow ? '#cc2222' : 'linear-gradient(90deg, #882222, #cc3333)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.58rem',
                color: 'var(--color-text-dim)',
                padding: '0 2px'
              }}>
                <span>AC: {hero.ac}</span>
                <span>Spd: {hero.speed}</span>
                <span>Surges: {gameState?.healingSurges ?? 0}</span>
                {canSurge && (
                  <button
                    onClick={() => handleHealingSurge(hero)}
                    style={{
                      background: 'rgba(80, 20, 20, 0.8)',
                      border: '1px solid #ff4444',
                      color: '#ffaaaa',
                      borderRadius: '2px',
                      fontSize: '0.55rem',
                      padding: '0 3px',
                      cursor: 'pointer'
                    }}
                    title="Use a healing surge to restore HP"
                  >
                    +Surge
                  </button>
                )}
              </div>

              {isPendingHeroApproval && (
                <button
                  onClick={() => approveAITurn()}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'bold',
                    fontSize: '0.62rem',
                    padding: '3px 5px',
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
                  ✅ Approve AI Turn
                </button>
              )}

              {isCurrent && gameState?.phase === 'hero' && (
                <div style={{ display: 'flex', gap: '3px', fontSize: '0.52rem', marginTop: '1px' }}>
                  <span style={{
                    padding: '1px 3px',
                    borderRadius: '2px',
                    background: !hero.isExhausted ? 'rgba(0, 255, 128, 0.15)' : !gameState.hasAttackedThisTurn ? 'rgba(255, 192, 0, 0.15)' : 'rgba(100, 100, 100, 0.2)',
                    color: !hero.isExhausted ? '#55ffaa' : !gameState.hasAttackedThisTurn ? '#ffcc00' : '#888',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    👟 {!hero.isExhausted ? 'Move' : !gameState.hasAttackedThisTurn ? 'Double' : 'Used'}
                  </span>
                  <span style={{
                    padding: '1px 3px',
                    borderRadius: '2px',
                    background: !gameState.hasAttackedThisTurn ? 'rgba(255, 80, 80, 0.15)' : 'rgba(100, 100, 100, 0.2)',
                    color: !gameState.hasAttackedThisTurn ? '#ff7777' : '#888',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    ⚔️ {!gameState.hasAttackedThisTurn ? 'Ready' : 'Used'}
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
    </MovablePanel>
  );
};
