import { TileSystem } from '../game/engine/TileSystem';
import { findBestLandingSquare } from '../game/engine/MonsterAI';
import { AbilitySystem } from '../game/ai/AbilitySystem';
import { ScenarioManager } from '../game/scenarios/ScenarioManager';
import { EncounterSystem } from '../game/engine/EncounterSystem';
import { DataLoader } from '../game/dataLoader';
import { GameState, Hero, Monster, Tile, Rotation } from '../game/types';

export async function runBonePileTests(): Promise<void> {
  console.log('--- RUNNING BONE PILE COMPLIANCE TESTS ---');

  // Test 1: Bone square rotation calculations for all 4 rotations
  console.log('Test 1: Bone square rotation verification...');
  const rot0 = TileSystem.rotateBoneSquare(1, 1, 0);
  if (rot0.sqX !== 1 || rot0.sqZ !== 1) throw new Error(`Expected (1,1) for 0°, got (${rot0.sqX}, ${rot0.sqZ})`);

  const rot90 = TileSystem.rotateBoneSquare(1, 1, 90);
  if (rot90.sqX !== 2 || rot90.sqZ !== 1) throw new Error(`Expected (2,1) for 90°, got (${rot90.sqX}, ${rot90.sqZ})`);

  const rot180 = TileSystem.rotateBoneSquare(1, 1, 180);
  if (rot180.sqX !== 2 || rot180.sqZ !== 2) throw new Error(`Expected (2,2) for 180°, got (${rot180.sqX}, ${rot180.sqZ})`);

  const rot270 = TileSystem.rotateBoneSquare(1, 1, 270);
  if (rot270.sqX !== 1 || rot270.sqZ !== 2) throw new Error(`Expected (1,2) for 270°, got (${rot270.sqX}, ${rot270.sqZ})`);
  console.log('✓ Bone square rotations verified for 0°, 90°, 180°, 270°');

  // Helper factory for test monster
  const createTestMonster = (overrides: Partial<Monster> = {}): Monster => ({
    id: `m_${Date.now()}_${Math.random()}`,
    name: 'Skeleton',
    type: 'monster',
    monsterType: 'skeleton',
    behavior: { conditions: [], priorityTargets: [], actions: [] },
    attackBonus: 4,
    damage: 1,
    experienceValue: 1,
    ownedByHeroId: 'hero_1',
    position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
    hp: 1,
    maxHp: 1,
    ac: 12,
    speed: 6,
    isExhausted: false,
    conditions: [],
    usedPowers: [],
    ...overrides
  });

  // Helper factory for test state
  const createBaseState = (): GameState => ({
    phase: 'hero',
    currentHeroId: 'hero_1',
    heroes: [
      {
        id: 'hero_1',
        name: 'Arjhan',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        surgeValue: 3,
        xp: 0,
        position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
        hp: 10,
        maxHp: 10,
        ac: 16,
        speed: 6,
        isExhausted: false,
        surgeUsed: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: [],
        abilities: [],
        hand: [],
        items: []
      },
      {
        id: 'hero_2',
        name: 'Allisa',
        type: 'hero',
        heroClass: 'rogue',
        level: 1,
        surgeValue: 3,
        xp: 0,
        position: { x: 0, z: 0, sqX: 3, sqZ: 3 },
        hp: 8,
        maxHp: 8,
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
      }
    ],
    monsters: [],
    tiles: [
      {
        id: 'tile_start',
        name: 'Start Tile',
        x: 0,
        z: 0,
        terrainType: 'corridor',
        connections: [
          { edge: 'north', isOpen: true, connectedTileId: 'tile_new' },
          { edge: 'south', isOpen: false },
          { edge: 'east', isOpen: false },
          { edge: 'west', isOpen: false }
        ],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: true,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: ['hero_1', 'hero_2'],
        items: []
      }
    ],
    dungeonDeck: [],
    monsterDeck: ['monster_skeleton', 'monster_zombie', 'monster_ghoul'],
    encounterDeck: [],
    treasureDeck: [],
    discardPiles: { treasure: [], encounter: [], ability: [], monster: [] },
    activeScenario: {
      id: 'adv01',
      name: 'Escape the Tomb',
      difficulty: 'Easy',
      description: 'Test',
      introText: 'Test',
      victoryText: 'Test',
      defeatText: 'Test',
      objectives: [],
      specialRules: [],
      startTileId: 'tile_start',
      maxSurges: 2
    },
    turnOrder: ['hero_1', 'hero_2'],
    healingSurges: 2,
    turnCount: 1,
    log: [],
    logIdCounter: 100,
    activeEnvironmentCard: null,
    experiencePile: [],
    treasuresDrawnThisTurn: 0,
    traps: [],
    villainPhaseQueue: [],
    activeVillainId: null,
    cardResolution: {
      phase: 'idle',
      cardId: null,
      cardType: null,
      targetEntityId: null,
      pendingEffects: [],
      resolvedEffects: []
    }
  });

  // Test 2: Exploration spawn places on ROTATED bone square
  console.log('Test 2: Exploration spawn on rotated bone square...');
  const testRotations: Rotation[] = [0, 90, 180, 270];
  const expectedSquares: Record<Rotation, { sqX: number; sqZ: number }> = {
    0: { sqX: 1, sqZ: 1 },
    90: { sqX: 2, sqZ: 1 },
    180: { sqX: 2, sqZ: 2 },
    270: { sqX: 1, sqZ: 2 }
  };

  for (const rot of testRotations) {
    const state = createBaseState();
    const rotatedBone = TileSystem.rotateBoneSquare(1, 1, rot);
    const newTile: Tile = {
      id: `tile_test_${rot}`,
      name: `Test Tile ${rot}`,
      x: 0,
      z: 1,
      terrainType: 'corridor',
      connections: [],
      boneSquare: rotatedBone,
      isRevealed: true,
      isStart: false,
      isExit: false,
      rotation: rot,
      encounterType: 'black',
      monsters: [],
      heroes: [],
      items: []
    };
    state.tiles.push(newTile);

    const afterExplore = TileSystem.spawnMonsterForExploration(state, newTile);
    const spawnedMonster = afterExplore.monsters[0];
    if (!spawnedMonster) throw new Error(`No monster spawned for rotation ${rot}`);

    const expected = expectedSquares[rot];
    if (spawnedMonster.position.sqX !== expected.sqX || spawnedMonster.position.sqZ !== expected.sqZ) {
      throw new Error(`Rotation ${rot}: expected monster at (${expected.sqX}, ${expected.sqZ}), got (${spawnedMonster.position.sqX}, ${spawnedMonster.position.sqZ})`);
    }
  }
  console.log('✓ Exploration spawns correctly at rotated boneSquare for 0°, 90°, 180°, 270°');

  // Test 3: Exploration spawn fallback when bone pile is occupied
  console.log('Test 3: Exploration spawn fallback when bone pile is occupied...');
  {
    const state = createBaseState();
    const rot = 90;
    const rotatedBone = TileSystem.rotateBoneSquare(1, 1, rot); // (2, 1)
    const newTile: Tile = {
      id: 'tile_occupied_test',
      name: 'Occupied Test Tile',
      x: 0,
      z: 1,
      terrainType: 'corridor',
      connections: [],
      boneSquare: rotatedBone,
      isRevealed: true,
      isStart: false,
      isExit: false,
      rotation: rot,
      encounterType: 'black',
      monsters: ['existing_monster'],
      heroes: [],
      items: []
    };
    state.tiles.push(newTile);

    // Existing monster sits right on the bone pile (2, 1)
    state.monsters.push(createTestMonster({
      id: 'existing_monster',
      name: 'Blocker Skeleton',
      position: { x: 0, z: 1, sqX: 2, sqZ: 1 }
    }));

    const afterExplore = TileSystem.spawnMonsterForExploration(state, newTile);
    const newlySpawned = afterExplore.monsters.find(m => m.id !== 'existing_monster');
    if (!newlySpawned) throw new Error('New monster was not spawned');

    if (newlySpawned.position.sqX === 2 && newlySpawned.position.sqZ === 1) {
      throw new Error('New monster placed on occupied bone square!');
    }
    if (newlySpawned.position.x !== 0 || newlySpawned.position.z !== 1) {
      throw new Error('New monster placed on wrong tile!');
    }
    console.log(`✓ Bone square occupied: monster safely placed at empty square (${newlySpawned.position.sqX}, ${newlySpawned.position.sqZ}) on same tile`);
  }

  // Test 4: Exploration control rule (discard & redraw already controlled type)
  console.log('Test 4: Exploration control rule...');
  {
    const state = createBaseState();
    // Active hero hero_1 already controls a skeleton
    state.monsters.push(createTestMonster({
      id: 'm_hero1_skeleton',
      templateId: 'monster_skeleton',
      name: 'Skeleton',
      ownedByHeroId: 'hero_1',
      position: { x: 0, z: 0, sqX: 1, sqZ: 0 }
    }));

    // Another player (hero_2) controls a zombie
    state.monsters.push(createTestMonster({
      id: 'm_hero2_zombie',
      templateId: 'monster_zombie',
      name: 'Zombie',
      monsterType: 'zombie',
      ownedByHeroId: 'hero_2',
      position: { x: 0, z: 0, sqX: 0, sqZ: 1 }
    }));

    // Deck has [ghoul, zombie, skeleton] -> next pop() is skeleton
    state.monsterDeck = ['monster_ghoul', 'monster_zombie', 'monster_skeleton'];

    const newTile: Tile = {
      id: 'tile_control_test',
      name: 'Control Test Tile',
      x: 0,
      z: 1,
      terrainType: 'corridor',
      connections: [],
      boneSquare: { sqX: 1, sqZ: 1 },
      isRevealed: true,
      isStart: false,
      isExit: false,
      rotation: 0,
      encounterType: 'black',
      monsters: [],
      heroes: [],
      items: []
    };
    state.tiles.push(newTile);

    // Active hero (hero_1) explores:
    // Candidate monster_skeleton is already controlled by hero_1 -> discarded and redrawn.
    // Next candidate monster_zombie is controlled by hero_2 (another player's copy is fine!) -> accepted!
    const afterExplore = TileSystem.spawnMonsterForExploration(state, newTile);
    const spawned = afterExplore.monsters.find(m => m.id.startsWith('monster_monster_zombie'));
    if (!spawned) {
      throw new Error(`Expected hero_1 to draw monster_zombie, but got: ${afterExplore.monsters[afterExplore.monsters.length - 1]?.templateId}`);
    }
    if (!afterExplore.discardPiles.monster.includes('monster_skeleton')) {
      throw new Error('Expected discarded monster_skeleton in monster discard pile');
    }
    console.log('✓ Control rule verified: discarded already-controlled skeleton, drew zombie (another player\'s copy is allowed)');
  }

  // Test 5: Monster tactics movement ("move to bone pile if empty, else anywhere on tile")
  console.log('Test 5: Monster tactics movement...');
  {
    const state = createBaseState();
    const landingTile: Tile = {
      id: 'tile_landing',
      name: 'Landing Tile',
      x: 1,
      z: 0,
      terrainType: 'corridor',
      connections: [],
      boneSquare: { sqX: 2, sqZ: 1 }, // e.g. 90 deg rotation
      isRevealed: true,
      isStart: false,
      isExit: false,
      rotation: 90,
      monsters: [],
      heroes: [],
      items: []
    };
    state.tiles.push(landingTile);

    const movingMonster = createTestMonster({
      id: 'moving_monster',
      name: 'Moving Skeleton',
      position: { x: 2, z: 0, sqX: 0, sqZ: 0 }
    });

    // When bone pile is empty, non-adjacent move lands directly on the rotated bone pile
    const landingSquare = findBestLandingSquare(movingMonster, null, landingTile, false, state);
    if (landingSquare.sqX !== 2 || landingSquare.sqZ !== 1) {
      throw new Error(`Expected monster to move to bone pile (2, 1), got (${landingSquare.sqX}, ${landingSquare.sqZ})`);
    }

    // Now occupy the bone pile with hero_1
    state.heroes[0].position = { x: 1, z: 0, sqX: 2, sqZ: 1 };
    const fallbackSquare = findBestLandingSquare(movingMonster, null, landingTile, false, state);
    if (fallbackSquare.sqX === 2 && fallbackSquare.sqZ === 1) {
      throw new Error('Monster moved onto occupied bone pile!');
    }
    console.log(`✓ Monster tactics movement: moved to empty bone pile (2, 1); when occupied, moved to (${fallbackSquare.sqX}, ${fallbackSquare.sqZ})`);
  }

  // Test 6: AbilitySystem summon placing on bone pile & fallback for multiple summons
  console.log('Test 6: AbilitySystem summon...');
  {
    const state = createBaseState();
    state.tiles[0].boneSquare = { sqX: 1, sqZ: 1 };

    const sourceMonster = createTestMonster({
      id: 'summoner_boss',
      name: 'Necromancer',
      monsterType: 'boss',
      ownedByHeroId: 'hero_1',
      position: { x: 0, z: 0, sqX: 3, sqZ: 0 },
      hp: 10,
      maxHp: 10,
      ac: 14
    });
    state.monsters.push(sourceMonster);

    // Summon 2 skeletons on source tile
    const ability = {
      id: 'ab_summon_2',
      name: 'Summon Skeletons',
      type: 'active' as const,
      description: 'Summon 2 skeletons',
      effects: [
        {
          type: 'summon' as const,
          target: 'self' as const,
          monsterId: 'monster_skeleton',
          value: 2
        }
      ]
    };

    const afterSummon = AbilitySystem.executeAbility(ability, sourceMonster, state);
    const summoned = afterSummon.monsters.filter(m => m.id.includes('summoned'));
    if (summoned.length !== 2) throw new Error(`Expected 2 summoned monsters, got ${summoned.length}`);

    // First summoned monster should be on the bone square (1, 1)
    if (summoned[0].position.sqX !== 1 || summoned[0].position.sqZ !== 1) {
      throw new Error(`First summoned monster should be on bone square (1, 1), got (${summoned[0].position.sqX}, ${summoned[0].position.sqZ})`);
    }

    // Second summoned monster should NOT stack on the first
    if (summoned[1].position.sqX === 1 && summoned[1].position.sqZ === 1) {
      throw new Error('Second summoned monster stacked on the bone square!');
    }
    console.log(`✓ AbilitySystem summon: first on bone pile (1, 1), second on empty square (${summoned[1].position.sqX}, ${summoned[1].position.sqZ})`);
  }

  // Test 7: Scenario Strahd Awakening on start tile bone pile
  console.log('Test 7: Scenario Strahd awakening on start tile bone pile...');
  {
    const state = createBaseState();
    state.tiles[0].boneSquare = { sqX: 1, sqZ: 1 };

    const awakenedState = ScenarioManager.triggerStrahdAwakening(state);
    const strahd = awakenedState.monsters.find(m => m.name.toLowerCase().includes('strahd') || m.isBoss);
    if (!strahd) throw new Error('Strahd monster not found after awakening');

    if (strahd.position.sqX !== 1 || strahd.position.sqZ !== 1) {
      throw new Error(`Expected Strahd on bone pile (1, 1), got (${strahd.position.sqX}, ${strahd.position.sqZ})`);
    }
    console.log('✓ ScenarioManager: Strahd awakens on start tile bone pile (1, 1)');
  }

  // Test 8: Encounter control rule & discard pile persistence (Secret Door)
  console.log('Test 8: Encounter control rule & discard pile persistence (Secret Door)...');
  {
    const state = createBaseState();
    // activeHero is hero_2 (Allisa), but state.currentHeroId is hero_1 (Arjhan) to verify explicit controlling hero passing
    state.currentHeroId = 'hero_1';
    const activeHero = state.heroes.find(h => h.id === 'hero_2')!;

    // hero_2 already controls a skeleton
    state.monsters.push(createTestMonster({
      id: 'm_hero2_skeleton',
      templateId: 'monster_skeleton',
      name: 'Skeleton',
      ownedByHeroId: 'hero_2',
      position: { x: 0, z: 0, sqX: 0, sqZ: 1 }
    }));

    // hero_1 controls a zombie (another player's copy is fine to draw!)
    state.monsters.push(createTestMonster({
      id: 'm_hero1_zombie',
      templateId: 'monster_zombie',
      name: 'Zombie',
      monsterType: 'zombie',
      ownedByHeroId: 'hero_1',
      position: { x: 0, z: 0, sqX: 3, sqZ: 3 }
    }));

    // Monster deck has [skeleton, zombie]
    // First candidate (skeleton) is duplicate for hero_2 -> discarded
    // Second candidate (zombie) is not controlled by hero_2 -> spawned
    state.monsterDeck = ['monster_skeleton', 'monster_zombie'];
    const initialMonsterDeckCount = state.monsterDeck.length;
    const initialMonsterDiscardCount = state.discardPiles.monster.length;

    // Start tile needs an open unexplored edge for Secret Door
    state.tiles[0].connections = [
      { edge: 'north', isOpen: true },
      { edge: 'south', isOpen: false },
      { edge: 'east', isOpen: false },
      { edge: 'west', isOpen: false }
    ];

    // Dungeon deck needs a tile template ID to place
    state.dungeonDeck = ['named_arcane_circle'];

    const secretDoorCard = DataLoader.getInstance().getCardById('enc_secret_door') ?? {
      id: 'enc_secret_door',
      name: 'Secret Door',
      type: 'encounter',
      encounterType: 'event',
      effects: []
    };

    const result = EncounterSystem.processEventCard(state, secretDoorCard as any, activeHero);
    const afterState = result.gameState;

    // Verify monster discard pile persisted the control-rule discard
    if (!afterState.discardPiles.monster.includes('monster_skeleton')) {
      throw new Error(`Expected monster_skeleton in discardPiles.monster, got: ${JSON.stringify(afterState.discardPiles.monster)}`);
    }

    // Verify the spawned monster is the zombie, owned by hero_2
    const newlySpawned = afterState.monsters.find(m => m.id !== 'm_hero2_skeleton' && m.id !== 'm_hero1_zombie');
    if (!newlySpawned) {
      throw new Error('Secret Door did not spawn a monster');
    }
    if (newlySpawned.templateId !== 'monster_zombie') {
      throw new Error(`Expected newly spawned monster to be monster_zombie, got: ${newlySpawned.templateId}`);
    }
    if (newlySpawned.ownedByHeroId !== 'hero_2') {
      throw new Error(`Expected spawned monster to be owned by hero_2, got: ${newlySpawned.ownedByHeroId}`);
    }

    // Verify reconciliation: deck count + discard count + spawned monster (1) equals initial deck + discards
    const finalDeckCount = afterState.monsterDeck.length;
    const finalMonsterDiscardCount = afterState.discardPiles.monster.length;
    if (finalDeckCount + finalMonsterDiscardCount + 1 !== initialMonsterDeckCount + initialMonsterDiscardCount) {
      throw new Error(`Monster cards did not reconcile! Deck: ${finalDeckCount}, Discards: ${finalMonsterDiscardCount}`);
    }
    if (finalDeckCount !== 0 || finalMonsterDiscardCount !== 1) {
      throw new Error(`Expected 0 in deck and 1 in discard, got deck=${finalDeckCount}, discard=${finalMonsterDiscardCount}`);
    }

    console.log('✓ Encounter control rule & discard persistence verified: duplicate skeleton discarded to pile, zombie spawned for hero_2, deck & discard reconciled');
  }

  console.log('ALL BONE PILE TESTS PASSED!');
}
