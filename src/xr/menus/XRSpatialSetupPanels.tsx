import React from 'react';
import { useXR } from '@react-three/xr';
import { Html } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { MainMenu } from '../../components/ui/MainMenu';
import { ScenarioSetupScreen } from '../../components/ui/ScenarioSetupScreen';
import { useGameTransition } from '../../hooks/useGameTransition';

/**
 * XRSpatialSetupPanels presents the Title Screen and Adventure Setup flow
 * as 3D spatial panels in WebXR AR/VR.
 *
 * Flow:
 * 1. Title Screen panel (MainMenu) is presented first in AR space above the tabletop.
 * 2. Clicking "Begin Adventure" opens the Adventure Setup spatial panel (ScenarioSetupScreen:
 *    scenario selection, hero cards with Level 1/2 flips, power card selection, and settings).
 * 3. Clicking "Start Adventure" confirms all selections, calls beginAdventure(), and closes
 *    the setup panel. Only then does the 3D dungeon board and party mount in AR.
 */
export const XRSpatialSetupPanels: React.FC = () => {
  const { isPresenting } = useXR();
  const gameState = useGameStore((state) => state.gameState);
  const isUnboxingMode = useUIStore((state) => state.isUnboxingMode);
  const showSetupScreen = useUIStore((state) => state.showSetupScreen);
  const setShowSetupScreen = useUIStore((state) => state.setShowSetupScreen);
  const { handleStartGame } = useGameTransition();

  // Only render during an active WebXR session when the game has not yet started and not in unboxing mode
  if (!isPresenting || gameState !== null || isUnboxingMode) {
    return null;
  }

  return (
    <group position={[0, 0.40, 0.05]} rotation={[-Math.PI / 14, 0, 0]}>
      <Html
        transform
        distanceFactor={1.25}
        center
        occlude={false}
        style={{
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        {showSetupScreen ? (
          <ScenarioSetupScreen
            isSpatialPanel
            onBack={() => setShowSetupScreen(false)}
            onStart={(scenarioId, heroIds) => {
              setShowSetupScreen(false);
              handleStartGame(scenarioId, heroIds);
            }}
          />
        ) : (
          <MainMenu
            isSpatialPanel
            onStart={() => setShowSetupScreen(true)}
          />
        )}
      </Html>
    </group>
  );
};

export default XRSpatialSetupPanels;
