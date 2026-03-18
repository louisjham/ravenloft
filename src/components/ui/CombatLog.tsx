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

  // Dummy logs if empty
  const displayLog = log.length ? log : [
    { id: '1', timestamp: '03:14:00', message: 'The wind howls as you enter the Crypt...', type: 'event' },
    { id: '2', timestamp: '03:14:10', message: 'Arjhan moves to (0, 0)', type: 'action' },
    { id: '3', timestamp: '03:14:15', message: 'A Goblin appears!', type: 'combat' },
  ];

  const getColor = (type: string) => {
    switch (type) {
      case 'combat': return '#ff4444';
      case 'action': return '#44ff44';
      case 'event': return '#ffcc00';
      default: return 'var(--color-text)';
    }
  };

  return (
    <div className="combat-log gothic-panel" style={{ 
      gridArea: 'left', 
      alignSelf: 'end', 
      height: '150px',
      marginTop: 'auto',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 className="gothic-title" style={{ fontSize: '0.7rem', margin: '0 0 5px 0' }}>Combat Log</h3>
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          fontSize: '0.75rem', 
          fontFamily: 'var(--font-body)',
          paddingRight: '5px'
        }}
      >
        {displayLog.map((entry) => (
          <div key={entry.id} style={{ marginBottom: '4px', borderLeft: `2px solid ${getColor(entry.type)}`, paddingLeft: '8px' }}>
            <span style={{ color: 'var(--color-text-dim)', fontSize: '0.65rem' }}>[{entry.timestamp}] </span>
            <span style={{ color: getColor(entry.type) }}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
