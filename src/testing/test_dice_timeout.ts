import { CombatAdapter } from '../game/engine/CombatAdapter';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { Hero, Monster, GameState } from '../game/types';

export async function runDiceTimeoutTests(): Promise<void> {
  console.log('--- RUNNING DICE TIMEOUT SURFACING TESTS ---');

  const testHero: Hero = {
    id: 'hero_timeout_test',
    name: 'Allisa',
    type: 'hero',
    heroClass: 'rogue',
    level: 1,
    surgeValue: 3,
    xp: 0,
    position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
    hp: 10,
    maxHp: 10,
    ac: 14,
    speed: 6,
    isExhausted: false,
    surgeUsed: false,
    attackBonus: 0,
    conditions: [],
    usedPowers: [],
    abilities: [],
    hand: [],
    items: []
  };

  const testMonster: Monster = {
    id: 'monster_timeout_test',
    name: 'Skeleton',
    type: 'monster',
    monsterType: 'skeleton',
    behavior: { conditions: [], priorityTargets: [], actions: [] },
    attackBonus: 4,
    damage: 1,
    experienceValue: 10,
    ownedByHeroId: 'hero_timeout_test',
    position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
    hp: 1,
    maxHp: 1,
    ac: 12,
    speed: 6,
    isExhausted: false,
    conditions: [],
    usedPowers: []
  };

  const initialGameState: GameState = {
    logIdCounter: 100,
    phase: 'hero',
    currentHeroId: testHero.id,
    heroes: [testHero],
    monsters: [testMonster],
    tiles: [],
    dungeonDeck: [],
    treasureDeck: [],
    encounterDeck: [],
    monsterDeck: [],
    discardPiles: {
      treasure: [],
      encounter: [],
      ability: [],
      monster: []
    },
    activeScenario: null as any,
    turnOrder: [testHero.id],
    healingSurges: 2,
    turnCount: 1,
    villainPhaseQueue: [],
    activeVillainId: null,
    activeEnvironmentCard: null,
    experiencePile: [],
    treasuresDrawnThisTurn: 0,
    traps: [],
    cardResolution: {
      phase: 'idle',
      cardId: null,
      cardType: null,
      targetEntityId: null
    },
    log: [],
    hasAttackedThisTurn: false
  };

  useGameStore.setState({ gameState: initialGameState });
  useUIStore.setState({ notifications: [] });

  console.log('Testing auto-roll dice timeout (3s) surfacing in CombatAdapter...');
  const startTime = Date.now();

  const attackResult = await CombatAdapter.resolveAttackAsync(
    testMonster,
    testHero,
    testMonster.attackBonus,
    testMonster.damage,
    0,
    initialGameState
  );

  const elapsed = Date.now() - startTime;
  console.log(`Attack auto-resolved after ${elapsed}ms.`);

  if (elapsed < 2800) {
    throw new Error(`Expected timeout to wait ~3000ms, but resolved in ${elapsed}ms`);
  }

  // 1. Verify attack result returned valid combat result
  if (!attackResult || typeof attackResult.hit !== 'boolean' || typeof attackResult.damage !== 'number') {
    throw new Error('Expected CombatAdapter to resolve a valid AttackResult upon timeout fallback');
  }

  // 2. Verify on-screen UI notification was added
  const notifications = useUIStore.getState().notifications;
  const timeoutNotification = notifications.find(n =>
    n.message.includes('Dice roll timed out') && n.message.includes('Skeleton')
  );
  if (!timeoutNotification) {
    throw new Error(`Expected UI notification for dice timeout, found: ${JSON.stringify(notifications)}`);
  }
  console.log('✓ UI notification received:', timeoutNotification.message);

  // 3. Verify Chronicle entry in useGameStore
  const finalStoreState = useGameStore.getState().gameState;
  const timeoutStoreLog = finalStoreState?.log.find(l =>
    l.message.includes('Dice roll timed out') && l.message.includes('Skeleton vs Allisa')
  );
  if (!timeoutStoreLog) {
    throw new Error(`Expected Chronicle log entry in useGameStore, found: ${JSON.stringify(finalStoreState?.log)}`);
  }
  if (timeoutStoreLog.type !== 'combat') {
    throw new Error(`Expected log entry type 'combat', got: ${timeoutStoreLog.type}`);
  }
  if (timeoutStoreLog.id !== '101') {
    throw new Error(`Expected log entry ID '101', got: ${timeoutStoreLog.id}`);
  }
  console.log('✓ Chronicle log entry verified in gameStore:', timeoutStoreLog.message);

  // 4. Verify passed gameState reference was also synchronized
  const timeoutPassedLog = initialGameState.log.find(l =>
    l.message.includes('Dice roll timed out') && l.message.includes('Skeleton vs Allisa')
  );
  if (!timeoutPassedLog || initialGameState.logIdCounter !== 101) {
    throw new Error('Expected passed gameState reference to have synchronized log and logIdCounter');
  }
  console.log('✓ Passed gameState reference synchronization verified.');

  console.log('ALL DICE TIMEOUT SURFACING TESTS PASSED!');
}

if (typeof window === 'undefined' && (globalThis as any).process?.argv?.[1]?.includes('test_dice_timeout')) {
  runDiceTimeoutTests().catch((e) => {
    console.error(e);
    (globalThis as any).process?.exit(1);
  });
}
