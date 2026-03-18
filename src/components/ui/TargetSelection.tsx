import React from 'react';

interface TargetSelectionProps {
  onCancel: () => void;
  title?: string;
}

export const TargetSelection: React.FC<TargetSelectionProps> = ({ onCancel, title = "Select Target" }) => {
  return (
    <div className="target-selection-overlay" style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.4) 100%)',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 5
    }}>
      <div className="target-info gothic-panel" style={{ 
        marginTop: '150px', 
        padding: '10px 30px', 
        pointerEvents: 'auto',
        textAlign: 'center'
      }}>
        <h3 className="gothic-title" style={{ margin: 0 }}>{title}</h3>
        <p style={{ fontSize: '0.8rem', margin: '5px 0' }}>Click on a monster or tile in the world</p>
        <button className="gothic-button" onClick={onCancel} style={{ marginTop: '10px', fontSize: '0.7rem' }}>Cancel</button>
      </div>
    </div>
  );
};
