import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

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
  const currentHeroName = useGameStore(s => {
    const gs = s.gameState;
    if (!gs) return '';
    const hero = gs.heroes.find(h => h.id === gs.currentHeroId);
    return hero?.name ?? '';
  });
  
  // Extract specific properties to minimize dependency updates
  const hasMovement = useGameStore(s => {
    if (!s.gameState) return false;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    return hero ? !hero.isExhausted : false;
  });
  
  const currentHeroSpeed = useGameStore(s => {
    if (!s.gameState) return 0;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    return hero ? hero.speed : 0;
  });

  const canAttack = useGameStore(s => {
    if (!s.gameState) return false;
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
    return hero ? !!hero.hand && hero.hand.length > 0 : false;
  });

  const hasExplorationPoints = useGameStore(s => {
    if (!s.gameState) return false;
    return s.gameState.tiles.some(tile => 
      tile.isRevealed && tile.connections.some(conn => conn.isOpen && !conn.connectedTileId)
    );
  });

  useEffect(() => {
    if (phase !== 'hero' || !currentHeroId) {
      clearDismissTimer();
      if (dismissing) setDismissing(false);
      setCurrentPrompt(null);
      return;
    }

    let newPrompt: { text: string; subtext?: string; type: 'action' | 'end-turn' | 'info'; autoDismiss?: boolean } | null = null;

    // If player is actively in an interaction mode, show mode-specific prompt
    if (interactionMode !== 'none') {
      switch (interactionMode) {
        case 'move':
          newPrompt = { text: 'MOVE', subtext: `${currentHeroSpeed} squares remaining`, type: 'action' };
          break;
        case 'attack':
          newPrompt = { text: 'ATTACK', subtext: 'Select a target', type: 'action' };
          break;
        case 'ability':
          newPrompt = { text: 'USE POWER', subtext: 'Select power and target', type: 'action' };
          break;
        case 'explore':
          newPrompt = { text: 'EXPLORE', subtext: 'Click an edge to place a tile', type: 'action' };
          break;
      }
    } else {
      // Check what actions are available
      if (hasMovement) {
        const heroName = currentHeroName.toUpperCase();
        newPrompt = {
          text: `${heroName}'S TURN`,
          subtext: `Move (${currentHeroSpeed}), Attack, Use Power, or Explore`,
          type: 'action',
          autoDismiss: true,
        };
      } else if (canAttack) {
        newPrompt = { text: 'ATTACK AVAILABLE', subtext: 'Attack nearby enemies or End Turn', type: 'action' };
      } else if (hasUsablePowers) {
        newPrompt = { text: 'POWERS AVAILABLE', subtext: 'Use a power or End Turn', type: 'action' };
      } else if (hasExplorationPoints) {
        newPrompt = { text: 'EXPLORE OR END TURN', subtext: 'Reveal new areas or end your turn', type: 'info' };
      } else {
        newPrompt = { text: 'END TURN', subtext: 'Press SPACE to continue', type: 'end-turn' };
      }
    }

    // Don't re-create the auto-dismiss prompt after it was already dismissed for this hero
    if (newPrompt?.autoDismiss && autoDismissedHero.current === currentHeroId) {
      setCurrentPrompt(null);
      return;
    }

    // Only update state if the prompt actually changed to prevent infinite loops
    setCurrentPrompt(prev => {
      if (!prev && !newPrompt) return prev;
      if (prev && newPrompt && prev.text === newPrompt.text && prev.subtext === newPrompt.subtext && prev.type === newPrompt.type) {
        return prev;
      }

      // If the prompt changed, reset the timer logic
      clearDismissTimer();
      setDismissing(false);

      if (newPrompt?.autoDismiss) {
        autoDismissedHero.current = currentHeroId;
        dismissTimer.current = setTimeout(() => {
          setDismissing(true);
          setTimeout(() => {
            setCurrentPrompt(null);
            setDismissing(false);
          }, 600);
        }, 2000);
      }

      return newPrompt;
    });

    return () => clearDismissTimer();
  }, [
    phase, 
    currentHeroId, 
    currentHeroName,
    interactionMode, 
    hasMovement, 
    currentHeroSpeed, 
    canAttack, 
    hasUsablePowers, 
    hasExplorationPoints
  ]);

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
          top: '50%',
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
            fontSize: isEndTurn ? '5rem' : '3.5rem',
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
              fontSize: '1.3rem',
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
