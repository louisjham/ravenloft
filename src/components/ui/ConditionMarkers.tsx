import React from 'react';
import { ActiveCondition } from '../../game/types';

interface ConditionMarkersProps {
  entityId: string;
  conditions: ActiveCondition[];
  size: 'large' | 'small';
}

const getIconForType = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'stunned': return '💫';
    case 'blinded': return '🕶';
    case 'poisoned': return '☠';
    case 'slowed': return '🐢';
    case 'immobilized': return '⛓';
    case 'dazed': return '😵';
    case 'weakened': return '↓';
    case 'marked': return '◎';
    case 'pushed': return '→';
    case 'prone': return '↙';
    default: return '?';
  }
};

const ConditionMarkers: React.FC<ConditionMarkersProps> = ({
  entityId,
  conditions,
  size
}) => {
  const activeForEntity = conditions.filter(c => c.targetId === entityId);

  if (activeForEntity.length === 0) return null;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
  };

  const chipSize = size === 'large' ? 32 : 20;
  const iconSize = size === 'large' ? '14px' : '10px';

  const chipBaseStyle: React.CSSProperties = {
    width: `${chipSize}px`,
    height: `${chipSize}px`,
    backgroundColor: '#00000088',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: iconSize,
    lineHeight: '1',
  };

  const badgeStyle = (duration: number): React.CSSProperties => ({
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: duration === 1 ? '#ff4d4d' : '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: '50%',
    width: '14px',
    height: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${duration === 1 ? '#ff4d4d' : '#888'}`,
    boxShadow: '0 0 5px rgba(0,0,0,0.5)',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: '9px',
    fontVariant: 'small-caps',
    color: '#aaa',
    marginLeft: '4px',
    display: size === 'large' ? 'inline' : 'none',
  };

  return (
    <div style={rowStyle}>
      {activeForEntity.map((condition, idx) => (
        <div 
          key={`${condition.type}-${idx}`} 
          style={{ display: 'flex', alignItems: 'center' }}
          title={condition.turnsRemaining === -1 
            ? `${condition.type} (permanent)` 
            : `${condition.type} (${condition.turnsRemaining} turns remaining)`}
        >
          <div style={chipBaseStyle}>
            <span style={iconStyle}>{getIconForType(condition.type)}</span>
            {condition.turnsRemaining !== -1 && (
              <div style={badgeStyle(condition.turnsRemaining)}>{condition.turnsRemaining}</div>
            )}
          </div>
          {size === 'large' && (
            <span style={labelStyle}>{condition.type}</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default ConditionMarkers;
