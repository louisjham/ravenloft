// Condition types
export type ConditionType = 'slowed' | 'immobilized' | 'poisoned' | 'dazed' | 'weakened' | 'stunned';

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

export interface Condition {
  type: ConditionType;
  sourceId?: string; // Who applied this condition
  turnsRemaining: number; // How many turns until it expires
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
  // DEBUG: Conditions array - currently NOT used
  conditions: Condition[];
  // DEBUG: Used powers tracking - currently NOT used
  usedPowers: string[]; // IDs of Daily powers used this adventure
}

export interface Hero extends Entity {
  type: 'hero';
  heroClass: string;
  level: number;
  xp: number;
  surgeUsed: boolean;
  abilities: string[]; // Ability IDs
  hand: string[]; // Card IDs
  items: string[]; // Item IDs
}

export interface Monster extends Entity {
  type: 'monster';
  monsterType: string;
  behavior: MonsterBehavior;
  attackBonus: number;
  damage: number;
  experienceValue: number;
  ownedByHeroId: string | null;
  moveRange?: number;
  abilities?: MonsterAbility[]
  currentPhase?: string
  isBoss?: boolean
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
}

export type CardType = 'ability' | 'monster' | 'encounter' | 'treasure' | 'item' | 'consumable';

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  flavorText?: string;
  effects: Effect[];
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
  range?: number;
  target?: 'self' | 'single' | 'area' | 'all_heroes' | 'all_monsters' | 'adjacent';
  // Level up card
  isLevelUp?: boolean;
  // Trap card specific
  disableDC?: number; // Difficulty class to disable the trap
}

export interface Effect {
  type: 'damage' | 'heal' | 'move' | 'status_effect' | 'attack_bonus' | 'defense_bonus' | 'draw_card' | 'flip_power' | 'passive';
  value?: number;
  target: 'self' | 'single' | 'area' | 'all_heroes' | 'all_monsters' | 'adjacent';
  range?: number;
  statusEffect?: string;
  condition?: string; // e.g., 'undead', 'vampire'
  passiveType?: string; // e.g., 'undead_ward'
  duration?: number; // For temporary effects
  attackBonus?: number; // For event-attack and trap cards
}

export interface Die {
  sides: 20;
  lastRoll?: number;
  history: number[];
}

export interface Scenario {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  introText: string;
  victoryText: string;
  defeatText: string;
  objectives: any[]; // Detailed in Objectives.ts
  specialRules: any[];
  startTileId: string;
  maxSurges: number;
}

export interface GameLogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'action' | 'combat' | 'event' | 'system';
}

export type GamePhase = 'setup' | 'hero' | 'exploration' | 'villain' | 'monster' | 'end' | 'victory' | 'defeat';

export interface GameState {
  phase: GamePhase;
  currentHeroId: string;
  heroes: Hero[];
  monsters: Monster[];
  tiles: Tile[];
  dungeonDeck: string[]; // Card IDs
  treasureDeck: string[];
  encounterDeck: string[];
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
}

export interface Trap {
  id: string;
  cardId: string;
  tileId: string;
  position?: Position;
  disabled: boolean;
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
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  showDevTools: boolean;
  difficulty: 'normal' | 'hard';
}

export interface Path {
  points: Position[];
  cost: number;
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
  | { action: 'move'; path: Tile[] }
  | { action: 'attack'; targetHeroId: string; damage: number }
  | {
    action: 'move_then_attack';
    path: Tile[];
    targetHeroId: string;
    damage: number
  }
  | { action: 'idle' }
  | {
    action: 'use_ability';
    abilityId: string;
    targetId?: string;
    effects: AbilityEffect[]
  }
