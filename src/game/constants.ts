/**
 * Core game constants matching the 2010 Castle Ravenloft board game rules.
 */

export const GAME_CONSTANTS = {
  // HP & Surges
  MAX_HEALING_SURGES: 2, // Base rules default; each scenario can override via maxSurges
  
  // Combat
  D20_SIDES: 20,
  CRITICAL_HIT_ROLL: 20,
  
  // Movement & Grid
  TILE_SIZE_SQUARES: 4, // 4x4 squares per tile
  START_TILE_ID: 'start-tile',
  
  // Leveling
  XP_COST_UPGRADE_ABILITY: 5,
  XP_COST_LEVEL_UP: 5,
  MAX_LEVEL: 2,
  
  // Phases
  PHASES: ['setup', 'hero', 'exploration', 'villain', 'monster', 'end', 'victory', 'defeat'] as const,

  // Spacing & Math
  HALF_TILE_OFFSET: 2.0,

  // Encounters
  DEFAULT_TRAP_ATTACK_BONUS: 7,
  SPAWN_SQ_X: 2,
  SPAWN_SQ_Z: 2,

  // Treasure deck — base types plus Chromatic Dragons expansion types
  TREASURE_CARD_TYPES: ['treasure', 'item', 'consumable', 'weapon', 'summon'] as const,
};

export type GamePhaseType = typeof GAME_CONSTANTS.PHASES[number];
