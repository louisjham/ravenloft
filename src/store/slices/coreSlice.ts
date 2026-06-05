import { StateCreator } from 'zustand';
import { GameStore, CoreSlice } from '../storeTypes';
import { GameState, Entity, Tile, Card, GameSettings, Hero } from '../../game/types';
import { SaveSystem } from '../../game/progression/SaveSystem';
import { DataLoader } from '../../game/dataLoader';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { TokenSystem } from '../../game/engine/TokenSystem';
import { EncounterSystem } from '../../game/engine/EncounterSystem';
import { useUIStore } from '../uiStore';
import { executeVillainPhase } from './villainPhaseLogic';
import { ObjectiveTracker } from '../../game/scenarios/Objectives';
import { ScenarioManager } from '../../game/scenarios/ScenarioManager';
import { isDev } from '../../utils/devEnv';

export const createCoreSlice: StateCreator<GameStore, [], [], CoreSlice> = (set, get) => ({
  gameState: null,
  selectedEntity: null,
  selectedCard: null,
  hoveredTile: null,
  isPaused: false,
  settings: {
    masterVolume: 0.8,
    musicVolume: 0.6,
    sfxVolume: 1.0,
    voiceVolume: 0.8,
    showDevTools: false,
    difficulty: 'normal',
  },

  setGameState: (gameState: GameState) => set({ gameState }),

  startNewGame: (scenarioId: string, heroIds: string[]) => {
    if (isDev()) console.log('[DEBUG] gameStore.startNewGame: Called with scenarioId:', scenarioId, 'heroIds:', heroIds);
    const dataLoader = DataLoader.getInstance();
    const scenario = dataLoader.getScenarios().find(s => s.id === scenarioId);
    const allHeroes = dataLoader.getHeroes();
    const selectedHeroes = heroIds.map(id => allHeroes.find(h => h.id === id)).filter(Boolean) as Hero[];

    if (!scenario) {
      console.error('[ERROR] gameStore.startNewGame: Scenario not found for ID:', scenarioId);
      return;
    }

    const initialState: GameState = {
      phase: 'setup',
      currentHeroId: selectedHeroes[0].id,
      heroes: selectedHeroes,
      monsters: [],
      tiles: (() => {
        const startTileTemplate = DataLoader.getInstance().getTileById(scenario.startTileId);
        if (!startTileTemplate) {
          console.error('[ERROR] Start tile template not found:', scenario.startTileId);
          return [];
        }
        return [{
          ...startTileTemplate,
          x: 0, z: 0,
          isRevealed: true,
          isStart: true,
          isExit: false,
          rotation: 0,
          monsters: [],
          heroes: selectedHeroes.map(h => h.id),
          items: []
        }];
      })(),
      dungeonDeck: (() => {
        const allTiles = DataLoader.getInstance().getTiles();
        const startTileId = scenario.startTileId;
        const setAside = scenario.setAsideTileIds ?? [];

        // Tiles to seed at specific positions (e.g. Chapel at index 8)
        const specialPlacements: { tileId: string; index: number }[] =
          (scenario.specialTilePlacements ?? []).map(p => ({
            tileId: p.tileId,
            index: p.insertAfterIndex
          }));

        const specialTileIds = new Set(specialPlacements.map(p => p.tileId));
        const setAsideSet = new Set(setAside);

        // Tiles that go into the general pool: exclude start, setAside, and specially-placed tiles
        let poolTileIds = allTiles
          .filter(t => t.id !== startTileId && !setAsideSet.has(t.id) && !specialTileIds.has(t.id))
          .map(t => t.id);

        // If scenario specifies tilePiles, cap the pool to the listed special tiles + standard count
        if (scenario.tilePiles) {
          const specialFromPool = poolTileIds.filter(id => scenario.tilePiles!.special.includes(id));
          const standardPool = poolTileIds.filter(id => !scenario.tilePiles!.special.includes(id));
          for (let i = standardPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [standardPool[i], standardPool[j]] = [standardPool[j], standardPool[i]];
          }
          const selectedStandard = standardPool.slice(0, scenario.tilePiles.standard);
          poolTileIds = [...selectedStandard, ...specialFromPool];
        }

        // Shuffle the pool
        for (let i = poolTileIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [poolTileIds[i], poolTileIds[j]] = [poolTileIds[j], poolTileIds[i]];
        }

        // If the scenario uses a lair packet system (Adventure 7), handle it
        if (scenario.lairPacketSize && scenario.lairCount && scenario.villainLairPairings) {
          const lairTileIds = scenario.villainLairPairings.map(p => p.lairTileId);
          const shuffledLairTiles = [...lairTileIds].sort(() => Math.random() - 0.5);
          const selectedLairTiles = shuffledLairTiles.slice(0, scenario.lairCount);

          // Build the lair packet: selected lair tiles shuffled into `lairPacketSize` pool tiles
          const packetSize = scenario.lairPacketSize;
          const packetPool = poolTileIds.splice(0, packetSize - selectedLairTiles.length);
          const lairPacket = [...packetPool, ...selectedLairTiles].sort(() => Math.random() - 0.5);

          // Insert lair packet near the beginning of the deck
          poolTileIds.splice(0, 0, ...lairPacket);
        }

        // Insert special placements at their positions
        const sortedPlacements = [...specialPlacements].sort((a, b) => a.index - b.index);
        for (const placement of sortedPlacements) {
          const insertAt = Math.min(placement.index, poolTileIds.length);
          poolTileIds.splice(insertAt, 0, placement.tileId);
        }

        return poolTileIds;
      })(),
      treasureDeck: (() => {
        const treasureTypes = ['treasure', 'item', 'consumable', 'weapon', 'summon'];
        const treasureIds = DataLoader.getInstance()
          .getAllCards()
          .filter(c => treasureTypes.includes(c.type))
          .map(c => c.id);
        for (let i = treasureIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [treasureIds[i], treasureIds[j]] = [treasureIds[j], treasureIds[i]];
        }
        return treasureIds;
      })(),
      encounterDeck: (() => {
        const encounterIds = DataLoader.getInstance()
          .getAllCards()
          .filter(c => c.type === 'encounter')
          .map(c => c.id);
        for (let i = encounterIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [encounterIds[i], encounterIds[j]] = [encounterIds[j], encounterIds[i]];
        }
        return encounterIds;
      })(),
      monsterDeck: (() => {
        const monsterIds = DataLoader.getInstance()
          .getMonsters()
          .map(m => m.id);
        for (let i = monsterIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [monsterIds[i], monsterIds[j]] = [monsterIds[j], monsterIds[i]];
        }
        return monsterIds;
      })(),
      discardPiles: { treasure: [], encounter: [], ability: [], monster: [] },
      activeScenario: scenario,
      turnOrder: selectedHeroes.map(h => h.id),
      healingSurges: scenario.maxSurges,
      turnCount: 0,
      log: [{ id: 'start', timestamp: new Date().toISOString(), message: `Scenario started: ${scenario.name}`, type: 'system' }],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [],
      villainPhaseQueue: [],
      activeVillainId: null,
      powerSelections: selectedHeroes.map(hero => ({ heroId: hero.id, selectedPowerIds: [], isConfirmed: false })),
      activeConditions: [],
      cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null },

      // Scenario-specific state
      ...(() => {
        const rules = scenario.specialRules || [];
        const extra: Record<string, unknown> = {};

        // Initialize time track if any special rule mentions it
        const hasTimeTrack = rules.some(r =>
          String(r.id ?? '').includes('sun_track') || String(r.id ?? '').includes('daylight') || String(r.id ?? '').includes('collapse') ||
          String(r.description ?? '').toLowerCase().includes('time track') ||
          String(r.description ?? '').toLowerCase().includes('sunset') ||
          String(r.description ?? '').toLowerCase().includes('advance the time')
        );
        if (hasTimeTrack) {
          extra.timeTrack = { current: 0, max: 6 };
        }

        // Strahd awakening (strahd_awakens rule or sun_track time-track scenarios)
        if (rules.some(r => {
          const id = String(r.id ?? '');
          return id.includes('strahd_awakens') || id.includes('sun_track') || id.includes('daylight_assault');
        })) {
          extra.strahdAwakened = false;
        }

        // Kavan / Fountain tokens
        if (scenario.id === 'adventure_05') {
          extra.fountainTokens = 5;
          extra.kavanEscortedBy = null;
          extra.tokens = [{
            id: 'item_kavan',
            type: 'item',
            name: 'Kavan',
            position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
            tileId: 'start-tile',
            isRevealed: true,
            isSearched: false,
          }];
        }

        // Chapel reveal tracking
        const hasChapel = scenario.setAsideTileIds?.includes('named_chapel');
        if (hasChapel) {
          extra.chapelRevealed = false;
        }

        // Lair pairings / villain tracking (Adventure 7)
        if (scenario.villainLairPairings) {
          extra.defeatedVillainIds = [];
        }

        return extra;
      })()
    };

    let finalState = TokenSystem.initializeScenarioTokens(initialState, scenario.id);
    set({ gameState: finalState });
  },

  loadGame: (saveId: string) => {
    const state = SaveSystem.loadGame(saveId);
    if (state) set({ gameState: state });
  },

  saveGame: () => {
    const { gameState } = get();
    if (gameState) SaveSystem.saveGame(gameState);
  },

  selectEntity: (entity: Entity | null) => set({ selectedEntity: entity }),
  selectCard: (card: Card | null) => set({ selectedCard: card }),
  hoverTile: (tile: Tile | null) => set({ hoveredTile: tile }),

  endTurn: () => {
    const state = get().gameState;
    if (!state) return;

    const currentEntity = [...state.heroes, ...state.monsters].find(e => e.id === state.currentHeroId);
    let updatedHeroes = [...state.heroes];
    let updatedMonsters = [...state.monsters];

    if (currentEntity) {
      const poisonDamage = ConditionSystem.processPoisonDamage(currentEntity);
      if (poisonDamage > 0) {
        const updated = CombatSystem.applyDamage(currentEntity, poisonDamage);
        if (currentEntity.type === 'hero') {
          updatedHeroes = updatedHeroes.map(h => h.id === currentEntity.id ? updated as Hero : h);
        }
      }
    }

    const treasuresClearedState = TreasureSystem.resetTreasuresDrawn({ ...state, heroes: updatedHeroes, monsters: updatedMonsters });
    // Cross-slice call: depends on conditionSlice.decrementConditions
    get().decrementConditions();

    // Check victory/defeat BEFORE villain phase
    // This ensures immediate feedback when objectives are met during the hero phase
    if (treasuresClearedState.phase !== 'setup') {
      const updatedObjectives = ObjectiveTracker.checkObjectives(treasuresClearedState);
      const allObjectivesComplete = updatedObjectives.every(obj => obj.isCompleted);
      const stateWithObjectives = {
        ...treasuresClearedState,
        activeScenario: { ...treasuresClearedState.activeScenario, objectives: updatedObjectives }
      };
      const isDefeated = ScenarioManager.checkDefeat(stateWithObjectives);

      if (isDefeated) {
        set({ gameState: { ...stateWithObjectives, phase: 'defeat' as const } });
        useUIStore.getState().showModal('defeat');
        return;
      }
      if (allObjectivesComplete) {
        set({ gameState: { ...stateWithObjectives, phase: 'victory' as const } });
        useUIStore.getState().showModal('victory');
        return;
      }
      // Fallback: check coffin victory separately (legacy scenario 1 support)
      const coffinVictory = TokenSystem.checkCoffinVictory(stateWithObjectives);
      if (coffinVictory.isVictory) {
        set({ gameState: stateWithObjectives });
        useUIStore.getState().showModal('victory');
        return;
      }
    }

    // Check if an encounter card should be drawn (start of villain phase)
    // Rules: draw encounter if chapel is revealed, no tile was placed, OR if the placed tile has a black triangle
    const placedType = state.lastPlacedTileEncounterType;
    const chapelRevealed = state.chapelRevealed === true;
    const shouldDrawEncounter = chapelRevealed || !placedType || placedType === 'black';

    if (shouldDrawEncounter && state.encounterDeck.length > 0) {
      const respiteResult = TreasureSystem.checkAndDiscardRespite(treasuresClearedState, 'encounterDeck');
      const drawResult = EncounterSystem.drawEncounterCard(respiteResult.gameState);

      if (drawResult.card) {
        set({
          gameState: {
            ...drawResult.newState,
            phase: 'villain' as const,
            hasExploredThisTurn: false,
            cardResolution: {
              phase: 'revealing' as const,
              cardId: drawResult.card.id,
              cardType: 'encounter' as const,
              pendingEffects: [],
              resolvedEffects: [],
              targetEntityId: null,
              result: null
            },
            pendingEncounter: true
          } as any
        });
        return; // Wait for encounter to be resolved before continuing
      }
    }

    // No encounter needed, or encounter deck empty — proceed with villain phase normally
    let newState = executeVillainPhase(treasuresClearedState);

    const currentIndex = newState.turnOrder.indexOf(newState.currentHeroId);
    const nextIndex = (currentIndex + 1) % newState.turnOrder.length;
    const nextId = newState.turnOrder[nextIndex];
    const stateAfterTurnStart = ConditionSystem.processTurnStart(newState, nextId);

    set({
      gameState: {
        ...stateAfterTurnStart,
        currentHeroId: nextId,
        phase: 'hero',
        hasExploredThisTurn: false,
        turnCount: stateAfterTurnStart.turnCount + (nextIndex === 0 ? 1 : 0)
      } as any
    });
  },

  levelUpHero: (heroId: string, newDailyPowerId?: string) => {
    const state = get().gameState;
    if (!state) return;

    const currentHero = state.heroes.find(h => h.id === heroId);
    if (!currentHero || currentHero.xp < 5) return;

    const updatedHeroes = state.heroes.map(hero => {
      if (hero.id === heroId) {
        return {
          ...hero,
          level: hero.level + 1,
          xp: hero.xp - 5,
          hp: hero.maxHp + 2,
          maxHp: hero.maxHp + 2,
          ac: hero.ac + 1,
          attackBonus: hero.attackBonus ? hero.attackBonus + 1 : 1,
          abilities: newDailyPowerId ? [...hero.abilities, newDailyPowerId] : hero.abilities
        };
      }
      return hero;
    });

    set({ gameState: { ...state, heroes: updatedHeroes } });
  },

  escapeHero: (heroId: string) => {
    set((state) => {
      if (!state.gameState) return {};
      const heroes = state.gameState.heroes.map(h => 
        h.id === heroId ? { ...h, escaped: true } : h
      );
      return { gameState: { ...state.gameState, heroes } };
    });
  },

  discardTreasureForPower: (heroId: string) => {
    console.log('discardTreasureForPower called for', heroId);
    // TODO: implement discard treasure for power upgrade
  },

  pauseGame: () => set({ isPaused: true }),
  unpauseGame: () => set({ isPaused: false }),
  updateSettings: (newSettings: Partial<GameSettings>) => set(state => ({ settings: { ...state.settings, ...newSettings } }))
});
