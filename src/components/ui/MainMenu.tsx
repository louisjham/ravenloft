import React from 'react';

interface MainMenuProps {
  onStart: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  return (
    <div className="main-menu" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.8)), url(/ui/main_menu_bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 3000,
      color: 'white'
    }}>
      <div className="title-area" style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 className="gothic-title" style={{
          fontSize: '5rem',
          margin: 0,
          textShadow: '0 0 20px var(--color-accent), 0 0 40px black'
        }}>Castle Ravenloft</h1>
        <div style={{
          fontSize: '1.2rem',
          fontFamily: 'var(--font-accent)',
          color: 'var(--color-gold)',
          letterSpacing: '4px'
        }}>A 3D Board Game Adaptation</div>
      </div>

      <div className="menu-box gothic-panel" style={{
        width: '350px',
        padding: '40px',
        background: 'rgba(5, 5, 10, 0.8)',
        border: '1px solid var(--color-gold)'
      }}>
        <div className="menu-options" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <button
            className="gothic-button"
            style={{ fontSize: '1.4rem', padding: '15px' }}
            onClick={() => {
              console.log('[DEBUG] MainMenu: Begin Adventure clicked');
              onStart();
            }}
          >
            Begin Adventure
          </button>
          <button className="gothic-button" style={{ fontSize: '1.4rem', padding: '15px' }}>Load Journey</button>
          <button className="gothic-button" style={{ fontSize: '1.4rem', padding: '15px' }}>Hall of Heroes</button>
          <button className="gothic-button" style={{ fontSize: '1.4rem', padding: '15px' }}>Options</button>
          <button className="gothic-button" style={{ fontSize: '1.4rem', padding: '15px', marginTop: '20px' }}>Exit Game</button>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '20px',
        fontSize: '0.8rem',
        color: 'var(--color-text-dim)'
      }}>
        © 2026 Advanced Agentic Coding Team | WOTC Fan Content Policy
      </div>
    </div>
  );
};
