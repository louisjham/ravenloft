import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { MovablePanel } from './MovablePanel';

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
    <MovablePanel
      id="combat-log"
      title="LOG"
      icon="📜"
      defaultCollapsed={false}
      width={185}
      headerExtra={
        <span style={{ fontSize: '0.6rem', color: 'rgba(192, 160, 96, 0.6)' }}>
          {log.length}
        </span>
      }
    >
      <div
        ref={scrollRef}
        style={{
          height: '95px',
          overflowY: 'auto',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-body)',
          padding: '2px 4px',
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
          log.slice(-25).map((entry) => (
            <div
              key={entry.id}
              style={{
                marginBottom: '2px',
                borderLeft: `2px solid ${getColor(entry.type)}`,
                paddingLeft: '5px',
                color: getColor(entry.type),
                opacity: 0.9
              }}
            >
              {entry.message}
            </div>
          ))
        )}
      </div>
    </MovablePanel>
  );
};
