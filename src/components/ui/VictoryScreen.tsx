import React from 'react';
import { GameState } from '../../game/types';

interface Props {
  gameState: GameState;
  isVictory: boolean;
  onContinue: () => void;
  onQuit: () => void;
}

export const VictoryScreen: React.FC<Props> = ({ gameState, isVictory, onContinue, onQuit }) => {
  const scenario = gameState.activeScenario;

  return (
    <div className={`victory-overlay ${isVictory ? 'victory' : 'defeat'}`}>
      <div className="victory-content gothic-panel">
        <h1 className="gothic-title">
          {isVictory ? 'Victory!' : 'Defeat...'}
        </h1>
        
        <p className="narrative-text">
          {isVictory ? scenario.victoryText : scenario.defeatText}
        </p>

        <div className="stats-panel">
          <div className="stat">
            <span className="label">Turns Survived:</span>
            <span className="value">{gameState.turnCount || 0}</span>
          </div>
          <div className="stat">
            <span className="label">Monsters Defeated:</span>
            <span className="value">{gameState.log.filter(l => l.type === 'combat').length}</span>
          </div>
        </div>

        <div className="victory-actions">
          {isVictory ? (
            <button className="gothic-button" onClick={onContinue}>
              Next Scenario
            </button>
          ) : (
            <button className="gothic-button" onClick={onContinue}>
              Retry Scenario
            </button>
          )}
          <button className="gothic-button secondary" onClick={onQuit}>
            Return to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
