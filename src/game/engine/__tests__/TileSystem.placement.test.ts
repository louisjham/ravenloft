// @ts-ignore
import { describe, it, expect } from 'vitest';
import { getEffectiveOpenEdges, isPlacementValid } from '../TileSystem';
import { EdgeDirection } from '../../types';

function makeBoard(...entries: Array<{ x: number; y: number; openEdges: EdgeDirection[]; rotation: number }>) {
  const board = new Map<string, { openEdges: EdgeDirection[]; rotation: number }>();
  for (const entry of entries) {
    board.set(`${entry.x},${entry.y}`, { openEdges: entry.openEdges, rotation: entry.rotation });
  }
  return board;
}

describe('getEffectiveOpenEdges', () => {
  it('returns original array for rotation 0', () => {
    const result = getEffectiveOpenEdges(['north', 'south'], 0);
    expect(result).toEqual(['north', 'south']);
  });

  it('rotates edges 90 degrees', () => {
    const result = getEffectiveOpenEdges(['north', 'south'], 90);
    expect(result).toEqual(['east', 'west']);
  });

  it('rotates edges 180 degrees', () => {
    const result = getEffectiveOpenEdges(['north', 'south'], 180);
    expect(result).toEqual(['south', 'north']);
  });

  it('rotates 3-way intersection 90 degrees', () => {
    const result = getEffectiveOpenEdges(['north', 'south', 'east'], 90);
    expect(result).toEqual(['east', 'west', 'south']);
  });
});

describe('isPlacementValid', () => {
  it('rejects occupied position', () => {
    const board = makeBoard({ x: 0, y: 1, openEdges: ['north', 'south'], rotation: 0 });
    const result = isPlacementValid(['north', 'south'], 0, 0, 1, board);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('A tile already exists here.');
  });

  it('rejects isolated placement', () => {
    const board = makeBoard({ x: 0, y: 0, openEdges: ['north', 'south'], rotation: 0 });
    const result = isPlacementValid(['north', 'south'], 0, 5, 5, board);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Tile must be placed adjacent to an existing tile.');
  });

  it('accepts matching N-S corridor', () => {
    const board = makeBoard({ x: 0, y: 0, openEdges: ['north', 'south'], rotation: 0 });
    const result = isPlacementValid(['north', 'south'], 0, 0, 1, board);
    expect(result.valid).toBe(true);
  });

  it('rejects mismatched edges', () => {
    const board = makeBoard({ x: 0, y: 0, openEdges: ['north', 'south'], rotation: 0 });
    const result = isPlacementValid(['east', 'west'], 0, 0, 1, board);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Edge mismatch');
  });

  it('validates multi-neighbor placement', () => {
    // Arranged neighbors around (1,1):
    // (1,0) to the North -> has its South edge open
    // (0,1) to the West  -> has its East edge open
    const board = makeBoard(
      { x: 1, y: 0, openEdges: ['south', 'east'], rotation: 0 },
      { x: 0, y: 1, openEdges: ['east', 'south'], rotation: 0 }
    );
    // Candidate at (1,1) with North and West open perfectly matches BOTH neighbors
    const resultValid = isPlacementValid(['north', 'west'], 0, 1, 1, board);
    expect(resultValid.valid).toBe(true);

    const resultInvalid = isPlacementValid(['north'], 0, 1, 1, board); 
    expect(resultInvalid.valid).toBe(false);
    expect(resultInvalid.reason).toContain('Edge mismatch');
  });

  it('accepts x4 crossroads next to anything open', () => {
    const board = makeBoard({ x: 0, y: 0, openEdges: ['north', 'south'], rotation: 0 });
    const result = isPlacementValid(['north', 'south', 'east', 'west'], 0, 0, 1, board);
    expect(result.valid).toBe(true);
  });
});
