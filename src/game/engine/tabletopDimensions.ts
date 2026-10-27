import scenario1 from '../../data/scenarios/scenario1.json';
import scenario2 from '../../data/scenarios/scenario2.json';
import scenario3 from '../../data/scenarios/scenario3.json';
import scenario4 from '../../data/scenarios/scenario4.json';
import scenario5 from '../../data/scenarios/scenario5.json';
import adv01 from '../../data/scenarios/adventure_01.json';
import adv02 from '../../data/scenarios/adventure_02.json';
import adv03 from '../../data/scenarios/adventure_03.json';
import adv04 from '../../data/scenarios/adventure_04.json';
import adv05 from '../../data/scenarios/adventure_05.json';
import adv06 from '../../data/scenarios/adventure_06.json';
import adv07 from '../../data/scenarios/adventure_07.json';
import adv08 from '../../data/scenarios/adventure_08.json';
import adv09 from '../../data/scenarios/adventure_09.json';
import adv10 from '../../data/scenarios/adventure_10.json';
import adv11 from '../../data/scenarios/adventure_11.json';
import adv12 from '../../data/scenarios/adventure_12.json';
import adv13 from '../../data/scenarios/adventure_13.json';
import advTome from '../../data/scenarios/adventure_tome_of_strahd.json';

export interface ScenarioWithPiles {
  id?: string;
  name?: string;
  tilePiles?: {
    standard: number;
    special: string[];
  };
  specialTilePlacements?: Array<{ tileId: string; insertAfterIndex: number }>;
  setAsideTileIds?: string[];
  lairPacketSize?: number;
  lairCount?: number;
  startTileId?: string;
}

export const ALL_SCENARIOS: ScenarioWithPiles[] = [
  scenario1 as unknown as ScenarioWithPiles,
  scenario2 as unknown as ScenarioWithPiles,
  scenario3 as unknown as ScenarioWithPiles,
  scenario4 as unknown as ScenarioWithPiles,
  scenario5 as unknown as ScenarioWithPiles,
  adv01 as unknown as ScenarioWithPiles,
  adv02 as unknown as ScenarioWithPiles,
  adv03 as unknown as ScenarioWithPiles,
  adv04 as unknown as ScenarioWithPiles,
  adv05 as unknown as ScenarioWithPiles,
  adv06 as unknown as ScenarioWithPiles,
  adv07 as unknown as ScenarioWithPiles,
  adv08 as unknown as ScenarioWithPiles,
  adv09 as unknown as ScenarioWithPiles,
  adv10 as unknown as ScenarioWithPiles,
  adv11 as unknown as ScenarioWithPiles,
  adv12 as unknown as ScenarioWithPiles,
  adv13 as unknown as ScenarioWithPiles,
  advTome as unknown as ScenarioWithPiles,
];

/**
 * Totals the tile piles for a given scenario.
 * When `tilePiles` is specified, it totals the standard tiles plus the special tiles in the pile.
 */
export function getScenarioTilePileTotal(scenario: ScenarioWithPiles): number {
  if (scenario?.tilePiles) {
    const std = typeof scenario.tilePiles.standard === 'number' ? scenario.tilePiles.standard : 0;
    const spec = Array.isArray(scenario.tilePiles.special) ? scenario.tilePiles.special.length : 0;
    return std + spec;
  }
  return 0;
}

/**
 * Returns the largest tile pile total across all scenarios.
 */
export function getLargestScenarioTilePile(scenarios: ScenarioWithPiles[] = ALL_SCENARIOS): number {
  let max = 0;
  for (const s of scenarios) {
    const total = getScenarioTilePileTotal(s);
    if (total > max) {
      max = total;
    }
  }
  return max;
}

export interface TabletopDimensionsResult {
  largestPileTotal: number;
  rawSpanTiles: number;
  marginPerSide: number;
  calculatedTilesAcross: number;
  tilesAcross: number;
  tableSize: number;
  tileSize: number;
  tableThickness: number;
  floorPlaneSize: number;
}

/**
 * Derives tabletop dimensions directly from scenario data rather than arbitrary magic numbers.
 *
 * Algorithm:
 * 1. Find the largest scenario tile pile total (N) from src/data/scenarios/*.json.
 * 2. Calculate the bounding span for N tiles laid out in the worst realistic configuration
 *    (in a branching castle dungeon, roughly ceil(sqrt(N)) across).
 * 3. Add a 2-tile margin on every side (+2 tiles * 2 sides = +4 tiles).
 * 4. Apply the minimum floor rule: at least 12x12 tiles (48 units) even if the math says less.
 * 5. Return table dimension in Three.js world units (tileSize = 4).
 */
export function deriveTabletopDimensions(
  scenarios: ScenarioWithPiles[] = ALL_SCENARIOS,
  tileSize: number = 4,
  marginPerSide: number = 2,
  minTilesAcross: number = 12
): TabletopDimensionsResult {
  const largestPileTotal = getLargestScenarioTilePile(scenarios);

  // For N tiles laid in a realistic exploration cluster/layout, bounding dimension is ceil(sqrt(N)).
  const rawSpanTiles = Math.max(1, Math.ceil(Math.sqrt(largestPileTotal)));

  // 2-tile margin on every side (both +X/-X and +Z/-Z)
  const calculatedTilesAcross = rawSpanTiles + 2 * marginPerSide;

  // Enforce minimum 12x12 tiles (48 units)
  const tilesAcross = Math.max(calculatedTilesAcross, minTilesAcross);
  const tableSize = tilesAcross * tileSize;
  const tableThickness = 0.45;

  // Floor plane extends well beyond the table into the scene fog (fog: [22, 52]).
  // 240 units extends 120 units in each direction, fading out seamlessly.
  const floorPlaneSize = Math.max(tableSize * 3, 240);

  return {
    largestPileTotal,
    rawSpanTiles,
    marginPerSide,
    calculatedTilesAcross,
    tilesAcross,
    tableSize,
    tileSize,
    tableThickness,
    floorPlaneSize,
  };
}

export const TABLETOP_DIMENSIONS = deriveTabletopDimensions();
export const TABLE_SIZE = TABLETOP_DIMENSIONS.tableSize; // 48
export const TABLE_TILES_ACROSS = TABLETOP_DIMENSIONS.tilesAcross; // 12
export const TILE_SIZE = TABLETOP_DIMENSIONS.tileSize; // 4
export const TABLE_THICKNESS = TABLETOP_DIMENSIONS.tableThickness; // 0.45
export const FLOOR_PLANE_SIZE = TABLETOP_DIMENSIONS.floorPlaneSize; // 240
