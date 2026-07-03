import React, { useState } from 'react';
import { LoadJourneyOverlay } from './LoadJourneyOverlay';
import { HallOfHeroesOverlay } from './HallOfHeroesOverlay';
import { OptionsOverlay } from './OptionsOverlay';

interface MainMenuProps {
  onStart: () => void;
  onGameLoaded?: () => void;
}

type MenuOverlay = 'none' | 'load' | 'hall' | 'options';

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, onGameLoaded }) => {
  const [overlay, setOverlay] = useState<MenuOverlay>('none');

  const handleGameLoaded = () => {
    setOverlay('none');
    // If the parent provided an onGameLoaded callback (e.g. to switch to in-game view), call it.
    // Otherwise the game store already has the new gameState set, which the parent will detect.
    if (onGameLoaded) onGameLoaded();
  };

  return (
    <>
      {/* Main Menu backdrop */}
      <div
        className="main-menu"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(/ui/boxast.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 3000,
          color: 'white',
        }}
      >
        <div className="title-area" style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1
            className="gothic-title"
            style={{
              fontSize: '5rem',
              margin: 0,
              textShadow: '0 0 20px var(--color-accent), 0 0 40px black',
            }}
          >
            Castle Ravenloft
          </h1>
          <div
            style={{
              fontSize: '1.2rem',
              fontFamily: 'var(--font-accent)',
              color: 'var(--color-gold)',
              letterSpacing: '4px',
            }}
          >
            A 3D Board Game Adaptation
          </div>
        </div>

        <div
          className="menu-box gothic-panel"
          style={{
            width: '350px',
            padding: '40px',
            background: 'rgba(5, 5, 10, 0.8)',
            border: '1px solid var(--color-gold)',
          }}
        >
          <div className="menu-options" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Begin Adventure */}
            <button
              id="menu-begin-adventure"
              className="gothic-button"
              style={{ fontSize: '1.4rem', padding: '15px' }}
              onClick={() => {
                console.log('[DEBUG] MainMenu: Begin Adventure clicked');
                onStart();
              }}
            >
              Begin Adventure
            </button>

            {/* Load Journey */}
            <button
              id="menu-load-journey"
              className="gothic-button"
              style={{ fontSize: '1.4rem', padding: '15px' }}
              onClick={() => setOverlay('load')}
            >
              Load Journey
            </button>

            {/* Hall of Heroes */}
            <button
              id="menu-hall-of-heroes"
              className="gothic-button"
              style={{ fontSize: '1.4rem', padding: '15px' }}
              onClick={() => setOverlay('hall')}
            >
              Hall of Heroes
            </button>

            {/* Options */}
            <button
              id="menu-options"
              className="gothic-button"
              style={{ fontSize: '1.4rem', padding: '15px' }}
              onClick={() => setOverlay('options')}
            >
              Options
            </button>

            {/* Exit Game */}
            <button
              id="menu-exit-game"
              className="gothic-button"
              style={{ fontSize: '1.4rem', padding: '15px', marginTop: '20px', color: '#c55' }}
              onClick={() => {
                if (window.confirm('Return to the mortal realm? Your progress will be lost.')) {
                  window.close();
                }
              }}
            >
              Exit Game
            </button>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            fontSize: '0.8rem',
            color: 'var(--color-text-dim)',
          }}
        >
          © 2026 Advanced Agentic Coding Team | WOTC Fan Content Policy
        </div>
      </div>

      {/* Overlays — rendered above the main menu */}
      {overlay === 'load' && (
        <LoadJourneyOverlay
          onLoad={handleGameLoaded}
          onClose={() => setOverlay('none')}
        />
      )}
      {overlay === 'hall' && (
        <HallOfHeroesOverlay
          onClose={() => setOverlay('none')}
        />
      )}
      {overlay === 'options' && (
        <OptionsOverlay
          onClose={() => setOverlay('none')}
        />
      )}
    </>
  );
};
