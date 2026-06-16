import React from 'react';
import { Scene } from './components/3d/Scene';
import { DungeonBoard } from './components/3d/DungeonBoard';
import { Hero3D } from './components/3d/Hero3D';
import { Monster3D } from './components/3d/Monster3D';
import { useGameStore } from './store/gameStore';
import { useUIStore } from './store/uiStore';
import { Card } from './game/types';

import { Physics } from '@react-three/cannon';
import { Dice3D } from './components/3d/Dice3D';
import { DiceArena } from './components/3d/DiceArena';
import { PhysicsGroundPlane } from './components/3d/PhysicsGroundPlane';
import { TableSurface } from './components/3d/TableSurface';
import { DungeonWalls } from './components/3d/DungeonWalls';
import { FireParticles } from './components/3d/Effects';
import { GameController } from './components/interaction/GameController';
import { MonsterAIIndicator } from './components/3d/MonsterAIIndicator';
import { AudioReactComponent } from './audio/AudioReactComponent';

import { UIOverlay } from './components/ui/UIOverlay';
import VillainPhaseOverlay from './components/ui/VillainPhaseOverlay';
import PowerSelectionScreen from './components/ui/PowerSelectionScreen';

import { GlobalErrorBoundary } from './utils/errorHandling';
import { SceneTransition, PhaseTransition } from './components/effects/Transitions';
import { TutorialOverlay, HelpOverlay } from './components/tutorial/TutorialSystem';
import { DiceAnnouncementOverlay } from './components/ui/DiceAnnouncementOverlay';
import EncounterCardOverlay from './components/ui/EncounterCardOverlay';
import TreasureCardPanel from './components/ui/TreasureCardPanel';

// Import diagnostic tools for debugging tile placement
import './testing/tile-placement-diagnostics';
import { ExplorationLayer } from './components/3d/ExplorationLayer';
import { RotationPicker } from './components/ui/RotationPicker';
import { TilePlacementContext } from './contexts/TilePlacementContext';

import { useCardResolution } from './hooks/useCardResolution';
import { useTreasurePanel } from './hooks/useTreasurePanel';
import { useExplorationControls } from './hooks/useExplorationControls';
import { useGameTransition } from './hooks/useGameTransition';

const App: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);

  // Power selection store methods
  const selectPower = useGameStore((state) => state.selectPower);
  const deselectPower = useGameStore((state) => state.deselectPower);
  const confirmHeroSelection = useGameStore((state) => state.confirmHeroSelection);
  const autoSelectPowers = useGameStore((state) => state.autoSelectPowers);
  const beginAdventure = useGameStore((state) => state.beginAdventure);

  // Extracted hooks
  const {
    cardResolution,
    resolvedCard,
    heroes,
    canCancelEncounter,
    allCards,
    advanceCardResolution,
    selectResolutionTarget,
    dismissCardResolution,
  } = useCardResolution();

  const {
    treasurePanelHero,
    treasureAssignments,
    turnCount: treasureTurnCount,
    allCards: treasureAllCards,
    handleOpenTreasure,
    handleCloseTreasure,
    useTreasureCard,
  } = useTreasurePanel();

  const {
    exploration,
    onEdgeSelected,
    handlePlacementConfirm,
    handlePlacementCancel,
    onAcceptFate,
  } = useExplorationControls();

  const { isTransitioning, handleStartGame } = useGameTransition();

  // UI state
  const activeModal = useUIStore((state) => state.activeModal);
  const hideModal = useUIStore((state) => state.hideModal);

  React.useEffect(() => {
    return useGameStore.subscribe(
      (state) => state.gameState?.phase,
      (phase) => {
        if (phase === 'victory') {
          useUIStore.getState().showModal('victory');
        } else if (phase === 'defeat') {
          useUIStore.getState().showModal('defeat');
        }
      }
    );
  }, []);

  const monsters = gameState?.monsters || [];

  return (
    <TilePlacementContext.Provider value={{
      confirmPlacement: handlePlacementConfirm,
      cancelPlacement: handlePlacementCancel,
    }}>
    <div className="app-container">
      <AudioReactComponent />

      {gameState && gameState.phase === 'setup' ? (
        <PowerSelectionScreen
          heroes={gameState.heroes}
          powerSelections={gameState.powerSelections ?? []}
          onSelectPower={(heroId: string, card: Card) => selectPower(heroId, card)}
          onDeselectPower={(heroId: string, id: string) => deselectPower(heroId, id)}
          onConfirmHero={(heroId: string) => confirmHeroSelection(heroId)}
          onAutoSelect={(heroId: string) => autoSelectPowers(heroId)}
          onConfirmAll={() => beginAdventure()}
        />
      ) : (
        <Scene>
          <Physics>
            <GameController />
            <PhysicsGroundPlane />
            <React.Suspense fallback={null}>
              <TableSurface />
              <DungeonWalls />
            </React.Suspense>
            <DungeonBoard />
            {gameState && (
              <ExplorationLayer
                tiles={gameState.tiles}
                explorationState={exploration}
                onEdgeSelected={onEdgeSelected}
              />
            )}

            <group name="entities">
              {heroes.filter(h => !h.escaped).map((hero) => (
                <Hero3D key={hero.id} hero={hero} />
              ))}

              {monsters.map((monster) => (
                <Monster3D key={monster.id} monster={monster} />
              ))}
            </group>

            <Dice3D />
            <DiceArena />

            <FireParticles position={[0.5, 0, 0.5]} />
            <MonsterAIIndicator />
          </Physics>
        </Scene>
      )}

      {/* Show UIOverlay when not in setup phase (includes MainMenu when gameState is null) */}
      {!(gameState && gameState.phase === 'setup') && (
        <UIOverlay onStartGame={handleStartGame} onOpenTreasure={handleOpenTreasure} />
      )}

      {gameState && (
        <VillainPhaseOverlay
          activeVillainId={gameState.activeVillainId}
          villainQueue={gameState.villainPhaseQueue}
          monsters={gameState.monsters}
          traps={gameState.traps}
          isVillainPhaseActive={gameState.villainPhaseQueue.length > 0}
        />
      )}

      {exploration.phase === 'exhausted' && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="gothic-panel" style={{ padding: '30px', textAlign: 'center', maxWidth: '400px' }}>
            <h2 className="gothic-title" style={{ color: 'var(--color-accent)', marginBottom: '15px' }}>Deck Exhausted</h2>
            <p style={{ color: 'var(--color-text-dim)', marginBottom: '25px', lineHeight: '1.5' }}>
              No tiles remaining in the dungeon deck. The darkness closes in...
            </p>
            <button
              className="deck-exhausted-btn"
              onClick={onAcceptFate}
            >
              Accept Fate
            </button>
          </div>
        </div>
      )}

      {(exploration.phase === 'positioning' || exploration.phase === 'placement_blocked') && (
        <RotationPicker
          tilePreviewId={exploration.drawnTile.name}
          validRotations={exploration.validRotations}
          onConfirm={(rotation) => handlePlacementConfirm()}
          onCancel={() => handlePlacementCancel()}
        />
      )}

      {/* SceneTransition: Only show during actual transitions (controlled by isTransitioning state) */}
      {/* The transition should NOT be active when showing MainMenu because that blocks interactions */}
      <SceneTransition active={isTransitioning} type="fade" />
      <TutorialOverlay />
      <HelpOverlay isOpen={activeModal === 'help'} onClose={hideModal} />

      <div id="aria-announcer" className="sr-only" aria-live="polite"></div>

      {cardResolution && cardResolution.phase !== 'idle' && resolvedCard && (
        <EncounterCardOverlay
          resolution={cardResolution}
          card={resolvedCard}
          heroes={heroes}
          canCancelEncounter={canCancelEncounter}
          onAdvance={advanceCardResolution}
          onSelectTarget={selectResolutionTarget}
          onDismiss={dismissCardResolution}
        />
      )}

      {treasurePanelHero && (
        <TreasureCardPanel
          hero={treasurePanelHero}
          assignments={treasureAssignments}
          allCards={treasureAllCards}
          currentTurn={treasureTurnCount}
          onUseTreasure={(cardId, heroId) => useTreasureCard(cardId, heroId)}
          onClose={handleCloseTreasure}
        />
      )}

      <DiceAnnouncementOverlay />
    </div>
    </TilePlacementContext.Provider>
  );
};

const Root: React.FC = () => (
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);

export default Root;
