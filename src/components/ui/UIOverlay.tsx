import React, { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
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
import { ActionPromptAnimated } from './ActionPromptAnimated';
import { TargetSelection } from './TargetSelection';
import { FortuneResolutionModal } from './FortuneResolutionModal';
import { DataLoader } from '../../game/dataLoader';
import type { Card } from '../../game/types';

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
  const interactionMode = useUIStore((state) => state.interactionMode);
  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);

  const selectedPowerCard = useMemo((): Card | null => {
    if (interactionMode !== 'ability' || !selectedPowerId || !gameState) return null;
    const hero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    if (!hero) return null;
    const card = DataLoader.getInstance().getCardById(selectedPowerId);
    return card || null;
  }, [interactionMode, selectedPowerId, gameState]);

  const bannerContent = useMemo(() => {
    if (!gameState || gameState.phase !== 'hero') return null;

    switch (interactionMode) {
      case 'move':
        return {
          title: 'MOVEMENT PHASE',
          description: 'Click any highlighted square on the board to move.',
          footer: 'Press [M] or click \'Move\' again to cancel.'
        };
      case 'attack':
        return {
          title: 'COMBAT PHASE',
          description: 'Click an adjacent or in-range enemy monster to attack.',
          footer: 'Press [A] or click \'Attack\' again to cancel.'
        };
      case 'ability':
        return {
          title: 'POWER USE',
          description: 'Select a power card from your hand, then click a target.',
          footer: 'Press [C] or click \'Ability\' again to cancel.'
        };
      case 'explore':
        return {
          title: 'EXPLORATION PHASE',
          description: 'Click a glowing edge arrow to draw and place a new tile.',
          footer: 'Press [E] or click \'Explore\' again to cancel.'
        };
      default:
        return null;
    }
  }, [gameState?.phase, interactionMode]);

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
      {/* Action Guidance Banner */}
      {bannerContent && (
        <div style={{
          position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, pointerEvents: 'none'
        }}>
          <div className="gothic-panel" style={{
            background: 'var(--color-overlay)',
            border: '2px solid var(--color-gold)',
            boxShadow: '0 0 20px rgba(192, 160, 96, 0.4)',
            padding: '12px 24px',
            borderRadius: '4px',
            textAlign: 'center',
            minWidth: '320px',
            maxWidth: '450px',
            animation: 'slideInUp 0.3s ease-out'
          }}>
            <div className="gothic-title" style={{ fontSize: '1.1rem', letterSpacing: '2px', fontWeight: 'bold', margin: 0 }}>
              {bannerContent.title}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#e0e0e0', marginTop: '6px', fontFamily: 'var(--font-body)' }}>
              {bannerContent.description}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '4px', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
              {bannerContent.footer}
            </div>
          </div>
        </div>
      )}

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

      {/* Action Prompt - shows what player should do next */}
      <ActionPromptAnimated />

      <div className="ui-layer">
        {/* Top: Turn Info */}
        <div style={{ gridArea: 'top', display: 'flex', justifyContent: 'center' }}>
          <TurnIndicator />
        </div>

        {/* Left: Party Sidebar & Combat Log */}
        <div style={{ gridArea: 'left', display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <PartySidebar />
          </div>
          <div style={{ pointerEvents: 'auto', marginTop: 'auto' }}>
            <CombatLog />
          </div>
        </div>

        {/* Right: Scenario & Actions */}
        <div style={{ gridArea: 'right', display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <ScenarioPanel />
          </div>
          <div style={{ pointerEvents: 'auto', marginTop: 'auto', display: 'flex', alignItems: 'flex-end' }}>
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

      {/* Target Selection Overlay */}
      {selectedPowerCard && gameState && (
        <TargetSelection
          card={selectedPowerCard}
          gameState={gameState}
          onSelectTarget={(entityId) => {
            useGameStore.getState().usePower(selectedPowerId!, entityId);
            setInteractionMode('none');
            setSelectedPowerId(null);
          }}
          onCancel={() => {
            setInteractionMode('none');
            setSelectedPowerId(null);
          }}
        />
      )}

      {/* Fortune Resolution Modal */}
      <FortuneResolutionModal />
    </>
  );
};
