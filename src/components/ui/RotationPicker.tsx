import React, { useState, useEffect } from 'react';
import { Rotation } from '../../game/types';

interface RotationPickerProps {
  validRotations: Rotation[];
  tilePreviewId: string;
  onConfirm: (rotation: Rotation) => void;
  onCancel: () => void;
}

export const RotationPicker: React.FC<RotationPickerProps> = ({
  validRotations,
  tilePreviewId,
  onConfirm,
  onCancel,
}) => {
  const [selectedRotation, setSelectedRotation] = useState<Rotation>(validRotations[0] ?? 0);

  useEffect(() => {
    // If there's exactly one valid rotation, auto-confirm immediately on mount
    if (validRotations.length === 1) {
      onConfirm(validRotations[0]);
    } else if (validRotations.length > 1 && !validRotations.includes(selectedRotation)) {
      // Safety update if valid rotations change and current selection is invalid
      setSelectedRotation(validRotations[0]);
    }
  }, [validRotations, onConfirm, selectedRotation]);

  // If auto-confirming or no valid rotations, don't show the UI
  if (validRotations.length <= 1) {
    return null;
  }

  return (
    <div 
      className="gothic-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        border: '2px solid #555',
        padding: '24px',
        color: '#e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 0 20px rgba(0,0,0,0.8)',
        borderRadius: '8px'
      }}
    >
      <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: '#ffb347', fontSize: '1.5rem' }}>
        Select Tile Rotation
      </h2>
      
      {/* Visual placeholder for the rotated UI representation */}
      <div style={{
        position: 'relative',
        width: '100px',
        height: '100px',
        border: '2px dashed #666',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'transform 0.3s ease-out',
        transform: `rotate(${selectedRotation}deg)`,
        backgroundColor: '#222',
        textAlign: 'center',
        fontSize: '0.8rem',
        padding: 'px'
      }}>
        {tilePreviewId}
        <div style={{ 
          position: 'absolute', 
          top: -15, 
          color: '#ffaa00', 
          fontWeight: 'bold',
          transform: `rotate(-${selectedRotation}deg)` // Keep arrow upright relative to rotation text? No, it's easier to just let it rotate with the container to show "North" edge.
        }}>
          N
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {validRotations.map(rot => (
          <button
            key={rot}
            onClick={() => setSelectedRotation(rot)}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedRotation === rot ? '#444' : '#222',
              color: selectedRotation === rot ? '#fff' : '#aaa',
              border: `1px solid ${selectedRotation === rot ? '#ffb347' : '#444'}`,
              cursor: 'pointer',
              fontFamily: 'Cinzel, serif',
              borderRadius: '4px',
              minWidth: '60px'
            }}
          >
            {rot}°
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', width: '100%' }}>
        <button 
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#3a1a1a',
            color: '#e0e0e0',
            border: '1px solid #6a2a2a',
            cursor: 'pointer',
            fontFamily: 'Cinzel, serif',
            borderRadius: '4px'
          }}
        >
          Cancel
        </button>
        <button 
          onClick={() => onConfirm(selectedRotation)}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#1a3a1a',
            color: '#fff',
            border: '1px solid #2a6a2a',
            cursor: 'pointer',
            fontFamily: 'Cinzel, serif',
            borderRadius: '4px'
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};
