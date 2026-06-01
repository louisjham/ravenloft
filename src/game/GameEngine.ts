/**
 * @deprecated This class is unused. The actual game flow runs via Zustand store
 * (src/store/gameStore.ts) which correctly scopes monster activation by ownership
 * via buildVillainQueue()/executeVillainPhase(). See AGENTS.md for the correct
 * state management patterns.
 *
 * Key problems with this file:
 * - monsterPhase() iterates all monsters globally instead of per-owner
 * - Uses raw manhattanDistance instead of getTileGraphDistance for tile-range
 * - Mutates state directly instead of returning new GameState objects
 * - processTurn() switch doesn't handle 'villain' → 'monster' transition
 *   (the store does this correctly via executeVillainPhase)
 *
 * To remove: delete this file, update tsconfig.json exclude list, remove
 * the import in store/gameStore.ts if present (currently not imported).
 */
export {}
