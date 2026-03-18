import React from 'react';

interface PauseMenuProps {
  onResume: () => void;
  onQuit: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onQuit }) => {
  return (
    <div className="pause-menu-overlay" style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      background: 'rgba(0,0,0,0.85)', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 2000 
    }}>
      <h1 className="gothic-title" style={{ fontSize: '3rem', marginBottom: '40px' }}>Game Paused</h1>
      <div className="menu-options" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '250px' }}>
        <button className="gothic-button" style={{ fontSize: '1.2rem', padding: '15px' }} onClick={onResume}>Resume Voyage</button>
        <button className="gothic-button" style={{ fontSize: '1.2rem', padding: '15px' }}>Save Progress</button>
        <button className="gothic-button" style={{ fontSize: '1.2rem', padding: '15px' }}>Settings</button>
        <button className="gothic-button" style={{ fontSize: '1.2rem', padding: '15px', color: '#ff4444' }} onClick={onQuit}>Abandon Quest</button>
      </div>
    </div>
  );
};
