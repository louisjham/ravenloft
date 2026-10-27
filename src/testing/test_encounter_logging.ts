import { DataLoader } from '../game/dataLoader';
import { useGameStore } from '../store/gameStore';
import { GameState, Hero, Card } from '../game/types';
import { formatEncounterOutcome, formatEncounterLogMessage } from '../game/engine/LogUtils';

export async function runEncounterLoggingTests(): Promise<void> {
  console.log('--- RUNNING ENCOUNTER CHRONICLE LOGGING TESTS ---');

  // 1. Verify all official encounter cards have flavor text in DataLoader
  const dataLoader = DataLoader.getInstance();
  const encounterCards = dataLoader.getAllCards().filter(c => c.type === 'encounter' && !c.id.startsWith('enc_test_'));
  console.log(`Loaded ${encounterCards.length} official encounter cards.`);

  const cardsWithoutFlavor = encounterCards.filter(c => !c.flavorText || c.flavorText.trim() === '');
  if (cardsWithoutFlavor.length > 0) {
    console.error(`Found ${cardsWithoutFlavor.length} cards missing flavor text:`, cardsWithoutFlavor.map(c => c.name));
    throw new Error('Some encounter cards are missing flavor text');
  } else {
    console.log(`✓ All ${encounterCards.length} encounter cards have verified flavor text.`);
  }

  // 2. Test formatEncounterOutcome & formatEncounterLogMessage
  const batSwarm = dataLoader.getCardById('enc_bat_swarm')!;
  const outcome1 = formatEncounterOutcome(batSwarm);
  const logMsg1 = formatEncounterLogMessage(batSwarm, outcome1);
  console.log('Sample Environment Log Entry:', logMsg1);
  if (!logMsg1.includes('[Bat Swarm]') || !logMsg1.includes('A horde of shrieking bats') || !logMsg1.includes('Environment active')) {
    throw new Error('Log message does not match expected format');
  }
  console.log('✓ Environment log format verified.');

  // Sample XP Cancellation Log Entry
  const outcomeXP = formatEncounterOutcome(batSwarm, { cancelledByXP: true });
  const logMsgXP = formatEncounterLogMessage(batSwarm, outcomeXP);
  console.log('Sample Cancelled by XP Log Entry:', logMsgXP);
  if (!logMsgXP.includes('[Bat Swarm]') || !logMsgXP.includes('Cancelled by spending 5 XP.')) {
    throw new Error('XP cancel log message does not match expected format');
  }
  console.log('✓ XP Cancel log format verified.');

  // Sample Dispel Magic Log Entry
  const outcomeDM = formatEncounterOutcome(batSwarm, { cancelledByDispelMagic: true, wizardName: 'Immeril' });
  const logMsgDM = formatEncounterLogMessage(batSwarm, outcomeDM);
  console.log('Sample Dispel Magic Log Entry:', logMsgDM);
  if (!logMsgDM.includes('[Bat Swarm]') || !logMsgDM.includes('Cancelled by Immeril using Dispel Magic.')) {
    throw new Error('Dispel Magic log message does not match expected format');
  }
  console.log('✓ Dispel Magic log format verified.');

  // 3. Test useGameStore end-to-end flow with state
  const dummyHero: Hero = {
    id: 'hero_1',
    name: 'Arjhan',
    heroClass: 'dragonborn',
    level: 1,
    hp: 8,
    maxHp: 8,
    ac: 16,
    speed: 6,
    surgeValue: 4,
    position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
    abilities: [],
    hand: [],
    flippedPowerIds: [],
    conditions: [],
    items: [],
    isDefeated: false,
    type: 'hero'
  } as any;

  const wizardHero: Hero = {
    id: 'hero_wizard',
    name: 'Immeril',
    heroClass: 'wizard',
    level: 1,
    hp: 6,
    maxHp: 6,
    ac: 14,
    speed: 6,
    surgeValue: 3,
    position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
    abilities: ['wizard_dispel_magic'],
    hand: [],
    flippedPowerIds: [],
    conditions: [],
    items: [],
    isDefeated: false,
    type: 'hero'
  } as any;

  const testInitialState: GameState = {
    activeScenario: {
      id: 'adventure_1',
      name: 'Escape the Tomb',
      description: '',
      villainPhase: { drawEncounterRules: { drawOnUnexplored: true, drawOnBlackTriangle: true } },
      setupRules: { startingTile: 'start', heroSpawns: [] },
      victoryCondition: { type: 'explore_all_tiles', count: 10 },
      defeatCondition: { type: 'all_heroes_dead' }
    } as any,
    currentHeroId: 'hero_1',
    turnOrder: ['hero_1', 'hero_wizard'],
    heroes: [dummyHero, wizardHero],
    monsters: [],
    traps: [],
    tiles: [{
      id: 'tile_start',
      x: 0,
      z: 0,
      rotation: 0,
      edges: { north: 'open', south: 'wall', east: 'wall', west: 'wall' },
      isExplored: true,
      hasMonster: false,
      encounterType: 'black'
    } as any],
    encounterDeck: ['enc_bat_swarm', 'enc_dart_trap', 'enc_blood_fog'],
    monsterDeck: ['monster_skeleton', 'monster_zombie'],
    treasureDeck: [],
    dungeonDeck: [],
    experiencePile: ['monster_skeleton', 'monster_skeleton', 'monster_skeleton', 'monster_skeleton', 'monster_skeleton'],
    discardPiles: { encounter: [], monster: [], treasure: [] },
    phase: 'villain',
    turnCount: 1,
    log: [],
    logIdCounter: 100,
    cardResolution: { phase: 'idle', cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null, hasLoggedChronicle: false }
  } as any as GameState;

  useGameStore.setState({ gameState: testInitialState });

  // Test 3a: Draw encounter card
  console.log('\n--- Testing Draw & Dismiss of Encounter Card ---');
  useGameStore.getState().drawEncounterCard();

  let s = useGameStore.getState().gameState!;
  if (s.cardResolution.phase !== 'revealing' || s.cardResolution.cardId !== 'enc_bat_swarm') {
    throw new Error(`Expected revealing phase for enc_bat_swarm, got ${s.cardResolution.phase}`);
  }
  console.log('✓ drawEncounterCard set phase to revealing.');

  // Advance resolution to resolving then complete
  useGameStore.getState().advanceCardResolution();
  s = useGameStore.getState().gameState!;

  useGameStore.getState().advanceCardResolution();
  s = useGameStore.getState().gameState!;

  if (s.cardResolution.phase !== 'complete') {
    throw new Error(`Expected complete phase, got ${s.cardResolution.phase}`);
  }

  // Dismiss resolution -> writes exactly one chronicle entry
  useGameStore.getState().dismissCardResolution();
  s = useGameStore.getState().gameState!;
  if (s.cardResolution.phase !== 'idle') {
    throw new Error(`Expected idle phase, got ${s.cardResolution.phase}`);
  }

  const encounterLogs = s.log.filter(l => l.type === 'encounter');
  console.log('Logged encounter entries count:', encounterLogs.length);
  if (encounterLogs.length !== 1) {
    throw new Error(`Expected exactly 1 encounter log entry, got ${encounterLogs.length}`);
  }

  console.log('Logged entry:', encounterLogs[0]);
  if (!encounterLogs[0].message.includes('Bat Swarm') || !encounterLogs[0].message.includes('A horde of shrieking bats')) {
    throw new Error('Log message content missing title or flavor');
  }
  if (encounterLogs[0].id !== '101') {
    throw new Error(`Expected id 101, got ${encounterLogs[0].id}`);
  }
  console.log('✓ Draw & Dismiss written exactly 1 entry with correct ID & content.');

  // Test 3b: Test Cancel with 5 XP
  console.log('\n--- Testing Cancel Encounter with 5 XP ---');
  useGameStore.getState().drawEncounterCard(); // draws enc_dart_trap
  useGameStore.getState().cancelEncounterCard('enc_dart_trap');

  s = useGameStore.getState().gameState!;
  const encounterLogsAfterCancel = s.log.filter(l => l.type === 'encounter');
  console.log('Total encounter entries after XP cancel:', encounterLogsAfterCancel.length);
  if (encounterLogsAfterCancel.length !== 2) {
    throw new Error(`Expected exactly 2 encounter entries, got ${encounterLogsAfterCancel.length}`);
  }
  const cancelEntry = encounterLogsAfterCancel[1];
  console.log('Cancel entry:', cancelEntry);
  if (!cancelEntry.message.includes('Dart Trap') || !cancelEntry.message.includes('Cancelled by spending 5 XP')) {
    throw new Error('Cancel entry content incorrect');
  }
  if (cancelEntry.id !== '102') {
    throw new Error(`Expected id 102, got ${cancelEntry.id}`);
  }
  console.log('✓ Cancel with XP written exactly 1 entry with correct ID & content.');

  // Test 3c: Test Cancel with Dispel Magic
  console.log('\n--- Testing Cancel Encounter with Dispel Magic ---');
  useGameStore.getState().drawEncounterCard(); // draws enc_blood_fog
  useGameStore.getState().cancelEncounterWithDispelMagic('enc_blood_fog');

  s = useGameStore.getState().gameState!;
  const encounterLogsAfterDispel = s.log.filter(l => l.type === 'encounter');
  console.log('Total encounter entries after Dispel Magic:', encounterLogsAfterDispel.length);
  if (encounterLogsAfterDispel.length !== 3) {
    throw new Error(`Expected exactly 3 encounter entries, got ${encounterLogsAfterDispel.length}`);
  }
  const dispelEntry = encounterLogsAfterDispel[2];
  console.log('Dispel entry:', dispelEntry);
  if (!dispelEntry.message.includes('Blood Fog') || !dispelEntry.message.includes('Cancelled by Immeril using Dispel Magic')) {
    throw new Error('Dispel Magic entry content incorrect');
  }
  if (dispelEntry.id !== '103') {
    throw new Error(`Expected id 103, got ${dispelEntry.id}`);
  }
  console.log('✓ Cancel with Dispel Magic written exactly 1 entry with correct ID & content.');

  // Verify all entries appear in 'all' and 'encounter' categories
  console.log('\n--- Testing Chronicle Filter Categories ---');
  const allEntries = s.log;
  const encounterCategoryEntries = s.log.filter(entry => entry.type === 'encounter' || entry.message.includes('Encounter'));
  if (encounterCategoryEntries.length !== 3) {
    throw new Error(`Expected 3 entries in encounter category, got ${encounterCategoryEntries.length}`);
  }
  if (!allEntries.includes(encounterCategoryEntries[0]) ||
      !allEntries.includes(encounterCategoryEntries[1]) ||
      !allEntries.includes(encounterCategoryEntries[2])) {
    throw new Error('Encounter entries missing from All log');
  }
  console.log('✓ Chronicle category filtering verified for All and Encounter tabs.');

  console.log('\nALL ENCOUNTER CHRONICLE TESTS PASSED!');
}

const proc = (globalThis as any).process;
if (proc?.argv?.[1]?.includes('test_encounter_logging')) {
  runEncounterLoggingTests().catch(err => {
    console.error(err);
    proc.exit?.(1);
  });
}
