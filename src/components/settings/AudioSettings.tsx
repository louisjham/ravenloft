import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const AudioSettings: React.FC = () => {
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);

  const handleChange = (key: string, value: string) => {
    updateSettings({ [key]: parseFloat(value) });
  };

  return (
    <div className="audio-settings gothic-panel">
      <h3 className="gothic-title">Audio Settings</h3>
      
      <div className="setting-item">
        <label>Master Volume</label>
        <input 
          type="range" min="0" max="1" step="0.05" 
          value={settings.masterVolume} 
          onChange={(e) => handleChange('masterVolume', e.target.value)} 
        />
        <span>{Math.round(settings.masterVolume * 100)}%</span>
      </div>

      <div className="setting-item">
        <label>Music Volume</label>
        <input 
          type="range" min="0" max="1" step="0.05" 
          value={settings.musicVolume} 
          onChange={(e) => handleChange('musicVolume', e.target.value)} 
        />
        <span>{Math.round(settings.musicVolume * 100)}%</span>
      </div>

      <div className="setting-item">
        <label>SFX Volume</label>
        <input 
          type="range" min="0" max="1" step="0.05" 
          value={settings.sfxVolume} 
          onChange={(e) => handleChange('sfxVolume', e.target.value)} 
        />
        <span>{Math.round(settings.sfxVolume * 100)}%</span>
      </div>

      <div className="setting-item">
        <label>Voice Volume</label>
        <input 
          type="range" min="0" max="1" step="0.05" 
          value={settings.voiceVolume} 
          onChange={(e) => handleChange('voiceVolume', e.target.value)} 
        />
        <span>{Math.round(settings.voiceVolume * 100)}%</span>
      </div>
    </div>
  );
};
