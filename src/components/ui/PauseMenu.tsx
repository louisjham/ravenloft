import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { SettingsPanel } from './SettingsPanel';

interface PauseMenuProps {
  onResume: () => void;
  onQuitToMainMenu?: () => void;
  onRestart?: () => void;
  onQuit?: () => void;
}

type MenuView = 'main' | 'settings' | 'confirm_quit' | 'confirm_restart';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onQuitToMainMenu,
  onRestart,
  onQuit,
}) => {
  const [view, setView] = useState<MenuView>('main');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const gameState = useGameStore((state) => state.gameState);
  const saveGame = useGameStore((state) => state.saveGame);
  const addNotification = useUIStore((state) => state.addNotification);
  const showModal = useUIStore((state) => state.showModal);

  const scenarioName = gameState?.activeScenario?.name;

  const handleSave = () => {
    saveGame();
    setSaveSuccess(true);
    addNotification('Game progress successfully saved to the crypt.', 'success', 3000);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  };

  const handleQuitConfirm = () => {
    if (onQuitToMainMenu) {
      onQuitToMainMenu();
    } else if (onQuit) {
      onQuit();
    }
  };

  const handleRestartConfirm = () => {
    if (onRestart) {
      onRestart();
    }
  };

  const handleOpenHelp = () => {
    showModal('help');
  };

  // Keyboard Escape navigation within options menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (view !== 'main') {
          setView('main');
        } else {
          onResume();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [view, onResume]);

  return (
    <div
      className="pause-menu-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3500,
        padding: '20px',
      }}
    >
      {view === 'settings' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <SettingsPanel onClose={() => setView('main')} />
          <button
            className="gothic-button"
            onClick={() => setView('main')}
            style={{
              padding: '10px 24px',
              fontSize: '1rem',
              color: 'var(--color-gold)',
              border: '1px solid var(--color-gold)',
              background: 'rgba(10, 10, 20, 0.8)',
            }}
          >
            ← Back to Game Options
          </button>
        </div>
      ) : view === 'confirm_quit' ? (
        <div
          className="gothic-panel"
          style={{
            width: '420px',
            maxWidth: '90%',
            padding: '36px 30px',
            textAlign: 'center',
            border: '2px solid #8b0000',
            boxShadow: '0 0 30px rgba(139, 0, 0, 0.6), 0 0 10px black',
            background: 'rgba(15, 10, 15, 0.95)',
          }}
        >
          <h2 className="gothic-title" style={{ fontSize: '1.8rem', color: '#ff6666', margin: '0 0 16px 0' }}>
            Abandon Quest?
          </h2>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(to right, transparent, #8b0000, transparent)',
              margin: '0 0 20px 0',
            }}
          />
          <p style={{ color: '#d0d0d0', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px' }}>
            Are you sure you wish to return to the mortal realm? Any unsaved progress will be claimed by Castle Ravenloft.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              className="gothic-button"
              onClick={() => setView('main')}
              style={{ padding: '10px 20px', fontSize: '0.95rem' }}
            >
              Cancel
            </button>
            <button
              id="confirm-quit-button"
              className="gothic-button"
              onClick={handleQuitConfirm}
              style={{
                padding: '10px 20px',
                fontSize: '0.95rem',
                background: 'rgba(139, 0, 0, 0.8)',
                borderColor: '#ff4444',
                color: '#fff',
                boxShadow: '0 0 12px rgba(255, 68, 68, 0.4)',
              }}
            >
              Return to Main Menu
            </button>
          </div>
        </div>
      ) : view === 'confirm_restart' ? (
        <div
          className="gothic-panel"
          style={{
            width: '420px',
            maxWidth: '90%',
            padding: '36px 30px',
            textAlign: 'center',
            border: '2px solid var(--color-gold)',
            boxShadow: '0 0 30px rgba(192, 160, 96, 0.4), 0 0 10px black',
            background: 'rgba(15, 12, 20, 0.95)',
          }}
        >
          <h2 className="gothic-title" style={{ fontSize: '1.8rem', color: 'var(--color-gold)', margin: '0 0 16px 0' }}>
            Restart Adventure?
          </h2>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(to right, transparent, var(--color-gold), transparent)',
              margin: '0 0 20px 0',
            }}
          />
          <p style={{ color: '#d0d0d0', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px' }}>
            Restart this adventure from the entrance tile? All current tile placements, monster positions, and exploration will be reset.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              className="gothic-button"
              onClick={() => setView('main')}
              style={{ padding: '10px 20px', fontSize: '0.95rem' }}
            >
              Cancel
            </button>
            <button
              id="confirm-restart-button"
              className="gothic-button"
              onClick={handleRestartConfirm}
              style={{
                padding: '10px 20px',
                fontSize: '0.95rem',
                background: 'var(--color-accent)',
                borderColor: 'var(--color-gold)',
                color: '#fff',
              }}
            >
              Restart Adventure
            </button>
          </div>
        </div>
      ) : (
        <div
          className="gothic-panel"
          style={{
            width: '380px',
            maxWidth: '90%',
            padding: '36px 32px',
            border: '2px solid var(--color-gold)',
            boxShadow: '0 0 40px rgba(0, 0, 0, 0.9), 0 0 20px rgba(192, 160, 96, 0.3)',
            background: 'rgba(10, 8, 15, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <h1
              className="gothic-title"
              style={{
                fontSize: '2.4rem',
                margin: 0,
                color: 'var(--color-gold)',
                textShadow: '0 0 15px rgba(192, 160, 96, 0.5)',
                letterSpacing: '3px',
              }}
            >
              Game Options
            </h1>
            {scenarioName && (
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--color-text-dim)',
                  fontStyle: 'italic',
                  marginTop: '6px',
                  fontFamily: 'var(--font-accent)',
                }}
              >
                {scenarioName}
              </div>
            )}
            <div
              style={{
                height: '1px',
                background: 'linear-gradient(to right, transparent, var(--color-gold), transparent)',
                marginTop: '16px',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Resume */}
            <button
              id="options-resume-btn"
              className="gothic-button"
              style={{
                fontSize: '1.15rem',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(192, 160, 96, 0.15)',
                borderColor: 'var(--color-gold)',
                color: '#fff',
              }}
              onClick={onResume}
            >
              <span>Resume Adventure</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7, color: 'var(--color-gold)' }}>[Esc]</span>
            </button>

            {/* Audio & Graphics Settings */}
            <button
              id="options-settings-btn"
              className="gothic-button"
              style={{
                fontSize: '1.05rem',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onClick={() => setView('settings')}
            >
              <span>⚙</span>
              <span>Audio & Graphics</span>
            </button>

            {/* Save Progress */}
            <button
              id="options-save-btn"
              className="gothic-button"
              style={{
                fontSize: '1.05rem',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: saveSuccess ? 'var(--color-gold)' : undefined,
                borderColor: saveSuccess ? 'var(--color-gold)' : undefined,
              }}
              onClick={handleSave}
            >
              <span>{saveSuccess ? '✓' : '💾'}</span>
              <span>{saveSuccess ? 'Progress Saved!' : 'Save Progress'}</span>
            </button>

            {/* Restart Adventure */}
            {onRestart && (
              <button
                id="options-restart-btn"
                className="gothic-button"
                style={{
                  fontSize: '1.05rem',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onClick={() => setView('confirm_restart')}
              >
                <span>↺</span>
                <span>Restart Adventure</span>
              </button>
            )}

            {/* Rules & Help */}
            <button
              id="options-help-btn"
              className="gothic-button"
              style={{
                fontSize: '1.05rem',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onClick={handleOpenHelp}
            >
              <span>📜</span>
              <span>Game Rules & Guide</span>
            </button>

            {/* Return to Main Menu */}
            <button
              id="options-quit-btn"
              className="gothic-button"
              style={{
                fontSize: '1.05rem',
                padding: '12px 18px',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#ff6666',
                borderColor: 'rgba(180, 50, 50, 0.7)',
                background: 'rgba(80, 10, 15, 0.4)',
              }}
              onClick={() => setView('confirm_quit')}
            >
              <span>🚪</span>
              <span>Return to Main Menu</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

