import { StateCreator } from 'zustand';
import { GameStore, CoreSlice } from '../storeTypes';
import { GameState, Entity, Tile, Card, GameSettings, Hero, GameLogEntry } from '../../game/types';
import { SaveSystem } from '../../game/progression/SaveSystem';
import { DataLoader } from '../../game/dataLoader';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { CombatSystem } from '../../game/engine/CombatSystem';
import { TreasureSystem } from '../../game/engine/TreasureSystem';
import { TokenSystem } from '../../game/engine/TokenSystem';
import { EncounterSystem } from '../../game/engine/EncounterSystem';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';
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
    quickRoll: false,
    animationSpeed: 'normal',
    graphicsQuality: 'high',
    resolutionScale: 1.0,
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
      logIdCounter: 0,
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

        if (scenario.id === 'adventure_tome_of_strahd') {
          const top3 = poolTileIds.splice(0, 3);
          const tomePacket = [...top3, 'crypt_barov_ravenovia'].sort(() => Math.random() - 0.5);
          poolTileIds.splice(12, 0, ...tomePacket);
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
          .filter(m => !m.isBoss && m.experienceValue > 0)
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
      exploredThisTurn: false,
      hasExploredThisTurn: false,
      hasAttackedThisTurn: false,
      lastPlacedTileId: null,
      activeBlessings: [],

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

        if (scenario.id === 'adventure_tome_of_strahd') {
          const itemTokens = [
            'item_silver_dagger',
            'item_dimensional_shackles',
            'item_holy_water',
            'item_feywalk_amulet',
            'item_torch',
            'item_wooden_stake',
            'item_gravestorms_phylactery',
            'item_tome_of_strahd'
          ];
          extra.tomeOfStrahdItemStack = itemTokens.sort(() => Math.random() - 0.5);

          const villainTokens = [
            'monster_werewolf',
            'monster_howling_hag',
            'monster_dragolich',
            'monster_zombie_dragon',
            'monster_flesh_golem',
            'monster_kobold_sorcerer',
            'monster_young_vampire'
          ];
          extra.tomeOfStrahdVillainStack = villainTokens.sort(() => Math.random() - 0.5);
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

    // Process Freezing Cloud tokens at the end of the Hero Phase
    let stateForFreezingCloud = { ...state };
    const freezingCloudTokens = (stateForFreezingCloud.tokens || []).filter(t => t.name === 'Freezing Cloud');
    if (freezingCloudTokens.length > 0) {
      let updatedTokens = [...(stateForFreezingCloud.tokens || [])];
      let updatedMonsters = [...stateForFreezingCloud.monsters];
      let logsAdded: GameLogEntry[] = [];

      for (const fcToken of freezingCloudTokens) {
        const fcTile = stateForFreezingCloud.tiles.find(t => t.id === fcToken.tileId);
        if (fcTile) {
          const monstersOnTile = updatedMonsters.filter(m =>
            !m.isDefeated && m.hp > 0 && m.position.x === fcTile.x && m.position.z === fcTile.z
          );

          for (const m of monstersOnTile) {
            const damagedMonster = CombatSystem.applyDamage(m, 1);
            updatedMonsters = updatedMonsters.map(mon => mon.id === m.id ? (damagedMonster.hp <= 0 ? { ...damagedMonster, isDefeated: true } : damagedMonster) : mon);
            logsAdded.push({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              message: `Freezing Cloud deals 1 damage to ${m.name} on tile (${fcTile.x}, ${fcTile.z}).`,
              type: 'system' as const
            });
          }
        }

        const currentTokensCount = (fcToken.metadata?.cloudTokens as number) || 1;
        const newTokensCount = currentTokensCount - 1;
        if (newTokensCount <= 0) {
          updatedTokens = updatedTokens.filter(t => t.id !== fcToken.id);
          logsAdded.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: `Freezing Cloud dispersed (no cloud tokens remain).`,
            type: 'system' as const
          });
        } else {
          updatedTokens = updatedTokens.map(t => t.id === fcToken.id ? { ...t, metadata: { ...t.metadata, cloudTokens: newTokensCount } } : t);
        }
      }

      stateForFreezingCloud = {
        ...stateForFreezingCloud,
        tokens: updatedTokens,
        monsters: updatedMonsters,
        log: [...stateForFreezingCloud.log, ...logsAdded].slice(-100)
      };
    }

    const currentEntity = [...stateForFreezingCloud.heroes, ...stateForFreezingCloud.monsters].find(e => e.id === stateForFreezingCloud.currentHeroId);
    let updatedHeroes = [...stateForFreezingCloud.heroes];
    let updatedMonsters = [...stateForFreezingCloud.monsters];

    if (currentEntity) {
      const poisonDamage = ConditionSystem.processPoisonDamage(currentEntity);
      if (poisonDamage > 0) {
        const updated = CombatSystem.applyDamage(currentEntity, poisonDamage);
        if (currentEntity.type === 'hero') {
          updatedHeroes = updatedHeroes.map(h => h.id === currentEntity.id ? updated as Hero : h);
        }
      }
    }

    const treasuresClearedState = TreasureSystem.resetTreasuresDrawn(
      TreasureSystem.processDefeatedMonsters({ ...stateForFreezingCloud, heroes: updatedHeroes, monsters: updatedMonsters })
    );

    // Bug 4: commit treasuresClearedState first so decrementConditions reads the fresh state,
    // then retrieve the updated stateAfterDecrement and propagate it to all downstream actions.
    set({ gameState: treasuresClearedState });
    get().decrementConditions();
    let stateAfterDecrement = get().gameState!;

    const expiryResult = TreasureSystem.checkBlessingExpiry(stateAfterDecrement, stateAfterDecrement.currentHeroId);
    if (expiryResult.expired) {
      stateAfterDecrement = {
        ...expiryResult.newState,
        log: [...expiryResult.newState.log, {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: expiryResult.message,
          type: 'system'
        } as GameLogEntry].slice(-100)
      };
      set({ gameState: stateAfterDecrement });
    }

    // Tome of Strahd token reveal logic
    if (stateAfterDecrement.activeScenario.id === 'adventure_tome_of_strahd') {
      const activeHero = stateAfterDecrement.heroes.find(h => h.id === stateAfterDecrement.currentHeroId);
      if (activeHero && stateAfterDecrement.tokens) {
        const itemTokens = stateAfterDecrement.tokens.filter(t => t.type === 'item' && !t.isRevealed);
        
        for (const token of itemTokens) {
          const dx = (activeHero.position.x * 4 + activeHero.position.sqX) - (token.position.x * 4 + token.position.sqX);
          const dz = (activeHero.position.z * 4 + activeHero.position.sqZ) - (token.position.z * 4 + token.position.sqZ);
          
          if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
            const itemId = token.metadata?.itemId as string;
            if (itemId) {
              const updatedTokens = stateAfterDecrement.tokens!.map(t => 
                t.id === token.id ? { ...t, isRevealed: true, isSearched: true } : t
              );
              
              const updatedHero = {
                ...activeHero,
                items: [...activeHero.items, itemId]
              };

              stateAfterDecrement = {
                ...stateAfterDecrement,
                tokens: updatedTokens,
                heroes: stateAfterDecrement.heroes.map(h => h.id === updatedHero.id ? updatedHero : h),
                log: [...stateAfterDecrement.log, {
                  id: crypto.randomUUID(),
                  timestamp: new Date().toISOString(),
                  message: `${activeHero.name} discovered an item token and received a special item!`,
                  type: 'system' as const
                }].slice(-100)
              };
              set({ gameState: stateAfterDecrement });
            }
          }
        }
      }
    }

    // Deadly Shadows Environment Effect
    if (stateAfterDecrement.activeEnvironmentCard === 'enc_deadly_shadows') {
      const activeHero = stateAfterDecrement.heroes.find(h => h.id === stateAfterDecrement.currentHeroId);
      if (activeHero) {
        const hasOtherHero = stateAfterDecrement.heroes.some(h => h.id !== activeHero.id && h.position.x === activeHero.position.x && h.position.z === activeHero.position.z);
        if (hasOtherHero) {
          const damagedHero = CombatSystem.applyDamage(activeHero, 1, stateAfterDecrement);
          stateAfterDecrement = {
            ...stateAfterDecrement,
            heroes: stateAfterDecrement.heroes.map(h => h.id === damagedHero.id ? damagedHero : h),
            log: [...stateAfterDecrement.log, {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              message: `Deadly Shadows deals 1 damage to ${activeHero.name} for ending their turn on a shared tile!`,
              type: 'system' as const
            }].slice(-100)
          };
          set({ gameState: stateAfterDecrement });
        }
      }
    }

    // Check victory/defeat BEFORE villain phase
    // This ensures immediate feedback when objectives are met during the hero phase
    if (stateAfterDecrement.phase !== 'setup') {
      const updatedObjectives = ObjectiveTracker.checkObjectives(stateAfterDecrement);
      const allObjectivesComplete = updatedObjectives.every(obj => obj.isCompleted);
      const stateWithObjectives = {
        ...stateAfterDecrement,
        activeScenario: { ...stateAfterDecrement.activeScenario, objectives: updatedObjectives }
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
    const placedType = stateAfterDecrement.lastPlacedTileEncounterType;
    const chapelRevealed = stateAfterDecrement.chapelRevealed === true;
    const shouldDrawEncounter = chapelRevealed || !placedType || placedType === 'black';

    if (shouldDrawEncounter && stateAfterDecrement.encounterDeck.length > 0) {
      const respiteResult = TreasureSystem.checkAndDiscardRespite(stateAfterDecrement, 'encounterDeck');
      const drawResult = EncounterSystem.drawEncounterCard(respiteResult.gameState);

      if (drawResult.card) {
        set({
          gameState: {
            ...drawResult.newState,
            phase: 'villain' as const,
            hasExploredThisTurn: false,
            exploredThisTurn: true,
            lastPlacedTileId: null,
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
    let newState = executeVillainPhase(stateAfterDecrement);

    const currentIndex = newState.turnOrder.indexOf(newState.currentHeroId);
    const nextIndex = (currentIndex + 1) % newState.turnOrder.length;
    const nextId = newState.turnOrder[nextIndex];
    const stateAfterTurnStart = ConditionSystem.processTurnStart(newState, nextId);

    // Bug 5: Check defeat right at the start of the next hero's turn
    if (ScenarioManager.checkDefeat({ ...stateAfterTurnStart, currentHeroId: nextId })) {
      set({ gameState: { ...stateAfterTurnStart, currentHeroId: nextId, phase: 'defeat' } as any });
      useUIStore.getState().showModal('defeat');
      return;
    }

    set({
      gameState: {
        ...stateAfterTurnStart,
        currentHeroId: nextId,
        phase: 'hero',
        hasExploredThisTurn: false,
        exploredThisTurn: false,
        lastPlacedTileEncounterType: null,
        lastPlacedTileId: null,
        hasAttackedThisTurn: false,
        turnCount: stateAfterTurnStart.turnCount + (nextIndex === 0 ? 1 : 0),
        heroes: stateAfterTurnStart.heroes.map(h => {
          let startedTurnAdjacentToDreadWarriorIds: string[] = [];
          if (h.id === nextId) {
            const dreadWarriors = stateAfterTurnStart.monsters.filter(m => !m.isDefeated && m.hp > 0 && m.name.toLowerCase() === 'dread warrior');
            for (const dw of dreadWarriors) {
              const hAbsX = h.position.x * 4 + h.position.sqX;
              const hAbsZ = h.position.z * 4 + h.position.sqZ;
              const dwAbsX = dw.position.x * 4 + dw.position.sqX;
              const dwAbsZ = dw.position.z * 4 + dw.position.sqZ;
              const isAdjacent = Math.abs(hAbsX - dwAbsX) + Math.abs(hAbsZ - dwAbsZ) === 1;
              if (isAdjacent) {
                startedTurnAdjacentToDreadWarriorIds.push(dw.id);
              }
            }
          }
          return {
            ...h,
            extraActionsThisTurn: 0,
            hasRolledNatural20ThisTurn: false,
            hasUsedSurgeThisTurn: false,
            isExhausted: false,
            startedTurnAdjacentToDreadWarriorIds
          };
        })
      } as any
    });
  },

  levelUpHero: (heroId: string, newDailyPowerId?: string) => {
    const state = get().gameState;
    if (!state) return;

    const hero = state.heroes.find(h => h.id === heroId);
    if (!hero) return;

    // Delegate to ExperienceSystem which uses the shared experiencePile (card-based XP)
    const result = ExperienceSystem.levelUpHero(state, hero, newDailyPowerId);
    if (!result.success) {
      console.warn('[coreSlice.levelUpHero]', result.message);
      return;
    }

    const logEntry: GameLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      message: result.message,
      type: 'system' as const
    };

    set({
      gameState: {
        ...result.newState,
        log: [...result.newState.log, logEntry].slice(-100)
      }
    });
  },

  cureMummyRot: (heroId: string) => {
    const state = get().gameState;
    if (!state) return;

    const hero = state.heroes.find(h => h.id === heroId);
    if (!hero) return;

    const result = ExperienceSystem.cureMummyRot(state, hero);
    if (!result.success) {
      console.warn('[coreSlice.cureMummyRot]', result.message);
      return;
    }

    const logEntry: GameLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      message: result.message,
      type: 'system' as const
    };

    set({
      gameState: {
        ...result.newState,
        log: [...result.newState.log, logEntry].slice(-100)
      }
    });
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

  resolvePendingFortune: async (choice: Record<string, unknown>) => {
    const state = get().gameState;
    if (!state) return;
    if (!state.pendingFortune) {
      console.warn('[resolvePendingFortune] Called with no pendingFortune in state.');
      return;
    }
    const { newState, message } = await TreasureSystem.resolvePendingFortuneAsync(state, choice as any);
    const syncedState = ConditionSystem.syncActiveConditions(newState);
    const updatedState = {
      ...syncedState,
      log: [
        ...syncedState.log,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message,
          type: 'system' as const,
        }
      ].slice(-100)
    };
    set({ gameState: updatedState });
  },

  pauseGame: () => set({ isPaused: true }),
  unpauseGame: () => set({ isPaused: false }),
  updateSettings: (newSettings: Partial<GameSettings>) => set(state => ({ settings: { ...state.settings, ...newSettings } }))
});
