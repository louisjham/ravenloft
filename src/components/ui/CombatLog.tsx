import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

export const CombatLog: React.FC = () => {
  const log = useGameStore((state) => state.gameState?.log || []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  const getColor = (type: string) => {
    switch (type) {
      case 'combat': return '#ff4444';
      case 'action': return '#44ff44';
      case 'event': return '#ffcc00';
      case 'system': return '#00aaff';
      case 'exploration': return '#00ffff';
      case 'treasure': return '#ffd700';
      case 'damage': return '#ff6666';
      case 'heal': return '#66ff66';
      default: return 'var(--color-text)';
    }
  };

  return (
    <div className="combat-log" style={{
      height: '90px',
      padding: '4px 8px',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(5, 5, 10, 0.5)',
      border: '1px solid rgba(192, 160, 96, 0.2)',
      borderRadius: '3px',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        fontSize: '0.6rem',
        margin: '0 0 3px 0',
        color: 'rgba(192, 160, 96, 0.7)',
        fontFamily: 'var(--font-gothic)',
        letterSpacing: '1px',
        textTransform: 'uppercase'
      }}>
        Log
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-body)',
          paddingRight: '3px',
          lineHeight: '1.3'
        }}
        className="custom-scrollbar"
      >
        {log.length === 0 ? (
          <div style={{
            color: 'rgba(255,255,255,0.3)',
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: '15px',
            fontSize: '0.6rem'
          }}>
            Awaiting adventure...
          </div>
        ) : (
          log.slice(-15).map((entry) => (
            <div
              key={entry.id}
              style={{
                marginBottom: '2px',
                borderLeft: `2px solid ${getColor(entry.type)}`,
                paddingLeft: '5px',
                color: getColor(entry.type),
                opacity: 0.85
              }}
            >
              {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
