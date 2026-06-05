import React from 'react';
import { CardResolutionState, Card, Hero } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import './EncounterCardOverlay.css';

interface EncounterCardOverlayProps {
  resolution: CardResolutionState;
  card: Card | null;
  heroes: Hero[];
  /** Whether the party has >= 5 XP in the experience pile (computed by parent via ExperienceSystem). */
  canCancelEncounter: boolean;
  onAdvance: () => void;
  onSelectTarget: (entityId: string) => void;
  onDismiss: () => void;
}

const EncounterCardOverlay: React.FC<EncounterCardOverlayProps> = ({
  resolution,
  card,
  heroes,
  canCancelEncounter,
  onAdvance,
  onSelectTarget,
  onDismiss
}) => {
  // Only show when resolving an encounter
  if (resolution.phase === 'idle' || !card) return null;

  const needsTarget = resolution.phase === 'revealing' &&
    !resolution.targetEntityId &&
    (card.effects?.some(e => e.target === 'single') ?? false);

  const handleCancel = () => {
    if (card.id) {
      useGameStore.getState().cancelEncounterCard(card.id);
    }
  };

  // Determine button text based on encounter type
  let primaryButtonText = 'Resolve Event';
  if (card.encounterType === 'trap') primaryButtonText = 'Trigger Trap';
  if (card.encounterType === 'event-attack') primaryButtonText = 'Roll to Defend';
  if (card.encounterType === 'environment') primaryButtonText = 'Apply Environment';

  // During resolution phase, it might take multiple steps
  if (resolution.phase === 'resolving') {
    primaryButtonText = (resolution.pendingEffects ?? []).length === 0 ? 'Continue' : 'Apply Next Effect';
  }
  if (resolution.phase === 'complete') {
    primaryButtonText = 'Done';
  }

  // Fallback image if the specific token is missing
  const imageUrl = card.image || '/assets/tokens/Token_Encounter_Generic.png';

  return (
    <div className="encounter-overlay">
      <div className="encounter-panel">
        <h2 className="encounter-title">{card.name}</h2>
        <div className="encounter-type">{card.encounterType ? card.encounterType.replace('-', ' ') : 'Event'}</div>
        
        <div className="encounter-token-container">
          <img src={imageUrl} alt={card.name} className="encounter-token-img" onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/tokens/Token_Encounter_Generic.png';
          }} />
        </div>

        <div className="encounter-description">
          {card.description}
        </div>

        {needsTarget && (
          <div style={{ width: '100%', marginTop: '10px' }}>
            <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px', textAlign: 'center' }}>Select a target:</div>
            <div className="encounter-targets">
              {heroes.map(hero => (
                <button
                  key={hero.id}
                  className="encounter-target-btn"
                  onClick={() => onSelectTarget(hero.id)}
                >
                  {hero.heroClass}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="encounter-button-container">
          {resolution.phase === 'revealing' && (!needsTarget || resolution.targetEntityId) && (
            <>
              <button className="encounter-button-primary" onClick={onAdvance}>
                {primaryButtonText}
              </button>
              
              <button 
                className="encounter-button-secondary"
                disabled={!canCancelEncounter}
                title={!canCancelEncounter ? 'Need monster cards totaling 5 XP to cancel' : 'Spend 5 XP to cancel this encounter'}
                onClick={handleCancel}
              >
                Cancel Encounter (Spend 5 XP)
              </button>

              {heroes.some(h =>
                h.heroClass === 'wizard' &&
                (h.abilities.includes('wizard_dispel_magic') || h.hand.includes('wizard_dispel_magic')) &&
                !(h.flippedPowerIds ?? []).includes('wizard_dispel_magic')
              ) && (
                <button
                  className="encounter-button-secondary"
                  style={{ backgroundColor: '#4a3b8c', borderColor: '#6a5acd', marginTop: '10px' }}
                  onClick={() => {
                    if (card.id) {
                      useGameStore.getState().cancelEncounterWithDispelMagic(card.id);
                    }
                  }}
                >
                  Cancel Encounter (Use Dispel Magic)
                </button>
              )}
            </>
          )}

          {resolution.phase === 'resolving' && (
            <button className="encounter-button-primary" onClick={onAdvance}>
              {primaryButtonText}
            </button>
          )}

          {resolution.phase === 'complete' && (
            <button
              className="encounter-button-primary"
              style={{ backgroundColor: '#2d6a2d', borderColor: '#4caf50' }}
              onClick={onDismiss}
            >
              {primaryButtonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EncounterCardOverlay;
