import React from 'react';
import { useGameStore } from '../../store/gameStore';
import './CombatEncounterView.css';

export const CombatEncounterView: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);

  if (!gameState || !gameState.activeCombatEncounter) {
    return null;
  }

  const { activeCombatEncounter, heroes, monsters } = gameState;
  const { isActive, status, engagedHeroIds, engagedMonsterIds } = activeCombatEncounter;

  // Find the entities
  const engagedHeroes = engagedHeroIds.map(id => heroes.find(h => h.id === id)).filter(Boolean);
  const engagedMonsters = engagedMonsterIds.map(id => monsters.find(m => m.id === id)).filter(Boolean);

  const isOngoing = isActive && status === 'ongoing';
  const isResolved = !isActive && (status === 'victory' || status === 'defeat' || status === 'fled');

  // ── Slim non-blocking HUD for ongoing combat ──────────────────────────────
  // pointer-events: none on the HUD itself so clicks pass through to the board.
  if (isOngoing) {
    return (
      <div className="combat-encounter-hud" aria-live="polite">
        <span className="hud-label">⚔ Combat</span>
        <span className="hud-entities">
          {engagedHeroes.map(h => (
            <span key={h!.id} className="hud-hero-chip">
              {h!.name} <em>{h!.hp}/{h!.maxHp}</em>
            </span>
          ))}
          <span className="hud-vs">vs</span>
          {engagedMonsters.map(m => (
            <span key={m!.id} className="hud-monster-chip">
              {m!.name} <em>{m!.hp}/{m!.maxHp}</em>
            </span>
          ))}
        </span>
      </div>
    );
  }

  // ── Full panel only for resolved states ───────────────────────────────────
  if (!isResolved) return null;

  const clearEncounter = () => {
    useGameStore.setState(state => {
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          activeCombatEncounter: null
        }
      };
    });
  };

  return (
    <div className="combat-encounter-overlay resolving">
      <div className="combat-encounter-header">
        <h2 className="gothic-title">Encounter Phase</h2>
        {status === 'victory' && <div className="resolution-banner victory">Victory!</div>}
        {status === 'defeat'  && <div className="resolution-banner defeat">Defeat!</div>}
        {status === 'fled'    && <div className="resolution-banner fled">Retreat Successful</div>}
      </div>

      <div className="combat-encounter-arena">
        <div className="combat-side heroes-side">
          <h3 className="side-title">Heroes</h3>
          <div className="combatants-list">
            {engagedHeroes.map(h => (
              <div key={h!.id} className={`combatant-card ${h!.hp <= 0 ? 'defeated' : ''}`}>
                <div className="combatant-name">{h!.name}</div>
                <div className="combatant-stats">
                  <span>HP: {h!.hp}/{h!.maxHp}</span>
                  <span>AC: {h!.ac}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="combat-vs-divider">VS</div>

        <div className="combat-side monsters-side">
          <h3 className="side-title">Monsters</h3>
          <div className="combatants-list">
            {engagedMonsters.map(m => (
              <div key={m!.id} className={`combatant-card ${m!.hp <= 0 ? 'defeated' : ''}`}>
                <div className="combatant-name">{m!.name}</div>
                <div className="combatant-stats">
                  <span>HP: {m!.hp}/{m!.maxHp}</span>
                  <span>AC: {m!.ac}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="combat-encounter-footer">
        <button className="encounter-btn primary" onClick={clearEncounter}>
          Continue Exploration
        </button>
      </div>
    </div>
  );
};
