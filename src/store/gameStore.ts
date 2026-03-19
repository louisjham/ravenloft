import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { GameState, Entity, Tile, Card, GameSettings, Position, Hero, PowerType, Trap, Monster } from '../game/types'
import { SaveSystem } from '../game/progression/SaveSystem'
import { DataLoader } from '../game/dataLoader'
import { CombatSystem } from '../game/engine/CombatSystem'
import { ConditionSystem } from '../game/engine/ConditionSystem'
import { PowerSystem } from '../game/engine/PowerSystem'
import { EncounterSystem } from '../game/engine/EncounterSystem'
import { TreasureSystem } from '../game/engine/TreasureSystem'
import { ExperienceSystem } from '../game/engine/ExperienceSystem'
import { resolveTactic, resolveTrap, type TacticResult } from '../game/engine/MonsterAI'

interface GameStore {
  // State
  gameState: GameState | null
  selectedEntity: Entity | null
  selectedCard: Card | null
  hoveredTile: Tile | null
  isPaused: boolean
  settings: GameSettings

  // Actions
  setGameState: (state: GameState) => void
  startNewGame: (scenarioId: string, heroIds: string[]) => void
  loadGame: (saveId: string) => void
  saveGame: () => void

  // Selection
  selectEntity: (entity: Entity | null) => void
  selectCard: (card: Card | null) => void
  hoverTile: (tile: Tile | null) => void

  // Game actions
  moveHero: (targetPosition: Position) => void
  attackMonster: (monsterId: string) => void
  playCard: (cardId: string, targetId: string) => void
  endTurn: () => void

  // Power System actions
  usePower: (cardId: string, targetId: string) => void
  resetPower: (powerId: string) => void
  getAvailablePowers: () => Card[]

  // Encounter System actions
  drawEncounterCard: () => void
  cancelEncounterCard: (cardId: string) => void
  disableTrap: (trapId: string) => void

  // Treasure System actions
  drawTreasureCard: () => void
  useTreasureCard: (cardId: string, targetId?: string) => void
  assignItem: (cardId: string, heroId: string) => void

  // Experience System actions
  levelUpHero: (heroId: string, newDailyPowerId?: string) => void

  // UI stubs for testing initial UI components
  initializeDummyState: () => void

  // UI Actions
  pauseGame: () => void
  unpauseGame: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
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

    // Actions
    setGameState: (gameState: GameState) => set({ gameState }),

    startNewGame: (scenarioId: string, heroIds: string[]) => {
      console.log('[DEBUG] gameStore.startNewGame: Called with scenarioId:', scenarioId, 'heroIds:', heroIds);
      const dataLoader = DataLoader.getInstance();
      const allScenarios = dataLoader.getScenarios();
      console.log('[DEBUG] gameStore.startNewGame: Available scenarios:', allScenarios.map(s => s.id));
      const scenario = dataLoader.getScenarios().find(s => s.id === scenarioId);
      console.log('[DEBUG] gameStore.startNewGame: Found scenario:', scenario);
      const allHeroes = dataLoader.getHeroes();
      console.log('[DEBUG] gameStore.startNewGame: Available heroes:', allHeroes.map(h => h.id));
      const selectedHeroes = heroIds.map(id => allHeroes.find(h => h.id === id)).filter(Boolean) as Hero[];
      console.log('[DEBUG] gameStore.startNewGame: Selected heroes:', selectedHeroes);

      if (!scenario) {
        console.error('[ERROR] gameStore.startNewGame: Scenario not found for ID:', scenarioId);
        return;
      }

      const initialState: GameState = {
        phase: 'setup',
        currentHeroId: selectedHeroes[0].id,
        heroes: selectedHeroes,
        monsters: [],
        tiles: [{
          id: scenario.startTileId,
          name: 'Entrance',
          x: 0, z: 0,
          terrainType: 'corridor',
          connections: [],
          boneSquare: { sqX: 1, sqZ: 1 },
          isRevealed: true,
          isStart: true,
          isExit: false,
          rotation: 0,
          monsters: [],
          heroes: selectedHeroes.map(h => h.id),
          items: []
        }],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        discardPiles: {},
        activeScenario: scenario,
        turnOrder: selectedHeroes.map(h => h.id),
        healingSurges: scenario.maxSurges,
        turnCount: 0,
        log: [{
          id: 'start',
          timestamp: new Date().toLocaleTimeString(),
          message: `Scenario started: ${scenario.name}`,
          type: 'system'
        }],
        // New state fields
        activeEnvironmentCard: null,
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null
      };

      set({ gameState: initialState });
    },

    loadGame: (saveId: string) => {
      const state = SaveSystem.loadGame(saveId);
      if (state) set({ gameState: state });
    },

    saveGame: () => {
      const { gameState } = get();
      if (gameState) SaveSystem.saveGame(gameState);
    },

    // Selection
    selectEntity: (entity: Entity | null) => set({ selectedEntity: entity }),
    selectCard: (card: Card | null) => set({ selectedCard: card }),
    hoverTile: (tile: Tile | null) => set({ hoveredTile: tile }),

    // Game Actions
    moveHero: (targetPosition: Position) => {
      const state = get().gameState;
      if (!state) return;

      const updatedHeroes = state.heroes.map(hero => {
        if (hero.id === state.currentHeroId) {
          return { ...hero, position: targetPosition };
        }
        return hero;
      });

      const updatedLog: import('../game/types').GameLogEntry[] = [
        ...state.log,
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString(),
          message: `${state.heroes.find(h => h.id === state.currentHeroId)?.name} moves to (${targetPosition.x}, ${targetPosition.z})`,
          type: 'action'
        }
      ];

      set({ gameState: { ...state, heroes: updatedHeroes, log: updatedLog } });
    },

    attackMonster: (monsterId: string) => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      const monster = state.monsters.find(m => m.id === monsterId);

      if (!hero || !monster) return;

      // Combat logic - use hero's attackBonus and monster's damage for counter-attack
      const result = CombatSystem.resolveAttack(hero, monster, hero.ac, monster.damage);

      const updatedMonsters = state.monsters.map(m => {
        if (m.id === monsterId) {
          return { ...m, hp: Math.max(0, m.hp - result.damage) };
        }
        return m;
      });

      const updatedLog: import('../game/types').GameLogEntry[] = [
        ...state.log,
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString(),
          message: `${hero.name} attacks ${monster.name} and deals ${result.damage} damage!`,
          type: 'combat'
        }
      ];

      set({ gameState: { ...state, monsters: updatedMonsters, log: updatedLog } });
    },

    playCard: (cardId: string, targetId: string) => {
      console.log('[DEBUG gameStore] Play card:', cardId, 'on target:', targetId);
      const state = get().gameState;
      if (!state) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);
      if (!card) {
        console.log('[DEBUG gameStore] Card not found:', cardId);
        return;
      }

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) {
        console.log('[DEBUG gameStore] Hero not found:', state.currentHeroId);
        return;
      }

      // Handle different card types
      if (card.type === 'ability') {
        // Use PowerSystem for ability cards
        const target = targetId ? [...state.heroes, ...state.monsters].find(e => e.id === targetId) || null : null;
        const result = PowerSystem.usePower(hero, card, target, state);

        if (result.success) {
          const updatedLog: import('../game/types').GameLogEntry[] = [
            ...state.log,
            {
              id: Math.random().toString(),
              timestamp: new Date().toLocaleTimeString(),
              message: result.message,
              type: 'action'
            }
          ];
          set({ gameState: { ...state, heroes: [...state.heroes], log: updatedLog } });
        } else {
          console.log('[DEBUG gameStore] Power use failed:', result.message);
        }
      } else if (card.type === 'treasure') {
        // Handle treasure cards
        if (card.treasureType === 'blessing') {
          const result = TreasureSystem.useBlessing(state, card, hero);
          console.log('[DEBUG gameStore] Blessing result:', result);
        } else if (card.treasureType === 'fortune') {
          const result = TreasureSystem.useFortune(state, card, hero);
          console.log('[DEBUG gameStore] Fortune result:', result);
        } else if (card.treasureType === 'item') {
          const result = TreasureSystem.assignItem(state, card, hero);
          console.log('[DEBUG gameStore] Item assigned:', result);
        }
      }
    },

    endTurn: () => {
      const state = get().gameState;
      if (!state) return;

      console.log('[DEBUG gameStore] Ending hero phase for:', state.currentHeroId, 'Current Phase:', state.phase);

      // Rulebook: After Exploration Phase -> Villain Phase
      // If we are currently in hero or exploration phase, ending the turn moves us to the Villain phase.
      if (state.phase === 'hero' || state.phase === 'exploration') {
        // First transition to villain phase, then execute villain phase logic
        let newState: GameState = {
          ...state,
          phase: 'villain' as const
        };
        // Execute villain phase immediately after transitioning
        newState = executeVillainPhase(newState);
        set({ gameState: newState });
        console.log('[DEBUG gameStore] Transitioning to Villain phase and executing villain phase.');
        return;
      }

      // If we are ALREADY in the Villain phase and ending the turn, we pass to the NEXT hero.
      console.log('[DEBUG gameStore] Villain phase ended. Passing turn to next hero.');

      // Process conditions for the current entity
      const currentEntity = [...state.heroes, ...state.monsters].find(e => e.id === state.currentHeroId);
      if (currentEntity) {
        // Process poison damage at start of turn (if poisoned)
        const poisonDamage = ConditionSystem.processPoisonDamage(currentEntity);
        if (poisonDamage > 0) {
          CombatSystem.applyDamage(currentEntity, poisonDamage);
        }

        // Process condition expiration at end of turn
        ConditionSystem.processTurnEnd(currentEntity);
      }

      // Reset treasures drawn counter for next turn
      TreasureSystem.resetTreasuresDrawn(state);

      // Execute Villain Phase cascade before advancing to next hero
      let newState = state;
      newState = executeVillainPhase(newState);

      const currentIndex = newState.turnOrder.indexOf(newState.currentHeroId);
      const nextIndex = (currentIndex + 1) % newState.turnOrder.length;
      const nextId = newState.turnOrder[nextIndex];

      const newPhase = nextId.startsWith('m') ? 'monster' : 'hero';

      set({
        gameState: {
          ...newState,
          currentHeroId: nextId,
          phase: 'hero', // Next player starts their Hero phase
          turnCount: newState.turnCount + (nextIndex === 0 ? 1 : 0)
        }
      });

      console.log('[DEBUG gameStore] Turn ended, next entity:', nextId, 'new phase: hero');
    },

    // Power System actions
    usePower: (cardId: string, targetId: string) => {
      const state = get().gameState;
      if (!state) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);
      if (!card) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const target = targetId ? [...state.heroes, ...state.monsters].find(e => e.id === targetId) || null : null;
      const result = PowerSystem.usePower(hero, card, target, state);

      if (result.success) {
        const updatedLog: import('../game/types').GameLogEntry[] = [
          ...state.log,
          {
            id: Math.random().toString(),
            timestamp: new Date().toLocaleTimeString(),
            message: result.message,
            type: 'action'
          }
        ];
        set({ gameState: { ...state, heroes: [...state.heroes], log: updatedLog } });
      }
    },

    resetPower: (powerId: string) => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      PowerSystem.resetPower(hero, powerId);
      set({ gameState: { ...state, heroes: [...state.heroes] } });
    },

    getAvailablePowers: () => {
      const state = get().gameState;
      if (!state) return [];

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return [];

      const dataLoader = DataLoader.getInstance();
      const allCards = dataLoader.getAllCards();
      return PowerSystem.getAvailablePowers(hero, allCards);
    },

    // Encounter System actions
    drawEncounterCard: () => {
      const state = get().gameState;
      if (!state) return;

      const result = EncounterSystem.drawEncounterCard(state);
      if (result.card) {
        console.log('[DEBUG gameStore] Encounter card drawn:', result.message);
        // Process the encounter card based on its type
        if (result.card.encounterType === 'environment') {
          EncounterSystem.processEnvironmentCard(state, result.card);
        } else if (result.card.encounterType === 'event' || result.card.encounterType === 'event-attack') {
          const hero = state.heroes.find(h => h.id === state.currentHeroId);
          if (hero) {
            if (result.card.encounterType === 'event-attack') {
              EncounterSystem.processEventAttackCard(state, result.card, hero);
            } else {
              EncounterSystem.processEventCard(state, result.card, hero);
            }
          }
        } else if (result.card.encounterType === 'trap') {
          const hero = state.heroes.find(h => h.id === state.currentHeroId);
          if (hero) {
            EncounterSystem.placeTrap(state, result.card, hero);
          }
        }
        set({ gameState: { ...state } });
      }
    },

    cancelEncounterCard: (cardId: string) => {
      const state = get().gameState;
      if (!state) return;

      const result = ExperienceSystem.cancelEncounterCard(state, cardId);
      console.log('[DEBUG gameStore] Cancel encounter:', result.message);
      if (result.success) {
        set({ gameState: { ...state } });
      }
    },

    disableTrap: (trapId: string) => {
      const state = get().gameState;
      if (!state) return;

      const trap = state.traps.find(t => t.id === trapId);
      if (!trap) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(trap.cardId);
      if (!card) return;

      const result = EncounterSystem.attemptDisableTrap(state, hero, trap, card);
      console.log('[DEBUG gameStore] Disable trap:', result.message);
      if (result.success) {
        set({ gameState: { ...state } });
      }
    },

    // Treasure System actions
    drawTreasureCard: () => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const result = TreasureSystem.drawTreasureCard(state, hero);
      console.log('[DEBUG gameStore] Draw treasure:', result.message);
      if (result.card) {
        set({ gameState: { ...state } });
      }
    },

    useTreasureCard: (cardId: string, targetId?: string) => {
      const state = get().gameState;
      if (!state) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);
      if (!card) return;

      const hero = state.heroes.find(h => h.id === state.currentHeroId);
      if (!hero) return;

      const target = targetId ? [...state.heroes, ...state.monsters].find(e => e.id === targetId) || null : null;
      const result = TreasureSystem.useItem(state, card, hero, target);
      console.log('[DEBUG gameStore] Use treasure:', result.message);
      if (result.success) {
        set({ gameState: { ...state, heroes: [...state.heroes] } });
      }
    },

    assignItem: (cardId: string, heroId: string) => {
      const state = get().gameState;
      if (!state) return;

      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);
      if (!card) return;

      const hero = state.heroes.find(h => h.id === heroId);
      if (!hero) return;

      const result = TreasureSystem.assignItem(state, card, hero);
      console.log('[DEBUG gameStore] Assign item:', result.message);
      if (result.success) {
        set({ gameState: { ...state, heroes: [...state.heroes] } });
      }
    },

    // Experience System actions
    levelUpHero: (heroId: string, newDailyPowerId?: string) => {
      const state = get().gameState;
      if (!state) return;

      const hero = state.heroes.find(h => h.id === heroId);
      if (!hero) return;

      const result = ExperienceSystem.levelUpHero(state, hero, newDailyPowerId);
      console.log('[DEBUG gameStore] Level up:', result.message);
      if (result.success) {
        const updatedLog: import('../game/types').GameLogEntry[] = [
          ...state.log,
          {
            id: Math.random().toString(),
            timestamp: new Date().toLocaleTimeString(),
            message: result.message,
            type: 'system'
          }
        ];
        set({ gameState: { ...state, heroes: [...state.heroes], log: updatedLog } });
      }
    },

    // UI Control
    pauseGame: () => set({ isPaused: true }),
    unpauseGame: () => set({ isPaused: false }),
    updateSettings: (newSettings: Partial<GameSettings>) => set((state: GameStore) => ({
      settings: { ...state.settings, ...newSettings }
    })),

    // Mock state for developer usage
    initializeDummyState: () => {
      set({
        gameState: {
          phase: 'hero',
          currentHeroId: 'h1',
          heroes: [
            {
              id: 'h1',
              name: 'Arjhan',
              type: 'hero',
              heroClass: 'Paladin',
              hp: 10,
              maxHp: 10,
              ac: 16,
              speed: 6,
              isExhausted: false,
              level: 1,
              xp: 0,
              surgeUsed: false,
              abilities: ['strike', 'heal'],
              hand: [],
              items: [],
              position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
              conditions: [],
              usedPowers: []
            }
          ],
          monsters: [
            {
              id: 'm1',
              name: 'Goblin',
              type: 'monster',
              monsterType: 'Goblin',
              hp: 1,
              maxHp: 1,
              ac: 12,
              speed: 6,
              isExhausted: false,
              behavior: { conditions: [], priorityTargets: [], actions: [] },
              attackBonus: 2,
              damage: 1,
              experienceValue: 100,
              position: { x: 0, z: 0, sqX: 3, sqZ: 3 },
              conditions: [],
              usedPowers: [],
              ownedByHeroId: 'h1'
            }
          ],
          tiles: [
            {
              id: 'start-tile',
              name: 'Crypt Entrance',
              x: 0,
              z: 0,
              terrainType: 'corridor',
              connections: [],
              boneSquare: { sqX: 1, sqZ: 1 },
              isRevealed: true,
              isStart: true,
              isExit: false,
              rotation: 0,
              monsters: ['m1'],
              heroes: ['h1'],
              items: []
            }
          ],
          dungeonDeck: [],
          treasureDeck: [],
          encounterDeck: [],
          discardPiles: {},
          activeScenario: {
            id: 's1',
            name: 'Find the Icon of Ravenloft',
            difficulty: 'Easy',
            description: 'You must delve deep into the crypts to retrieve the Icon of Ravenloft.',
            introText: 'Enter the crypts...',
            victoryText: 'You found it!',
            defeatText: 'The darkness wins.',
            objectives: [],
            specialRules: [],
            startTileId: 'start-tile',
            maxSurges: 2
          },
          turnOrder: ['h1', 'm1'],
          healingSurges: 2,
          turnCount: 1,
          log: [
            { id: '1', timestamp: new Date().toLocaleTimeString(), message: 'The party enters the crypt.', type: 'system' }
          ],
          // New state fields
          activeEnvironmentCard: null,
          experiencePile: [],
          treasuresDrawnThisTurn: 0,
          traps: [],
          villainPhaseQueue: [],
          activeVillainId: null
        }
      });
    }
  }))
)

/**
 * Helper function to build the Villain Phase queue.
 * Returns an ordered array of ids where:
 * - All monsters with ownedByHeroId === activeHeroId come first (sorted by insertion order)
 * - All traps with ownedByHeroId === activeHeroId follow
 * - Skip any monster with hp <= 0
 */
export function buildVillainQueue(
  state: GameState,
  activeHeroId: string
): string[] {
  const queue: string[] = [];

  // Add monsters owned by the active hero (alive only, insertion order)
  for (const monster of state.monsters) {
    if (monster.ownedByHeroId === activeHeroId && monster.hp > 0) {
      queue.push(monster.id);
    }
  }

  // Add traps owned by the active hero (insertion order)
  for (const trap of state.traps) {
    if (trap.ownedByHeroId === activeHeroId) {
      queue.push(trap.id);
    }
  }

  return queue;
}

/**
 * Execute the Villain Phase cascade.
 * Processes the villain queue one entry at a time, applying monster tactics and trap triggers.
 *
 * Logic:
 * 1. Call buildVillainQueue(state, state.activeHeroId) and assign to state.villainPhaseQueue
 * 2. For each id in villainPhaseQueue:
 *    a. Set state.activeVillainId = id
 *    b. Determine if id belongs to a Monster or Trap
 *    c. If Monster:
 *       - Find the tile where monster.tileId matches
 *       - Call resolveTactic(monster, monsterTile, state)
 *       - Apply result to state immutably:
 *         'move': update monster.tileId to last tile in path
 *         'attack': reduce target hero hp by damage
 *         'move_then_attack': apply both
 *         'idle': no change
 *    d. If Trap:
 *       - Find the tile where trap.tileId matches
 *       - Call resolveTrap(trap, trapTile, state)
 *       - If result → state = applyTrapResult(state, id, result)
 * 3. After queue is fully consumed:
 *    state.activeVillainId = null
 *    state.villainPhaseQueue = []
 * 4. Return the final state
 *
 * @param state - Current game state
 * @returns New game state with villain phase applied
 */
export function executeVillainPhase(state: GameState): GameState {
  // 1. Build the villain queue
  const villainPhaseQueue = buildVillainQueue(state, state.currentHeroId);

  let newState = {
    ...state,
    villainPhaseQueue
  };

  // 2. Process each entry in the queue
  for (const villainId of villainPhaseQueue) {
    // a. Set activeVillainId
    newState = {
      ...newState,
      activeVillainId: villainId
    };

    // b. Determine if it's a Monster or Trap
    const monster = newState.monsters.find(m => m.id === villainId);
    const trap = newState.traps.find(t => t.id === villainId);

    if (monster) {
      // c. If Monster
      // Find the tile where monster is located by position
      const monsterTile = newState.tiles.find(tile =>
        tile.x === monster.position.x && tile.z === monster.position.z
      );
      if (monsterTile) {
        const result = resolveTactic(monster, monsterTile, newState);

        // Apply result to state immutably
        if (result.action === 'move' || result.action === 'move_then_attack') {
          // Update monster.position to last tile in path
          const lastTile = result.path[result.path.length - 1];
          newState = {
            ...newState,
            monsters: newState.monsters.map(m =>
              m.id === villainId
                ? { ...m, position: { x: lastTile.x, z: lastTile.z, sqX: m.position.sqX, sqZ: m.position.sqZ } }
                : m
            )
          };
        }

        if (result.action === 'attack' || result.action === 'move_then_attack') {
          // Reduce target hero hp by damage
          newState = {
            ...newState,
            heroes: newState.heroes.map(h =>
              h.id === result.targetHeroId
                ? { ...h, hp: Math.max(0, h.hp - result.damage) }
                : h
            )
          };
        }
        // 'idle': no change
      }
    } else if (trap) {
      // d. If Trap
      // Find the tile where trap.tileId matches
      const trapTile = newState.tiles.find(tile => tile.id === trap.tileId);
      if (trapTile) {
        const result = resolveTrap(trap, trapTile, newState);
        if (result) {
          newState = applyTrapResult(newState, villainId, result);
        }
      }
    }
  }

  // 3. After queue is fully consumed
  newState = {
    ...newState,
    activeVillainId: null,
    villainPhaseQueue: []
  };

  // 4. Return the final state
  return newState;
}

/**
 * Apply trap damage result to game state.
 *
 * Pure function that returns a new GameState where:
 * - The target hero's hp is reduced by result.damage
 * - The trap's isTriggered is set to true
 * - No other state is modified
 *
 * @param state - Current game state
 * @param trapId - ID of the trap that triggered
 * @param result - Result from resolveTrap (non-null)
 * @returns New game state with trap damage applied
 */
export function applyTrapResult(
  state: GameState,
  trapId: string,
  result: NonNullable<ReturnType<typeof import('../game/engine/MonsterAI').resolveTrap>>
): GameState {
  return {
    ...state,
    heroes: state.heroes.map(hero =>
      hero.id === result.targetHeroId
        ? { ...hero, hp: Math.max(0, hero.hp - result.damage) }
        : hero
    ),
    traps: state.traps.map(trap =>
      trap.id === trapId
        ? { ...trap, isTriggered: true }
        : trap
    )
  };
}
