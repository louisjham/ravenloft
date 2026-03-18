/**
 * Core game constants matching the 2010 Castle Ravenloft board game rules.
 */

export const GAME_CONSTANTS = {
  // HP & Surges
  MAX_HEALING_SURGES: 3,
  TOTAL_SURGE_HEAL_HP: 1, // Restores to 1 HP if Surge is used at 0
  
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
  PHASES: ['hero', 'exploration', 'monster'] as const,
};

export type GamePhaseType = typeof GAME_CONSTANTS.PHASES[number];
