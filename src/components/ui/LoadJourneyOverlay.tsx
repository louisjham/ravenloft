import React, { useState, useEffect } from 'react';
import { SaveSystem, SaveSlot } from '../../game/progression/SaveSystem';
import { useGameStore } from '../../store/gameStore';

interface LoadJourneyOverlayProps {
  onLoad: () => void;
  onClose: () => void;
}

export const LoadJourneyOverlay: React.FC<LoadJourneyOverlayProps> = ({ onLoad, onClose }) => {
  const [saves, setSaves] = useState<Record<string, SaveSlot>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadGame = useGameStore((state) => state.loadGame);

  useEffect(() => {
    setSaves(SaveSystem.getSaves());
  }, []);

  const handleLoad = (slotId: string) => {
    loadGame(slotId);
    onLoad();
  };

  const handleDelete = (slotId: string) => {
    SaveSystem.deleteSave(slotId);
    setSaves(SaveSystem.getSaves());
    setDeletingId(null);
  };

  const slotList = Object.values(saves).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Panel */}
      <div
        className="gothic-panel"
        style={{
          width: '560px', maxWidth: '95vw',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          border: '2px solid var(--color-gold)',
          boxShadow: '0 0 50px rgba(139,0,0,0.5)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 16px',
          borderBottom: '1px solid #500',
          background: 'rgba(0,0,0,0.6)',
        }}>
          <h2 className="gothic-title" style={{
            margin: 0, fontSize: '1.8rem',
            color: 'var(--color-gold)',
            textShadow: '0 0 12px rgba(192,160,96,0.4)',
          }}>
            ⚔ Load Journey
          </h2>
          <button
            onClick={onClose}
            className="gothic-button"
            style={{ padding: '4px 14px', fontSize: '0.8rem', letterSpacing: '1px' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Save List */}
        <div style={{
          overflowY: 'auto', padding: '20px 28px',
          display: 'flex', flexDirection: 'column', gap: '14px',
          flex: 1,
        }} className="custom-scrollbar">
          {slotList.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              color: 'var(--color-text-dim)',
              fontStyle: 'italic',
              fontSize: '1rem',
              lineHeight: '1.6',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.4 }}>🪦</div>
              No saved journeys found.<br />
              <span style={{ fontSize: '0.85rem' }}>
                Begin an adventure and save your progress from the Pause Menu.
              </span>
            </div>
          ) : (
            slotList.map((slot) => (
              <div
                key={slot.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #3a2a10',
                  borderRadius: '4px',
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: '16px',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3a2a10')}
              >
                {/* Slot Icon */}
                <div style={{
                  fontSize: '2rem', width: '48px', textAlign: 'center',
                  flexShrink: 0, opacity: 0.8,
                }}>
                  🏰
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '1rem', fontWeight: 'bold',
                    color: 'var(--color-gold)',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {slot.scenarioName}
                  </div>
                  <div style={{
                    fontSize: '0.8rem', color: '#aaa',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    Heroes: {slot.heroNames.join(', ') || '—'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    {formatDate(slot.timestamp)}
                    {slot.id === 'auto' && (
                      <span style={{
                        marginLeft: '8px', background: 'rgba(139,0,0,0.4)',
                        color: '#c88', padding: '1px 6px', borderRadius: '3px', fontSize: '0.7rem',
                      }}>AUTO</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                  <button
                    className="gothic-button"
                    onClick={() => handleLoad(slot.id)}
                    style={{ padding: '6px 16px', fontSize: '0.85rem', letterSpacing: '1px' }}
                  >
                    ▶ Load
                  </button>
                  {deletingId === slot.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleDelete(slot.id)}
                        style={{
                          flex: 1, padding: '4px 8px', fontSize: '0.75rem',
                          background: '#600', border: '1px solid #900',
                          color: '#fbb', cursor: 'pointer', borderRadius: '2px',
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        style={{
                          flex: 1, padding: '4px 8px', fontSize: '0.75rem',
                          background: '#222', border: '1px solid #444',
                          color: '#aaa', cursor: 'pointer', borderRadius: '2px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(slot.id)}
                      style={{
                        padding: '4px 16px', fontSize: '0.75rem',
                        background: 'transparent', border: '1px solid #500',
                        color: '#c55', cursor: 'pointer', borderRadius: '2px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,0,0,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
