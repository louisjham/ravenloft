// Condition types
export type ConditionType = 'slowed' | 'immobilized' | 'poisoned' | 'dazed' | 'weakened' | 'stunned' | 'crippling_miasma' | 'attack_bonus' | 'damage_bonus' | 'ac_bonus' | 'mummy_rot';



// Power types
export type PowerType = 'at-will' | 'daily' | 'utility';

// Treasure card types
export type TreasureType = 'blessing' | 'fortune' | 'item';

// Encounter card types
export type EncounterType = 'environment' | 'event' | 'event-attack' | 'trap';

export type EntityType = 'hero' | 'monster' | 'trap' | 'treasure';

// Cardinal direction used for tile edges and movement.
export type Direction = 'north' | 'east' | 'south' | 'west';

// Valid tile rotation values (clockwise degrees).
export type Rotation = 0 | 90 | 180 | 270;

export interface Position {
  x: number; // Tile X
  z: number; // Tile Z
  sqX: number; // 0-3 within tile
  sqZ: number; // 0-3 within tile
}

export interface ExplorationPoint {
  tileId: string;
  edge: Direction;
  worldX: number;
  worldZ: number;
}

/**
 * Describes a conflict when attempting to place a tile.
 */
export interface EdgeConflict {
  edge: Direction;
  issue: 'open_to_wall' | 'wall_to_open' | 'open_to_boundary' | 'primary_blocked';
  neighborTileId?: string;
  description: string;
}

/**
 * Result of validating a tile placement.
 */
export interface ValidationResult {
  valid: boolean;
  conflicts: EdgeConflict[];
  warnings: string[];
}

export interface Condition {
  type: ConditionType;
  sourceId?: string; // Who applied this condition
  turnsRemaining: number; // How many turns until it expires
  value?: number; // Optional value (e.g. for attack_bonus)
}

export interface ActiveCondition extends Condition {
  targetId: string;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  position: Position;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  isExhausted: boolean;
  isDefeated?: boolean;
  conditions: Condition[];
  usedPowers: string[];
}

export interface Hero extends Entity {
  type: 'hero';
  heroClass: string;
  level: number;
  xp: number;
  surgeUsed: boolean;
  surgeValue: number;
  abilities: string[]; // Ability IDs
  hand: string[]; // Card IDs
  items: string[]; // Item IDs
  selectedPowerIds?: string[]
  escaped?: boolean;
  flippedPowerIds?: string[];
  attackBonus: number;
  damage?: number;
  /** Fortune: Action Surge — number of extra actions granted this turn. Reset to 0 at end of turn. */
  extraActionsThisTurn?: number;
  hasRolledNatural20ThisTurn?: boolean;
  hasUsedSurgeThisTurn?: boolean;
  removedFromPlay?: boolean;
  startedTurnAdjacentToDreadWarriorIds?: string[];
}

export function isMonsterEntity(entity: Entity): entity is Monster {
  return entity.type === 'monster';
}

export function isHeroEntity(entity: Entity): entity is Hero {
  return entity.type === 'hero';
}

export interface Monster extends Entity {
  type: 'monster';
  monsterType: string;
  isUndead?: boolean;
  /** The original deck card / data-file ID this instance was created from (e.g. "monster_skeleton"). */
  templateId?: string;
  behavior: MonsterBehavior;
  attackBonus: number;
  damage: number;
  missDamage?: number;
  experienceValue: number;
  ownedByHeroId: string | null;
  hasActivated?: boolean;
  moveRange?: number;
  abilities?: MonsterAbility[]
  currentPhase?: string
  isBoss?: boolean
  tacticsText?: string
  specialAbilityText?: string
  /** Fortune: Daze — number of activations to skip (decremented by MonsterAI). */
  skipActivations?: number;
  /** Silver Dagger — Werewolf HP regeneration is permanently disabled. */
  regenerationDisabled?: boolean;
}

export interface MonsterBehavior {
  conditions: string[];
  priorityTargets: string[];
  actions: string[];
}

export type TileCorner = 'NW' | 'NE' | 'SW' | 'SE';

export interface TileConnection {
  edge: 'north' | 'south' | 'east' | 'west';
  isOpen: boolean;
  connectedTileId?: string;
}

export interface Tile {
  id: string;
  name: string;
  x: number; // Dungeon grid X
  z: number; // Dungeon grid Z
  terrainType: 'corridor' | 'named_room' | 'boss_room';
  connections: TileConnection[];
  boneSquare: { sqX: number, sqZ: number };
  isRevealed: boolean;
  isStart: boolean;
  isExit: boolean;
  rotation: 0 | 90 | 180 | 270;
  monsters: string[]; // Monster IDs on this tile
  heroes: string[]; // Hero IDs on this tile
  items: string[]; // Item/Token IDs
  blocksLineOfSight?: boolean; // If true, this tile blocks line-of-sight
  imageUrl?: string;
  openEdges?: Direction[];
  encounterType?: 'white' | 'black';
}

export type CardType = 'ability' | 'monster' | 'encounter' | 'treasure' | 'item' | 'consumable';

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  flavorText?: string;
  effects: Effect[];
  image?: string;
  phase?: 'hero' | 'exploration' | 'monster';
  heroClass?: string;
  powerType?: PowerType;
  // Treasure card specific
  treasureType?: TreasureType;
  // Encounter card specific
  encounterType?: EncounterType;
  // Power card specific
  attackBonus?: number;
  damage?: number;
  missEffect?: string; // e.g. "1 Damage" — text shown for on-miss effects
  range?: number;
  target?: 'self' | 'single' | 'area' | 'all_heroes' | 'all_monsters' | 'adjacent' | 'adjacent-monster' | 'all-on-tile';
  // Level up card
  isLevelUp?: boolean;
  // Charges for multi-use items (e.g. Necklace of Fireballs)
  charges?: number;
  // Trap card specific
  disableDC?: number; // Difficulty class to disable the trap
}

export interface Effect {
  type:
    | 'damage' | 'heal' | 'move' | 'status_effect'
    | 'attack_bonus' | 'defense_bonus' | 'damage_bonus' | 'ac_bonus' | 'speed_bonus'
    | 'draw_card' | 'flip_power' | 'passive' | 'spawn_monster' | 'draw_treasure'
    // Fortune-specific effect types
    | 'remove_conditions'
    | 'daze_monster_activation'
    | 'peek_reorder_deck'
    | 'reveal_tile_no_encounter'
    | 'add_xp_to_pile'
    | 'move_monster_away'
    | 'draw_treasure_choose'
    | 'remove_one_condition'
    | 'deck_sentinel_choice'
    // Phase 2 event/event-attack effect types
    | 'event_attack'
    | 'move_monsters_closer'
    | 'heal_undead_on_tile'
    | 'discard_treasure';
  value?: number;
  target?: 'self' | 'single' | 'area' | 'all_heroes' | 'all_monsters' | 'adjacent' | 'all' | 'single_hero' | 'monsterDeck' | 'encounterDeck' | 'tile' | 'heroes_on_active_tile' | 'active_hero' | 'heroes_within_1_tile' | 'monsters_on_active_tile' | 'monsters_not_on_hero_tile';
  range?: number;
  statusEffect?: ConditionType;
  when?: 'hit' | 'miss' | 'always';
  condition?: string; // e.g., 'undead', 'vampire'
  passiveType?: string; // e.g., 'undead_ward'
  duration?: number; // For temporary effects
  attackBonus?: number; // For event-attack and trap cards
  targetType?: 'hero' | 'monster' | 'all';
  // Phase 2 event_attack fields
  damage?: number;
  missValue?: number;
  onHitStatusEffect?: ConditionType;
  onMissStatusEffect?: ConditionType;
  onHitEffect?: string;
  repeatCount?: number;
}


export interface Die {
  sides: 20;
  lastRoll?: number;
  history: number[];
}

export interface SpecialTilePlacement {
  tileId: string;
  insertAfterIndex: number;
}

export interface VillainLairPairing {
  lairTileId: string;
  villainMonsterId: string;
  villainName: string;
}

export interface Scenario {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  introText: string;
  victoryText: string;
  defeatText: string;
  objectives: Objective[];
  specialRules: MachineSpecialRule[];
  startTileId: string;
  maxSurges: number;
  setAsideTileIds?: string[];
  specialTilePlacements?: SpecialTilePlacement[];
  tilePiles?: { standard: number; special: string[] };
  lairPacketSize?: number;
  lairCount?: number;
  villainLairPairings?: VillainLairPairing[];
}

export interface GameLogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'action' | 'combat' | 'event' | 'system';
}

export type GamePhase = 'setup' | 'hero' | 'exploration' /* TODO: actively used? */ | 'villain' | 'monster' | 'end' /* TODO: actively used? */ | 'victory' | 'defeat';

export type CardResolutionPhase =
  | 'idle'
  | 'drawing'
  | 'revealing'
  | 'resolving'
  | 'complete';

export interface CardResolutionState {
  phase: CardResolutionPhase;
  cardId: string | null;
  cardType: 'encounter' | 'treasure' | null;
  pendingEffects?: Effect[];
  resolvedEffects?: Effect[];
  targetEntityId: string | null;
  result?: { success: boolean; message: string; results?: any[] } | null;
  spawnedMonsterId?: string | null;
}

export interface TreasureAssignment {
  cardId: string
  heroId: string
  assignedAt: number
  isUsed: boolean
}

export interface ActiveBlessing {
  cardId: string
  heroId: string
  drawnOnTurnCount: number
  effects: Effect[]
  name: string
}

export interface TileEffect {
  id: string
  tileId: string
  type: string
  heroId: string
  cardId: string
  isExpended: boolean
  description: string
}

export type DeckSentinel = 'sentinel_moments_respite'

export type DeckKey = 'encounterDeck' | 'monsterDeck' | 'treasureDeck' | 'dungeonDeck';

// ---------------------------------------------------------------------------
// Fortune XP entries (Harrowed Experience)
// Kept separate from experiencePile (string[]) to avoid breaking existing code.
// ---------------------------------------------------------------------------

export interface FortuneXpEntry {
  cardId: string;    // The fortune card ID (e.g. 'fortune_harrowed_experience')
  source: 'fortune';
  amount: number;    // Always 1 for Harrowed Experience
}

// ---------------------------------------------------------------------------
// PendingFortune — discriminated union for player-choice fortune resolution
// ---------------------------------------------------------------------------

export type PendingFortune =
  | { kind: 'deckReorder'; deck: 'monster' | 'encounter'; topCards: string[]; fortuneCardId: string }
  | { kind: 'monsterPick'; purpose: 'daze' | 'move'; eligible: string[]; fortuneCardId: string }
  | { kind: 'heroConditionPick'; heroIds: string[]; fortuneCardId: string }
  | { kind: 'treasureChoose'; drawn: string[]; fortuneCardId: string }
  | { kind: 'tileEdgePick'; edges: { tileId: string; edge: Direction }[]; fortuneCardId: string }
  | { kind: 'deckSentinelChoice'; fortuneCardId: string }
  | { kind: 'tileRelocatePick'; heroId: string; eligibleTileIds: string[]; fortuneCardId: string }
  | { kind: 'atWillPowerPick'; attackerHeroId: string; targetHeroId: string; eligiblePowerIds: string[]; fortuneCardId: string };

export interface Objective {
  id: string
  description: string
  type: string
  isCompleted: boolean
  targetId?: string
  targetTileId?: string
  targetIds?: string[]
  targetAttribute?: string
  targetType?: string
  count?: number
  currentCount?: number
  [key: string]: unknown
}

export interface MachineSpecialRule {
  trigger: { type: 'turn_count' | 'tile_reveal' | 'turn_total'; value?: number }
  action?: string
  [key: string]: unknown
}

export interface GameState {
  logIdCounter: number;
  phase: GamePhase;
  currentHeroId: string;
  heroes: Hero[];
  monsters: Monster[];
  tiles: Tile[];
  dungeonDeck: string[]; // Card IDs
  treasureDeck: string[];
  encounterDeck: string[];
  monsterDeck: string[];
  discardPiles: Record<CardType | string, string[]>;
  activeScenario: Scenario;
  turnOrder: string[];
  healingSurges: number;
  turnCount: number;
  log: GameLogEntry[];
  // New state for card systems
  activeEnvironmentCard: string | null; // ID of active environment card
  experiencePile: string[]; // IDs of monster cards in experience pile
  treasuresDrawnThisTurn: number; // Track treasures drawn this turn
  traps: Trap[]; // Active traps in dungeon
  villainPhaseQueue: string[];
  activeVillainId: string | null;
  powerSelections?: PowerSelection[]
  // One entry per hero, populated at game initialization.
  // Card resolution (Prompt CUI-1)
  cardResolution: CardResolutionState;

  treasureAssignments?: TreasureAssignment[];
  activeConditions?: ActiveCondition[];
  // Token system
  tokens?: GameToken[]; // Tokens placed on tiles
  strahdsCoffinTokenId?: string | null; // Which token is Strahd's coffin (for Scenario 1)
  
  // Turn state
  hasExploredThisTurn?: boolean;
  hasAttackedThisTurn?: boolean;
  hasRolledNatural20ThisTurn?: boolean;
  hasUsedSurgeThisTurn?: boolean;
  lastPlacedTileEncounterType?: string | null;
  exploredThisTurn?: boolean;
  lastPlacedTileId?: string | null;

  // Blessings, items, tile effects
  activeBlessings?: ActiveBlessing[];
  itemCharges?: Record<string, number>;
  tileEffects?: TileEffect[];

  // Fortune XP entries (Harrowed Experience) — separate from monster experiencePile
  fortuneXpEntries?: FortuneXpEntry[];

  // Pending player-choice Fortune resolution
  pendingFortune?: PendingFortune;

  // Scenario tracking
  defeatedVillainIds?: string[];

  // Custom Scenario Variables
  fountainTokens?: number;
  timeTrack?: { current: number; max: number };
  strahdAwakened?: boolean;
  chapelRevealed?: boolean;
  laboratoryRevealed?: boolean;
  kavanEscortedBy?: string;
  unplacedCoffinTokens?: { id: string; name: string; isStrahds: boolean }[];
  tomeOfStrahdItemStack?: string[];
  tomeOfStrahdVillainStack?: string[];

  // Encounter card in villain phase
  pendingEncounter?: boolean; // Whether an encounter draw is pending for this villain phase
  frenzyActiveThisTurn?: boolean;
}

export interface Trap {
  id: string;
  cardId: string;
  tileId: string;
  position?: Position;
  isDisabled: boolean;
  ownedByHeroId: string | null;
  isTriggered: boolean;
}

export interface AttackResult {
  attackerId: string;
  targetId: string;
  hit: boolean;
  roll: number;
  total: number;
  damage: number;
  critical: boolean;
  wasImmune?: boolean;
  healAttacker?: number;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  showDevTools: boolean;
  difficulty: 'normal' | 'hard';
  quickRoll?: boolean;
  animationSpeed?: 'normal' | 'fast' | 'instant';
  graphicsQuality?: 'high' | 'medium' | 'low';
  resolutionScale?: number;
  accessibility?: {
    colorblindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    highContrast?: boolean;
    textSize?: 'small' | 'medium' | 'large';
    [key: string]: boolean | number | string | undefined;
  };
}

export interface Path {
  points: Position[];
  cost: number;
}

export interface IBehavior {
  decideAction(monster: Monster, heroes: Hero[], gameState: GameState): MonsterAction;
}

export interface MonsterAction {
  type: 'move' | 'attack' | 'special' | 'idle';
  targetId?: string;
  position?: Position;
  abilityId?: string;
}

// ============================================================================
// AMI-1: Monster Ability System Types
// ============================================================================

// Union types for monster abilities
export type AbilityType = 'passive' | 'active' | 'triggered'

export type AbilityTrigger =
  | 'on_turn_start' | 'on_turn_end'
  | 'on_damage_taken' | 'on_damage_dealt'
  | 'on_death' | 'on_spawn' | 'on_low_hp'

export type AbilityEffectType =
  | 'damage' | 'heal' | 'condition' | 'move'
  | 'summon' | 'buff' | 'debuff'
  | 'teleport' | 'push' | 'pull'

export type AbilityTarget =
  | 'self' | 'closest_hero' | 'all_heroes'
  | 'all_monsters' | 'adjacent_heroes'
  | 'adjacent_monsters' | 'tile' | 'random_hero'

// Interfaces for monster abilities
export interface AbilityEffect {
  type: AbilityEffectType
  target: AbilityTarget
  value?: number
  condition?: string
  duration?: number
  range?: number
  aoe?: boolean
  /** For 'summon' effects: the monster data ID to spawn (e.g. 'monster_skeleton'). */
  monsterId?: string
}

export interface MonsterAbility {
  id: string
  name: string
  description: string
  type: AbilityType
  trigger?: AbilityTrigger
  cooldown?: number
  currentCooldown?: number
  uses?: number
  remainingUses?: number
  effects: AbilityEffect[]
}

export interface TacticPattern {
  condition: string
  actions: string[]
  ability?: string
}

export interface BossPhase {
  id: string
  className: string
  hpThreshold: number
  triggers: string[]
  abilities: string[]
  tactics: TacticPattern[]
  passiveAbilities?: string[]
}

// TacticResult type moved from MonsterAI.ts and extended
export type TacticResult =
  | { action: 'move'; path: Tile[]; passCard?: boolean; revealTiles?: boolean; teleportToTileId?: string; acolyteDidNotAttack?: boolean }
  | { action: 'attack'; targetHeroId: string; damage: number; attackBonus?: number; missDamage?: number; statusEffect?: ConditionType; multiTarget?: boolean; passCard?: boolean; acolyteDidNotAttack?: boolean }
  | {
    action: 'move_then_attack';
    path: Tile[];
    targetHeroId: string;
    damage: number;
    attackBonus?: number;
    missDamage?: number;
    statusEffect?: ConditionType;
    multiTarget?: boolean;
    passCard?: boolean;
    acolyteDidNotAttack?: boolean;
  }
  | { action: 'idle'; passCard?: boolean; acolyteDidNotAttack?: boolean; revealTiles?: boolean; teleportToTileId?: string }
  | {
    action: 'use_ability';
    abilityId: string;
    targetId?: string;
    effects: AbilityEffect[];
    passCard?: boolean;
    acolyteDidNotAttack?: boolean;
  }

// ============================================================================
// PSS-1: Power Selection System Types
// ============================================================================

export type PowerTargetType =
  | 'self' | 'single_enemy' | 'single_ally'
  | 'all_enemies' | 'all_allies'
  | 'adjacent_enemies' | 'adjacent_allies'
  | 'area' | 'tile'

export type PowerKeyword =
  | 'arcane' | 'divine' | 'martial' | 'shadow'
  | 'fire' | 'cold' | 'thunder' | 'necrotic'
  | 'radiant' | 'poison'

export interface PowerSelection {
  heroId: string
  selectedPowerIds: string[]
  isConfirmed: boolean
}

export interface PowerSelectionConstraints {
  heroType: string
  maxAtWill: number    // maps to 'at-will' cards
  maxDaily: number     // maps to 'daily' cards
  maxUtility: number   // maps to 'utility' cards
  totalMax: number
}

export type PowerCardRef = Pick<Card,
  'id' | 'name' | 'description' | 'flavorText' |
  'powerType' | 'heroClass' | 'effects' | 'attackBonus' |
  'damage' | 'range' | 'target'
> & {
  keywords?: PowerKeyword[]
  maxPerDeck?: number
}

// ============================================================================
// Token System Types
// ============================================================================

export type TokenType =
  | 'coffin'        // Coffin tokens for Scenario 1 (Find Strahd's Coffin)
  | 'treasure'      // Treasure tokens
  | 'trap'          // Trap tokens
  | 'objective'     // Generic objective tokens
  | 'monster_spawn' // Monster spawn points
  | 'item'          // Item tokens
  | 'encounter'     // Encounter tokens
  | 'condition'    // Condition tokens
  | 'hp'           // HP tokens
  | 'healing_surge' // Healing surge tokens
  | 'monster'      // Monster tokens
  | 'reaction'     // Reaction tokens
  | 'marker'       // Marker tokens
  | 'adventure'    // Adventure tokens
  | 'misc'         // Miscellaneous tokens
  | 'brazier'      // Brazier tokens (Scenario 2)

export interface GameToken {
  id: string
  type: TokenType
  name: string
  description?: string
  position: Position
  tileId: string      // Which tile this token is on
  isRevealed: boolean // Whether the token has been discovered
  isSearched: boolean // Whether the token has been searched
  imageUrl?: string   // Optional image for the token
  metadata?: {        // Additional data based on token type
    isStrahdsCoffin?: boolean  // For coffin tokens - is this THE coffin?
    trapId?: string            // For trap tokens
    itemId?: string            // For item tokens
    monsterId?: string         // For monster spawn tokens
    [key: string]: unknown
  }
}

export interface TokenSearchResult {
  tokenId: string
  tokenType: TokenType
  success: boolean
  message: string
  revealedData?: {
    isStrahdsCoffin?: boolean
    itemId?: string
    trapId?: string
  }
}
