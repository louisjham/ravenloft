import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { DataLoader } from '../../game/dataLoader';
import type { PendingFortune, Card, GameState, Hero, Monster, Tile } from '../../game/types';
import { getTileGraphDistance } from '../../game/engine/MonsterAI';

export const FortuneResolutionModal: React.FC = () => {
  const gameState = useGameStore((state: { gameState: GameState | null }) => state.gameState);
  const resolvePendingFortune = useGameStore((state: { resolvePendingFortune: (choice: any) => void }) => state.resolvePendingFortune);

  if (!gameState || !gameState.pendingFortune) return null;

  const pending = gameState.pendingFortune;
  const dataLoader = DataLoader.getInstance();
  const card = dataLoader.getCardById(pending.fortuneCardId) as Card | undefined;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="gothic-panel" style={{
        background: 'var(--color-bg)',
        border: '3px solid var(--color-gold)',
        padding: '30px',
        borderRadius: '8px',
        width: '600px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h2 style={{ color: 'var(--color-gold)', textAlign: 'center', marginTop: 0 }}>
          {card?.name ?? 'Fortune Resolution'}
        </h2>
        <p style={{ color: '#ccc', fontStyle: 'italic', textAlign: 'center', marginBottom: '20px' }}>
          {card?.description}
        </p>

        <ResolutionContent pending={pending} gameState={gameState} resolve={resolvePendingFortune} dataLoader={dataLoader} />
      </div>
    </div>
  );
};

const ResolutionContent: React.FC<{
  pending: PendingFortune;
  gameState: GameState;
  resolve: (choice: any) => void;
  dataLoader: DataLoader;
}> = ({ pending, gameState, resolve, dataLoader }) => {

  switch (pending.kind) {
    case 'deckSentinelChoice':
      return (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
          <button className="gothic-button" onClick={() => resolve({ kind: 'deckSentinelChoice', deck: 'encounter' })}>
            Protect Encounter Deck
          </button>
          <button className="gothic-button" onClick={() => resolve({ kind: 'deckSentinelChoice', deck: 'monster' })}>
            Protect Monster Deck
          </button>
        </div>
      );

    case 'treasureChoose':
      return (
        <div>
          <h3 style={{ color: '#fff', textAlign: 'center' }}>Choose one to keep:</h3>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {pending.drawn.map((id: string) => {
              const c = dataLoader.getCardById(id);
              if (!c) return null;
              return (
                <div key={id} onClick={() => resolve({ kind: 'treasureChoose', keptCardId: id, drawingHeroId: gameState.currentHeroId })}
                  style={{
                    border: '2px solid var(--color-accent)', padding: '10px', borderRadius: '4px',
                    cursor: 'pointer', width: '150px', textAlign: 'center'
                  }}>
                  <div style={{ color: 'var(--color-gold)', fontWeight: 'bold' }}>{c.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '10px' }}>{c.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'heroConditionPick':
      return (
        <div>
          <h3 style={{ color: '#fff', textAlign: 'center' }}>Choose a condition to remove:</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pending.heroIds.map((hId: string) => {
              const hero = gameState.heroes.find((h: Hero) => h.id === hId);
              if (!hero) return null;
              return hero.conditions.map((cond: { type: string }) => (
                <button key={`${hId}-${cond.type}`} className="gothic-button"
                  onClick={() => resolve({ kind: 'heroConditionPick', heroId: hId, conditionType: cond.type })}>
                  {hero.name} — Remove {cond.type}
                </button>
              ));
            })}
          </div>
        </div>
      );

    case 'monsterPick':
      return <MonsterPickContent pending={pending} gameState={gameState} resolve={resolve} />;

    case 'tileEdgePick':
      return (
        <div>
          <h3 style={{ color: '#fff', textAlign: 'center' }}>Choose an unexplored edge:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', maxHeight: '400px', overflowY: 'auto' }}>
            {pending.edges.map((e: { tileId: string; edge: string }) => (
              <button key={`${e.tileId}-${e.edge}`} className="gothic-button"
                onClick={() => resolve({ kind: 'tileEdgePick', tileId: e.tileId, edge: e.edge })}>
                {e.tileId} ({e.edge})
              </button>
            ))}
          </div>
        </div>
      );

    case 'deckReorder':
      return <DeckReorderContent pending={pending} resolve={resolve} dataLoader={dataLoader} />;

    case 'tileRelocatePick':
      return (
        <div>
          <h3 style={{ color: '#fff', textAlign: 'center' }}>Choose an adjacent tile to relocate to:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {(pending as any).eligibleTileIds.map((tileId: string) => {
              const t = gameState.tiles.find(tile => tile.id === tileId);
              return t ? (
                <button key={tileId} className="gothic-button"
                  onClick={() => resolve({ kind: 'tileRelocatePick', destinationTileId: tileId })}>
                  {t.name || tileId} ({t.x}, {t.z})
                </button>
              ) : null;
            })}
          </div>
        </div>
      );

    case 'atWillPowerPick':
      return (
        <div>
          <h3 style={{ color: '#fff', textAlign: 'center' }}>
            Choose an At-Will power for {gameState.heroes.find((h: Hero) => h.id === (pending as any).attackerHeroId)?.name} to attack:
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' }}>
            {(pending as any).eligiblePowerIds.map((powerId: string) => {
              const p = dataLoader.getCardById(powerId);
              if (!p) return null;
              return (
                <div key={powerId} onClick={() => resolve({ kind: 'atWillPowerPick', powerCardId: powerId })}
                  style={{
                    border: '2px solid var(--color-accent)', padding: '10px', borderRadius: '4px',
                    cursor: 'pointer', width: '150px', textAlign: 'center', background: '#222'
                  }}>
                  <div style={{ color: 'var(--color-gold)', fontWeight: 'bold' }}>{p.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '10px' }}>{p.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      );

    default:
      return <div style={{ color: 'red' }}>Unknown fortune kind: {(pending as any).kind}</div>;
  }
};

const MonsterPickContent: React.FC<{ pending: any; gameState: GameState; resolve: any }> = ({ pending, gameState, resolve }) => {
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);

  if (pending.purpose === 'daze') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {pending.eligible.map((id: string) => {
          const m = gameState.monsters.find((x: Monster) => x.id === id);
          return m ? (
            <button key={id} className="gothic-button" onClick={() => resolve({ kind: 'monsterPick', monsterId: id })}>
              Daze {m.name}
            </button>
          ) : null;
        })}
      </div>
    );
  }

  // Intimidating Bellow (move monster)
  if (!selectedMonsterId) {
    return (
      <div>
        <h3 style={{ color: '#fff', textAlign: 'center' }}>Step 1: Choose a monster to move</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pending.eligible.map((id: string) => {
            const m = gameState.monsters.find((x: Monster) => x.id === id);
            return m ? (
              <button key={id} className="gothic-button" onClick={() => setSelectedMonsterId(id)}>
                Move {m.name}
              </button>
            ) : null;
          })}
        </div>
      </div>
    );
  }

  // Step 2: Choose destination tile
  const monster = gameState.monsters.find((m: Monster) => m.id === selectedMonsterId);
  if (!monster) return null;
  const mTile = gameState.tiles.find((t: Tile) => t.x === monster.position.x && t.z === monster.position.z);
  
  const validTiles = gameState.tiles.filter((t: Tile) => {
    if (!mTile) return false;
    return getTileGraphDistance(mTile, t, gameState.tiles) >= 2;
  });

  return (
    <div>
      <h3 style={{ color: '#fff', textAlign: 'center' }}>Step 2: Choose destination for {monster.name}</h3>
      <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.9rem' }}>(Must be at least 2 tiles away)</p>
      {validTiles.length === 0 ? (
        <p style={{ color: 'red', textAlign: 'center' }}>No valid tiles available.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', maxHeight: '300px', overflowY: 'auto' }}>
          {validTiles.map((t: Tile) => (
            <button key={t.id} className="gothic-button"
              onClick={() => resolve({ kind: 'monsterPick', monsterId: selectedMonsterId, destinationTileId: t.id })}>
              {t.name} ({t.x}, {t.z})
            </button>
          ))}
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button className="gothic-button" onClick={() => setSelectedMonsterId(null)}>Back</button>
      </div>
    </div>
  );
};

const DeckReorderContent: React.FC<{ pending: any; resolve: any; dataLoader: DataLoader }> = ({ pending, resolve, dataLoader }) => {
  const [order, setOrder] = useState<string[]>(pending.topCards);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrder(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    setOrder(newOrder);
  };

  return (
    <div>
      <h3 style={{ color: '#fff', textAlign: 'center' }}>Reorder top {order.length} cards (Top to Bottom):</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {order.map((id, idx) => {
          const c = dataLoader.getCardById(id);
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#222', padding: '10px', borderRadius: '4px', border: '1px solid #444'
            }}>
              <div>
                <strong style={{ color: 'var(--color-gold)' }}>{idx + 1}. {c?.name ?? id}</strong>
                <div style={{ fontSize: '0.8rem', color: '#ccc' }}>{c?.description}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button disabled={idx === 0} onClick={() => moveUp(idx)}>↑</button>
                <button disabled={idx === order.length - 1} onClick={() => moveDown(idx)}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button className="gothic-button" onClick={() => resolve({ kind: 'deckReorder', newOrder: order })}>
          Confirm Order
        </button>
      </div>
    </div>
  );
};
