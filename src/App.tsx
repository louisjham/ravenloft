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
import { PhysicsGroundPlane } from './components/3d/PhysicsGroundPlane';
import { TableSurface } from './components/3d/TableSurface';
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
import { DiceAnnouncementOverlay } from './components/ui/DiceAnnouncementOverlay';
import EncounterCardOverlay from './components/ui/EncounterCardOverlay';
import { DataLoader } from './game/dataLoader';
import { ExperienceSystem } from './game/engine/ExperienceSystem';
import { ScenarioManager } from './game/scenarios/ScenarioManager';

// Import diagnostic tools for debugging tile placement
import './testing/tile-placement-diagnostics';
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
import { TilePlacementContext } from './contexts/TilePlacementContext';
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

  // Reactive XP selector — used to compute canCancelEncounter below.
  // Uses ExperienceSystem to check if XP values in the pile sum to >= 5 (subset-sum).
  const canCancelEncounter = gameState ? ExperienceSystem.canCancelEncounter(gameState) : false;

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

  const handleStartGame = (scenarioId: string, heroIds: string[]) => {
    console.log('[DEBUG] App.handleStartGame: Called with', scenarioId, heroIds);
    startTransition(); // Show transition overlay
    startNewGame(scenarioId, heroIds);
    hideModal();
    // End transition after a short delay to allow game to initialize
    setTimeout(() => endTransition(), 1500);
  };

  const monsters = gameState?.monsters || [];

  const handlePlacementConfirm = React.useCallback(() => {
    if (!gameState || (exploration.phase !== 'positioning' && exploration.phase !== 'placement_blocked')) return;

    const { pendingTileRotation, closeTilePlacer } = useUIStore.getState();

    const pt = gameState.tiles.find(t => t.id === exploration.point.tileId)!;
    let targetX = pt.x;
    let targetZ = pt.z;
    if (exploration.point.edge === 'north') targetZ -= 1;
    else if (exploration.point.edge === 'south') targetZ += 1;
    else if (exploration.point.edge === 'east') targetX += 1;
    else if (exploration.point.edge === 'west') targetX -= 1;

    const validation = TileSystem.validateEdgeAlignment(
      gameState.tiles,
      exploration.drawnTile,
      targetX,
      targetZ,
      pendingTileRotation,
      exploration.point.edge
    );

    const newState = onPlacementAttempted(
      setTileRotation(exploration, pendingTileRotation),
      validation
    );

    if (newState.phase === 'placing') {
      closeTilePlacer();
      const finalState = TileSystem.placeTile(gameState, newState.point, newState.rotation);
      // Find the newly placed tile to draw a monster on it
      const placedTile = finalState.tiles.find(t => t.x === targetX && t.z === targetZ);
      if (placedTile) {
        const stateWithMonster = TileSystem.spawnMonsterForExploration(finalState, placedTile);
        // Process special rules (time tracks, lair spawns, etc.)
        const stateWithRules = ScenarioManager.processPostExplore(stateWithMonster, placedTile);
        setGameState({ ...stateWithRules, hasExploredThisTurn: true, lastPlacedTileEncounterType: placedTile.encounterType ?? null });
      } else {
        setGameState({ ...finalState, hasExploredThisTurn: true, lastPlacedTileEncounterType: null });
      }
      setExploration(onPlacementComplete(newState));
    } else if (newState.phase === 'placement_blocked') {
      const c = validation.conflicts[0];
      const reason = c
        ? c.neighborTileId
          ? `Edge mismatch with ${c.neighborTileId}`
          : `Placement blocked: ${c.description}`
        : "Invalid placement";

      setGameState({
        ...gameState,
        log: [
          ...gameState.log,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: `Placement Invalid: ${reason}`,
            type: 'system' as const
          }
        ].slice(-100)
      });
      useUIStore.getState().setTilePlacementError(reason);
      setExploration(newState);
    } else {
      setExploration(newState);
    }
  }, [gameState, exploration, setGameState, drawEncounterCard]);

  const handlePlacementCancel = React.useCallback(() => {
    if (!gameState || (exploration.phase !== 'positioning' && exploration.phase !== 'placement_blocked')) return;

    setGameState({
      ...gameState,
      dungeonDeck: exploration.drawnTile ? [exploration.drawnTile.id, ...exploration.remainingDeck] : exploration.remainingDeck
    });
    useUIStore.getState().closeTilePlacer();
    setExploration(onCancel(exploration));
  }, [gameState, exploration, setGameState]);

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
            </React.Suspense>
            <DungeonBoard />
            {gameState && (
              <ExplorationLayer
                tiles={gameState.tiles}
                explorationState={exploration}
                onEdgeSelected={(point) => {
                  if (gameState.phase !== 'hero') return;
                  // Rule: Hero can only explore once per turn
                  if (gameState.hasExploredThisTurn) {
                    console.log('[Explore] Already explored this turn');
                    return;
                  }
                  const drawResult = TileSystem.drawAndPlace(gameState, point);
                  const newState = onArrowClicked(exploration, point, drawResult);
                  setExploration(newState);
                  if (newState.phase === 'positioning') {
                    useUIStore.getState().openTilePlacer();
                    useUIStore.setState({ pendingTileRotation: newState.currentRotation });
                  }
                }}
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

            <FireParticles position={[0.5, 0, 0.5]} />
            <MonsterAIIndicator />
          </Physics>
        </Scene>
      )}

      {/* Show UIOverlay when not in setup phase (includes MainMenu when gameState is null) */}
      {!(gameState && gameState.phase === 'setup') && (
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
            <h2 className="gothic-title" style={{ color: 'var(--color-red)', marginBottom: '15px' }}>Deck Exhausted</h2>
            <p style={{ color: 'var(--color-text-dim)', marginBottom: '25px', lineHeight: '1.5' }}>
              No tiles remaining in the dungeon deck. The darkness closes in...
            </p>
            <button
              className="action-button"
              style={{
                width: '100%',
                background: 'rgba(139, 0, 0, 0.2)',
                border: '1px solid var(--color-red)',
                color: 'var(--color-red)',
                padding: '10px',
                fontFamily: 'Cinzel, serif',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 0, 0, 0.4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(139, 0, 0, 0.2)'}
              onClick={() => setExploration({ phase: 'idle' })}
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
          allCards={allCards}
          currentTurn={turnCount}
          onUseTreasure={(cardId, heroId) => useTreasureCard(cardId, heroId)}
          onClose={() => setTreasurePanelHeroId(null)}
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

