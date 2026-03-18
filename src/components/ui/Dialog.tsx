import React from 'react';

interface DialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
}

export const Dialog: React.FC<DialogProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmLabel = "Acknowledge" 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      background: 'rgba(0,0,0,0.7)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 1000,
      pointerEvents: 'auto'
    }}>
      <div className="gothic-panel" style={{ 
        width: '400px', 
        padding: '30px', 
        textAlign: 'center',
        border: '3px solid var(--color-gold)'
      }}>
        <h2 className="gothic-title" style={{ marginTop: 0 }}>{title}</h2>
        <div style={{ 
          height: '2px', 
          background: 'linear-gradient(to right, transparent, var(--color-gold), transparent)', 
          margin: '15px 0' 
        }} />
        <p style={{ lineHeight: '1.6', marginBottom: '25px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          {onCancel && (
            <button className="gothic-button" onClick={onCancel}>Cancel</button>
          )}
          <button className="gothic-button" onClick={onConfirm} style={{ background: 'var(--color-accent)' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
