import React from 'react';
import { Hero, TreasureAssignment, Card } from '../../game/types';
import CardFace from './cards/CardFace';

interface TreasureCardPanelProps {
  hero: Hero;
  assignments: TreasureAssignment[];
  allCards: Card[];
  currentTurn: number;
  onUseTreasure: (cardId: string, heroId: string) => void;
  onClose: () => void;
}

const TreasureCardPanel: React.FC<TreasureCardPanelProps> = ({
  hero,
  assignments,
  allCards,
  currentTurn,
  onUseTreasure,
  onClose
}) => {
  const heroAssignments = assignments.filter(a => a.heroId === hero.id);
  const heroCards = heroAssignments.map(a => {
    const card = allCards.find(c => c.id === a.cardId);
    return card ? { card, assignment: a } : null;
  }).filter((item): item is { card: Card; assignment: TreasureAssignment } => item !== null);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '85vh',
    background: 'rgba(26, 26, 26, 0.95)',
    border: '1px solid #c0a060',
    borderRadius: '8px',
    boxShadow: '0 0 30px rgba(0,0,0,0.8), inset 0 0 50px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1100,
    fontFamily: 'Cinzel, serif',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    background: 'linear-gradient(to bottom, #3a3a3a, #1a1a1a)',
    borderBottom: '1px solid #444',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#f0d080',
  };

  const gridStyle: React.CSSProperties = {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '24px',
    justifyContent: 'center',
  };

  const cardContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  };

  const footerStyle: React.CSSProperties = {
    padding: '12px 20px',
    background: '#111',
    borderTop: '1px solid #333',
    fontSize: '13px',
    color: '#888',
    textAlign: 'center',
  };

  const statusLabelStyle = (isUsed: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: isUsed ? 'rgba(100, 100, 100, 0.2)' : 'rgba(240, 208, 128, 0.1)',
    color: isUsed ? '#666' : '#f0d080',
    border: `1px solid ${isUsed ? '#444' : '#c0a060'}`,
    textTransform: 'uppercase',
  });

  const useButtonStyle: React.CSSProperties = {
    padding: '8px 24px',
    backgroundColor: '#8b1a1a',
    color: '#fff',
    border: '1px solid #5a1111',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'Cinzel, serif',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: '1',
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
          {hero.heroClass} Treasures
        </div>
        <button style={closeButtonStyle} onClick={onClose}>×</button>
      </header>

      <div style={gridStyle}>
        {heroCards.length > 0 ? (
          heroCards.map(({ card, assignment }) => (
            <div key={card.id} style={cardContainerStyle}>
              <CardFace
                card={card}
                isFaceDown={false}
                isAnimating={false}
                size="compact"
              />
              {assignment.isUsed ? (
                <div style={statusLabelStyle(true)}>Used</div>
              ) : (card.treasureType === 'blessing' || card.treasureType === 'fortune') ? (
                <button 
                  style={useButtonStyle} 
                  onClick={() => onUseTreasure(card.id, hero.id)}
                >
                  Use Item
                </button>
              ) : card.treasureType === 'item' ? (
                card.effects.some(e => e.type === 'passive') ? (
                  <div style={statusLabelStyle(false)}>Equipped</div>
                ) : (
                  <button 
                    style={useButtonStyle} 
                    onClick={() => onUseTreasure(card.id, hero.id)}
                  >
                    Use Item
                  </button>
                )
              ) : (
                <div style={statusLabelStyle(false)}>Equipped</div>
              )}
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px 0', color: '#666' }}>
            No treasure cards yet.
          </div>
        )}
      </div>

      <footer style={footerStyle}>
        {heroCards.length} card(s) captured
      </footer>
    </div>
  );
};

export default TreasureCardPanel;
