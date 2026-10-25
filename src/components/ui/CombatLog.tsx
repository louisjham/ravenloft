import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { MovablePanel } from './MovablePanel';
import { GameLogEntry } from '../../game/types';

type FilterCategory = 'all' | 'combat' | 'rooms' | 'spells' | 'villain';

export const CombatLog: React.FC = () => {
  const log = useGameStore((state) => state.gameState?.log || []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new log entries if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log, filter, search, autoScroll]);

  const getColor = (type: string) => {
    switch (type) {
      case 'combat': return '#ff5252';
      case 'action': return '#44ffaa';
      case 'event': return '#ffcc00';
      case 'system': return '#a0c4ff';
      case 'exploration': return '#00f0ff';
      case 'treasure': return '#ffd700';
      case 'damage': return '#ff6b6b';
      case 'heal': return '#69f0ae';
      case 'spell': return '#c77dff';
      case 'villain': return '#ff758f';
      default: return 'var(--color-text)';
    }
  };

  const getCategoryBadge = (entry: GameLogEntry) => {
    const msg = entry.message;
    if (msg.includes('CRITICAL HIT')) return { label: 'CRIT', bg: 'rgba(255, 0, 0, 0.35)', color: '#ff4444' };
    if (msg.includes('HITS') || msg.includes('HIT!')) return { label: 'HIT', bg: 'rgba(46, 204, 113, 0.25)', color: '#2ecc71' };
    if (msg.includes('MISSES') || msg.includes('MISS!')) return { label: 'MISS', bg: 'rgba(140, 140, 140, 0.25)', color: '#bbb' };
    if (msg.includes('explored') || entry.type === 'exploration') return { label: 'ROOM', bg: 'rgba(0, 200, 255, 0.25)', color: '#00e5ff' };
    if (msg.includes('bone square') || msg.includes('emerges') || msg.includes('summoned')) return { label: 'SPAWN', bg: 'rgba(230, 126, 34, 0.25)', color: '#ff922b' };
    if (msg.includes('is defeated!') || msg.includes('destroyed')) return { label: 'DEFEAT', bg: 'rgba(192, 57, 43, 0.35)', color: '#ff6b6b' };
    if (entry.type === 'spell' || msg.includes('Power Spent') || msg.includes('uses')) return { label: 'SPELL', bg: 'rgba(155, 89, 182, 0.25)', color: '#d0bfff' };
    if (entry.type === 'treasure' || msg.includes('Treasure')) return { label: 'LOOT', bg: 'rgba(241, 196, 15, 0.25)', color: '#ffd43b' };
    if (msg.includes('Villain Phase') || entry.type === 'villain') return { label: 'VILLAIN', bg: 'rgba(224, 49, 49, 0.25)', color: '#ff8787' };
    if (msg.includes('Encounter')) return { label: 'EVENT', bg: 'rgba(230, 126, 34, 0.25)', color: '#ffa94d' };
    if (entry.type === 'action') return { label: 'MOVE', bg: 'rgba(52, 152, 219, 0.2)', color: '#74c0fc' };
    return null;
  };

  const renderMessageWithDice = (message: string) => {
    if (message.includes('🎲')) {
      const parts = message.split(/(🎲[^➔\n]+➔?)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('🎲')) {
          return (
            <span
              key={idx}
              style={{
                display: 'inline-block',
                background: 'rgba(192, 160, 96, 0.15)',
                border: '1px solid rgba(192, 160, 96, 0.4)',
                borderRadius: '3px',
                padding: '0 4px',
                margin: '0 2px',
                color: '#ffd700',
                fontWeight: 'bold',
                fontSize: '0.62rem'
              }}
            >
              {part}
            </span>
          );
        }
        return part;
      });
    }
    return message;
  };

  const filteredLog = useMemo(() => {
    return log.filter((entry) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!entry.message.toLowerCase().includes(q)) return false;
      }
      if (filter === 'all') return true;
      if (filter === 'combat') {
        return entry.type === 'combat' || entry.type === 'damage' || entry.message.includes('attacks') || entry.message.includes('HITS') || entry.message.includes('MISSES') || entry.message.includes('deals') || entry.message.includes('defeated');
      }
      if (filter === 'rooms') {
        return entry.type === 'exploration' || entry.message.includes('explored') || entry.message.includes('bone square') || entry.message.includes('coffin') || entry.message.includes('room');
      }
      if (filter === 'spells') {
        return entry.type === 'spell' || entry.type === 'treasure' || entry.message.includes('uses') || entry.message.includes('Power Spent') || entry.message.includes('Treasure');
      }
      if (filter === 'villain') {
        return entry.type === 'villain' || entry.message.includes('Villain') || entry.message.includes('Encounter') || entry.message.includes('advances');
      }
      return true;
    });
  }, [log, filter, search]);

  const panelWidth = isExpanded ? 340 : 250;
  const logHeight = isExpanded ? '260px' : '155px';

  return (
    <MovablePanel
      id="combat-log"
      title="CHRONICLE"
      icon="📜"
      defaultCollapsed={false}
      width={panelWidth}
      headerExtra={
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-gold)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0 2px',
              opacity: 0.8
            }}
            title={isExpanded ? 'Standard view' : 'Enlarge chronicle'}
          >
            {isExpanded ? '⊡' : '⛶'}
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              background: 'transparent',
              border: 'none',
              color: autoScroll ? 'var(--color-gold)' : 'rgba(255,255,255,0.3)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              padding: '0 2px'
            }}
            title={autoScroll ? 'Autoscroll active' : 'Autoscroll paused (click to follow)'}
          >
            {autoScroll ? '⬇' : '⏸'}
          </button>
          <span style={{ fontSize: '0.6rem', color: 'rgba(192, 160, 96, 0.8)' }}>
            {filteredLog.length}/{log.length}
          </span>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Category Tabs */}
        <div style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '1px solid rgba(192, 160, 96, 0.25)',
          paddingBottom: '3px'
        }}>
          {(['all', 'combat', 'rooms', 'spells', 'villain'] as FilterCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                background: filter === cat ? 'rgba(192, 160, 96, 0.25)' : 'rgba(10, 10, 15, 0.4)',
                border: filter === cat ? '1px solid var(--color-gold)' : '1px solid rgba(192, 160, 96, 0.15)',
                color: filter === cat ? 'var(--color-gold)' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.58rem',
                padding: '2px 5px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontFamily: 'Cinzel, serif',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease'
              }}
            >
              {cat === 'all' && 'All'}
              {cat === 'combat' && '⚔️ Fight'}
              {cat === 'rooms' && '🏰 Rooms'}
              {cat === 'spells' && '✨ Magic'}
              {cat === 'villain' && '💀 Villain'}
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chronicle..."
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(192, 160, 96, 0.2)',
              borderRadius: '2px',
              padding: '2px 18px 2px 5px',
              fontSize: '0.6rem',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '4px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                fontSize: '0.65rem',
                padding: 0
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Log Entries Viewport */}
        <div
          ref={scrollRef}
          style={{
            height: logHeight,
            overflowY: 'auto',
            fontSize: '0.65rem',
            fontFamily: 'var(--font-body)',
            padding: '2px 4px',
            lineHeight: '1.35',
            background: 'rgba(5, 5, 8, 0.35)',
            borderRadius: '2px'
          }}
          className="custom-scrollbar"
        >
          {filteredLog.length === 0 ? (
            <div style={{
              color: 'rgba(255,255,255,0.3)',
              fontStyle: 'italic',
              textAlign: 'center',
              marginTop: '30px',
              fontSize: '0.62rem'
            }}>
              {search ? 'No chronicle entries match your search.' : 'Awaiting adventure...'}
            </div>
          ) : (
            filteredLog.map((entry) => {
              const isTurnDivider = entry.message.startsWith('── Turn');
              if (isTurnDivider) {
                return (
                  <div
                    key={entry.id}
                    style={{
                      textAlign: 'center',
                      fontFamily: 'Cinzel, serif',
                      color: 'var(--color-gold)',
                      fontSize: '0.62rem',
                      fontWeight: 'bold',
                      letterSpacing: '0.5px',
                      margin: '6px 0',
                      padding: '2px 0',
                      background: 'linear-gradient(90deg, transparent, rgba(192, 160, 96, 0.15), transparent)',
                      borderTop: '1px solid rgba(192, 160, 96, 0.25)',
                      borderBottom: '1px solid rgba(192, 160, 96, 0.25)'
                    }}
                  >
                    {entry.message}
                  </div>
                );
              }

              const badge = getCategoryBadge(entry);
              const color = getColor(entry.type);

              return (
                <div
                  key={entry.id}
                  style={{
                    marginBottom: '3px',
                    borderLeft: `2px solid ${color}`,
                    paddingLeft: '5px',
                    paddingRight: '2px',
                    color: color,
                    opacity: 0.95,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '4px',
                    flexWrap: 'wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {badge && (
                    <span
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        fontSize: '0.52rem',
                        fontWeight: 'bold',
                        padding: '1px 3px',
                        borderRadius: '2px',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}
                    >
                      {badge.label}
                    </span>
                  )}
                  <span style={{ flex: 1 }}>
                    {renderMessageWithDice(entry.message)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </MovablePanel>
  );
};
