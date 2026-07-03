import React, { useMemo } from 'react';
import { SaveSystem } from '../../game/progression/SaveSystem';

interface HallOfHeroesOverlayProps {
  onClose: () => void;
}

// All scenarios in the game — used to check completion status
const ALL_SCENARIOS = [
  { id: 'scenario_escape_the_tomb',      name: 'Escape the Tomb',                adventure: 1 },
  { id: 'scenario_find_the_icon',        name: 'Find the Icon of Ravenloft',     adventure: 2 },
  { id: 'scenario_klaks_artifact',       name: "Klak's Infernal Artifact",       adventure: 3 },
  { id: 'scenario_daylight_assault',     name: 'Daylight Assault',               adventure: 4 },
  { id: 'scenario_final_transformation', name: 'The Final Transformation',       adventure: 5 },
  { id: 'scenario_destroy_dracolich',    name: 'Destroy the Dracolich',          adventure: 6 },
  { id: 'scenario_find_strahds_coffin',  name: "Find Strahd's Coffin",           adventure: 0 },
];

export const HallOfHeroesOverlay: React.FC<HallOfHeroesOverlayProps> = ({ onClose }) => {
  const completedCount = useMemo(
    () => ALL_SCENARIOS.filter((s) => SaveSystem.isCompleted(s.id)).length,
    []
  );

  const saves = useMemo(() => Object.values(SaveSystem.getSaves()), []);

  // Unique hero names seen across all saves
  const heroRoster = useMemo(() => {
    const names = new Set<string>();
    saves.forEach((slot) => slot.heroNames.forEach((n) => names.add(n)));
    return [...names];
  }, [saves]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        className="gothic-panel"
        style={{
          width: '600px', maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          border: '2px solid var(--color-gold)',
          boxShadow: '0 0 60px rgba(192,160,96,0.3)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 16px',
          borderBottom: '1px solid #500',
          background: 'rgba(0,0,0,0.6)',
        }}>
          <h2 className="gothic-title" style={{
            margin: 0, fontSize: '1.8rem',
            color: 'var(--color-gold)',
            textShadow: '0 0 16px rgba(192,160,96,0.5)',
          }}>
            🏆 Hall of Heroes
          </h2>
          <button
            onClick={onClose}
            className="gothic-button"
            style={{ padding: '4px 14px', fontSize: '0.8rem', letterSpacing: '1px' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '24px 28px', flex: 1 }} className="custom-scrollbar">

          {/* Summary Bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
            marginBottom: '28px',
          }}>
            {[
              { label: 'Adventures Completed', value: `${completedCount} / ${ALL_SCENARIOS.length}`, icon: '⚔️' },
              { label: 'Journeys Recorded', value: saves.length, icon: '📜' },
              { label: 'Heroes Known', value: heroRoster.length, icon: '🧙' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #3a2a10',
                borderRadius: '4px',
                padding: '14px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>{stat.icon}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-gold)' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', letterSpacing: '0.5px' }}>
                  {stat.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Adventures */}
          <h3 className="gothic-title" style={{
            fontSize: '1rem', color: 'var(--color-accent)',
            borderBottom: '1px dashed #444', paddingBottom: '6px', marginBottom: '14px',
          }}>
            Adventures
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
            {ALL_SCENARIOS.map((scenario) => {
              const done = SaveSystem.isCompleted(scenario.id);
              return (
                <div key={scenario.id} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '10px 16px',
                  background: done ? 'rgba(192,160,96,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${done ? '#5a4a20' : '#2a2a2a'}`,
                  borderRadius: '3px',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    fontSize: '1.2rem', width: '28px', textAlign: 'center', flexShrink: 0,
                  }}>
                    {done ? '✅' : '🔒'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.9rem',
                      color: done ? 'var(--color-gold)' : '#666',
                      fontWeight: done ? 'bold' : 'normal',
                    }}>
                      {scenario.adventure > 0 ? `Adventure ${scenario.adventure}: ` : 'Scenario: '}
                      {scenario.name}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 'bold',
                    color: done ? '#8c6' : '#444',
                    letterSpacing: '1px',
                  }}>
                    {done ? 'COMPLETED' : 'LOCKED'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hero Roster */}
          <h3 className="gothic-title" style={{
            fontSize: '1rem', color: 'var(--color-accent)',
            borderBottom: '1px dashed #444', paddingBottom: '6px', marginBottom: '14px',
          }}>
            Hero Roster
          </h3>
          {heroRoster.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '30px',
              color: '#555', fontStyle: 'italic', fontSize: '0.9rem',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.4 }}>⚔</div>
              No heroes recorded yet. Complete adventures to fill the Hall.
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px',
            }}>
              {heroRoster.map((name) => (
                <div key={name} style={{
                  background: 'rgba(192,160,96,0.06)',
                  border: '1px solid #4a3a18',
                  borderRadius: '4px',
                  padding: '12px 10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>🧙</div>
                  <div style={{
                    fontSize: '0.8rem', color: 'var(--color-gold)',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
