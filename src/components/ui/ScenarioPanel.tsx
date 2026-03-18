import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const ScenarioPanel: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const scenario = gameState?.activeScenario;

  if (!scenario) return null;

  return (
    <div className="scenario-panel gothic-panel" style={{ 
      gridArea: 'right', 
      alignSelf: 'start', 
      padding: '15px' 
    }}>
      <h2 className="gothic-title" style={{ fontSize: '1rem', margin: '0 0 5px 0' }}>{scenario.name}</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', margin: '0 0 10px 0', fontStyle: 'italic' }}>
        {scenario.description}
      </p>
      
      <div className="objectives">
        <h3 className="gothic-title" style={{ fontSize: '0.7rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '3px' }}>Objectives</h3>
        <ul style={{ paddingLeft: '20px', margin: '5px 0', fontSize: '0.8rem' }}>
          {scenario.objectives?.map((obj: any, i: number) => (
            <li key={i} style={{ marginBottom: '3px' }}>{obj.description}</li>
          ))}
          {(!scenario.objectives || scenario.objectives.length === 0) && <li key="def">Find the Icon of Ravenloft</li>}
        </ul>
      </div>

      <div className="turn-counter" style={{ 
        marginTop: '10px', 
        fontSize: '0.7rem', 
        color: 'var(--color-gold)', 
        textAlign: 'right' 
      }}>
        SURGES REMAINING: {gameState.healingSurges}
      </div>
    </div>
  );
};
