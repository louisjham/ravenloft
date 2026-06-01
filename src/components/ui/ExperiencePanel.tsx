import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';

export const ExperiencePanel: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const currentHeroId = gameState?.currentHeroId;
  const currentHero = gameState?.heroes.find(h => h.id === currentHeroId);
  const hideModal = useUIStore((state) => state.hideModal);
  const levelUpHero = useGameStore((state) => state.levelUpHero);

  if (!gameState || !currentHero) return null;

  const xpCount = gameState.experiencePile.length;
  const canLevelUp = ExperienceSystem.canLevelUp(gameState, currentHero);

  // Benefits summary
  const level2Benefits = [
    "+2 Max HP",
    "+1 AC (Armor Class)",
    "+1 Surge Value",
    "Choose a new Daily Power (if applicable)",
    "Gain Critical Hit ability"
  ];

  return (
    <div className="experience-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      fontFamily: 'Cinzel, serif'
    }}>
      <div className="experience-panel gothic-panel" style={{
        width: '500px',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        position: 'relative'
      }}>
        <button 
          onClick={hideModal}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            color: 'var(--color-gold)',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          &times;
        </button>

        <h2 className="gothic-title" style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '10px' }}>
          Experience Spending
        </h2>

        <div className="xp-status" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '20px',
          padding: '20px',
          background: 'rgba(212, 175, 55, 0.05)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: '8px'
        }}>
          <div className="xp-pile" style={{ display: 'flex', gap: '4px' }}>
            {[...Array(xpCount)].map((_, i) => (
              <div key={i} style={{
                width: '15px',
                height: '25px',
                background: 'var(--color-gold)',
                border: '1px solid #000',
                boxShadow: '0 0 5px var(--color-gold)',
                borderRadius: '2px'
              }} />
            ))}
            {xpCount === 0 && <span style={{ color: 'var(--color-text-dim)' }}>No Experience Cards</span>}
          </div>
          <div style={{ fontSize: '1.2rem', color: 'var(--color-gold)', fontWeight: 'bold' }}>
            {xpCount} XP
          </div>
        </div>

        <div className="spending-options" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Level Up Section */}
          <div className="option-section" style={{
            border: '1px solid #333',
            padding: '15px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 className="gothic-title" style={{ margin: 0, fontSize: '1.2rem' }}>Level Up</h3>
              <div style={{ fontSize: '0.9rem', color: canLevelUp ? 'var(--color-gold)' : '#666' }}>
                Cost: 5 XP
              </div>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)', marginBottom: '15px' }}>
              Requires a Natural 20 on an attack roll or trap disable (currently simplified).
            </p>

            <ul style={{ fontSize: '0.85rem', color: '#ccc', paddingLeft: '20px', marginBottom: '15px' }}>
              {level2Benefits.map((b, i) => <li key={i}>{b}</li>)}
            </ul>

            <button
              className="gothic-button"
              disabled={!canLevelUp}
              onClick={() => {
                levelUpHero(currentHero.id);
                // hideModal(); // Keep open to see effect? Or close?
              }}
              style={{
                width: '100%',
                padding: '10px',
                opacity: canLevelUp ? 1 : 0.5,
                background: canLevelUp ? 'linear-gradient(to bottom, #d4af37, #8a6d3b)' : '#333',
                color: canLevelUp ? '#000' : '#888'
              }}
            >
              Raise to Level 2
            </button>
          </div>

          {/* Cancellation Info */}
          <div className="option-section" style={{
            border: '1px solid #333',
            padding: '15px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.3)'
          }}>
            <h3 className="gothic-title" style={{ margin: 0, fontSize: '1.2rem', marginBottom: '5px' }}>Encounter Cancellation</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
              You can spend 5 XP to cancel an Encounter card when it is drawn. This option appears during the Encounter phase.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: '10px' }}>
          XP is shared by the entire party.
        </div>
      </div>
    </div>
  );
};
