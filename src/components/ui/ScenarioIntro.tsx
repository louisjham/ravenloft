import React from 'react';
import { Scenario } from '../../game/types';

interface Props {
  scenario: Scenario;
  onStart: () => void;
}

export const ScenarioIntro: React.FC<Props> = ({ scenario, onStart }) => {
  return (
    <div className="scenario-intro-overlay">
      <div className="scenario-intro-content gothic-panel">
        <h1 className="gothic-title">{scenario.name}</h1>
        <div className="difficulty-tag">{scenario.difficulty}</div>
        
        <p className="narrative-text">{scenario.introText}</p>
        
        <div className="objectives-list">
          <h3 className="gothic-title" style={{ fontSize: '1rem' }}>Objectives:</h3>
          <ul>
            {scenario.objectives.map((obj: any) => (
              <li key={obj.id}>{obj.description}</li>
            ))}
          </ul>
        </div>

        <button className="gothic-button start-button" onClick={onStart}>
          Enter the Dungeon
        </button>
      </div>
    </div>
  );
};
