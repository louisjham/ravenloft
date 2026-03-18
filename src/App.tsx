import React from 'react';
import { Scene } from './components/3d/Scene';
import { DungeonBoard } from './components/3d/DungeonBoard';
import { Hero3D } from './components/3d/Hero3D';
import { Monster3D } from './components/3d/Monster3D';
import { useGameStore } from './store/gameStore';
import { useUIStore } from './store/uiStore';

import { Physics } from '@react-three/cannon';
import { Dice3D } from './components/3d/Dice3D';
import { FireParticles } from './components/3d/Effects';
import { GameController } from './components/interaction/GameController';
import { MonsterAIIndicator } from './components/3d/MonsterAIIndicator';
import { AudioReactComponent } from './audio/AudioReactComponent';

import { UIOverlay } from './components/ui/UIOverlay';

import { GlobalErrorBoundary } from './utils/errorHandling';
import { SceneTransition, PhaseTransition } from './components/effects/Transitions';
import { TutorialOverlay, HelpOverlay } from './components/tutorial/TutorialSystem';

const App: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const startNewGame = useGameStore((state) => state.startNewGame);

  const activeModal = useUIStore((state) => state.activeModal);
  const hideModal = useUIStore((state) => state.hideModal);
  const isTransitioning = useUIStore((state) => state.isTransitioning);
  const startTransition = useUIStore((state) => state.startTransition);
  const endTransition = useUIStore((state) => state.endTransition);

  const handleStartGame = (scenarioId: string, heroIds: string[]) => {
    console.log('[DEBUG] App.handleStartGame: Called with', scenarioId, heroIds);
    startTransition(); // Show transition overlay
    startNewGame(scenarioId, heroIds);
    hideModal();
    // End transition after a short delay to allow game to initialize
    setTimeout(() => endTransition(), 1500);
  };

  const heroes = gameState?.heroes || [];
  const monsters = gameState?.monsters || [];

  return (
    <div className="app-container">
      <AudioReactComponent />

      <Scene>
        <Physics>
          <GameController />
          <DungeonBoard />

          <group name="entities">
            {heroes.map((hero) => (
              <Hero3D key={hero.id} hero={hero} />
            ))}

            {monsters.map((monster) => (
              <Monster3D key={monster.id} monster={monster} />
            ))}
          </group>

          <Dice3D />
          <FireParticles position={[0.5, 0, 0.5]} />
          <MonsterAIIndicator />
        </Physics>
      </Scene>

      <UIOverlay onStartGame={handleStartGame} />

      {/* SceneTransition: Only show during actual transitions (controlled by isTransitioning state) */}
      {/* The transition should NOT be active when showing MainMenu because that blocks interactions */}
      <SceneTransition active={isTransitioning} type="fade" />
      <TutorialOverlay />
      <HelpOverlay isOpen={activeModal === 'help'} onClose={hideModal} />

      <div id="aria-announcer" className="sr-only" aria-live="polite"></div>
    </div>
  );
};

const Root: React.FC = () => (
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);

export default Root;

