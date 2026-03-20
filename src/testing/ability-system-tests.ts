/**
 * Ability System Tests
 *
 * Comprehensive tests for AbilitySystem and BossPhases functionality.
 * Includes unit tests and integration tests for monster abilities.
 */

// Test utilities for console capture, assertions, etc.
import { captureWarn, captureError, captureLog, runWithCapturedConsole } from './testUtils';

import { AbilitySystem } from '../game/ai/AbilitySystem';
import { BossPhases } from '../game/ai/BossPhases';
import type {
    GameState,
    Monster,
    Hero,
    MonsterAbility,
    Tile,
    Position
} from '../game/types';

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Creates a minimal GameState for testing.
 */
function createTestGameState(heroes: Hero[], monsters: Monster[], tiles: Tile[]): GameState {
    return {
        phase: 'monster',
        currentHeroId: heroes[0]?.id ?? '',
        heroes,
        monsters,
        tiles,
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        discardPiles: {},
        activeScenario: {
            id: 'test_scenario',
            name: 'Test Scenario',
            difficulty: 'Medium',
            description: 'Test scenario',
            introText: 'Test',
            victoryText: 'Test',
            defeatText: 'Test',
            objectives: [],
            specialRules: [],
            startTileId: 'tile_start',
            maxSurges: 3
        },
        turnOrder: heroes.map(h => h.id),
        healingSurges: 2,
        turnCount: 1,
        log: [],
        activeEnvironmentCard: null,
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null,
    activeConditions: []
    };
}

/**
 * Creates a test tile.
 */
function createTestTile(id: string, x: number, z: number, connections: any[] = []): Tile {
    return {
        id,
        name: `Tile ${id}`,
        x,
        z,
        terrainType: 'corridor',
        connections,
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: []
    };
}

/**
 * Creates a test hero.
 */
function createTestHero(id: string, hp: number = 10, position: Position = { x: 0, z: 0, sqX: 1, sqZ: 1 }): Hero {
    return {
        id,
        name: `Hero ${id}`,
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        xp: 0,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: [],
        position,
        hp,
        maxHp: hp,
        ac: 16,
        speed: 6,
        isExhausted: false,
        conditions: [],
        usedPowers: []
    };
}

/**
 * Creates a test monster.
 */
function createTestMonster(
    id: string,
    monsterType: string,
    hp: number = 10,
    position: Position = { x: 0, z: 0, sqX: 2, sqZ: 2 },
    abilities?: MonsterAbility[],
    isBoss: boolean = false
): Monster {
    return {
        id,
        name: `Monster ${id}`,
        type: 'monster',
        monsterType,
        hp,
        maxHp: hp,
        ac: 13,
        speed: 6,
        isExhausted: false,
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 4,
        damage: 2,
        experienceValue: 100,
        ownedByHeroId: null,
        position,
        conditions: [],
        usedPowers: [],
        abilities,
        isBoss
    };
}

// ---------------------------------------------------------------------------
// GROUP 1: AbilitySystem Unit Tests
// ---------------------------------------------------------------------------

/**
 * Test Group 1a: canUseAbility returns false when cooldown > 0
 */
function testCanUseAbility_Cooldown(): void {
    console.log('  Test 1a: canUseAbility returns false when cooldown > 0');

    const ability: MonsterAbility = {
        id: 'test_ability',
        name: 'Test Ability',
        description: 'Test',
        type: 'active',
        cooldown: 3,
        currentCooldown: 2,
        effects: [{ type: 'damage', target: 'closest_hero', value: 2 }]
    };

    const monster = createTestMonster('monster_1', 'goblin', 10);
    const gameState = createTestGameState([], [monster], []);

    const result = AbilitySystem.canUseAbility(ability, monster, gameState);
    if (result !== false) {
        throw new Error(`Test 1a FAILED: Expected false, got ${result}`);
    }

    console.log('  Test 1a PASSED');
}

/**
 * Test Group 1b: canUseAbility returns false when remainingUses === 0
 */
function testCanUseAbility_RemainingUses(): void {
    console.log('  Test 1b: canUseAbility returns false when remainingUses === 0');

    const ability: MonsterAbility = {
        id: 'test_ability',
        name: 'Test Ability',
        description: 'Test',
        type: 'active',
        uses: 2,
        remainingUses: 0,
        effects: [{ type: 'damage', target: 'closest_hero', value: 2 }]
    };

    const monster = createTestMonster('monster_1', 'goblin', 10);
    const gameState = createTestGameState([], [monster], []);

    const result = AbilitySystem.canUseAbility(ability, monster, gameState);
    if (result !== false) {
        throw new Error(`Test 1b FAILED: Expected false, got ${result}`);
    }

    console.log('  Test 1b PASSED');
}

/**
 * Test Group 1c: canUseAbility returns false for passive abilities
 */
function testCanUseAbility_Passive(): void {
    console.log('  Test 1c: canUseAbility returns false for passive abilities');

    const ability: MonsterAbility = {
        id: 'test_ability',
        name: 'Test Ability',
        description: 'Test',
        type: 'passive',
        effects: [{ type: 'heal', target: 'self', value: 1 }]
    };

    const monster = createTestMonster('monster_1', 'goblin', 10);
    const gameState = createTestGameState([], [monster], []);

    const result = AbilitySystem.canUseAbility(ability, monster, gameState);
    if (result !== false) {
        throw new Error(`Test 1c FAILED: Expected false, got ${result}`);
    }

    console.log('  Test 1c PASSED');
}

/**
 * Test Group 1d: executeAbility reduces target hero hp by damage value
 */
function testExecuteAbility_DamageHero(): void {
    console.log('  Test 1d: executeAbility reduces target hero hp by damage value');

    const ability: MonsterAbility = {
        id: 'test_ability',
        name: 'Test Ability',
        description: 'Test',
        type: 'active',
        effects: [{ type: 'damage', target: 'closest_hero', value: 3 }]
    };

    const hero = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const monster = createTestMonster('monster_1', 'goblin', 10, { x: 0, z: 0, sqX: 2, sqZ: 2 });
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1'];
    tile.monsters = ['monster_1'];

    const gameState = createTestGameState([hero], [monster], [tile]);

    const result = AbilitySystem.executeAbility(ability, monster, gameState);
    const updatedHero = result.heroes.find(h => h.id === 'hero_1');

    if (!updatedHero) {
        throw new Error('Test 1d FAILED: Hero not found after ability execution');
    }

    if (updatedHero.hp !== 7) {
        throw new Error(`Test 1d FAILED: Expected hero HP to be 7, got ${updatedHero.hp}`);
    }

    console.log('  Test 1d PASSED');
}

/**
 * Test Group 1e: executeAbility heals source monster (vampiric_bite)
 */
function testExecuteAbility_HealMonster(): void {
    console.log('  Test 1e: executeAbility heals source monster (vampiric_bite)');

    const ability: MonsterAbility = {
        id: 'vampiric_bite',
        name: 'Vampiric Bite',
        description: 'Bite and heal',
        type: 'active',
        effects: [
            { type: 'damage', target: 'closest_hero', value: 2 },
            { type: 'heal', target: 'self', value: 2 }
        ]
    };

    const hero = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const monster = createTestMonster('monster_1', 'vampire', 10, { x: 0, z: 0, sqX: 2, sqZ: 2 });
    monster.hp = 8;
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1'];
    tile.monsters = ['monster_1'];

    const gameState = createTestGameState([hero], [monster], [tile]);

    const result = AbilitySystem.executeAbility(ability, monster, gameState);
    const updatedMonster = result.monsters.find(m => m.id === 'monster_1');

    if (!updatedMonster) {
        throw new Error('Test 1e FAILED: Monster not found after ability execution');
    }

    if (updatedMonster.hp !== 10) {
        throw new Error(`Test 1e FAILED: Expected monster HP to be 10, got ${updatedMonster.hp}`);
    }

    console.log('  Test 1e PASSED');
}

/**
 * Test Group 1f: executeAbility respects roll_15_plus condition
 */
function testExecuteAbility_RollCondition(): void {
    console.log('  Test 1f: executeAbility respects roll_15_plus condition');

    const ability: MonsterAbility = {
        id: 'test_ability',
        name: 'Test Ability',
        description: 'Test',
        type: 'active',
        effects: [
            { type: 'damage', target: 'closest_hero', value: 2 },
            { type: 'heal', target: 'self', value: 2, condition: 'roll_15_plus' }
        ]
    };

    const hero = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const monster = createTestMonster('monster_1', 'vampire', 10, { x: 0, z: 0, sqX: 2, sqZ: 2 });
    monster.hp = 8;
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1'];
    tile.monsters = ['monster_1'];

    const gameState = createTestGameState([hero], [monster], [tile]);

    // Test 1f-i: Mock rollD20 to return 14 → heal does NOT apply
    console.log('    Test 1f-i: Roll 14 → heal does NOT apply');
    AbilitySystem._rollOverride = () => 14;
    let result = AbilitySystem.executeAbility(ability, monster, gameState);
    let updatedMonster = result.monsters.find(m => m.id === 'monster_1');
    if (!updatedMonster) {
        throw new Error('Test 1f-i FAILED: Monster not found after ability execution');
    }
    if (updatedMonster.hp !== 8) {
        throw new Error(`Test 1f-i FAILED: Expected monster HP to remain 8, got ${updatedMonster.hp}`);
    }
    console.log('    Test 1f-i PASSED');

    // Test 1f-ii: Mock rollD20 to return 15 → heal DOES apply
    console.log('    Test 1f-ii: Roll 15 → heal DOES apply');
    AbilitySystem._rollOverride = () => 15;
    result = AbilitySystem.executeAbility(ability, monster, gameState);
    updatedMonster = result.monsters.find(m => m.id === 'monster_1');
    if (!updatedMonster) {
        throw new Error('Test 1f-ii FAILED: Monster not found after ability execution');
    }
    if (updatedMonster.hp !== 10) {
        throw new Error(`Test 1f-ii FAILED: Expected monster HP to be 10, got ${updatedMonster.hp}`);
    }
    console.log('    Test 1f-ii PASSED');

    // Reset roll override
    AbilitySystem._rollOverride = null;

    console.log('  Test 1f PASSED');
}

/**
 * Test Group 1g: processCooldowns decrements cooldown to minimum 0
 */
function testProcessCooldowns(): void {
    console.log('  Test 1g: processCooldowns decrements cooldown to minimum 0');

    const ability1: MonsterAbility = {
        id: 'ability_1',
        name: 'Ability 1',
        description: 'Test',
        type: 'active',
        cooldown: 3,
        currentCooldown: 2,
        effects: [{ type: 'damage', target: 'closest_hero', value: 1 }]
    };

    const ability2: MonsterAbility = {
        id: 'ability_2',
        name: 'Ability 2',
        description: 'Test',
        type: 'active',
        cooldown: 1,
        currentCooldown: 1,
        effects: [{ type: 'damage', target: 'closest_hero', value: 1 }]
    };

    const monster = createTestMonster('monster_1', 'goblin', 10);
    monster.abilities = [ability1, ability2];

    const gameState = createTestGameState([], [monster], []);

    const result = AbilitySystem.processCooldowns(monster, gameState);
    const updatedMonster = result.monsters.find(m => m.id === 'monster_1');

    if (!updatedMonster || !updatedMonster.abilities) {
        throw new Error('Test 1g FAILED: Monster or abilities not found');
    }

    const updatedAbility1 = updatedMonster.abilities.find(a => a.id === 'ability_1');
    const updatedAbility2 = updatedMonster.abilities.find(a => a.id === 'ability_2');

    if (!updatedAbility1 || !updatedAbility2) {
        throw new Error('Test 1g FAILED: Abilities not found');
    }

    if (updatedAbility1.currentCooldown !== 1) {
        throw new Error(`Test 1g FAILED: Expected ability1 cooldown to be 1, got ${updatedAbility1.currentCooldown}`);
    }

    if (updatedAbility2.currentCooldown !== 0) {
        throw new Error(`Test 1g FAILED: Expected ability2 cooldown to be 0, got ${updatedAbility2.currentCooldown}`);
    }

    console.log('  Test 1g PASSED');
}

// ---------------------------------------------------------------------------
// GROUP 2: BossPhases Unit Tests
// ---------------------------------------------------------------------------

/**
 * Test Group 2a: getCurrentPhase returns p1 at full HP
 */
function testGetCurrentPhase_FullHP(): void {
    console.log('  Test 2a: getCurrentPhase returns p1 at full HP');

    const monster = createTestMonster('strahd', 'strahd', 100, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [], true);
    monster.currentPhase = 'p1';

    const gameState = createTestGameState([], [monster], []);

    const phase = BossPhases.getCurrentPhase(monster, gameState);

    if (!phase) {
        throw new Error('Test 2a FAILED: No phase returned');
    }

    if (phase.id !== 'p1') {
        throw new Error(`Test 2a FAILED: Expected phase p1, got ${phase.id}`);
    }

    console.log('  Test 2a PASSED');
}

/**
 * Test Group 2b: getCurrentPhase returns p2 at 40% HP for strahd
 */
function testGetCurrentPhase_LowHP(): void {
    console.log('  Test 2b: getCurrentPhase returns p2 at 40% HP for strahd');

    const monster = createTestMonster('strahd', 'strahd', 40, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [], true);
    monster.maxHp = 100;
    monster.currentPhase = 'p2';

    const gameState = createTestGameState([], [monster], []);

    const phase = BossPhases.getCurrentPhase(monster, gameState);

    if (!phase) {
        throw new Error('Test 2b FAILED: No phase returned');
    }

    if (phase.id !== 'p2') {
        throw new Error(`Test 2b FAILED: Expected phase p2, got ${phase.id}`);
    }

    console.log('  Test 2b PASSED');
}

/**
 * Test Group 2c: shouldTransitionPhase true when HP crosses threshold
 */
function testShouldTransitionPhase(): void {
    console.log('  Test 2c: shouldTransitionPhase true when HP crosses threshold');

    const monster = createTestMonster('strahd', 'strahd', 49, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [], true);
    monster.maxHp = 100;
    monster.currentPhase = 'p1';

    const gameState = createTestGameState([], [monster], []);

    const shouldTransition = BossPhases.shouldTransitionPhase(monster, gameState);

    if (!shouldTransition) {
        throw new Error('Test 2c FAILED: Expected shouldTransitionPhase to be true');
    }

    console.log('  Test 2c PASSED');
}

/**
 * Test Group 2d: transitionPhase updates currentPhase correctly
 */
function testTransitionPhase(): void {
    console.log('  Test 2d: transitionPhase updates currentPhase correctly');

    const monster = createTestMonster('strahd', 'strahd', 49, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [], true);
    monster.maxHp = 100;
    monster.currentPhase = 'p1';

    const gameState = createTestGameState([], [monster], []);

    const result = BossPhases.transitionPhase(monster, gameState);
    const updatedMonster = result.monsters.find(m => m.id === 'strahd');

    if (!updatedMonster) {
        throw new Error('Test 2d FAILED: Monster not found after transition');
    }

    if (updatedMonster.currentPhase !== 'p2') {
        throw new Error(`Test 2d FAILED: Expected currentPhase to be p2, got ${updatedMonster.currentPhase}`);
    }

    console.log('  Test 2d PASSED');
}

/**
 * Test Group 2e: getPhaseTactics returns correct pattern array for phase
 */
function testGetPhaseTactics(): void {
    console.log('  Test 2e: getPhaseTactics returns correct pattern array for phase');

    const monster = createTestMonster('strahd', 'strahd', 100, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [], true);
    monster.currentPhase = 'p1';

    const gameState = createTestGameState([], [monster], []);

    const tactics = BossPhases.getPhaseTactics(monster, gameState);

    if (!tactics || tactics.length === 0) {
        throw new Error('Test 2e FAILED: No tactics returned');
    }

    // p1 should have 2 tactics
    if (tactics.length !== 2) {
        throw new Error(`Test 2e FAILED: Expected 2 tactics, got ${tactics.length}`);
    }

    if (tactics[0].condition !== 'hp_full') {
        throw new Error(`Test 2e FAILED: Expected first tactic condition to be hp_full, got ${tactics[0].condition}`);
    }

    console.log('  Test 2e PASSED');
}

// ---------------------------------------------------------------------------
// GROUP 3: Integration Tests
// ---------------------------------------------------------------------------

/**
 * Test Group 3a: Skeleton defeated → undying triggers → may return to 1 HP
 */
function testSkeletonUndying(): void {
    console.log('  Test 3a: Skeleton defeated → undying triggers → may return to 1 HP');

    const undyingAbility: MonsterAbility = {
        id: 'undying',
        name: 'Undying',
        description: 'Roll to return to 1 HP when defeated',
        type: 'active',
        trigger: 'on_death',
        cooldown: 0,
        currentCooldown: 0,
        effects: [
            { type: 'heal', value: 1, target: 'self', condition: 'roll_15_plus' }
        ]
    };

    const hero = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const skeleton = createTestMonster('skeleton_1', 'skeleton', 0, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [undyingAbility]);
    skeleton.maxHp = 5;
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1'];
    tile.monsters = ['skeleton_1'];

    const gameState = createTestGameState([hero], [skeleton], [tile]);

    // Test 3a-i: Roll < 15 → skeleton stays defeated
    console.log('    Test 3a-i: Roll 14 → skeleton stays defeated');
    AbilitySystem._rollOverride = () => 14;
    let result = AbilitySystem.executeAbility(undyingAbility, skeleton, gameState);
    let updatedSkeleton = result.monsters.find(m => m.id === 'skeleton_1');
    if (!updatedSkeleton) {
        throw new Error('Test 3a-i FAILED: Skeleton not found after ability execution');
    }
    if (updatedSkeleton.hp !== 0) {
        throw new Error(`Test 3a-i FAILED: Expected skeleton HP to be 0, got ${updatedSkeleton.hp}`);
    }
    console.log('    Test 3a-i PASSED');

    // Test 3a-ii: Roll >= 15 → skeleton returns to 1 HP
    console.log('    Test 3a-ii: Roll 15 → skeleton returns to 1 HP');
    AbilitySystem._rollOverride = () => 15;
    result = AbilitySystem.executeAbility(undyingAbility, skeleton, gameState);
    updatedSkeleton = result.monsters.find(m => m.id === 'skeleton_1');
    if (!updatedSkeleton) {
        throw new Error('Test 3a-ii FAILED: Skeleton not found after ability execution');
    }
    if (updatedSkeleton.hp !== 1) {
        throw new Error(`Test 3a-ii FAILED: Expected skeleton HP to be 1, got ${updatedSkeleton.hp}`);
    }
    console.log('    Test 3a-ii PASSED');

    // Reset roll override
    AbilitySystem._rollOverride = null;

    console.log('  Test 3a PASSED');
}

/**
 * Test Group 3b: Strahd starts at p1, takes damage below 50% → next villain phase activates p2 tactics
 */
function testStrahdPhaseTransition(): void {
    console.log('  Test 3b: Strahd starts at p1, takes damage below 50% → next villain phase activates p2 tactics');

    const hero = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const strahd = createTestMonster('strahd', 'strahd', 100, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [], true);
    strahd.currentPhase = 'p1';
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1'];
    tile.monsters = ['strahd'];

    let gameState = createTestGameState([hero], [strahd], [tile]);

    // Strahd takes damage below 50%
    gameState.monsters = gameState.monsters.map(m =>
        m.id === 'strahd' ? { ...m, hp: 49 } : m
    );

    // Check if phase should transition
    const shouldTransition = BossPhases.shouldTransitionPhase(
        gameState.monsters.find(m => m.id === 'strahd')!,
        gameState
    );

    if (!shouldTransition) {
        throw new Error('Test 3b FAILED: Expected shouldTransitionPhase to be true');
    }

    // Transition phase
    gameState = BossPhases.transitionPhase(
        gameState.monsters.find(m => m.id === 'strahd')!,
        gameState
    );

    const updatedStrahd = gameState.monsters.find(m => m.id === 'strahd');
    if (!updatedStrahd) {
        throw new Error('Test 3b FAILED: Strahd not found after transition');
    }

    if (updatedStrahd.currentPhase !== 'p2') {
        throw new Error(`Test 3b FAILED: Expected currentPhase to be p2, got ${updatedStrahd.currentPhase}`);
    }

    // Check that p2 tactics are returned
    const tactics = BossPhases.getPhaseTactics(updatedStrahd, gameState);
    if (!tactics || tactics.length === 0) {
        throw new Error('Test 3b FAILED: No tactics returned for p2');
    }

    // p2 should have 3 tactics
    if (tactics.length !== 3) {
        throw new Error(`Test 3b FAILED: Expected 3 tactics for p2, got ${tactics.length}`);
    }

    console.log('  Test 3b PASSED');
}

/**
 * Test Group 3c: Ghoul plague_aura → adjacent hero takes 1 damage at start of ghoul's turn
 */
function testGhoulPlagueAura(): void {
    console.log('  Test 3c: Ghoul plague_aura → adjacent hero takes 1 damage at start of ghoul\'s turn');

    const plagueAuraAbility: MonsterAbility = {
        id: 'plague_aura',
        name: 'Plague Aura',
        description: 'Adjacent heroes take 1 damage at start of turn',
        type: 'passive',
        trigger: 'on_turn_start',
        effects: [
            { type: 'damage', value: 1, target: 'adjacent_heroes' }
        ]
    };

    const hero = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const ghoul = createTestMonster('ghoul_1', 'ghoul', 10, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [plagueAuraAbility]);
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1'];
    tile.monsters = ['ghoul_1'];

    const gameState = createTestGameState([hero], [ghoul], [tile]);

    const result = AbilitySystem.executeAbility(plagueAuraAbility, ghoul, gameState);
    const updatedHero = result.heroes.find(h => h.id === 'hero_1');

    if (!updatedHero) {
        throw new Error('Test 3c FAILED: Hero not found after ability execution');
    }

    if (updatedHero.hp !== 9) {
        throw new Error(`Test 3c FAILED: Expected hero HP to be 9, got ${updatedHero.hp}`);
    }

    console.log('  Test 3c PASSED');
}

/**
 * Test Group 3d: Vampire uses drain_life → hero loses HP, vampire gains HP, neither exceeds maxHp
 */
function testVampireDrainLife(): void {
    console.log('  Test 3d: Vampire uses drain_life → hero loses HP, vampire gains HP, neither exceeds maxHp');

    const drainLifeAbility: MonsterAbility = {
        id: 'drain_life',
        name: 'Drain Life',
        description: 'Drain life from hero',
        type: 'active',
        effects: [
            { type: 'damage', value: 3, target: 'closest_hero' },
            { type: 'heal', value: 3, target: 'self' }
        ]
    };

    const hero = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const vampire = createTestMonster('vampire_1', 'vampire', 8, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [drainLifeAbility]);
    vampire.maxHp = 10;
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1'];
    tile.monsters = ['vampire_1'];

    const gameState = createTestGameState([hero], [vampire], [tile]);

    const result = AbilitySystem.executeAbility(drainLifeAbility, vampire, gameState);
    const updatedHero = result.heroes.find(h => h.id === 'hero_1');
    const updatedVampire = result.monsters.find(m => m.id === 'vampire_1');

    if (!updatedHero) {
        throw new Error('Test 3d FAILED: Hero not found after ability execution');
    }

    if (!updatedVampire) {
        throw new Error('Test 3d FAILED: Vampire not found after ability execution');
    }

    if (updatedHero.hp !== 7) {
        throw new Error(`Test 3d FAILED: Expected hero HP to be 7, got ${updatedHero.hp}`);
    }

    if (updatedVampire.hp !== 10) {
        throw new Error(`Test 3d FAILED: Expected vampire HP to be 10 (max), got ${updatedVampire.hp}`);
    }

    // Test with vampire at max HP already
    vampire.hp = 10;
    const gameState2 = createTestGameState([hero], [vampire], [tile]);
    const result2 = AbilitySystem.executeAbility(drainLifeAbility, vampire, gameState2);
    const updatedVampire2 = result2.monsters.find(m => m.id === 'vampire_1');

    if (!updatedVampire2) {
        throw new Error('Test 3d FAILED: Vampire not found after second ability execution');
    }

    if (updatedVampire2.hp !== 10) {
        throw new Error(`Test 3d FAILED: Expected vampire HP to remain at max 10, got ${updatedVampire2.hp}`);
    }

    console.log('  Test 3d PASSED');
}

/**
 * Test Group 3e: Dragon fire_breath (aoe) → ALL adjacent heroes take damage, not just closest
 */
function testDragonFireBreath(): void {
    console.log('  Test 3e: Dragon fire_breath (aoe) → ALL adjacent heroes take damage, not just closest');

    const fireBreathAbility: MonsterAbility = {
        id: 'fire_breath',
        name: 'Fire Breath',
        description: 'All adjacent heroes take damage',
        type: 'active',
        effects: [
            { type: 'damage', value: 2, target: 'adjacent_heroes' }
        ]
    };

    const hero1 = createTestHero('hero_1', 10, { x: 0, z: 0, sqX: 1, sqZ: 1 });
    const hero2 = createTestHero('hero_2', 10, { x: 0, z: 0, sqX: 3, sqZ: 3 });
    const dragon = createTestMonster('dragon_1', 'dragon', 20, { x: 0, z: 0, sqX: 2, sqZ: 2 }, [fireBreathAbility]);
    const tile = createTestTile('tile_0', 0, 0);
    tile.heroes = ['hero_1', 'hero_2'];
    tile.monsters = ['dragon_1'];

    const gameState = createTestGameState([hero1, hero2], [dragon], [tile]);

    const result = AbilitySystem.executeAbility(fireBreathAbility, dragon, gameState);
    const updatedHero1 = result.heroes.find(h => h.id === 'hero_1');
    const updatedHero2 = result.heroes.find(h => h.id === 'hero_2');

    if (!updatedHero1) {
        throw new Error('Test 3e FAILED: Hero 1 not found after ability execution');
    }

    if (!updatedHero2) {
        throw new Error('Test 3e FAILED: Hero 2 not found after ability execution');
    }

    if (updatedHero1.hp !== 8) {
        throw new Error(`Test 3e FAILED: Expected hero 1 HP to be 8, got ${updatedHero1.hp}`);
    }

    if (updatedHero2.hp !== 8) {
        throw new Error(`Test 3e FAILED: Expected hero 2 HP to be 8, got ${updatedHero2.hp}`);
    }

    console.log('  Test 3e PASSED');
}

// ---------------------------------------------------------------------------
// Main Test Runner
// ---------------------------------------------------------------------------

/**
 * Run all ability system tests.
 * Returns true if all tests pass, false otherwise.
 */
export const runAbilitySystemTests = (): boolean => {
    console.log('--- STARTING ABILITY SYSTEM TESTS ---');

    try {
        // GROUP 1: AbilitySystem Unit Tests
        console.log('GROUP 1: AbilitySystem Unit Tests');
        testCanUseAbility_Cooldown();
        testCanUseAbility_RemainingUses();
        testCanUseAbility_Passive();
        testExecuteAbility_DamageHero();
        testExecuteAbility_HealMonster();
        testExecuteAbility_RollCondition();
        testProcessCooldowns();
        console.log('GROUP 1 PASSED\n');

        // GROUP 2: BossPhases Unit Tests
        console.log('GROUP 2: BossPhases Unit Tests');
        testGetCurrentPhase_FullHP();
        testGetCurrentPhase_LowHP();
        testShouldTransitionPhase();
        testTransitionPhase();
        testGetPhaseTactics();
        console.log('GROUP 2 PASSED\n');

        // GROUP 3: Integration Tests
        console.log('GROUP 3: Integration Tests');
        testSkeletonUndying();
        testStrahdPhaseTransition();
        testGhoulPlagueAura();
        testVampireDrainLife();
        testDragonFireBreath();
        console.log('GROUP 3 PASSED\n');

        console.log('--- ABILITY SYSTEM TESTS PASSED ---');
        return true;
    } catch (error) {
        console.error('--- ABILITY SYSTEM TESTS FAILED ---');
        console.error(error);
        return false;
    }
};

export default runAbilitySystemTests;

