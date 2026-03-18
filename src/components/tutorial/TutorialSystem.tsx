import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * Tutorial System for guiding first-time players.
 * Includes tooltips and interactive guidance for Scenario 1.
 */

interface TutorialStep {
  target: string; // Selector for the target element
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const tutorialSteps: TutorialStep[] = [
  { target: '#hero-panel', content: 'This is your Hero Panel. Watch your HP and Healing Surges!', position: 'right' },
  { target: '#action-bar', content: 'Use these buttons to Move, Attack, or use Special Abilities.', position: 'top' },
  { target: '#dungeon-board', content: 'Click on adjacent squares to move. Moving to an unexplored edge reveals a new tile!', position: 'bottom' },
  { target: '#card-hand', content: 'These are your available abilities. Some are exhausted after use.', position: 'top' }
];

export const TutorialOverlay: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const { gameState } = useGameStore();

  if (gameState?.activeScenario.id !== 'scenario-1') return null;

  const step = tutorialSteps[currentStep];

  return (
    <div className="tutorial-modal">
      <div className="tutorial-content">
        <p>{step.content}</p>
        <button onClick={() => setCurrentStep(prev => Math.min(prev + 1, tutorialSteps.length - 1))}>
          {currentStep === tutorialSteps.length - 1 ? 'Start Game' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export const Tooltip: React.FC<{ text: string, children: React.ReactNode }> = ({ text, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="tooltip-container" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && <div className="tooltip-text">{text}</div>}
    </div>
  );
};

export const HelpOverlay: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="help-screen" onClick={onClose}>
      <div className="help-content gothic-panel">
        <h2>Quick Reference (F1)</h2>
        <ul>
          <li><strong>M</strong>: Move your Hero</li>
          <li><strong>A</strong>: Basic Attack</li>
          <li><strong>E</strong>: Explore tile edge</li>
          <li><strong>Space</strong>: End Turn</li>
          <li><strong>Esc</strong>: Pause Menu</li>
        </ul>
        <button onClick={onClose}>Return to Game</button>
      </div>
    </div>
  );
};
