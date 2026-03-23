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
import VillainPhaseOverlay from './components/ui/VillainPhaseOverlay';
import PowerSelectionScreen from './components/ui/PowerSelectionScreen';

import { GlobalErrorBoundary } from './utils/errorHandling';
import { SceneTransition, PhaseTransition } from './components/effects/Transitions';
import { TutorialOverlay, HelpOverlay } from './components/tutorial/TutorialSystem';
import { TileSystem } from './game/engine/TileSystem';
import EncounterCardOverlay from './components/ui/EncounterCardOverlay';
import { DataLoader } from './game/dataLoader';
import {
  ExplorationState,
  onArrowClicked,
  onPlacementAttempted,
  setTileRotation,
  onCancel,
  onPlacementComplete
} from './game/engine/ExplorationStateMachine';
import { ExplorationLayer } from './components/3d/ExplorationLayer';
import { RotationPicker } from './components/ui/RotationPicker';
import TreasureCardPanel from './components/ui/TreasureCardPanel';

const App: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const setGameState = useGameStore((state) => state.setGameState);

  // Power selection store methods
  const selectPower = useGameStore((state) => state.selectPower);
  const deselectPower = useGameStore((state) => state.deselectPower);
  const confirmHeroSelection = useGameStore((state) => state.confirmHeroSelection);
  const autoSelectPowers = useGameStore((state) => state.autoSelectPowers);
  const beginAdventure = useGameStore((state) => state.beginAdventure);
  const drawEncounterCard = useGameStore((state) => state.drawEncounterCard);

  const [exploration, setExploration] = React.useState<ExplorationState>({ phase: 'idle' });

  const activeModal = useUIStore((state) => state.activeModal);
  const hideModal = useUIStore((state) => state.hideModal);
  const isTransitioning = useUIStore((state) => state.isTransitioning);
  const startTransition = useUIStore((state) => state.startTransition);
  const endTransition = useUIStore((state) => state.endTransition);

  // Individual game store selectors for card resolution system
  const cardResolution = useGameStore((state) => state.gameState?.cardResolution);
  const heroes = useGameStore((state) => state.gameState?.heroes || []);
  const advanceCardResolution = useGameStore((state) => state.advanceCardResolution);
  const selectResolutionTarget = useGameStore((state) => state.selectResolutionTarget);
  const dismissCardResolution = useGameStore((state) => state.dismissCardResolution);

  // Treasure Card Panel state and individual selectors
  const [treasurePanelHeroId, setTreasurePanelHeroId] = React.useState<string | null>(null);
  const treasureAssignments = useGameStore(s => s.gameState?.treasureAssignments || []);
  const turnCount = useGameStore(s => s.gameState?.turnCount || 0);
  const useTreasureCard = useGameStore(s => s.useTreasureCard);

  const treasurePanelHero = React.useMemo(() =>
    heroes.find(h => h.id === treasurePanelHeroId) ?? null,
    [heroes, treasurePanelHeroId]
  );

  const allCards = React.useMemo(() =>
    DataLoader.getInstance().getAllCards(),
    [] // card definitions are static
  );

  const resolvedCard = React.useMemo(() => {
    if (!cardResolution?.cardId) return null;
    return DataLoader.getInstance().getCardById(cardResolution.cardId) ?? null;
  }, [cardResolution?.cardId]);

  const handleStartGame = (scenarioId: string, heroIds: string[]) => {
    console.log('[DEBUG] App.handleStartGame: Called with', scenarioId, heroIds);
    startTransition(); // Show transition overlay
    startNewGame(scenarioId, heroIds);
    hideModal();
    // End transition after a short delay to allow game to initialize
    setTimeout(() => endTransition(), 1500);
  };

  const monsters = gameState?.monsters || [];

  React.useEffect(() => {
    const handleConfirm = () => {
      if (!gameState || (exploration.phase !== 'positioning' && exploration.phase !== 'placement_blocked')) return;
      
      const { pendingTileRotation, closeTilePlacer } = useUIStore.getState();
      const newState = onPlacementAttempted(
        setTileRotation(exploration, pendingTileRotation), 
        { valid: true, conflicts: [], warnings: [] }
      );
      
      if (newState.phase === 'placing') {
         closeTilePlacer();
         const finalState = TileSystem.placeTile(gameState, newState.point, newState.rotation);
         setGameState(finalState);
         setExploration(onPlacementComplete(newState));
         if (gameState.phase !== 'setup') drawEncounterCard();
      } else {
         setExploration(newState);
      }
    };

    const handleCancel = () => {
      if (!gameState || (exploration.phase !== 'positioning' && exploration.phase !== 'placement_blocked')) return;

      setGameState({
        ...gameState,
        // @ts-ignore
        dungeonDeck: [exploration.drawnTile.id, ...exploration.remainingDeck]
      });
      useUIStore.getState().closeTilePlacer();
      setExploration(onCancel(exploration));
    };

    window.addEventListener('confirm-tile-placement', handleConfirm);
    window.addEventListener('cancel-tile-placement', handleCancel);

    return () => {
      window.removeEventListener('confirm-tile-placement', handleConfirm);
      window.removeEventListener('cancel-tile-placement', handleCancel);
    };
  }, [exploration, gameState, setGameState, drawEncounterCard]);

  return (
    <div className="app-container">
      <AudioReactComponent />

      {gameState && gameState.phase === 'setup' ? (
        <PowerSelectionScreen
          heroes={gameState.heroes}
          powerSelections={gameState.powerSelections ?? []}
          onSelectPower={(heroId: string, card: any) => selectPower(heroId, card)}
          onDeselectPower={(heroId: string, id: string) => deselectPower(heroId, id)}
          onConfirmHero={(heroId: string) => confirmHeroSelection(heroId)}
          onAutoSelect={(heroId: string) => autoSelectPowers(heroId)}
          onConfirmAll={() => beginAdventure()}
        />
      ) : (
        <Scene>
          <Physics>
            <GameController />
            <DungeonBoard />
            {gameState && (
              <ExplorationLayer
                tiles={gameState.tiles}
                // @ts-ignore
                explorationState={exploration}
                onEdgeSelected={(point) => {
                  const drawResult = TileSystem.drawAndPlace(gameState, point);
                  const newState = onArrowClicked(exploration, point, drawResult);
                  setExploration(newState);
                  if (newState.phase === 'positioning') {
                    useUIStore.getState().openTilePlacer();
                  }
                }}
              />
            )}

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
      )}

      {/* Only show UIOverlay during gameplay, not during setup phase */}
      {gameState && gameState.phase !== 'setup' && (
        <UIOverlay onStartGame={handleStartGame} onOpenTreasure={(heroId) => setTreasurePanelHeroId(heroId)} />
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
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>No tiles remaining in deck.</div>
          <button onClick={() => setExploration({ phase: 'idle' })}>
            OK
          </button>
        </div>
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
          onAdvance={advanceCardResolution}
          onSelectTarget={selectResolutionTarget}
          onDismiss={dismissCardResolution}
        />
      )}

      {treasurePanelHero && (
        <TreasureCardPanel
          hero={treasurePanelHero}
          assignments={treasureAssignments}
          allCards={allCards}
          currentTurn={turnCount}
          onUseTreasure={(cardId, heroId) => useTreasureCard(cardId, heroId)}
          onClose={() => setTreasurePanelHeroId(null)}
        />
      )}
    </div>
  );
};

const Root: React.FC = () => (
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);

export default Root;

