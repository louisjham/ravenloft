import React from 'react';
import { Card, Effect } from '../../../game/types';

interface CardFaceProps {
  card: Card;
  isFaceDown: boolean;
  isAnimating: boolean;
  size: 'full' | 'compact' | 'mini';
  onClick?: () => void;
}

const getCardHeaderConfig = (card: Card) => {
  if (card.encounterType) {
    switch (card.encounterType) {
      case 'environment':
        return { label: 'ENVIRONMENT', color: '#1a3a8b' };
      case 'event':
        return { label: 'EVENT', color: '#2d6a2d' };
      case 'event-attack':
        return { label: 'EVENT: ATTACK', color: '#8b1a1a' };
      case 'trap':
        return { label: 'TRAP', color: '#8b6914' };
      default:
        break;
    }
  }

  if (card.treasureType) {
    switch (card.treasureType) {
      case 'blessing':
        return { label: 'BLESSING', color: '#6a2d6a' };
      case 'fortune':
        return { label: 'FORTUNE', color: '#8b6914' };
      case 'item':
        return { label: 'ITEM', color: '#2d4a6a' };
      default:
        break;
    }
  }

  return { label: card.type.toUpperCase(), color: '#333333' };
};

const formatEffect = (effect: Effect): string => {
  const value = effect.value ?? 0;
  switch (effect.type) {
    case 'damage':
      return `⚔ Deal ${value} damage`;
    case 'heal':
      return `❤ Restore ${value} HP`;
    case 'status_effect':
      return `⊗ ${effect.statusEffect ?? 'Condition'}`;
    case 'attack_bonus':
      return `↑ +${value} to attack`;
    case 'defense_bonus':
      return `↓ -${value} damage taken`;
    case 'move':
      return `→ Move ${value} tiles`;
    case 'draw_card':
      return `⊕ Draw a card`;
    case 'flip_power':
      return `↻ Flip a power`;
    case 'passive':
      return `◎ ${effect.passiveType ?? 'Passive'}`;
    default:
      return effect.type;
  }
};

const CardFace: React.FC<CardFaceProps> = ({
  card,
  isFaceDown,
  isAnimating,
  size,
  onClick
}) => {
  const { label, color } = getCardHeaderConfig(card);

  const getDimensions = () => {
    switch (size) {
      case 'full': return { width: '240px', height: '336px' };
      case 'compact': return { width: '180px', height: '252px' };
      case 'mini': return { width: '120px', height: '168px' };
    }
  };

  const dims = getDimensions();

  const containerStyle: React.CSSProperties = {
    ...dims,
    position: 'relative',
    borderRadius: '12px',
    boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
    userSelect: 'none',
    transform: isAnimating ? 'scale(1.05)' : 'scale(1)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  const backStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0c0c14 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '4px double #444',
    boxSizing: 'border-box',
    borderRadius: '12px',
  };

  const backLogoStyle: React.CSSProperties = {
    fontSize: size === 'mini' ? '24px' : '48px',
    color: '#333',
    opacity: 0.5,
    fontFamily: 'Cinzel, serif',
  };

  const frontStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1a1a1a',
    color: '#e0e0e0',
    fontFamily: 'MedievalSharp, cursive',
    borderRadius: '12px',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: color,
    height: size === 'mini' ? '24px' : '36px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: size === 'mini' ? '9px' : '11px',
    fontWeight: 'bold',
    fontFamily: 'Cinzel, serif',
    color: '#fff',
    letterSpacing: '1px',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: size === 'mini' ? '8px' : '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: size === 'mini' ? '4px' : '12px',
    overflow: 'hidden',
    background: 'radial-gradient(circle at center, #2a2a2a 0%, #1a1a1a 100%)',
  };

  const nameStyle: React.CSSProperties = {
    fontFamily: 'Cinzel, serif',
    fontSize: size === 'full' ? '18px' : size === 'compact' ? '16px' : '12px',
    fontWeight: 'bold',
    color: '#f0d080',
    borderBottom: '1px solid #444',
    paddingBottom: '4px',
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: size === 'full' ? '13px' : '11px',
    lineHeight: '1.4',
    color: '#bbb',
    fontStyle: 'italic',
  };

  const effectListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: 'auto',
  };

  const effectItemStyle: React.CSSProperties = {
    fontSize: size === 'mini' ? '10px' : '13px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: '4px 8px',
    borderRadius: '4px',
  };

  if (isFaceDown) {
    return (
      <div style={containerStyle} onClick={onClick}>
        <div style={backStyle}>
          <div style={backLogoStyle}>RL</div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} onClick={onClick}>
      <div style={frontStyle}>
        <div style={headerStyle}>{label}</div>
        <div style={contentStyle}>
          <div style={nameStyle}>{card.name}</div>
          {size !== 'mini' && (
            <div style={descriptionStyle}>{card.description}</div>
          )}
          {card.effects && card.effects.length > 0 && (
            <div style={effectListStyle}>
              {card.effects.map((effect, idx) => (
                <div key={idx} style={effectItemStyle}>
                  {formatEffect(effect)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardFace;
