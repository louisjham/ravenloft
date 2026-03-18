import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { GameState, Entity, Tile, Card, GameSettings, Position, Hero, PowerType } from '../game/types'
import { SaveSystem } from '../game/progression/SaveSystem'
import { DataLoader } from '../game/dataLoader'
import { CombatSystem } from '../game/engine/CombatSystem'
import { ConditionSystem } from '../game/engine/ConditionSystem'

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
        }]
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

      // DEBUG: Find the card and check if it's a Daily power
      const dataLoader = DataLoader.getInstance();
      const card = dataLoader.getCardById(cardId);

      if (card && card.powerType === 'daily') {
        const hero = state.heroes.find(h => h.id === state.currentHeroId);
        if (hero) {
          if (hero.usedPowers.includes(cardId)) {
            console.log('[DEBUG gameStore] Daily power already used:', cardId);
            return; // Cannot use Daily power again
          }
          // Mark Daily power as used
          hero.usedPowers.push(cardId);
          console.log('[DEBUG gameStore] Daily power marked as used:', cardId);
        }
      }

      // TODO: Implement card effect resolution
      console.log('[DEBUG gameStore] Card effect resolution not yet implemented');
    },

    endTurn: () => {
      const state = get().gameState;
      if (!state) return;

      console.log('[DEBUG gameStore] Ending turn for:', state.currentHeroId);

      // DEBUG: Process conditions for the current entity
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

      const currentIndex = state.turnOrder.indexOf(state.currentHeroId);
      const nextIndex = (currentIndex + 1) % state.turnOrder.length;
      const nextId = state.turnOrder[nextIndex];

      const newPhase = nextId.startsWith('m') ? 'monster' : 'hero';

      set({
        gameState: {
          ...state,
          currentHeroId: nextId,
          phase: newPhase,
          turnCount: state.turnCount + (nextIndex === 0 ? 1 : 0)
        }
      });

      console.log('[DEBUG gameStore] Turn ended, next entity:', nextId, 'new phase:', newPhase);
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
              usedPowers: []
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
          ]
        }
      });
    }
  }))
)
