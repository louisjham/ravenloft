// DEBUG: Condition types - currently NOT implemented
export type ConditionType = 'slowed' | 'immobilized' | 'poisoned' | 'dazed' | 'weakened' | 'stunned';

// DEBUG: Power types - currently NOT implemented
export type PowerType = 'at-will' | 'daily' | 'utility';

export type EntityType = 'hero' | 'monster' | 'trap' | 'treasure';

export interface Position {
  x: number; // Tile X
  z: number; // Tile Z
  sqX: number; // 0-3 within tile
  sqZ: number; // 0-3 within tile
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
  isRevealed: boolean;
  isStart: boolean;
  isExit: boolean;
  rotation: 0 | 90 | 180 | 270;
  monsters: string[]; // Monster IDs on this tile
  heroes: string[]; // Hero IDs on this tile
  items: string[]; // Item/Token IDs
}

export type CardType = 'ability' | 'monster' | 'encounter' | 'treasure' | 'item';

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  flavorText?: string;
  effects: Effect[];
  phase?: 'hero' | 'exploration' | 'monster';
  heroClass?: string;
  // DEBUG: Power type - currently NOT used
  powerType?: PowerType;
}

export interface Effect {
  type: 'damage' | 'heal' | 'move' | 'status_effect';
  value?: number;
  target: 'self' | 'single' | 'area' | 'all_heroes' | 'all_monsters';
  range?: number;
  statusEffect?: string;
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

export type GamePhase = 'setup' | 'hero' | 'exploration' | 'monster' | 'end' | 'victory' | 'defeat';

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
