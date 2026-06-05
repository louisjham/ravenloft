import React, { useMemo } from 'react';
import type { Card, GameState, Entity, Monster } from '../../game/types';

export interface LegalTarget {
  entityId: string;
  name: string;
  type: 'hero' | 'monster';
  reason: string;
}

function getLegalTargets(card: Card, state: GameState): LegalTarget[] {
  const currentHero = state.heroes.find(h => h.id === state.currentHeroId);
  if (!currentHero) return [];

  const targets: LegalTarget[] = [];
  const targetMode = card.target || 'single';
  const range = card.range ?? 1;

  // Helper: check if two positions are adjacent (within 1 tile Manhattan distance, same tile fine)
  const isAdjacent = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.z - b.z) <= 1;

  // Helper: check if two positions are within range tiles
  const isInRange = (a: { x: number; z: number }, b: { x: number; z: number }, r: number) =>
    Math.abs(a.x - b.x) + Math.abs(a.z - b.z) <= r;

  // Helper: check if on same tile
  const isSameTile = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    a.x === b.x && a.z === b.z;

  switch (targetMode) {
    case 'self':
      targets.push({
        entityId: currentHero.id,
        name: currentHero.name,
        type: 'hero',
        reason: 'Self-target'
      });
      break;

    case 'adjacent':
      for (const h of state.heroes) {
        if (h.id !== currentHero.id && isAdjacent(currentHero.position, h.position)) {
          targets.push({ entityId: h.id, name: h.name, type: 'hero', reason: 'Adjacent ally' });
        }
      }
      for (const m of state.monsters) {
        if (m.hp > 0 && !m.isDefeated && isAdjacent(currentHero.position, m.position)) {
          targets.push({ entityId: m.id, name: m.name, type: 'monster', reason: 'Adjacent enemy' });
        }
      }
      break;

    case 'adjacent-monster':
      for (const m of state.monsters) {
        if (m.hp > 0 && !m.isDefeated && isAdjacent(currentHero.position, m.position)) {
          targets.push({ entityId: m.id, name: m.name, type: 'monster', reason: 'Adjacent enemy' });
        }
      }
      break;

    case 'single':
      for (const m of state.monsters) {
        if (m.hp > 0 && !m.isDefeated && isInRange(currentHero.position, m.position, range)) {
          targets.push({ entityId: m.id, name: m.name, type: 'monster', reason: `In range (${range})` });
        }
      }
      for (const h of state.heroes) {
        if (h.id !== currentHero.id && isInRange(currentHero.position, h.position, range)) {
          targets.push({ entityId: h.id, name: h.name, type: 'hero', reason: `In range (${range})` });
        }
      }
      break;

    case 'area':
    case 'all-on-tile':
      for (const m of state.monsters) {
        if (m.hp > 0 && !m.isDefeated && isSameTile(currentHero.position, m.position)) {
          targets.push({ entityId: m.id, name: m.name, type: 'monster', reason: 'On same tile' });
        }
      }
      for (const h of state.heroes) {
        if (h.id !== currentHero.id && isSameTile(currentHero.position, h.position)) {
          targets.push({ entityId: h.id, name: h.name, type: 'hero', reason: 'On same tile' });
        }
      }
      break;

    case 'all_heroes':
      for (const h of state.heroes) {
        if (isInRange(currentHero.position, h.position, range)) {
          targets.push({ entityId: h.id, name: h.name, type: 'hero', reason: 'Ally in range' });
        }
      }
      break;

    case 'all_monsters':
      for (const m of state.monsters) {
        if (m.hp > 0 && !m.isDefeated && isInRange(currentHero.position, m.position, range)) {
          targets.push({ entityId: m.id, name: m.name, type: 'monster', reason: 'Enemy in range' });
        }
      }
      break;
  }

  return targets;
}

interface TargetSelectionProps {
  card: Card;
  gameState: GameState;
  onSelectTarget: (entityId: string) => void;
  onCancel: () => void;
}

export const TargetSelection: React.FC<TargetSelectionProps> = ({ card, gameState, onSelectTarget, onCancel }) => {
  const legalTargets = useMemo(() => getLegalTargets(card, gameState), [card, gameState]);

  const monsterTargets = legalTargets.filter(t => t.type === 'monster');
  const heroTargets = legalTargets.filter(t => t.type === 'hero');

  return (
    <div className="target-selection-overlay" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.4) 100%)',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 5
    }}>
      <div className="target-info gothic-panel" style={{
        marginTop: '150px',
        padding: '15px 30px',
        pointerEvents: 'auto',
        textAlign: 'center',
        minWidth: '320px',
      }}>
        <h3 className="gothic-title" style={{ margin: '0 0 8px 0' }}>Select Target for {card.name}</h3>

        {legalTargets.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: '#ff8888' }}>
            No valid targets available in range.
          </p>
        )}

        {monsterTargets.length > 0 && (
          <>
            <p style={{ fontSize: '0.75rem', color: '#ccc', margin: '4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Monsters ({monsterTargets.length})
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '8px' }}>
              {monsterTargets.map(t => (
                <button
                  key={t.entityId}
                  className="gothic-button"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.75rem',
                    border: '2px solid #cc4444',
                    background: 'rgba(200, 50, 50, 0.2)',
                    cursor: 'pointer',
                    minWidth: '100px',
                  }}
                  onClick={() => onSelectTarget(t.entityId)}
                  title={t.reason}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </>
        )}

        {heroTargets.length > 0 && (
          <>
            <p style={{ fontSize: '0.75rem', color: '#ccc', margin: '4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Heroes ({heroTargets.length})
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '8px' }}>
              {heroTargets.map(t => (
                <button
                  key={t.entityId}
                  className="gothic-button"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.75rem',
                    border: '2px solid #44cc44',
                    background: 'rgba(50, 200, 50, 0.2)',
                    cursor: 'pointer',
                    minWidth: '100px',
                  }}
                  onClick={() => onSelectTarget(t.entityId)}
                  title={t.reason}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          className="gothic-button"
          onClick={onCancel}
          style={{ marginTop: '10px', fontSize: '0.7rem' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
