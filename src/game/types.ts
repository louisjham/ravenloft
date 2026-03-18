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
