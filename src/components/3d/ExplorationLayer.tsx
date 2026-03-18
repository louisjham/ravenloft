import React from 'react';
import { Tile, ExplorationPoint } from '../../game/types';
import { TileSystem } from '../../game/engine/TileSystem';
import { ExplorationArrow } from './ExplorationArrow';

interface ExplorationLayerProps {
  tiles: Tile[];
  onEdgeSelected: (point: ExplorationPoint) => void;
}

export const ExplorationLayer: React.FC<ExplorationLayerProps> = ({ tiles, onEdgeSelected }) => {
  const points = TileSystem.getExplorationPoints(tiles);

  return (
    <group name="exploration-layer">
      {points.map((point) => (
        <ExplorationArrow
          key={`${point.tileId}-${point.edge}`}
          point={point}
          onClick={onEdgeSelected}
          isHighlighted={false}
        />
      ))}
    </group>
  );
};
