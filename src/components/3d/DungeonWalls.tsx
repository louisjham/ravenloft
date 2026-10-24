import React, { Suspense } from 'react';
import { DungeonChamber } from './environment/DungeonChamber';

/**
 * DungeonWalls renders the atmospheric gothic dungeon chamber surrounding the playspace:
 * - High-detail perimeter stone walls, crossbeam ceiling arches, and stone pillars
 * - Skeletons chained in iron manacles against the stone pillars
 * - Animated wall torches with dynamic flickering flame light
 * - Heavy gothic bookshelves with spellbooks, glowing potion bottles, and skulls
 * - Medieval weapon racks with shields, broadswords, battleaxes, and halberds
 * - Worn stone flagstone flooring with subterranean green/crimson drain grates
 */
export const DungeonWalls: React.FC = () => {
  return (
    <Suspense fallback={null}>
      <DungeonChamber />
    </Suspense>
  );
};
