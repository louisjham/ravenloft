import React from 'react';
import { useGameStore } from '../../store/gameStore';
import ConditionMarkers from './ConditionMarkers';

export const HeroPanel: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  
  // Individual selectors for Condition logic
  const currentHeroId = useGameStore(s => s.gameState?.currentHeroId);
  const activeConditions = useGameStore(
    s => s.gameState?.activeConditions ?? []
  );

  const currentHero = gameState?.heroes?.find(h => h.id === currentHeroId);

  if (!currentHero) return null;

  const portraitMap: Record<string, string> = {
    'Arjhan': '/ui/arjhan.png',
    'Immeril': '/ui/immeril.png',
    'Kat': '/ui/kat.png',
    'Thorgrim': '/ui/thorgrim.png',
    'Vani': '/ui/vani.png',
  };

  const hpPercentage = (currentHero.hp / currentHero.maxHp) * 100;

  return (
    <div className="hero-panel gothic-panel" style={{ gridArea: 'left', alignSelf: 'start', padding: '15px' }}>
      <div className="hero-header" style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
        <div className="hero-portrait-container" style={{ 
          width: '80px', 
          height: '80px', 
          border: '2px solid var(--color-gold)', 
          borderRadius: '50%', 
          overflow: 'hidden',
          background: '#1a1a1a'
        }}>
          <img 
            src={portraitMap[currentHero.name] || '/ui/arjhan.png'} 
            alt={currentHero.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div className="hero-info">
          <h2 className="gothic-title" style={{ margin: 0, fontSize: '1.2rem' }}>{currentHero.name}</h2>
          <div className="hero-class" style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>{currentHero.heroClass}</div>
          <div className="hero-level" style={{ color: 'var(--color-gold)', fontSize: '0.8rem', fontWeight: 'bold' }}>LVL {currentHero.level} | XP {currentHero.xp}</div>
        </div>
      </div>

      <div className="hero-conditions" style={{ marginBottom: '15px' }}>
        <ConditionMarkers 
          entityId={currentHeroId ?? ''} 
          conditions={activeConditions} 
          size="small" 
        />
      </div>

      <div className="status-bars">
        <div className="hp-bar-container" style={{ position: 'relative', height: '40px', marginBottom: '10px' }}>
          <div className="hp-label" style={{ 
            position: 'absolute', 
            width: '100%', 
            textAlign: 'center', 
            zIndex: 1, 
            lineHeight: '40px', 
            fontSize: '0.9rem', 
            fontWeight: 'bold',
            textShadow: '0 0 4px black'
          }}>
            {currentHero.hp} / {currentHero.maxHp}
          </div>
          <div className="vial-bg" style={{ 
            position: 'absolute', 
            width: '100%', 
            height: '100%', 
            background: '#222', 
            borderRadius: '20px',
            border: '2px solid #444',
            overflow: 'hidden'
          }}>
            <div className="hp-fill" style={{ 
              width: `${hpPercentage}%`, 
              height: '100%', 
              background: 'linear-gradient(to right, #8b0000, #ff0000)',
              boxShadow: '0 0 10px #ff0000 inset',
              transition: 'width 0.3s ease-out'
            }} />
          </div>
          <img src="/ui/potion_vial.png" alt="vial" style={{ 
            position: 'absolute', 
            left: '-10px', 
            top: '-5px', 
            height: '50px', 
            opacity: 0.8,
            pointerEvents: 'none'
          }} />
        </div>
      </div>

      <div className="hero-surges" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>Healing Surges:</span>
        {[...Array(gameState?.healingSurges || 0)].map((_, i) => (
          <div key={i} className="surge-orb" style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            background: 'radial-gradient(circle, #00ff00, #004400)',
            boxShadow: '0 0 5px #00ff00'
          }} />
        ))}
      </div>

      <div className="ability-minis">
        <h3 className="gothic-title" style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '5px' }}>Abilities</h3>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          {currentHero.abilities.map((abilityId) => (
            <div key={abilityId} className="ability-icon" title={abilityId} style={{ 
              width: '30px', 
              height: '40px', 
              background: 'var(--color-accent-alt)',
              border: '1px solid var(--color-gold)',
              borderRadius: '2px'
            }} />
          ))}
          {currentHero.abilities.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>No active abilities</span>}
        </div>
      </div>
    </div>
  );
};
