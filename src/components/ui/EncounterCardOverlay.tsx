import React from 'react';
import { CardResolutionState, Card, Hero, Effect } from '../../game/types';
import CardFlip from './cards/CardFlip';

interface EncounterCardOverlayProps {
  resolution: CardResolutionState;
  card: Card | null;
  heroes: Hero[];
  onAdvance: () => void;
  onSelectTarget: (entityId: string) => void;
  onDismiss: () => void;
}

const getPhaseLabel = (phase: string) => {
  switch (phase) {
    case 'drawing': return 'Drawing Encounter Card...';
    case 'revealing': return 'Encounter!';
    case 'resolving': return 'Resolving...';
    case 'complete': return 'Resolved';
    default: return '';
  }
};

const formatEffect = (effect: Effect): string => {
  const value = effect.value ?? 0;
  switch (effect.type) {
    case 'damage': return `⚔ Deal ${value} damage`;
    case 'heal': return `❤ Restore ${value} HP`;
    case 'status_effect': return `⊗ ${effect.statusEffect ?? 'Condition'}`;
    case 'attack_bonus': return `↑ +${value} to attack`;
    case 'defense_bonus': return `↓ -${value} damage taken`;
    case 'move': return `→ Move ${value} tiles`;
    case 'draw_card': return `⊕ Draw a card`;
    case 'flip_power': return `↻ Flip a power`;
    case 'passive': return `◎ ${effect.passiveType ?? 'Passive'}`;
    default: return effect.type;
  }
};

const EncounterCardOverlay: React.FC<EncounterCardOverlayProps> = ({
  resolution,
  card,
  heroes,
  onAdvance,
  onSelectTarget,
  onDismiss
}) => {
  if (resolution.phase === 'idle' || !card) return null;

  const showEffects = resolution.phase === 'revealing' || resolution.phase === 'resolving';
  const needsTarget = resolution.phase === 'revealing' &&
    !resolution.targetEntityId &&
    (card.effects?.some(e => e.target === 'single') ?? false);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.75)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Cinzel, serif',
  };

  const columnStyle: React.CSSProperties = {
    maxWidth: '480px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    padding: '40px 20px',
  };

  const phaseLabelStyle: React.CSSProperties = {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '24px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    textShadow: '0 0 10px rgba(255,255,255,0.3)',
  };

  const panelStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const panelHeaderStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#aaa',
    fontWeight: 'bold',
    borderBottom: '1px solid #333',
    paddingBottom: '4px',
    marginBottom: '4px',
  };

  const effectItemStyle = (isResolved: boolean): React.CSSProperties => ({
    fontSize: '15px',
    color: isResolved ? '#666' : '#eee',
    textDecoration: isResolved ? 'line-through' : 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const buttonContainerStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#8b1a1a', // Gothic dark red
    color: '#fff',
    border: '1px solid #5a1111',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'Cinzel, serif',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
  };

  const targetButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: '#333',
    color: '#f0d080',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'Cinzel, serif',
    fontSize: '14px',
    transition: 'all 0.2s',
  };

  const cancelButtonStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '24px',
    left: '24px',
    padding: '8px 20px',
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #444',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  };

  return (
    <div style={overlayStyle}>
      <div style={columnStyle}>
        <div style={phaseLabelStyle}>{getPhaseLabel(resolution.phase!)}</div>

        <CardFlip
          card={card}
          isFlipped={resolution.phase !== 'drawing'}
          size="full"
          onFlipComplete={resolution.phase === 'drawing' ? onAdvance : undefined}
        />

        {showEffects && (
          <div style={panelStyle}>
            {(resolution.pendingEffects ?? []).length > 0 && (
              <>
                <div style={panelHeaderStyle}>Pending</div>
                {(resolution.pendingEffects ?? []).map((e, idx) => (
                  <div key={`p-${idx}`} style={effectItemStyle(false)}>{formatEffect(e)}</div>
                ))}
              </>
            )}
            {(resolution.resolvedEffects ?? []).length > 0 && (
              <>
                <div style={{ ...panelHeaderStyle, marginTop: '8px' }}>Resolved</div>
                {(resolution.resolvedEffects ?? []).map((e, idx) => (
                  <div key={`r-${idx}`} style={effectItemStyle(true)}>{formatEffect(e)}</div>
                ))}
              </>
            )}
          </div>
        )}

        {needsTarget && (
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>Select a target</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {heroes.map(hero => (
                <button
                  key={hero.id}
                  style={targetButtonStyle}
                  onClick={() => onSelectTarget(hero.id)}
                >
                  {hero.heroClass}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={buttonContainerStyle}>
          {resolution.phase === 'revealing' && (!needsTarget || resolution.targetEntityId) && (
            <button style={primaryButtonStyle} onClick={onAdvance}>Resolve</button>
          )}

          {resolution.phase === 'resolving' && (
            <button
              style={{ ...primaryButtonStyle, opacity: (resolution.pendingEffects ?? []).length === 0 ? 0.5 : 1 }}
              onClick={onAdvance}
              disabled={(resolution.pendingEffects ?? []).length === 0}
            >
              Apply Next Effect
            </button>
          )}

          {resolution.phase === 'complete' && (
            <button style={{ ...primaryButtonStyle, backgroundColor: '#2d6a2d' }} onClick={onDismiss}>Done</button>
          )}
        </div>
      </div>

      <button style={cancelButtonStyle} onClick={onDismiss}>
        {resolution.phase === 'resolving' ? 'Skip' : 'Cancel'}
      </button>
    </div>
  );
};

export default EncounterCardOverlay;
