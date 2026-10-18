import React, { useState } from 'react';
import { useXR, Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { DataLoader } from '../../game/dataLoader';
import { PhysicalCard3D } from './PhysicalCard3D';
import { playHapticProfile } from '../XRHaptics';
import type { Hero, Monster, Card } from '../../game/types';

interface DialogButtonProps {
  label: string;
  subtext?: string;
  position: [number, number, number];
  width?: number;
  height?: number;
  color?: string;
  onClick: () => void;
}

const DialogButton3D: React.FC<DialogButtonProps> = ({
  label,
  subtext,
  position,
  width = 0.28,
  height = 0.055,
  color = '#2d1c3a',
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e?: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    playHapticProfile('click');
    onClick();
  };

  const bgColor = hovered ? '#4a2574' : color;
  const borderColor = hovered ? '#f5dfa3' : '#c5a059';

  return (
    <Interactive
      onSelect={handleClick}
      onHover={() => {
        setHovered(true);
        playHapticProfile('hover');
      }}
      onBlur={() => setHovered(false)}
    >
      <group
        position={position}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          playHapticProfile('hover');
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleClick(e);
        }}
        scale={hovered ? 1.05 : 1.0}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, height, 0.015]} />
          <meshStandardMaterial color={bgColor} roughness={0.6} metalness={0.2} />
        </mesh>

        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[width - 0.008, height - 0.008, 0.002]} />
          <meshBasicMaterial color={borderColor} wireframe />
        </mesh>

        <Text
          position={[0, subtext ? 0.008 : 0, 0.012]}
          fontSize={0.016}
          color={hovered ? '#ffffff' : '#f5dfa3'}
          textAlign="center"
          maxWidth={width - 0.02}
        >
          {label}
        </Text>

        {subtext && (
          <Text
            position={[0, -0.012, 0.012]}
            fontSize={0.011}
            color="#a09080"
            textAlign="center"
            maxWidth={width - 0.02}
          >
            {subtext}
          </Text>
        )}
      </group>
    </Interactive>
  );
};

/**
 * SpatialFortuneDialog3D renders an in-world 3D modal for interactive Fortune card choices
 * in WebXR (e.g. choosing treasure cards, dazing monsters, curing conditions, or selecting decks).
 */
export const SpatialFortuneDialog3D: React.FC = () => {
  const { isPresenting } = useXR();
  const gameState = useGameStore((state) => state.gameState);
  const resolvePendingFortune = useGameStore((state) => state.resolvePendingFortune);

  const pending = gameState?.pendingFortune;

  if (!isPresenting || !gameState || !pending) {
    return null;
  }

  const dataLoader = DataLoader.getInstance();
  const card = dataLoader.getCardById(pending.fortuneCardId) as Card | undefined;
  const cardName = card?.name ?? 'Fortune Choice';

  const renderContent = () => {
    switch (pending.kind) {
      case 'deckSentinelChoice':
        return (
          <group position={[0, -0.06, 0.02]}>
            <Text position={[0, 0.06, 0]} fontSize={0.016} color="#d0c0b0" textAlign="center">
              Choose which deck to protect with Sentinel:
            </Text>
            <DialogButton3D
              label="Protect Encounter Deck"
              position={[-0.15, -0.01, 0]}
              width={0.24}
              color="#3a1e50"
              onClick={() => resolvePendingFortune({ kind: 'deckSentinelChoice', deck: 'encounter' })}
            />
            <DialogButton3D
              label="Protect Monster Deck"
              position={[0.15, -0.01, 0]}
              width={0.24}
              color="#4a1820"
              onClick={() => resolvePendingFortune({ kind: 'deckSentinelChoice', deck: 'monster' })}
            />
          </group>
        );

      case 'treasureChoose': {
        const drawnCards = pending.drawn
          .map((id) => dataLoader.getCardById(id))
          .filter((c): c is Card => c != null);

        return (
          <group position={[0, -0.03, 0.02]}>
            <Text position={[0, 0.16, 0]} fontSize={0.016} color="#f5dfa3" textAlign="center">
              Choose one Treasure card to keep:
            </Text>
            {drawnCards.map((c, idx) => {
              const xPos = drawnCards.length === 1 ? 0 : (idx === 0 ? -0.16 : 0.16);
              return (
                <group key={c.id} position={[xPos, 0.01, 0]}>
                  <PhysicalCard3D
                    card={c}
                    position={[0, 0, 0]}
                    scale={0.9}
                    isFlipped={false}
                  />
                  <DialogButton3D
                    label="KEEP THIS"
                    position={[0, -0.14, 0.02]}
                    width={0.16}
                    color="#1e4d2b"
                    onClick={() =>
                      resolvePendingFortune({
                        kind: 'treasureChoose',
                        keptCardId: c.id,
                        drawingHeroId: gameState.currentHeroId,
                      })
                    }
                  />
                </group>
              );
            })}
          </group>
        );
      }

      case 'heroConditionPick': {
        const options: { hero: Hero; conditionType: string }[] = [];
        pending.heroIds.forEach((hId) => {
          const hero = gameState.heroes.find((h) => h.id === hId);
          if (hero) {
            hero.conditions.forEach((cond) => {
              options.push({ hero, conditionType: cond.type });
            });
          }
        });

        return (
          <group position={[0, -0.04, 0.02]}>
            <Text position={[0, 0.08, 0]} fontSize={0.016} color="#d0c0b0" textAlign="center">
              Choose a Condition to Cure:
            </Text>
            {options.slice(0, 4).map((opt, i) => (
              <DialogButton3D
                key={`${opt.hero.id}-${opt.conditionType}`}
                label={`${opt.hero.name}: Cure ${opt.conditionType.toUpperCase()}`}
                position={[0, 0.02 - i * 0.06, 0]}
                width={0.34}
                color="#2a3a50"
                onClick={() =>
                  resolvePendingFortune({
                    kind: 'heroConditionPick',
                    heroId: opt.hero.id,
                    conditionType: opt.conditionType,
                  })
                }
              />
            ))}
          </group>
        );
      }

      case 'monsterPick': {
        const eligibleMonsters = pending.eligible
          .map((id) => gameState.monsters.find((m) => m.id === id))
          .filter((m): m is Monster => m != null);

        return (
          <group position={[0, -0.04, 0.02]}>
            <Text position={[0, 0.08, 0]} fontSize={0.016} color="#d0c0b0" textAlign="center">
              {pending.purpose === 'daze' ? 'Choose Monster to Daze:' : 'Choose Monster to Move:'}
            </Text>
            {eligibleMonsters.slice(0, 4).map((m, i) => (
              <DialogButton3D
                key={m.id}
                label={`${pending.purpose === 'daze' ? 'Daze' : 'Select'} ${m.name}`}
                position={[0, 0.02 - i * 0.06, 0]}
                width={0.32}
                color="#502020"
                onClick={() =>
                  resolvePendingFortune({
                    kind: 'monsterPick',
                    monsterId: m.id,
                  })
                }
              />
            ))}
          </group>
        );
      }

      case 'tileEdgePick': {
        return (
          <group position={[0, -0.04, 0.02]}>
            <Text position={[0, 0.08, 0]} fontSize={0.016} color="#d0c0b0" textAlign="center">
              Choose an Unexplored Tile Edge:
            </Text>
            {pending.edges.slice(0, 4).map((edge, i) => (
              <DialogButton3D
                key={`${edge.tileId}-${edge.edge}`}
                label={`${edge.tileId} (${edge.edge.toUpperCase()})`}
                position={[0, 0.02 - i * 0.06, 0]}
                width={0.32}
                color="#2d3a28"
                onClick={() =>
                  resolvePendingFortune({
                    kind: 'tileEdgePick',
                    tileId: edge.tileId,
                    edge: edge.edge,
                  })
                }
              />
            ))}
          </group>
        );
      }

      case 'tileRelocatePick': {
        const eligibleTiles = pending.eligibleTileIds
          .map((id) => gameState.tiles.find((t) => t.id === id))
          .filter((t) => t != null);

        return (
          <group position={[0, -0.04, 0.02]}>
            <Text position={[0, 0.08, 0]} fontSize={0.016} color="#d0c0b0" textAlign="center">
              Choose Destination Tile:
            </Text>
            {eligibleTiles.slice(0, 4).map((tile, i) => (
              <DialogButton3D
                key={tile.id}
                label={`${tile.name || tile.id}`}
                subtext={`Coordinates: (${tile.x}, ${tile.z})`}
                position={[0, 0.02 - i * 0.065, 0]}
                width={0.32}
                color="#203040"
                onClick={() =>
                  resolvePendingFortune({
                    kind: 'tileRelocatePick',
                    destinationTileId: tile.id,
                  })
                }
              />
            ))}
          </group>
        );
      }

      case 'atWillPowerPick': {
        const powers = pending.eligiblePowerIds
          .map((id) => dataLoader.getCardById(id))
          .filter((p): p is Card => p != null);

        return (
          <group position={[0, -0.04, 0.02]}>
            <Text position={[0, 0.08, 0]} fontSize={0.016} color="#d0c0b0" textAlign="center">
              Choose an At-Will Power:
            </Text>
            {powers.slice(0, 4).map((p, i) => (
              <DialogButton3D
                key={p.id}
                label={p.name}
                position={[0, 0.02 - i * 0.06, 0]}
                width={0.32}
                color="#302040"
                onClick={() =>
                  resolvePendingFortune({
                    kind: 'atWillPowerPick',
                    powerCardId: p.id,
                  })
                }
              />
            ))}
          </group>
        );
      }

      case 'deckReorder': {
        return (
          <group position={[0, -0.06, 0.02]}>
            <Text position={[0, 0.06, 0]} fontSize={0.016} color="#d0c0b0" textAlign="center">
              Deck Order (Glimpse of Future / Distant Sounds):
            </Text>
            <DialogButton3D
              label="Keep Top Order"
              position={[-0.14, -0.01, 0]}
              width={0.22}
              color="#2a3040"
              onClick={() =>
                resolvePendingFortune({
                  kind: 'deckReorder',
                  newOrder: pending.topCards,
                })
              }
            />
            <DialogButton3D
              label="Reverse Order"
              position={[0.14, -0.01, 0]}
              width={0.22}
              color="#402030"
              onClick={() =>
                resolvePendingFortune({
                  kind: 'deckReorder',
                  newOrder: [...pending.topCards].reverse(),
                })
              }
            />
          </group>
        );
      }

      default:
        return null;
    }
  };

  const isTreasureChoose = pending.kind === 'treasureChoose';
  const panelW = isTreasureChoose ? 0.65 : 0.52;
  const panelH = isTreasureChoose ? 0.44 : 0.36;

  return (
    <group position={[0, 0.28, 0]} rotation={[-Math.PI / 16, 0, 0]}>
      {/* 3D Slate Backdrop */}
      <mesh receiveShadow>
        <boxGeometry args={[panelW, panelH, 0.02]} />
        <meshStandardMaterial color="#120a1a" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Gold Trim Wireframe */}
      <mesh position={[0, 0, 0.011]}>
        <boxGeometry args={[panelW - 0.01, panelH - 0.01, 0.002]} />
        <meshBasicMaterial color="#c5a059" wireframe />
      </mesh>

      {/* Title */}
      <Text
        position={[0, panelH / 2 - 0.04, 0.015]}
        fontSize={0.022}
        color="#f5dfa3"
        textAlign="center"
        letterSpacing={0.05}
      >
        {cardName.toUpperCase()}
      </Text>

      {/* Dynamic Content by Fortune Kind */}
      {renderContent()}
    </group>
  );
};

export default SpatialFortuneDialog3D;
