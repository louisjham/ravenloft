import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * Transitions component for smooth scene and phase changes.
 * Includes loading screens and gothic-style fade effects.
 */

export const SceneTransition: React.FC<{ active: boolean, type: 'fade' | 'wipe' }> = ({ active, type }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!visible) return null;

  return (
    <div className={`transition-overlay ${type} ${active ? 'active' : 'inactive'}`}>
      <div className="gothic-logo">Castle Ravenloft</div>
      <div className="loading-bar">
        <div className="loading-progress" />
      </div>
    </div>
  );
};

export const TurnTransition: React.FC<{ heroName?: string, isPlayer: boolean }> = ({ heroName, isPlayer }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (heroName) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [heroName]);

  if (!show) return null;

  return (
    <div className={`turn-notification ${isPlayer ? 'player' : 'monster'}`}>
      <h2>{isPlayer ? `${heroName}'s Turn` : 'Monster Phase'}</h2>
    </div>
  );
};

export const PhaseTransition: React.FC<{ phase: string }> = ({ phase }) => {
  const [currentPhase, setCurrentPhase] = useState(phase);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    setOpacity(1);
    const timer = setTimeout(() => setOpacity(0), 1500);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="phase-transition-overlay" style={{ opacity }}>
      <h3>{phase.toUpperCase()}</h3>
    </div>
  );
};
