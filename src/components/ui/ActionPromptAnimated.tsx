import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { TileSystem } from '../../game/engine/TileSystem';

/**
 * ActionPromptAnimated - Dynamic, animated text prompts that guide the player
 * through their turn based on available actions. Uses fire/magical effects.
 */
export const ActionPromptAnimated: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const interactionMode = useUIStore((state) => state.interactionMode);
  const [currentPrompt, setCurrentPrompt] = useState<{
    text: string;
    subtext?: string;
    type: 'action' | 'end-turn' | 'info';
    autoDismiss?: boolean;
  } | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissedHero = useRef<string | null>(null);

  // Clear any pending dismiss timer
  const clearDismissTimer = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };

  // Use selectors for specific state pieces to prevent re-renders when unrelated game state changes
  const phase = useGameStore(s => s.gameState?.phase);
  const currentHeroId = useGameStore(s => s.gameState?.currentHeroId);
  const currentHero = useGameStore((state) => {
    if (!state.gameState) return null;
    const hero = state.gameState.heroes.find(h => h.id === state.gameState!.currentHeroId);

    // If hero is missing, return null instead of triggering errors
    if (!hero && state.gameState.currentHeroId) {
      if (import.meta.env.DEV) {
        console.warn(`Hero ${state.gameState.currentHeroId} not found during lookup.`);
      }
      return null;
    }
    return hero ?? null;
  });

  const currentHeroName = currentHero?.name ?? '';
  const currentHeroSpeed = currentHero?.speed ?? 0;

  const hasMovement = useGameStore(s => {
    if (!s.gameState) return false;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    return hero ? (!hero.isExhausted || !s.gameState.hasAttackedThisTurn) : false;
  });

  const canAttack = useGameStore(s => {
    if (!s.gameState) return false;
    if (s.gameState.hasAttackedThisTurn) return false;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    if (!hero) return false;
    // Rule check: Any monster on the same tile (simplified for now as 'can attack')
    const monstersOnTile = s.gameState.monsters.filter(m => 
      m.position.x === hero.position.x && 
      m.position.z === hero.position.z &&
      !m.isDefeated
    );
    return monstersOnTile.length > 0;
  });

  const hasUsablePowers = useGameStore(s => {
    if (!s.gameState) return false;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    if (!hero) return false;
    return (hero.abilities?.length || 0) > 0 || (hero.selectedPowerIds?.length || 0) > 0;
  });

  const hasExplorationPoints = useGameStore(s => {
    if (!s.gameState) return false;
    return s.gameState.tiles.some(tile => 
      tile.isRevealed && tile.connections.some(conn => conn.isOpen && !conn.connectedTileId)
    );
  });

  const isAdjacentToExplorationPoint = useGameStore(s => {
    if (!s.gameState || s.gameState.phase !== 'hero') return false;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    if (!hero) return false;
    const heroPos = hero.position;
    const heroTile = s.gameState.tiles.find(t => t.x === heroPos.x && t.z === heroPos.z);
    if (!heroTile) return false;
    
    const points = TileSystem.getExplorationPoints(s.gameState.tiles);
    const isHeroAtEdgeFor = (edge: string): boolean => {
      switch (edge) {
        case 'north': return heroPos.sqZ === 0;
        case 'south': return heroPos.sqZ === 3;
        case 'east':  return heroPos.sqX === 3;
        case 'west':  return heroPos.sqX === 0;
        default:      return false;
      }
    };
    return points.some(p => p.tileId === heroTile.id && isHeroAtEdgeFor(p.edge));
  });

  const hasAttacked = useGameStore(s => s.gameState?.hasAttackedThisTurn ?? false);
  const heroMovedOnce = useGameStore(s => {
    const hero = s.gameState?.heroes.find(h => h.id === s.gameState?.currentHeroId);
    return hero ? hero.isExhausted : false;
  });

  useEffect(() => {
    if (phase === 'villain') {
      clearDismissTimer();
      setDismissing(false);
      setCurrentPrompt({
        text: 'VILLAIN PHASE',
        subtext: 'Monsters and traps are activating...',
        type: 'action'
      });
      return;
    }

    if (phase !== 'hero' || !currentHeroId || !currentHero) {
      clearDismissTimer();
      if (dismissing) setDismissing(false);
      setCurrentPrompt(null);
      return;
    }

    if (gameState?.pendingAITurnApproval) {
      clearDismissTimer();
      if (dismissing) setDismissing(false);
      setCurrentPrompt({
        text: 'AI TURN COMPLETED',
        subtext: `Approve ${gameState.pendingAITurnApproval.heroName}'s turn to proceed [Space or Click Approve]`,
        type: 'end-turn',
        autoDismiss: false,
      });
      return;
    }

    // If player is actively in an interaction mode, let the top guidance banner handle it
    if (interactionMode !== 'none') {
      clearDismissTimer();
      if (dismissing) setDismissing(false);
      setCurrentPrompt(null);
      return;
    }

    // Turn start hero splash
    if (autoDismissedHero.current !== currentHeroId) {
      if (!currentHeroName) return;
      const heroName = currentHeroName.toUpperCase();
      setCurrentPrompt({
        text: `${heroName}'S TURN`,
        subtext: `Speed: ${currentHeroSpeed} squares • Choose an action`,
        type: 'action',
        autoDismiss: true,
      });

      clearDismissTimer();
      setDismissing(false);
      dismissTimer.current = setTimeout(() => {
        setDismissing(true);
        setTimeout(() => {
          autoDismissedHero.current = currentHeroId;
          setDismissing(false);
        }, 300);
      }, 1500);

      return () => clearDismissTimer();
    }

    // Persistent state guidance (never blank)
    let promptText = 'HERO PHASE';
    let promptSubtext = 'Drag Hero to Move • Attack [A] • Power [C] • End Turn [Space]';
    let promptType: 'action' | 'end-turn' | 'info' = 'info';

    if (heroMovedOnce && !hasAttacked) {
      promptText = 'STANDARD ACTION';
      promptSubtext = 'Attack [A] • Power [C] • Drag for Double Move • End Turn [Space]';
    } else if (hasAttacked && !heroMovedOnce) {
      promptText = 'MOVE ACTION';
      promptSubtext = `Drag Hero to Move (${currentHeroSpeed} sq) • Power [C] • End Turn [Space]`;
    } else if (hasAttacked && heroMovedOnce) {
      promptText = 'TURN COMPLETE';
      promptSubtext = 'Press [Space] to End Turn';
      promptType = 'end-turn';
    }

    if (isAdjacentToExplorationPoint && !gameState?.hasExploredThisTurn && promptType !== 'end-turn') {
      promptSubtext += ' • Edge Unexplored [E]';
    }

    const newPrompt = {
      text: promptText,
      subtext: promptSubtext,
      type: promptType
    };

    setCurrentPrompt(prev => {
      if (prev && prev.text === newPrompt.text && prev.subtext === newPrompt.subtext && prev.type === newPrompt.type) {
        return prev;
      }
      return newPrompt;
    });

    return () => clearDismissTimer();
  }, [
    phase, 
    currentHeroId, 
    currentHero,
    currentHeroName,
    interactionMode, 
    hasMovement, 
    currentHeroSpeed, 
    canAttack, 
    hasUsablePowers, 
    hasExplorationPoints, 
    isAdjacentToExplorationPoint,
    gameState?.hasExploredThisTurn,
    hasAttacked,
    heroMovedOnce
  ]);

  if (phase === 'hero' && !currentHero) return null;
  if (!currentPrompt) return null;

  const isEndTurn = currentPrompt.type === 'end-turn';
  const isAction = currentPrompt.type === 'action';

  return (
    <>
      <style>{`
        @keyframes fireStrobe {
          0%, 100% { 
            text-shadow: 
              0 0 10px #ff4500,
              0 0 20px #ff6347,
              0 0 30px #ff0000,
              0 0 40px #8b0000;
          }
          25% { 
            text-shadow: 
              0 0 20px #ff6347,
              0 0 30px #ff4500,
              0 0 40px #ff8c00,
              0 0 50px #ffa500;
          }
          50% { 
            text-shadow: 
              0 0 15px #ff0000,
              0 0 25px #ff4500,
              0 0 35px #ff6347,
              0 0 45px #8b0000;
          }
          75% { 
            text-shadow: 
              0 0 25px #ffa500,
              0 0 35px #ff8c00,
              0 0 45px #ff6347,
              0 0 55px #ff4500;
          }
        }

        @keyframes magicGlow {
          0%, 100% { 
            text-shadow: 
              0 0 10px #00ffff,
              0 0 20px #00ccff,
              0 0 30px #0099ff,
              0 0 40px #0066ff;
          }
          50% { 
            text-shadow: 
              0 0 20px #00ffff,
              0 0 30px #00ddff,
              0 0 40px #00bbff,
              0 0 50px #0099ff;
          }
        }

        @keyframes scaleUp {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999,
          pointerEvents: 'none',
          textAlign: 'center',
          animation: dismissing
            ? 'fadeOut 0.6s ease-out forwards'
            : isEndTurn
              ? 'scaleUp 0.5s ease-out, pulse 2s ease-in-out infinite 0.5s'
              : 'scaleUp 0.3s ease-out',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-gothic)',
            fontSize: isEndTurn ? '2.6rem' : '2.0rem',
            fontWeight: 'bold',
            letterSpacing: '0.3rem',
            textTransform: 'uppercase',
            color: '#fff',
            animation: isEndTurn 
              ? 'fireStrobe 0.15s infinite' 
              : isAction 
                ? 'magicGlow 2s ease-in-out infinite'
                : 'none',
            textShadow: isEndTurn
              ? '0 0 20px #ff4500, 0 0 40px #ff6347, 0 0 60px #ff0000'
              : isAction
                ? '0 0 20px #00ffff, 0 0 40px #00ccff'
                : '0 0 10px #c0a060',
            marginBottom: '10px',
          }}
        >
          {currentPrompt.text}
        </div>
        
        {currentPrompt.subtext && (
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.0rem',
              color: isEndTurn ? '#ffb347' : '#e0e0e0',
              textShadow: isEndTurn 
                ? '0 0 10px rgba(255, 179, 71, 0.8)' 
                : '0 0 5px rgba(192, 160, 96, 0.5)',
              animation: isEndTurn ? 'magicGlow 1.5s ease-in-out infinite' : 'none',
            }}
          >
            {currentPrompt.subtext}
          </div>
        )}
      </div>
    </>
  );
};

// Made with Bob
