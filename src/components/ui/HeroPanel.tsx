import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import ConditionMarkers from './ConditionMarkers';
import { GameLogEntry } from '../../game/types';
import { ExperienceSystem } from '../../game/engine/ExperienceSystem';

export const HeroPanel: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  
  // Individual selectors for Condition logic
  const currentHeroId = useGameStore(s => s.gameState?.currentHeroId);
  const activeConditions = useGameStore(
    s => s.gameState?.activeConditions ?? []
  );

  const currentHero = gameState?.heroes?.find(h => h.id === currentHeroId);

  if (!currentHero) return null;

  const portraitMap: Record<string, string> = {
    'Arjhan': '/ui/arjhan.png',
    'Immeril': '/ui/immeril.png',
    'Kat': '/ui/kat.png',
    'Thorgrim': '/ui/thorgrim.png',
    'Alanni': '/ui/alanni.png',
  };

  const hpPercentage = (currentHero.hp / currentHero.maxHp) * 100;

  const handleHealingSurge = () => {
    if (!gameState || gameState.healingSurges <= 0 || currentHero.hp >= currentHero.maxHp) return;
    if (currentHero.hasUsedSurgeThisTurn) return;

    const surgeHeal = ExperienceSystem.getSurgeValue(currentHero);
    const newHp = Math.min(currentHero.maxHp, currentHero.hp + surgeHeal);
    const newState = {
      ...gameState,
      healingSurges: gameState.healingSurges - 1,
      heroes: gameState.heroes.map(h => 
        h.id === currentHero.id ? { ...h, hp: newHp, hasUsedSurgeThisTurn: true } : h
      )
    };

    useGameStore.getState().setGameState(newState);
  };

  const isTomeOfStrahd = gameState?.activeScenario?.id === 'adventure_tome_of_strahd';
  const canScout = isTomeOfStrahd && currentHero.xp >= 5;
  const hasPhylactery = currentHero.items?.includes('item_gravestorms_phylactery');

  const cryptTile = gameState?.tiles.find(t => t.id === 'crypt_barov_ravenovia');
  const onCryptTile = cryptTile && currentHero.position.x === cryptTile.x && currentHero.position.z === cryptTile.z;

  const handleEndGameTomeOfStrahd = () => {
    if (!gameState) return;
    const hasTome = gameState.heroes.some(h => h.items?.includes('item_tome_of_strahd'));
    if (hasTome) {
      useGameStore.getState().setGameState({ ...gameState, phase: 'victory' });
      useUIStore.getState().showModal('victory');
    } else {
      useGameStore.getState().setGameState({ ...gameState, phase: 'defeat' });
      useUIStore.getState().showModal('defeat');
    }
  };

  const handleUsePhylactery = () => {
    if (!gameState) return;
    const dragolich = gameState.monsters.find(m => (m.templateId === 'monster_dragolich' || m.name.toLowerCase().includes('gravestorm')) && m.hp > 0 && !m.isDefeated);
    if (!dragolich) {
      useGameStore.getState().setGameState({
        ...gameState,
        log: [...gameState.log, { 
          id: crypto.randomUUID(), 
          timestamp: new Date().toISOString(), 
          message: 'Gravestorm is not on the board!', 
          type: 'system'
        } as GameLogEntry].slice(-100)
      });
      return;
    }

    const newHp = Math.max(0, dragolich.hp - 10);
    const updatedDragolich = { ...dragolich, hp: newHp, isDefeated: newHp === 0 };
    
    const newMonsters = gameState.monsters.map(m => m.id === dragolich.id ? updatedDragolich : m);
    const newHeroes = gameState.heroes.map(h => h.id === currentHero.id ? { ...h, items: h.items.filter(i => i !== 'item_gravestorms_phylactery') } : h);

    useGameStore.getState().setGameState({
      ...gameState,
      monsters: newMonsters,
      heroes: newHeroes,
      log: [...gameState.log, { 
        id: crypto.randomUUID(), 
        timestamp: new Date().toISOString(), 
        message: `${currentHero.name} used Gravestorm's Phylactery to deal 10 damage to Gravestorm!`, 
        type: 'event'
      } as GameLogEntry].slice(-100)
    });
  };

  const handleScoutTile = () => {
    if (!gameState || currentHero.xp < 5 || gameState.dungeonDeck.length === 0) return;
    const topTile = gameState.dungeonDeck[0];
    if (topTile === 'crypt_barov_ravenovia') {
      useGameStore.getState().setGameState({
        ...gameState,
        log: [...gameState.log, { 
          id: crypto.randomUUID(), 
          timestamp: new Date().toISOString(), 
          message: 'Cannot scout the Crypt of Barov and Ravenovia!', 
          type: 'system'
        } as GameLogEntry].slice(-100)
      });
      return;
    }

    const newDeck = [...gameState.dungeonDeck.slice(1), topTile];
    const newHeroes = gameState.heroes.map(h => 
      h.id === currentHero.id ? { ...h, xp: h.xp - 5 } : h
    );
    useGameStore.getState().setGameState({
      ...gameState,
      dungeonDeck: newDeck,
      heroes: newHeroes,
      log: [...gameState.log, { 
        id: crypto.randomUUID(), 
        timestamp: new Date().toISOString(), 
        message: `${currentHero.name} spent 5 XP to scout and moved the top tile to the bottom.`, 
        type: 'action' 
      } as GameLogEntry].slice(-100)
    });
  };

  return (
    <div className="hero-panel gothic-panel" style={{ alignSelf: 'start', padding: '15px' }}>
      <div className="hero-header" style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
        <div className="hero-portrait-container" style={{ 
          width: '80px', 
          height: '80px', 
          border: '2px solid var(--color-gold)', 
          borderRadius: '50%', 
          overflow: 'hidden',
          background: '#1a1a1a'
        }}>
          <img
            src={portraitMap[currentHero.name] || '/ui/arjhan.png'}
            alt={currentHero.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          />
        </div>
        <div className="hero-info">
          <h2 className="gothic-title" style={{ margin: 0, fontSize: '1.2rem' }}>{currentHero.name}</h2>
          <div className="hero-class" style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>{currentHero.heroClass}</div>
          <div 
            className="hero-level" 
            style={{ 
              color: 'var(--color-gold)', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            LVL {currentHero.level} 
            <span style={{ color: '#444' }}>|</span>
            <button
              className="xp-button"
              style={{
                background: 'rgba(255, 215, 0, 0.1)',
                border: '1px solid var(--color-gold)',
                borderRadius: '4px',
                padding: '2px 8px',
                color: 'var(--color-gold)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'Cinzel, serif',
                transition: 'all 0.2s'
              }}
              onClick={() => useUIStore.getState().showModal('experience')}
            >
              XP {gameState?.experiencePile?.length || 0}
            </button>
          </div>
        </div>
      </div>

      <div className="hero-conditions" style={{ marginBottom: '15px' }}>
        <ConditionMarkers 
          entityId={currentHeroId ?? ''} 
          conditions={activeConditions} 
          size="small" 
        />
      </div>

      <div className="status-bars">
        <div className="hp-bar-container" style={{ position: 'relative', height: '40px', marginBottom: '10px' }}>
          <div className="hp-label" style={{ 
            position: 'absolute', 
            width: '100%', 
            textAlign: 'center', 
            zIndex: 1, 
            lineHeight: '40px', 
            fontSize: '0.9rem', 
            fontWeight: 'bold',
            textShadow: '0 0 4px black'
          }}>
            {currentHero.hp} / {currentHero.maxHp}
          </div>
          <div className="vial-bg" style={{ 
            position: 'absolute', 
            width: '100%', 
            height: '100%', 
            background: '#222', 
            borderRadius: '20px',
            border: '2px solid #444',
            overflow: 'hidden'
          }}>
            <div className="hp-fill" style={{ 
              width: `${hpPercentage}%`, 
              height: '100%', 
              background: 'linear-gradient(to right, #8b0000, #ff0000)',
              boxShadow: '0 0 10px #ff0000 inset',
              transition: 'width 0.3s ease-out'
            }} />
          </div>
          <img src="/ui/potion_vial.png" alt="vial" style={{ 
            position: 'absolute', 
            left: '-10px', 
            top: '-5px', 
            height: '50px', 
            opacity: 0.8,
            pointerEvents: 'none'
          }} />
        </div>
      </div>

      <div className="hero-surges" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>Healing Surges:</span>
        {[...Array(gameState?.healingSurges || 0)].map((_, i) => (
          <div key={i} className="surge-orb" style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            background: 'radial-gradient(circle, #00ff00, #004400)',
            boxShadow: '0 0 5px #00ff00'
          }} />
        ))}
        <button 
          onClick={handleHealingSurge}
          disabled={(gameState?.healingSurges || 0) <= 0 || currentHero.hp >= currentHero.maxHp || currentHero.hasUsedSurgeThisTurn}
          style={{
             marginLeft: 'auto',
             fontFamily: 'Cinzel, serif',
             fontSize: '0.7rem',
             padding: '2px 8px',
             background: 'rgba(0, 255, 0, 0.1)',
             border: '1px solid #00ff00',
             color: '#00ff00',
             borderRadius: '4px',
             cursor: ((gameState?.healingSurges || 0) <= 0 || currentHero.hp >= currentHero.maxHp || currentHero.hasUsedSurgeThisTurn) ? 'not-allowed' : 'pointer',
             opacity: ((gameState?.healingSurges || 0) <= 0 || currentHero.hp >= currentHero.maxHp || currentHero.hasUsedSurgeThisTurn) ? 0.5 : 1,
             transition: 'all 0.2s'
          }}
        >
          Use Surge
        </button>
      </div>

      {isTomeOfStrahd && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
          <button 
            onClick={handleScoutTile}
            disabled={!canScout}
            title="Spend 5 XP to place the top tile at the bottom of the deck."
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.8rem',
              padding: '4px 12px',
              background: canScout ? 'rgba(139, 0, 0, 0.2)' : 'rgba(100, 100, 100, 0.1)',
              border: `1px solid ${canScout ? 'var(--color-accent)' : '#444'}`,
              color: canScout ? 'var(--color-gold)' : '#666',
              borderRadius: '4px',
              cursor: canScout ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              width: '100%'
            }}
          >
            Scout Tile (5 XP)
          </button>
        </div>
      )}

      {hasPhylactery && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
          <button 
            onClick={handleUsePhylactery}
            title="Use an attack action to inflict 10 damage to Gravestorm."
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.8rem',
              padding: '4px 12px',
              background: 'rgba(0, 200, 255, 0.2)',
              border: '1px solid #0cf',
              color: '#0cf',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%'
            }}
          >
            Use Gravestorm's Phylactery
          </button>
        </div>
      )}

      {isTomeOfStrahd && onCryptTile && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
          <button 
            onClick={handleEndGameTomeOfStrahd}
            title="Use an attack action to end the game. If you have the Tome of Strahd, you win!"
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.8rem',
              padding: '4px 12px',
              background: 'rgba(255, 0, 0, 0.3)',
              border: '1px solid #ff0000',
              color: '#ffaaaa',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%',
              boxShadow: '0 0 10px #ff0000 inset'
            }}
          >
            End Game
          </button>
        </div>
      )}

      <div className="ability-minis">
        <h3 className="gothic-title" style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '5px' }}>Abilities</h3>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          {currentHero.abilities.map((abilityId) => (
            <div key={abilityId} className="ability-icon" title={abilityId} style={{ 
              width: '30px', 
              height: '40px', 
              background: 'var(--color-accent-alt)',
              border: '1px solid var(--color-gold)',
              borderRadius: '2px'
            }} />
          ))}
          {currentHero.abilities.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>No active abilities</span>}
        </div>
      </div>
    </div>
  );
};
