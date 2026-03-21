import React, { useState, useMemo } from 'react';
import { DataLoader } from '../../game/dataLoader';
import { Hero, Scenario } from '../../game/types';

interface ScenarioSetupScreenProps {
  onBack: () => void;
  onStart: (scenarioId: string, heroIds: string[]) => void;
}

export const ScenarioSetupScreen: React.FC<ScenarioSetupScreenProps> = ({ onBack, onStart }) => {
  const dataLoader = DataLoader.getInstance();
  const allScenarios = useMemo(() => dataLoader.getScenarios(), [dataLoader]);
  const allHeroes = useMemo(() => dataLoader.getHeroes(), [dataLoader]);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(allScenarios[0]?.id || '');
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [surges, setSurges] = useState<number>(2);

  const selectedScenario = allScenarios.find(s => s.id === selectedScenarioId);

  const toggleHero = (heroId: string) => {
    setSelectedHeroIds(prev =>
      prev.includes(heroId)
        ? prev.filter(id => id !== heroId)
        : prev.length < 5 ? [...prev, heroId] : prev
    );
  };

  const isReady = selectedScenarioId && selectedHeroIds.length > 0;

  return (
    <div className="setup-screen" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      backgroundImage: 'radial-gradient(circle at center, #1a1a2e 0%, #050510 100%)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      zIndex: 3500,
      color: 'white',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div className="setup-header" style={{ textAlign: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <h1 className="gothic-title" style={{ fontSize: '2.5rem', margin: 0, color: 'var(--color-gold)' }}>Adventure Setup</h1>
        <div style={{ color: 'var(--color-text-dim)', letterSpacing: '2px' }}>Prepare Your Party for the Long Night</div>
      </div>

      <div className="setup-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(350px, 1fr) 2fr',
        gap: '20px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        flex: 1,
        minHeight: 0
      }}>

        {/* Left Column: Scenario & Settings */}
        <div className="setup-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, overflow: 'hidden' }}>

          {/* Scenario Selector */}
          <div className="setup-section gothic-panel" style={{ padding: '20px', border: '1px solid #444', flexShrink: 0 }}>
            <h3 className="gothic-title" style={{ color: 'var(--color-gold)', marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '8px', fontSize: '1.1rem' }}>Select Scenario</h3>
            <div className="scenario-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '10px' }}>
              {allScenarios.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedScenarioId(s.id)}
                  style={{
                    padding: '15px',
                    background: selectedScenarioId === s.id ? 'rgba(196, 160, 96, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${selectedScenarioId === s.id ? 'var(--color-gold)' : '#333'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: selectedScenarioId === s.id ? 'var(--color-gold)' : 'white' }}>{s.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: '5px' }}>{s.difficulty} Intensity</div>
                </div>
              ))}
            </div>

            {selectedScenario && (
              <div className="scenario-preview" style={{ marginTop: '15px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontStyle: 'italic', fontSize: '0.85rem', color: '#ccc', borderLeft: '3px solid var(--color-gold)' }}>
                "{selectedScenario.description}"
              </div>
            )}
          </div>

          {/* Game Settings */}
          <div className="setup-section gothic-panel" style={{ padding: '20px', border: '1px solid #444', flexShrink: 0 }}>
            <h3 className="gothic-title" style={{ color: 'var(--color-gold)', marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '8px', fontSize: '1.1rem' }}>Campaign Rules</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>Difficulty Spirit</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: difficulty === d ? 'var(--color-accent)' : 'transparent',
                      border: `1px solid ${difficulty === d ? 'var(--color-gold)' : '#444'}`,
                      color: difficulty === d ? 'white' : '#888',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>Healing Surges: {surges}</label>
              <input
                type="range"
                min="0"
                max="5"
                value={surges}
                onChange={(e) => setSurges(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-gold)' }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Hero Selection */}
        <div className="setup-column" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="setup-section gothic-panel" style={{ padding: '20px', border: '1px solid #444', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <h3 className="gothic-title" style={{ color: 'var(--color-gold)', marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '8px', fontSize: '1.1rem', flexShrink: 0 }}>Assembly of Heroes ({selectedHeroIds.length}/5)</h3>

            <div className="hero-selection-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '15px',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 320px)',
              paddingRight: '10px'
            }}>
              {allHeroes.map(h => {
                const isSelected = selectedHeroIds.includes(h.id);
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHero(h.id)}
                    style={{
                      position: 'relative',
                      border: `2px solid ${isSelected ? 'var(--color-gold)' : '#333'}`,
                      background: isSelected ? 'rgba(196, 160, 96, 0.1)' : 'rgba(0,0,0,0.4)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <div style={{ height: '140px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #333' }}>
                      <img
                        src={`/ui/${h.name.toLowerCase()}.png`}
                        alt={h.name}
                        style={{ height: '100%', width: '100%', objectFit: 'cover', opacity: isSelected ? 1 : 0.4 }}
                        onError={(e) => (e.currentTarget.src = '/ui/arjhan.png')}
                      />
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: isSelected ? 'var(--color-gold)' : 'white' }}>{h.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>{h.heroClass}</div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '0.7rem' }}>
                        <span>HP: <span style={{ color: 'var(--color-gold)' }}>{h.maxHp}</span></span>
                        <span>AC: <span style={{ color: 'var(--color-gold)' }}>{h.ac}</span></span>
                        <span>SPD: <span style={{ color: 'var(--color-gold)' }}>{h.speed}</span></span>
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '24px',
                        height: '24px',
                        background: 'var(--color-gold)',
                        color: 'black',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                      }}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedHeroIds.length === 0 && (
              <div style={{ marginTop: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>
                You must select at least one hero to enter the castle.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="setup-footer" style={{
        flexShrink: 0,
        paddingTop: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1400px',
        width: '100%',
        margin: '20px auto 0'
      }}>
        <button
          className="gothic-button"
          onClick={onBack}
          style={{ padding: '12px 30px', fontSize: '1rem' }}
        >
          Return to Gate
        </button>

        <div style={{ textAlign: 'right' }}>
          {!isReady && (
            <div style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '8px' }}>
              Selection incomplete
            </div>
          )}
          <button
            className="gothic-button"
            disabled={!isReady}
            onClick={() => onStart(selectedScenarioId, selectedHeroIds)}
            style={{
              padding: '12px 50px',
              fontSize: '1.1rem',
              opacity: isReady ? 1 : 0.3,
              cursor: isReady ? 'pointer' : 'not-allowed',
              boxShadow: isReady ? '0 0 20px var(--color-gold)' : 'none'
            }}
          >
            Enter the Castle
          </button>
        </div>
      </div>
    </div>
  );
};
