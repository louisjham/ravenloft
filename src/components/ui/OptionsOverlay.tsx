import React from 'react';
import { SettingsPanel } from './SettingsPanel';

interface OptionsOverlayProps {
  onClose: () => void;
}

export const OptionsOverlay: React.FC<OptionsOverlayProps> = ({ onClose }) => {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* SettingsPanel already handles its own interior layout and close button */}
      <SettingsPanel onClose={onClose} />
    </div>
  );
};
