import React, { useState } from 'react';
import { Card, PowerType } from '../../game/types';

export interface PowerCardDisplayProps {
  card: Card;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: (card: Card) => void;
  onDeselect: (card: Card) => void;
  showDetails: boolean;
  isFlipped?: boolean;
}

const getPowerBadgeConfig = (powerType: PowerType | undefined) => {
  switch (powerType) {
    case 'at-will':  return { label: 'AT-WILL',  color: '#2d6a2d', glow: '#4caf50' };
    case 'daily':    return { label: 'DAILY',     color: '#8b1a1a', glow: '#e53935' };
    case 'utility':  return { label: 'UTILITY',   color: '#1a3a8b', glow: '#1976d2' };
    default:         return { label: 'POWER',     color: '#444',    glow: '#888' };
  }
};

export const PowerCardDisplay: React.FC<PowerCardDisplayProps> = ({
  card,
  isSelected,
  isDisabled,
  onSelect,
  onDeselect,
  isFlipped,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    if (isFlipped) return;
    if (isSelected) {
      onDeselect(card);
    } else if (!isDisabled) {
      onSelect(card);
    }
  };

  const badge = getPowerBadgeConfig(card.powerType);

  // Card dimensions (physical card ~2:3 ratio)
  const W = 130;
  const H = 204;

  const borderColor = isSelected
    ? '#ffd700'
    : isFlipped
    ? '#661111'
    : hovered && !isFlipped
    ? badge.glow
    : 'rgba(80,80,80,0.8)';

  const boxShadow = isSelected
    ? `0 0 20px #ffd700, 0 0 40px rgba(255,215,0,0.4)`
    : isFlipped
    ? 'none'
    : hovered
    ? `0 0 16px ${badge.glow}88, 0 8px 24px rgba(0,0,0,0.8)`
    : '0 4px 12px rgba(0,0,0,0.7)';

  return (
    <div
      id={`power-card-${card.id}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: `${W}px`,
        height: `${H}px`,
        borderRadius: '8px',
        overflow: 'hidden',
        border: `2px solid ${borderColor}`,
        boxShadow,
        cursor: isFlipped ? 'default' : isDisabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* ── Card Art ── */}
      {card.image && !isFlipped ? (
        <img
          src={card.image}
          alt={card.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top',
            display: 'block',
            filter: isDisabled && !isSelected ? 'brightness(0.55) grayscale(0.4)' : 'none',
            transition: 'filter 0.3s',
          }}
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        /* Fallback when no image or flipped */
        <div style={{
          width: '100%',
          height: '100%',
          background: isFlipped
            ? 'linear-gradient(160deg, #1a0a0a 0%, #2a0808 100%)'
            : 'linear-gradient(160deg, #0d0d1a 0%, #1a1a2e 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px',
        }}>
          {isFlipped ? (
            <>
              <div style={{ fontSize: '28px', opacity: 0.4 }}>🂠</div>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '10px',
                color: '#882222',
                textAlign: 'center',
                letterSpacing: '1px',
              }}>USED</div>
            </>
          ) : (
            <>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#c0a060',
                textAlign: 'center',
                lineHeight: 1.3,
              }}>{card.name}</div>
              <div style={{
                fontSize: '10px',
                color: '#888',
                textAlign: 'center',
                padding: '0 4px',
                lineHeight: 1.4,
              }}>{card.description?.slice(0, 80)}{(card.description?.length ?? 0) > 80 ? '…' : ''}</div>
            </>
          )}
        </div>
      )}

      {/* ── Power Type Badge (top-left) ── */}
      {!isFlipped && (
        <div style={{
          position: 'absolute',
          top: '5px',
          left: '5px',
          background: `${badge.color}ee`,
          color: '#fff',
          fontSize: '8px',
          fontWeight: 'bold',
          fontFamily: 'Cinzel, serif',
          letterSpacing: '0.5px',
          padding: '2px 5px',
          borderRadius: '3px',
          border: `1px solid ${badge.glow}66`,
          backdropFilter: 'blur(2px)',
          pointerEvents: 'none',
        }}>
          {badge.label}
        </div>
      )}

      {/* ── Selected checkmark ── */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '5px',
          right: '6px',
          color: '#ffd700',
          fontSize: '16px',
          textShadow: '0 0 8px #ffd700',
          pointerEvents: 'none',
        }}>✓</div>
      )}

      {/* ── Flipped overlay ── */}
      {isFlipped && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(80,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(1px)',
        }}>
          <span style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '10px',
            color: '#ff6666',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textShadow: '0 0 8px #ff0000',
          }}>USED</span>
        </div>
      )}

      {/* ── Hover tooltip — stats + full description ── */}
      {hovered && !isFlipped && card.image && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          width: '220px',
          background: 'rgba(10,10,20,0.97)',
          border: `1px solid ${badge.glow}88`,
          borderRadius: '8px',
          padding: '10px 12px',
          boxShadow: `0 0 20px ${badge.glow}44, 0 8px 24px rgba(0,0,0,0.9)`,
          zIndex: 9999,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
        }}>
          {/* Badge + Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{
              background: badge.color,
              color: '#fff',
              fontSize: '8px',
              fontWeight: 'bold',
              fontFamily: 'Cinzel, serif',
              padding: '2px 5px',
              borderRadius: '3px',
              letterSpacing: '0.5px',
              flexShrink: 0,
            }}>{badge.label}</span>
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#e8d8b0',
              lineHeight: 1.2,
            }}>{card.name}</span>
          </div>

          {/* Stats row */}
          {(card.attackBonus !== undefined || card.damage !== undefined) && (
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '8px',
              borderBottom: '1px solid rgba(192,160,96,0.2)',
              paddingBottom: '6px',
            }}>
              {card.attackBonus !== undefined && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#888', fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}>ATTACK</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#c0a060' }}>+{card.attackBonus}</div>
                </div>
              )}
              {card.damage !== undefined && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#888', fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}>DAMAGE</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e05050' }}>{card.damage}</div>
                </div>
              )}
              {card.missEffect && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#888', fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}>MISS</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#c08040' }}>{card.missEffect}</div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div style={{
            fontSize: '11px',
            color: '#ccc',
            lineHeight: 1.5,
            marginBottom: card.flavorText ? '6px' : 0,
          }}>{card.description}</div>

          {/* Flavor text */}
          {card.flavorText && (
            <div style={{
              fontSize: '10px',
              color: '#666',
              fontStyle: 'italic',
              lineHeight: 1.4,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '5px',
              marginTop: '4px',
            }}>{card.flavorText}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default PowerCardDisplay;
