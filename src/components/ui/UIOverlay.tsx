import React, { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HeroPanel } from './HeroPanel';
import { ActionBar } from './ActionBar';
import { CardHand } from './CardHand';
import { CombatLog } from './CombatLog';
import { ScenarioPanel } from './ScenarioPanel';
import { TurnIndicator } from './TurnIndicator';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { ScenarioSetupScreen } from './ScenarioSetupScreen';
import { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { ExperiencePanel } from './ExperiencePanel';
import { PartySidebar } from './PartySidebar';

interface UIOverlayProps {
  onStartGame: (scenarioId: string, heroIds: string[]) => void;
  onOpenTreasure?: (heroId: string) => void;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ onStartGame, onOpenTreasure }) => {
  const gameState = useGameStore((state) => state.gameState);
  const isPaused = useGameStore((state) => state.isPaused);
  const unpauseGame = useGameStore((state) => state.unpauseGame);

  const [showSetup, setShowSetup] = useState(false);
  const activeModal = useUIStore((state) => state.activeModal);
  const showTilePlacer = useUIStore((state) => state.showTilePlacer);
  const tilePlacementError = useUIStore((state) => state.tilePlacementError);

  if (!gameState) {
    if (showSetup) {
      return (
        <ScenarioSetupScreen
          onBack={() => setShowSetup(false)}
          onStart={(scenarioId, heroIds) => {
            setShowSetup(false);
            onStartGame(scenarioId, heroIds);
          }}
        />
      );
    }
    return <MainMenu onStart={() => setShowSetup(true)} />;
  }

  return (
    <>
      {/* Tile Placement overlay */}
      {showTilePlacer && (
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1000, pointerEvents: 'none'
        }}>
          {tilePlacementError && (
            <div style={{
              background: 'rgba(200, 0, 0, 0.9)', color: 'white', padding: '10px 20px',
              borderRadius: '4px', border: '2px solid #500', fontWeight: 'bold'
            }}>
              {tilePlacementError}
            </div>
          )}
          <div style={{
            background: 'rgba(20, 20, 20, 0.9)', color: '#ffb347', padding: '10px 20px',
            borderRadius: '4px', border: '2px solid #555', fontFamily: 'Cinzel, serif', textAlign: 'center'
          }}>
            <div>Position Tile</div>
            <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '4px' }}>
              [R] Rotate • [Enter/Click] Confirm • [Esc] Cancel
            </div>
          </div>
        </div>
      )}

      <div className="ui-layer">
        {/* Top: Turn Info */}
        <div style={{ gridArea: 'top', display: 'flex', justifyContent: 'center' }}>
          <TurnIndicator />
        </div>

        {/* Left: Party Sidebar & Hero Status/Combat Log */}
        <div style={{ gridArea: 'left', display: 'flex', gap: '20px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <PartySidebar />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            <div style={{ pointerEvents: 'auto' }}>
              <HeroPanel />
            </div>
            <div style={{ pointerEvents: 'auto', marginTop: 'auto' }}>
              <CombatLog />
            </div>
          </div>
        </div>

        {/* Right: Scenario & Actions */}
        <div style={{ gridArea: 'right', display: 'flex', flexDirection: 'column', gap: '20px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <ScenarioPanel />
          </div>
          <div style={{ pointerEvents: 'auto', marginTop: 'auto' }}>
            <ActionBar onOpenTreasure={onOpenTreasure} />
          </div>
        </div>

        {/* Bottom: Card Hand - only show during hero phase, not setup phase */}
        {gameState && gameState.phase !== 'setup' && (
          <div style={{ gridArea: 'bot', pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>
              <CardHand />
            </div>
          </div>
        )}
      </div>

      {/* Pause Menu Overlay */}
      {isPaused && (
        <PauseMenu onResume={unpauseGame} onQuit={() => window.location.reload()} />
      )}

      {/* Experience Page Overlay */}
      {activeModal === 'experience' && (
        <ExperiencePanel />
      )}
    </>
  );
};
