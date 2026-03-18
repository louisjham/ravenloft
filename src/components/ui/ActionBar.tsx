import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useGameActions } from '../../hooks/useGameActions';

export const ActionBar: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const { handleEndTurn } = useGameActions();
  
  const actions = [
    { id: 'move', label: 'Move', key: 'M' },
    { id: 'attack', label: 'Attack', key: 'A' },
    { id: 'ability', label: 'Ability', key: 'C' },
    { id: 'explore', label: 'Explore', key: 'E' },
    { id: 'endTurn', label: 'End Turn', key: 'Space' },
  ];

  const onActionClick = (actionId: string) => {
    if (actionId === 'endTurn') {
      handleEndTurn();
    } else {
      console.log(`Action: ${actionId}`);
    }
  };

  return (
    <div className="action-bar gothic-panel" style={{ 
      gridArea: 'right', 
      alignSelf: 'end', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px', 
      padding: '15px' 
    }}>
      <h3 className="gothic-title" style={{ fontSize: '0.9rem', margin: '0 0 10px 0' }}>Available Actions</h3>
      {actions.map((action) => (
        <button 
          key={action.id} 
          className="gothic-button"
          onClick={() => onActionClick(action.id)}
          disabled={gameState?.phase !== 'hero'}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}
        >
          <span>{action.label}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>[{action.key}]</span>
        </button>
      ))}
    </div>
  );
};
