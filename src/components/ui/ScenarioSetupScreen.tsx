import React, { useState, useMemo } from 'react';
import { DataLoader } from '../../game/dataLoader';
import { useGameStore } from '../../store/gameStore';
import { getAllPowerCards } from '../../data/powerCardLoader';
import PowerSelectionSystem from '../../game/engine/PowerSelectionSystem';
import type { Card } from '../../game/types';

interface ScenarioSetupScreenProps {
  onBack: () => void;
  onStart: (scenarioId: string, heroIds: string[]) => void;
}

interface HeroPowerChoice {
  atWill1: string;
  atWill2: string;
  daily1: string;
  daily2: string;
  utility1: string;
  utility2: string;
}

interface CardLayout {
  height: string;
  top?: number | string;
  bottom?: number | string;
  transform: string;
  transformOrigin: string;
  isCardBack?: boolean;
}

// Map hero name → real scanned board game card image from /ui/heroes/
const HERO_CARD_SCAN: Record<string, string> = {
  arjhan:  '/ui/heroes/arjhan_card.jpg',
  alissa:  '/ui/heroes/alissa_card.jpg',
  immeril: '/ui/heroes/immeril_card.jpg',
  kat:     '/ui/heroes/kat_card.jpg',
  thorgrim:'/ui/heroes/thorgrim_card.jpg',
};

// Difficulty stars shown on each scenario card
const DIFFICULTY_STARS: Record<string, string> = {
  Easy:   '★☆☆',
  Medium: '★★☆',
  Hard:   '★★★',
};

export const ScenarioSetupScreen: React.FC<ScenarioSetupScreenProps> = ({ onBack, onStart }) => {
  const dataLoader = DataLoader.getInstance();
  const allScenarios = useMemo(() => dataLoader.getScenarios(), [dataLoader]);
  const allHeroes   = useMemo(() => dataLoader.getHeroes(),   [dataLoader]);
  const allPowerCards = useMemo(() => getAllPowerCards(), []);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(allScenarios[0]?.id || '');
  const [selectedHeroIds,    setSelectedHeroIds]    = useState<string[]>([]);
  const [surges,             setSurges]             = useState<number>(2);
  const [quickRoll,          setQuickRoll]          = useState<boolean>(false);
  const [animationSpeed,     setAnimationSpeed]     = useState<'normal' | 'fast' | 'instant'>('normal');
  const [graphicsQuality,    setGraphicsQuality]    = useState<'high' | 'medium' | 'low'>('high');
  const [zoomedHeroId,       setZoomedHeroId]       = useState<string | null>(null);

  const isSingleSided = (heroName: string): boolean => {
    return heroName.toLowerCase() === 'alissa';
  };

  const getCardLayout = (heroName: string, level: 1 | 2): CardLayout => {
    const name = heroName.toLowerCase();
    
    if (name === 'alissa') {
      return level === 1 
        ? { height: '100%', top: 0, transform: 'none', transformOrigin: 'center' }
        : { height: '100%', isCardBack: true, transform: 'none', transformOrigin: 'center' };
    }
    
    if (name === 'arjhan') {
      // Arjhan's scan is inverted: 1st Level is at the bottom, 2nd Level is at the top!
      return level === 1
        ? { height: '200%', bottom: 0, transform: 'none', transformOrigin: 'center' }
        : { height: '200%', top: 0, transform: 'rotate(180deg)', transformOrigin: '50% 25%' };
    }
    
    // Immeril, Kat, Thorgrim: 1st Level is at the top (upside down), 2nd Level is at the bottom (right-side up)
    return level === 1
      ? { height: '200%', top: 0, transform: 'rotate(180deg)', transformOrigin: '50% 25%' }
      : { height: '200%', bottom: 0, transform: 'none', transformOrigin: 'center' };
  };

  // Helper to initialize default choice
  const getDefaultPowerChoice = (heroClass: string): HeroPowerChoice => {
    const cls = heroClass.toLowerCase();
    const atWills = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'at-will');
    const dailies = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'daily');
    const utilities = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'utility');

    const choice: HeroPowerChoice = {
      atWill1: atWills[0]?.id ?? '',
      atWill2: atWills[1]?.id ?? '',
      daily1: '',
      daily2: '',
      utility1: '',
      utility2: '',
    };

    if (cls === 'fighter') {
      choice.daily1 = 'fighter_dragons_breath';
      const selectableDailies = dailies.filter(c => c.id !== 'fighter_dragons_breath');
      choice.daily2 = selectableDailies[0]?.id ?? '';
      choice.utility1 = utilities[0]?.id ?? '';
    } else if (cls === 'cleric') {
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = 'cleric_healing_word';
      const selectableUtilities = utilities.filter(c => c.id !== 'cleric_healing_word');
      choice.utility2 = selectableUtilities[0]?.id ?? '';
    } else if (cls === 'wizard') {
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = 'wizard_fey_step';
      const selectableUtilities = utilities.filter(c => c.id !== 'wizard_fey_step');
      choice.utility2 = selectableUtilities[0]?.id ?? '';
    } else if (cls === 'rogue') {
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = 'rogue_sneak_attack';
      const selectableUtilities = utilities.filter(c => c.id !== 'rogue_sneak_attack');
      choice.utility2 = selectableUtilities[0]?.id ?? '';
    } else {
      // ranger / default
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = utilities[0]?.id ?? '';
    }

    return choice;
  };

  // State to hold choices for all heroes
  const [heroChoices, setHeroChoices] = useState<Record<string, HeroPowerChoice>>(() => {
    const initial: Record<string, HeroPowerChoice> = {};
    allHeroes.forEach(h => {
      initial[h.id] = getDefaultPowerChoice(h.heroClass);
    });
    return initial;
  });

  const handleAutoSelectHero = (heroId: string, heroClass: string) => {
    const constraints = PowerSelectionSystem.getConstraints(heroClass);
    const selection = PowerSelectionSystem.autoSelectPowers(heroClass, heroId, constraints);
    
    // Map ids back to choice object
    const cls = heroClass.toLowerCase();
    const choice: HeroPowerChoice = {
      atWill1: '',
      atWill2: '',
      daily1: '',
      daily2: '',
      utility1: '',
      utility2: '',
    };
    
    const cards = selection.selectedPowerIds.map(id => allPowerCards.find(c => c.id === id)).filter(Boolean) as Card[];
    const atWills = cards.filter(c => c.powerType === 'at-will');
    const dailies = cards.filter(c => c.powerType === 'daily');
    const utilities = cards.filter(c => c.powerType === 'utility');

    choice.atWill1 = atWills[0]?.id ?? '';
    choice.atWill2 = atWills[1]?.id ?? '';

    if (cls === 'fighter') {
      choice.daily1 = 'fighter_dragons_breath';
      choice.daily2 = dailies.find(c => c.id !== 'fighter_dragons_breath')?.id ?? dailies[0]?.id ?? '';
      choice.utility1 = utilities[0]?.id ?? '';
    } else if (cls === 'cleric') {
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = 'cleric_healing_word';
      choice.utility2 = utilities.find(c => c.id !== 'cleric_healing_word')?.id ?? utilities[0]?.id ?? '';
    } else if (cls === 'wizard') {
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = 'wizard_fey_step';
      choice.utility2 = utilities.find(c => c.id !== 'wizard_fey_step')?.id ?? utilities[0]?.id ?? '';
    } else if (cls === 'rogue') {
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = 'rogue_sneak_attack';
      choice.utility2 = utilities.find(c => c.id !== 'rogue_sneak_attack')?.id ?? utilities[0]?.id ?? '';
    } else {
      choice.daily1 = dailies[0]?.id ?? '';
      choice.utility1 = utilities[0]?.id ?? '';
    }

    setHeroChoices(prev => ({ ...prev, [heroId]: choice }));
  };

  const handleAutoSelectAll = () => {
    const updated = { ...heroChoices };
    selectedHeroIds.forEach(heroId => {
      const hero = allHeroes.find(h => h.id === heroId);
      if (hero) {
        const constraints = PowerSelectionSystem.getConstraints(hero.heroClass);
        const selection = PowerSelectionSystem.autoSelectPowers(hero.heroClass, heroId, constraints);
        
        const cls = hero.heroClass.toLowerCase();
        const choice: HeroPowerChoice = {
          atWill1: '',
          atWill2: '',
          daily1: '',
          daily2: '',
          utility1: '',
          utility2: '',
        };
        
        const cards = selection.selectedPowerIds.map(id => allPowerCards.find(c => c.id === id)).filter(Boolean) as Card[];
        const atWills = cards.filter(c => c.powerType === 'at-will');
        const dailies = cards.filter(c => c.powerType === 'daily');
        const utilities = cards.filter(c => c.powerType === 'utility');

        choice.atWill1 = atWills[0]?.id ?? '';
        choice.atWill2 = atWills[1]?.id ?? '';

        if (cls === 'fighter') {
          choice.daily1 = 'fighter_dragons_breath';
          choice.daily2 = dailies.find(c => c.id !== 'fighter_dragons_breath')?.id ?? dailies[0]?.id ?? '';
          choice.utility1 = utilities[0]?.id ?? '';
        } else if (cls === 'cleric') {
          choice.daily1 = dailies[0]?.id ?? '';
          choice.utility1 = 'cleric_healing_word';
          choice.utility2 = utilities.find(c => c.id !== 'cleric_healing_word')?.id ?? utilities[0]?.id ?? '';
        } else if (cls === 'wizard') {
          choice.daily1 = dailies[0]?.id ?? '';
          choice.utility1 = 'wizard_fey_step';
          choice.utility2 = utilities.find(c => c.id !== 'wizard_fey_step')?.id ?? utilities[0]?.id ?? '';
        } else if (cls === 'rogue') {
          choice.daily1 = dailies[0]?.id ?? '';
          choice.utility1 = 'rogue_sneak_attack';
          choice.utility2 = utilities.find(c => c.id !== 'rogue_sneak_attack')?.id ?? utilities[0]?.id ?? '';
        } else {
          choice.daily1 = dailies[0]?.id ?? '';
          choice.utility1 = utilities[0]?.id ?? '';
        }

        updated[heroId] = choice;
      }
    });
    setHeroChoices(updated);
  };

  const updateHeroChoice = (heroId: string, key: keyof HeroPowerChoice, value: string) => {
    setHeroChoices(prev => ({
      ...prev,
      [heroId]: {
        ...prev[heroId],
        [key]: value,
      }
    }));
  };

  const selectedScenario = allScenarios.find(s => s.id === selectedScenarioId);

  const toggleHero = (heroId: string) => {
    setSelectedHeroIds(prev =>
      prev.includes(heroId)
        ? prev.filter(id => id !== heroId)
        : prev.length < 5 ? [...prev, heroId] : prev
    );
  };

  const isReady = selectedScenarioId && selectedHeroIds.length > 0;

  const handleStart = () => {
    const scaleMap = { low: 0.5, medium: 0.75, high: 1.0 };
    const store = useGameStore.getState();

    // 1. Update settings
    store.updateSettings({
      quickRoll,
      animationSpeed,
      graphicsQuality,
      resolutionScale: scaleMap[graphicsQuality],
    });

    // 2. Start the game (initializes phase to 'setup')
    onStart(selectedScenarioId, selectedHeroIds);

    // 3. Sequentially select and confirm powers for each hero
    selectedHeroIds.forEach(heroId => {
      const hero = allHeroes.find(h => h.id === heroId);
      if (!hero) return;

      const choice = heroChoices[heroId];
      if (!choice) return;

      // Flatten selection ids
      const powerIds = [
        choice.atWill1,
        choice.atWill2,
        choice.daily1,
        choice.daily2,
        choice.utility1,
        choice.utility2,
      ].filter(Boolean);

      // Select each power in the store
      powerIds.forEach(powerId => {
        const card = allPowerCards.find(c => c.id === powerId);
        if (card) {
          store.selectPower(heroId, card);
        }
      });

      // Confirm the selections
      store.confirmHeroSelection(heroId);
    });

    // 4. Transition the store to 'hero' phase to play!
    store.beginAdventure();
  };

  return (
    <div
      className="setup-screen"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.97)',
        backgroundImage: 'radial-gradient(circle at center, #1a1a2e 0%, #050510 100%)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 3500,
        color: 'white',
        fontFamily: 'var(--font-body)',
        overflow: 'hidden',     // prevent the whole page from scrolling
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center',
        padding: '18px 20px 12px',
        flexShrink: 0,
        borderBottom: '1px solid #222',
      }}>
        <h1 className="gothic-title" style={{ fontSize: '2.2rem', margin: 0, color: 'var(--color-gold)' }}>
          Adventure Setup
        </h1>
        <div style={{ color: 'var(--color-text-dim)', letterSpacing: '2px', fontSize: '0.85rem', marginTop: '4px' }}>
          Prepare Your Party for the Long Night
        </div>
      </div>

      {/* ── Body (scrollable) ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="custom-scrollbar">
        <div
          className="setup-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 380px) 1fr',
            gap: '20px',
            maxWidth: '1400px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* ── Left Column: Scenario & Settings ────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Scenario Selector */}
            <div className="setup-section gothic-panel" style={{ padding: '20px', border: '1px solid #444' }}>
              <h3 className="gothic-title" style={{
                color: 'var(--color-gold)', marginBottom: '15px',
                borderBottom: '1px solid #444', paddingBottom: '8px', fontSize: '1.1rem',
              }}>
                Select Scenario
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allScenarios.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedScenarioId(s.id)}
                    style={{
                      padding: '12px 15px',
                      background: selectedScenarioId === s.id ? 'rgba(196, 160, 96, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${selectedScenarioId === s.id ? 'var(--color-gold)' : '#333'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: selectedScenarioId === s.id ? 'var(--color-gold)' : 'white', fontSize: '0.9rem' }}>
                      {s.name}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: s.difficulty === 'Hard' ? '#e05' : s.difficulty === 'Medium' ? '#c90' : '#7a7',
                      letterSpacing: '1px',
                      flexShrink: 0,
                    }}>
                      {DIFFICULTY_STARS[s.difficulty] ?? s.difficulty}
                    </div>
                  </div>
                ))}
              </div>

              {selectedScenario && (
                <div style={{
                  marginTop: '14px', padding: '12px',
                  background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
                  fontStyle: 'italic', fontSize: '0.82rem', color: '#ccc',
                  borderLeft: '3px solid var(--color-gold)',
                  lineHeight: '1.5',
                }}>
                  "{selectedScenario.description}"
                </div>
              )}
            </div>

            {/* Game Settings */}
            <div className="setup-section gothic-panel" style={{ padding: '20px', border: '1px solid #444' }}>
              <h3 className="gothic-title" style={{
                color: 'var(--color-gold)', marginBottom: '15px',
                borderBottom: '1px solid #444', paddingBottom: '8px', fontSize: '1.1rem',
              }}>
                Campaign Rules
              </h3>

              {/* Healing Surges */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
                    Healing Surges
                  </label>
                  <span style={{ color: 'var(--color-gold)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {surges}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={surges}
                  onChange={(e) => setSurges(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-gold)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#555', marginTop: '2px' }}>
                  <span>0 — No Surges</span>
                  <span>5 — Very Generous</span>
                </div>
              </div>

              {/* Pacing Speed */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
                  Pacing Speed
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['normal', 'fast', 'instant'] as const).map(speed => (
                    <button
                      key={speed}
                      onClick={() => setAnimationSpeed(speed)}
                      style={{
                        flex: 1, padding: '8px',
                        background: animationSpeed === speed ? 'var(--color-accent)' : 'transparent',
                        border: `1px solid ${animationSpeed === speed ? 'var(--color-gold)' : '#444'}`,
                        color: animationSpeed === speed ? 'white' : '#888',
                        cursor: 'pointer', fontSize: '0.78rem',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>

              {/* Graphics Quality */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
                  Graphics Quality
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['low', 'medium', 'high'] as const).map(quality => (
                    <button
                      key={quality}
                      onClick={() => setGraphicsQuality(quality)}
                      style={{
                        flex: 1, padding: '8px',
                        background: graphicsQuality === quality ? 'var(--color-accent)' : 'transparent',
                        border: `1px solid ${graphicsQuality === quality ? 'var(--color-gold)' : '#444'}`,
                        color: graphicsQuality === quality ? 'white' : '#888',
                        cursor: 'pointer', fontSize: '0.78rem',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {quality}
                    </button>
                  ))}
                </div>
              </div>

              {/* Snappy Dice Rolls */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: '1px solid #333', paddingTop: '14px',
              }}>
                <div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--color-text-dim)' }}>Snappy Dice Rolls</div>
                  <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '2px', fontStyle: 'italic' }}>
                    Skips 3D physics — shows results instantly
                  </div>
                </div>
                <button
                  onClick={() => setQuickRoll(v => !v)}
                  style={{
                    width: '48px', height: '24px',
                    borderRadius: '12px',
                    background: quickRoll ? 'var(--color-accent)' : '#222',
                    border: '1px solid var(--color-gold)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.25s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '16px', height: '16px',
                    borderRadius: '50%',
                    background: 'var(--color-gold)',
                    position: 'absolute',
                    top: '3px',
                    left: quickRoll ? '27px' : '3px',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Column: Hero Selection ─────────────────────────── */}
          <div className="setup-section gothic-panel" style={{ padding: '20px', border: '1px solid #444' }}>
            <h3 className="gothic-title" style={{
              color: 'var(--color-gold)', marginBottom: '15px',
              borderBottom: '1px solid #444', paddingBottom: '8px', fontSize: '1.1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>
                Assembly of Heroes
                <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '10px' }}>
                  ({selectedHeroIds.length} / 5 selected)
                </span>
              </span>
              {selectedHeroIds.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAutoSelectAll();
                  }}
                  className="gothic-button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    background: 'rgba(196, 160, 96, 0.15)',
                    border: '1px solid var(--color-gold)',
                  }}
                >
                  Auto-Select All Powers
                </button>
              )}
            </h3>

            <div
              className="hero-selection-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {allHeroes.map(h => {
                const isSelected = selectedHeroIds.includes(h.id);
                const cls = h.heroClass.toLowerCase();
                const scanUrl = HERO_CARD_SCAN[h.name.toLowerCase()] ?? `/ui/heroes/${h.name.toLowerCase()}_card.jpg`;
                
                // Get options for dropdowns
                const atWills = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'at-will');
                const dailies = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'daily');
                const utilities = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'utility');
                
                const choice = heroChoices[h.id];

                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHero(h.id)}
                    style={{
                      position: 'relative',
                      border: `2px solid ${isSelected ? 'var(--color-gold)' : '#2a2a2a'}`,
                      background: isSelected ? 'rgba(196, 160, 96, 0.04)' : 'rgba(0,0,0,0.6)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: isSelected ? '0 0 20px rgba(192,160,96,0.25)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Card Scan container */}
                    <div style={{
                      width: '100%',
                      aspectRatio: '1.25 / 1',
                      overflow: 'hidden',
                      position: 'relative',
                      background: '#111',
                    }}>
                      {(() => {
                        const layout = getCardLayout(h.name, 1);
                        return (
                          <img
                            src={scanUrl}
                            alt={h.name}
                            style={{
                              position: 'absolute',
                              width: '100%',
                              height: layout.height,
                              top: layout.top !== undefined ? layout.top : 'auto',
                              bottom: layout.bottom !== undefined ? layout.bottom : 'auto',
                              left: 0,
                              objectFit: 'cover',
                              transform: layout.transform,
                              transformOrigin: layout.transformOrigin,
                              opacity: isSelected ? 1 : 0.45,
                              transition: 'opacity 0.2s',
                            }}
                          />
                        );
                      })()}
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '8px', right: '8px',
                          width: '20px', height: '20px',
                          background: 'var(--color-gold)',
                          color: 'black',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                          boxShadow: '0 0 6px rgba(0,0,0,0.6)',
                        }}>
                          ✓
                        </div>
                      )}

                      {/* Zoom Button Overlay */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedHeroId(h.id);
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          background: 'rgba(0,0,0,0.75)',
                          border: '1px solid var(--color-gold)',
                          color: 'var(--color-gold)',
                          borderRadius: '4px',
                          padding: '3px 7px',
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.15s',
                          fontFamily: 'Outfit, sans-serif',
                          zIndex: 10,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--color-gold)';
                          e.currentTarget.style.color = '#000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(0,0,0,0.75)';
                          e.currentTarget.style.color = 'var(--color-gold)';
                        }}
                      >
                        🔍 Zoom
                      </button>
                    </div>

                    {/* Stats Strip */}
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid #222' }}>
                      <div style={{ fontWeight: 'bold', color: isSelected ? 'var(--color-gold)' : '#fff', fontSize: '0.95rem' }}>
                        {h.name} <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 'normal' }}>({h.heroClass})</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '0.68rem', color: '#aaa' }}>
                        <span>AC <span style={{ color: 'var(--color-gold)' }}>{h.ac}</span></span>
                        <span>HP <span style={{ color: 'var(--color-gold)' }}>{h.maxHp}</span></span>
                        <span>SPD <span style={{ color: 'var(--color-gold)' }}>{h.speed}</span></span>
                        <span>SURGE <span style={{ color: 'var(--color-gold)' }}>{h.surgeValue}</span></span>
                      </div>
                    </div>

                    {/* Power Choice Controls (only shown if selected) */}
                    {isSelected && choice && (
                      <div
                        onClick={(e) => e.stopPropagation()} // prevent clicking selectors from toggling active status
                        style={{
                          padding: '12px',
                          background: 'rgba(0,0,0,0.85)',
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          borderTop: '1px solid #333',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: '2px', fontWeight: 'bold' }}>
                          Select Power Deck
                        </div>

                        {/* At-Will 1 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <label style={{ fontSize: '0.65rem', color: '#888' }}>AT-WILL POWER 1</label>
                          <select
                            value={choice.atWill1}
                            onChange={(e) => updateHeroChoice(h.id, 'atWill1', e.target.value)}
                            style={{
                              background: '#111', color: '#fff', border: '1px solid #444',
                              borderRadius: '3px', padding: '4px', fontSize: '0.75rem', width: '100%',
                              fontFamily: 'Outfit, sans-serif'
                            }}
                          >
                            {atWills.map(card => (
                              <option key={card.id} value={card.id}>{card.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* At-Will 2 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <label style={{ fontSize: '0.65rem', color: '#888' }}>AT-WILL POWER 2</label>
                          <select
                            value={choice.atWill2}
                            onChange={(e) => updateHeroChoice(h.id, 'atWill2', e.target.value)}
                            style={{
                              background: '#111', color: '#fff', border: '1px solid #444',
                              borderRadius: '3px', padding: '4px', fontSize: '0.75rem', width: '100%',
                              fontFamily: 'Outfit, sans-serif'
                            }}
                          >
                            {atWills.filter(c => c.id !== choice.atWill1).map(card => (
                              <option key={card.id} value={card.id}>{card.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Daily Power(s) */}
                        {cls === 'fighter' ? (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <label style={{ fontSize: '0.65rem', color: '#888' }}>DAILY POWER 1 (RACIAL)</label>
                              <div style={{
                                background: 'rgba(196,160,96,0.1)', color: 'var(--color-gold)', border: '1px dashed var(--color-gold)',
                                borderRadius: '3px', padding: '4px 8px', fontSize: '0.72rem', fontWeight: 'bold'
                              }}>
                                Dragon's Breath (Locked)
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <label style={{ fontSize: '0.65rem', color: '#888' }}>DAILY POWER 2</label>
                              <select
                                value={choice.daily2}
                                onChange={(e) => updateHeroChoice(h.id, 'daily2', e.target.value)}
                                style={{
                                  background: '#111', color: '#fff', border: '1px solid #444',
                                  borderRadius: '3px', padding: '4px', fontSize: '0.75rem', width: '100%',
                                  fontFamily: 'Outfit, sans-serif'
                                }}
                              >
                                {dailies.filter(c => c.id !== 'fighter_dragons_breath').map(card => (
                                  <option key={card.id} value={card.id}>{card.name}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <label style={{ fontSize: '0.65rem', color: '#888' }}>DAILY POWER</label>
                            <select
                              value={choice.daily1}
                              onChange={(e) => updateHeroChoice(h.id, 'daily1', e.target.value)}
                              style={{
                                  background: '#111', color: '#fff', border: '1px solid #444',
                                  borderRadius: '3px', padding: '4px', fontSize: '0.75rem', width: '100%',
                                  fontFamily: 'Outfit, sans-serif'
                              }}
                            >
                              {dailies.map(card => (
                                <option key={card.id} value={card.id}>{card.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Utility Power(s) */}
                        {['cleric', 'wizard', 'rogue'].includes(cls) ? (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <label style={{ fontSize: '0.65rem', color: '#888' }}>UTILITY POWER 1 (CLASS)</label>
                              <div style={{
                                background: 'rgba(196,160,96,0.1)', color: 'var(--color-gold)', border: '1px dashed var(--color-gold)',
                                borderRadius: '3px', padding: '4px 8px', fontSize: '0.72rem', fontWeight: 'bold'
                              }}>
                                {cls === 'cleric' ? 'Healing Word' : cls === 'wizard' ? 'Fey Step' : 'Sneak Attack'} (Locked)
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <label style={{ fontSize: '0.65rem', color: '#888' }}>UTILITY POWER 2</label>
                              <select
                                value={choice.utility2}
                                onChange={(e) => updateHeroChoice(h.id, 'utility2', e.target.value)}
                                style={{
                                  background: '#111', color: '#fff', border: '1px solid #444',
                                  borderRadius: '3px', padding: '4px', fontSize: '0.75rem', width: '100%',
                                  fontFamily: 'Outfit, sans-serif'
                                }}
                              >
                                {utilities.filter(c => {
                                  const lockedId = cls === 'cleric' ? 'cleric_healing_word' : cls === 'wizard' ? 'wizard_fey_step' : 'rogue_sneak_attack';
                                  return c.id !== lockedId;
                                }).map(card => (
                                  <option key={card.id} value={card.id}>{card.name}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <label style={{ fontSize: '0.65rem', color: '#888' }}>UTILITY POWER</label>
                            <select
                              value={choice.utility1}
                              onChange={(e) => updateHeroChoice(h.id, 'utility1', e.target.value)}
                              style={{
                                background: '#111', color: '#fff', border: '1px solid #444',
                                borderRadius: '3px', padding: '4px', fontSize: '0.75rem', width: '100%',
                                fontFamily: 'Outfit, sans-serif'
                              }}
                            >
                              {utilities.map(card => (
                                <option key={card.id} value={card.id}>{card.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Individual Auto Select */}
                        <button
                          onClick={() => handleAutoSelectHero(h.id, h.heroClass)}
                          className="gothic-button"
                          style={{
                            marginTop: '6px',
                            padding: '6px',
                            fontSize: '0.7rem',
                            width: '100%',
                            border: '1px solid #666',
                            background: '#222',
                          }}
                        >
                          Auto-Select Powers
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedHeroIds.length === 0 && (
              <div style={{ marginTop: '20px', textAlign: 'center', color: '#555', fontStyle: 'italic', fontSize: '0.9rem' }}>
                You must select at least one hero to enter the castle.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer — always visible, never cut off ─────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: '14px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #2a2a2a',
        background: 'rgba(0,0,0,0.6)',
        gap: '20px',
      }}>
        <button
          className="gothic-button"
          onClick={onBack}
          style={{ padding: '11px 28px', fontSize: '1rem' }}
        >
          ← Return to Gate
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {!isReady && (
            <div style={{ color: '#ff4444', fontSize: '0.85rem' }}>
              {selectedHeroIds.length === 0 ? 'Select at least one hero' : 'Select a scenario'}
            </div>
          )}
          <button
            className="gothic-button"
            disabled={!isReady}
            onClick={handleStart}
            style={{
              padding: '11px 48px',
              fontSize: '1.1rem',
              opacity: isReady ? 1 : 0.3,
              cursor: isReady ? 'pointer' : 'not-allowed',
              boxShadow: isReady ? '0 0 20px rgba(192,160,96,0.5)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Enter the Castle ⚔
          </button>
        </div>
      </div>

      {/* ── Zoom Modal ───────────────────────────────────────────── */}
      {zoomedHeroId && (
        <div
          onClick={() => setZoomedHeroId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5000,
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              gap: '40px',
              maxWidth: '90%',
              maxHeight: '90%',
              animation: 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              cursor: 'default',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {/* 1st Level */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '1.2rem', color: 'var(--color-gold)', fontFamily: 'Cinzel, serif', fontWeight: 'bold', letterSpacing: '1px' }}>
                1ST LEVEL
              </div>
              <div style={{
                width: '400px',
                height: '320px',
                overflow: 'hidden',
                position: 'relative',
                borderRadius: '12px',
                border: '3px solid var(--color-gold)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
              }}>
                {(() => {
                  const layout = getCardLayout(allHeroes.find(h => h.id === zoomedHeroId)!.name, 1);
                  return (
                    <img
                      src={HERO_CARD_SCAN[allHeroes.find(h => h.id === zoomedHeroId)!.name.toLowerCase()] ?? `/ui/heroes/${allHeroes.find(h => h.id === zoomedHeroId)!.name.toLowerCase()}_card.jpg`}
                      alt="1st Level"
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: layout.height,
                        top: layout.top !== undefined ? layout.top : 'auto',
                        bottom: layout.bottom !== undefined ? layout.bottom : 'auto',
                        left: 0,
                        objectFit: 'cover',
                        transform: layout.transform,
                        transformOrigin: layout.transformOrigin,
                      }}
                    />
                  );
                })()}

                {/* Glare Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0) 65%)',
                  transform: 'translateX(-150%) translateY(-150%) rotate(45deg)',
                  animation: 'glareSweep 1.1s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                  pointerEvents: 'none',
                }} />
              </div>
            </div>

            {/* 2nd Level */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '1.2rem', color: 'var(--color-gold)', fontFamily: 'Cinzel, serif', fontWeight: 'bold', letterSpacing: '1px' }}>
                2ND LEVEL
              </div>
              <div style={{
                width: '400px',
                height: '320px',
                overflow: 'hidden',
                position: 'relative',
                borderRadius: '12px',
                border: '3px solid var(--color-gold)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                background: '#111',
              }}>
                {(() => {
                  const heroName = allHeroes.find(h => h.id === zoomedHeroId)!.name;
                  const layout = getCardLayout(heroName, 2);
                  if (layout.isCardBack) {
                    return (
                      /* Custom Card Back for Alissa */
                      <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'radial-gradient(circle, #15100a 0%, #050302 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        boxSizing: 'border-box',
                        textAlign: 'center',
                        border: '1px solid rgba(192, 160, 96, 0.2)',
                      }}>
                        <div style={{
                          fontSize: '2rem',
                          color: 'var(--color-gold)',
                          marginBottom: '12px',
                          filter: 'drop-shadow(0 0 6px rgba(192, 160, 96, 0.3))'
                        }}>
                          🛡️
                        </div>
                        <div style={{
                          fontFamily: 'Cinzel, serif',
                          color: 'var(--color-gold)',
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          marginBottom: '4px',
                          letterSpacing: '1px',
                        }}>
                          ALLISA
                        </div>
                        <div style={{
                          fontSize: '0.62rem',
                          color: '#888',
                          textTransform: 'uppercase',
                          letterSpacing: '1.5px',
                          marginBottom: '12px',
                        }}>
                          2nd Level Card
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#ccc',
                          lineHeight: '1.4',
                          fontStyle: 'italic',
                          fontFamily: 'Outfit, sans-serif',
                          maxWidth: '280px',
                        }}>
                          "You gain AC 16 | HP 10 | SPEED 6 | SURGE 5 HP.<br/>
                          When you level up, increase your Hit Points by 2, your AC by 1, and your surge value by 1."
                        </div>
                      </div>
                    );
                  }
                  return (
                    <img
                      src={HERO_CARD_SCAN[allHeroes.find(h => h.id === zoomedHeroId)!.name.toLowerCase()] ?? `/ui/heroes/${allHeroes.find(h => h.id === zoomedHeroId)!.name.toLowerCase()}_card.jpg`}
                      alt="2nd Level"
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: layout.height,
                        top: layout.top !== undefined ? layout.top : 'auto',
                        bottom: layout.bottom !== undefined ? layout.bottom : 'auto',
                        left: 0,
                        objectFit: 'cover',
                        transform: layout.transform,
                        transformOrigin: layout.transformOrigin,
                      }}
                    />
                  );
                })()}

                {/* Glare Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0) 65%)',
                  transform: 'translateX(-150%) translateY(-150%) rotate(45deg)',
                  animation: 'glareSweep 1.1s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                  pointerEvents: 'none',
                }} />
              </div>
            </div>
          </div>

          <div style={{
            position: 'absolute',
            bottom: '30px',
            color: 'var(--color-text-dim)',
            fontSize: '0.85rem',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}>
            Click anywhere to close zoom
          </div>
        </div>
      )}
    </div>
  );
};
