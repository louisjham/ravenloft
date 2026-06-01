import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Objective } from '../../game/types';

export const ScenarioPanel: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const scenario = gameState?.activeScenario;
  const [collapsed, setCollapsed] = useState(true);

  if (!scenario) return null;

  return (
    <div className="scenario-panel" style={{
      background: 'rgba(5, 5, 10, 0.5)',
      border: '1px solid rgba(192, 160, 96, 0.2)',
      borderRadius: '3px',
      padding: collapsed ? '4px 8px' : '8px',
      backdropFilter: 'blur(4px)',
      cursor: 'pointer',
      userSelect: 'none'
    }} onClick={() => setCollapsed(!collapsed)}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px'
      }}>
        <h3 style={{
          fontFamily: 'var(--font-gothic)',
          fontSize: collapsed ? '0.65rem' : '0.75rem',
          margin: 0,
          color: 'var(--color-gold)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {scenario.name}
        </h3>
        <span style={{
          fontSize: '0.6rem',
          color: 'rgba(192, 160, 96, 0.6)',
          transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '8px' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', margin: '0 0 8px 0', fontStyle: 'italic' }}>
            {scenario.description}
          </p>

          <div className="objectives">
            <h4 style={{ fontSize: '0.6rem', fontFamily: 'var(--font-gothic)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2px', margin: '0 0 4px 0', color: 'rgba(255,255,255,0.6)' }}>
              Objectives
            </h4>
            <ul style={{ listStyleType: 'none', paddingLeft: '2px', margin: '4px 0', fontSize: '0.65rem' }}>
              {scenario.objectives?.map((obj: Objective, i: number) => {
                const isCompleted = obj.isCompleted;
                let progressDetail = null;

                if (obj.type === 'clear_chapel_monsters') {
                  if (gameState.chapelRevealed) {
                    const guardIds = obj.targetIds || [];
                    const aliveGuards = gameState.monsters.filter(m => guardIds.includes(m.id) && m.hp > 0 && !m.isDefeated);
                    const totalGuards = guardIds.length;
                    progressDetail = (
                      <span style={{ fontSize: '0.6rem', color: aliveGuards.length === 0 ? 'var(--color-gold)' : '#ff5555', marginLeft: '4px' }}>
                        ({aliveGuards.length}/{totalGuards})
                      </span>
                    );
                  } else {
                    progressDetail = (
                      <span style={{ fontSize: '0.6rem', color: 'var(--color-text-dim)', marginLeft: '4px', fontStyle: 'italic' }}>
                        (hidden)
                      </span>
                    );
                  }
                } else if (obj.type === 'possess_icon') {
                  const hasIcon = gameState.heroes.some(h => h.items.includes('treasure_icon_ravenloft'));
                  progressDetail = (
                    <span style={{ fontSize: '0.6rem', color: hasIcon ? '#44ff44' : 'var(--color-text-dim)', marginLeft: '4px', fontStyle: 'italic' }}>
                      ({hasIcon ? '✓' : '✗'})
                    </span>
                  );
                } else if (obj.type === 'defeat_klak') {
                  const klak = gameState.monsters.find(m => m.id.startsWith('monster_klak'));
                  const isDefeated = !klak || klak.hp <= 0 || klak.isDefeated;
                  progressDetail = (
                    <span style={{ fontSize: '0.6rem', color: isDefeated ? '#44ff44' : '#ff5555', marginLeft: '4px', fontStyle: 'italic' }}>
                      ({isDefeated ? '✓' : '✗'})
                    </span>
                  );
                } else if (obj.type === 'destroy_artifact') {
                  const artifact = gameState.monsters.find(m => m.id.startsWith('monster_klaks_artifact'));
                  const isDestroyed = !artifact || artifact.hp <= 0 || artifact.isDefeated;
                  progressDetail = (
                    <span style={{ fontSize: '0.6rem', color: isDestroyed ? '#44ff44' : '#ff5555', marginLeft: '4px', fontStyle: 'italic' }}>
                      ({isDestroyed ? '✓' : '✗'})
                    </span>
                  );
                }

                return (
                  <li
                    key={i}
                    style={{
                      marginBottom: '3px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '4px',
                      color: isCompleted ? 'var(--color-text-dim)' : 'var(--color-text)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      lineHeight: '1.2'
                    }}
                  >
                    <span style={{
                      color: isCompleted ? '#44ff44' : 'var(--color-gold)',
                      fontSize: '0.65rem'
                    }}>
                      {isCompleted ? '✓' : '✧'}
                    </span>
                    <span>
                      {obj.description}
                      {progressDetail}
                    </span>
                  </li>
                );
              })}
              {(!scenario.objectives || scenario.objectives.length === 0) && <li>Find the Icon of Ravenloft</li>}
            </ul>
          </div>

          {gameState.timeTrack && (
            <div className="time-track" style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
              <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-gothic)', marginBottom: '4px', color: 'rgba(255,255,255,0.6)' }}>
                Time {gameState.strahdAwakened && <span style={{ color: '#ff4444' }}>[SUN SET]</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}>
                {Array.from({ length: gameState.timeTrack.max }).map((_, idx) => {
                  const nodeNum = idx + 1;
                  const isFilled = nodeNum <= (gameState.timeTrack?.current || 0);
                  const isLast = nodeNum === gameState.timeTrack?.max;
                  let color = 'rgba(255, 255, 255, 0.05)';
                  let border = '1px solid #444';
                  let shadow = 'none';
                  if (isFilled) {
                    if (isLast) { color = '#ff3333'; border = '1px solid #ff0000'; shadow = '0 0 6px #ff3333'; }
                    else { color = '#f5b041'; border = '1px solid #d35400'; shadow = '0 0 4px #f5b041'; }
                  }
                  return (
                    <div key={idx} style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: color, border, boxShadow: shadow,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.5rem', fontWeight: 'bold',
                      color: isFilled ? (isLast ? 'white' : 'black') : 'var(--color-text-dim)',
                      transition: 'all 0.4s ease'
                    }} title={isLast ? "Sunset" : `Hour ${nodeNum}`}>
                      {isLast ? '🦇' : nodeNum}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{
            marginTop: '6px',
            fontSize: '0.6rem',
            color: 'rgba(192, 160, 96, 0.6)',
            textAlign: 'right'
          }}>
            Surges: {gameState.healingSurges}
          </div>
        </div>
      )}
    </div>
  );
};
