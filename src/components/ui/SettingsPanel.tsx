import React from 'react';
import { useGameStore } from '../../store/gameStore';

interface SettingsPanelProps {
  onClose?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);

  const handleVolumeChange = (type: 'masterVolume' | 'musicVolume' | 'sfxVolume', value: number) => {
    updateSettings({ [type]: value });
  };

  const handlePacingChange = (speed: 'normal' | 'fast' | 'instant') => {
    updateSettings({ animationSpeed: speed });
  };

  const handleGraphicsChange = (quality: 'high' | 'medium' | 'low') => {
    const scaleMap = { low: 0.5, medium: 0.75, high: 1.0 };
    updateSettings({ 
      graphicsQuality: quality,
      resolutionScale: scaleMap[quality]
    });
  };

  const handleQuickRollToggle = () => {
    updateSettings({ quickRoll: !settings.quickRoll });
  };

  return (
    <div 
      className="gothic-panel" 
      style={{
        padding: '30px',
        width: '450px',
        maxWidth: '90%',
        margin: '0 auto',
        border: '3px solid var(--color-gold)',
        boxShadow: '0 0 30px rgba(139, 0, 0, 0.6)',
        color: '#e0e0e0',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        animation: 'pulse-glow 4s infinite alternate',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #500', paddingBottom: '10px' }}>
        <h2 className="gothic-title" style={{ margin: 0, color: 'var(--color-gold)', fontSize: '1.8rem', textShadow: '2px 2px 4px black' }}>
          Tomb Customizations
        </h2>
        {onClose && (
          <button 
            onClick={onClose} 
            className="gothic-button"
            style={{
              padding: '4px 10px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              border: '1px solid var(--color-gold)',
              background: 'rgba(139,0,0,0.3)',
              color: 'var(--color-gold)',
              textTransform: 'uppercase'
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* AUDIO SECTION */}
      <div>
        <h3 className="gothic-title" style={{ color: 'var(--color-accent)', margin: '0 0 12px 0', fontSize: '1rem', borderBottom: '1px dashed #444', paddingBottom: '4px' }}>
          Whispers & Chants (Audio)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Master Volume */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span>Master Volume</span>
              <span style={{ color: 'var(--color-gold)' }}>{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={settings.masterVolume} 
              onChange={(e) => handleVolumeChange('masterVolume', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-gold)', background: '#222' }}
            />
          </div>
          {/* Music Volume */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span>Chamber Melodies (Music)</span>
              <span style={{ color: 'var(--color-gold)' }}>{Math.round(settings.musicVolume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={settings.musicVolume} 
              onChange={(e) => handleVolumeChange('musicVolume', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-gold)', background: '#222' }}
            />
          </div>
          {/* SFX Volume */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span>Sword & Spell (SFX)</span>
              <span style={{ color: 'var(--color-gold)' }}>{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={settings.sfxVolume} 
              onChange={(e) => handleVolumeChange('sfxVolume', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-gold)', background: '#222' }}
            />
          </div>
        </div>
      </div>

      {/* PACING & SPEED */}
      <div>
        <h3 className="gothic-title" style={{ color: 'var(--color-accent)', margin: '0 0 12px 0', fontSize: '1rem', borderBottom: '1px dashed #444', paddingBottom: '4px' }}>
          Chronos Pacing (Speed)
        </h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {(['normal', 'fast', 'instant'] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => handlePacingChange(speed)}
              className="gothic-button"
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                background: settings.animationSpeed === speed ? 'var(--color-accent)' : 'rgba(0,0,0,0.5)',
                border: `1px solid ${settings.animationSpeed === speed ? 'var(--color-gold)' : '#444'}`,
                color: settings.animationSpeed === speed ? 'white' : '#aaa',
                boxShadow: settings.animationSpeed === speed ? '0 0 8px rgba(139,0,0,0.6)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {speed}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontStyle: 'italic', lineHeight: '1.4' }}>
          {settings.animationSpeed === 'normal' && 'Immersive cinematic pacing with fully simulated 3D physics rolls and dramatic action delays.'}
          {settings.animationSpeed === 'fast' && 'Snappy combat! Speeds up pieces movement, card draws, and reduces dice rolling delays by 70%.'}
          {settings.animationSpeed === 'instant' && 'No downtime. Bypasses all action timings and skips 3D dice rolling animations entirely.'}
        </div>
      </div>

      {/* GRAPHICS QUALITY */}
      <div>
        <h3 className="gothic-title" style={{ color: 'var(--color-accent)', margin: '0 0 12px 0', fontSize: '1rem', borderBottom: '1px dashed #444', paddingBottom: '4px' }}>
          Spectre Quality (Graphics)
        </h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {(['low', 'medium', 'high'] as const).map((quality) => (
            <button
              key={quality}
              onClick={() => handleGraphicsChange(quality)}
              className="gothic-button"
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                background: settings.graphicsQuality === quality ? 'var(--color-accent)' : 'rgba(0,0,0,0.5)',
                border: `1px solid ${settings.graphicsQuality === quality ? 'var(--color-gold)' : '#444'}`,
                color: settings.graphicsQuality === quality ? 'white' : '#aaa',
                boxShadow: settings.graphicsQuality === quality ? '0 0 8px rgba(139,0,0,0.6)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {quality}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontStyle: 'italic', lineHeight: '1.4' }}>
          {settings.graphicsQuality === 'high' && 'Vivid atmosphere with dynamic shadows, post-processing outlines, and gothic candlelight.'}
          {settings.graphicsQuality === 'medium' && 'Zippy performance. Softened vignette effect, disabled outlines, and single light sources.'}
          {settings.graphicsQuality === 'low' && 'Max frame rate. Disables dynamic shadows, all post-processing filters, and wall light calculations.'}
        </div>
      </div>

      {/* RESOLUTION SCALING */}
      <div>
        <h3 className="gothic-title" style={{ color: 'var(--color-accent)', margin: '0 0 12px 0', fontSize: '1rem', borderBottom: '1px dashed #444', paddingBottom: '4px' }}>
          Resolution Scaling (Detail)
        </h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {([0.5, 0.75, 1.0, 1.5] as const).map((scale) => (
            <button
              key={scale}
              onClick={() => updateSettings({ resolutionScale: scale })}
              className="gothic-button"
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                background: settings.resolutionScale === scale ? 'var(--color-accent)' : 'rgba(0,0,0,0.5)',
                border: `1px solid ${settings.resolutionScale === scale ? 'var(--color-gold)' : '#444'}`,
                color: settings.resolutionScale === scale ? 'white' : '#aaa',
                boxShadow: settings.resolutionScale === scale ? '0 0 8px rgba(139,0,0,0.6)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {scale === 0.5 && '50%'}
              {scale === 0.75 && '75%'}
              {scale === 1.0 && '100%'}
              {scale === 1.5 && '150%'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontStyle: 'italic', lineHeight: '1.4' }}>
          {settings.resolutionScale === 0.5 && 'Pixelated / Extreme speedup. Reduces rendering burden by 75%.'}
          {settings.resolutionScale === 0.75 && 'Softer detail / Balanced performance. Highly recommended for slower devices.'}
          {settings.resolutionScale === 1.0 && 'Standard sharp resolution. Renders at 1:1 pixel match.'}
          {settings.resolutionScale === 1.5 && 'Crisp HD resolution. Heavy rendering burden, suitable for high-end GPUs.'}
        </div>
      </div>

      {/* QUICK ROLL Toggle */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #444',
          paddingTop: '16px',
          marginTop: '6px'
        }}
      >
        <div>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block' }}>Snappy Dice Rolls</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Skip 3D physical rolls & reveal results instantly</span>
        </div>
        <button
          onClick={handleQuickRollToggle}
          style={{
            width: '50px',
            height: '24px',
            borderRadius: '12px',
            background: settings.quickRoll ? 'var(--color-accent)' : '#222',
            border: '1px solid var(--color-gold)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.3s ease'
          }}
        >
          <div 
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'var(--color-gold)',
              position: 'absolute',
              top: '2.5px',
              left: settings.quickRoll ? '28px' : '3px',
              transition: 'left 0.2s ease',
              boxShadow: '0 0 4px black'
            }}
          />
        </button>
      </div>
    </div>
  );
};
