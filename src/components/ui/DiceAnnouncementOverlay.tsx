import React, { useEffect, useState } from 'react';
import { useDiceStore } from '../../store/diceStore';
import './DiceAnnouncementOverlay.css';

export const DiceAnnouncementOverlay: React.FC = () => {
  const phase = useDiceStore(s => s.phase);
  const announcementText = useDiceStore(s => s.announcementText);
  const rollerName = useDiceStore(s => s.rollerName);
  const targetName = useDiceStore(s => s.targetName);
  const result = useDiceStore(s => s.result);
  const attackBonus = useDiceStore(s => s.attackBonus);
  const targetAC = useDiceStore(s => s.targetAC);
  const isHit = useDiceStore(s => s.isHit);
  const isCritical = useDiceStore(s => s.isCritical);
  const damage = useDiceStore(s => s.damage);
  const rollType = useDiceStore(s => s.rollType);
  const isAutoRoll = useDiceStore(s => s.isAutoRoll);

  // Track screen shake
  const [shaking, setShaking] = useState(false);
  
  useEffect(() => {
    if (phase === 'showing_result' && isCritical) {
      setShaking(true);
      const timer = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, isCritical]);

  if (phase === 'idle') return null;

  const isActive = true;
  const showAnnouncement = phase === 'announcing' || phase === 'waiting_for_roll' || phase === 'rolling' || phase === 'settling';
  const showPrompt = phase === 'waiting_for_roll' && !isAutoRoll;
  const showResult = phase === 'showing_result';
  const showContinue = phase === 'showing_result';

  // Build result breakdown text
  let breakdownText = '';
  let verdictText = '';
  let verdictClass = '';
  
  if (showResult && result !== null) {
    if (targetAC !== null) {
      const total = result + attackBonus;
      const bonusStr = attackBonus >= 0 ? `+ ${attackBonus}` : `- ${Math.abs(attackBonus)}`;
      breakdownText = `${result} ${bonusStr} = ${total} vs AC ${targetAC}`;
      
      if (isCritical) {
        verdictText = '⚡ NATURAL 20 ⚡';
        verdictClass = 'critical';
      } else if (isHit) {
        verdictText = 'HIT!';
        verdictClass = 'hit';
      } else {
        verdictText = 'MISS';
        verdictClass = 'miss';
      }
    } else {
      // Non-attack roll (trap disable, ability check)
      breakdownText = `Rolled: ${result}`;
      if (rollType === 'trap_disable') {
        verdictText = isHit ? '🔓 DISABLED!' : '🔒 FAILED';
        verdictClass = isHit ? 'hit' : 'miss';
      }
    }
  }

  const resultNumberClass = isCritical ? 'critical' : (isHit === false ? 'miss' : '');

  return (
    <div className={`dice-overlay ${isActive ? 'active' : ''} ${shaking ? 'screen-shake' : ''}`}>
      <div className="dice-backdrop" />
      
      {showAnnouncement && (
        <div className={`dice-announcement visible`}>
          <h2>{announcementText}</h2>
          {targetName && (
            <div className="dice-subtitle">
              {rollerName} ⚔️ {targetName}
            </div>
          )}
        </div>
      )}

      {showPrompt && (
        <div className="dice-prompt">
          <span>⚄ Press SPACE to Roll ⚄</span>
        </div>
      )}

      {showResult && result !== null && (
        <div className="dice-result">
          <div className={`dice-result-number ${resultNumberClass}`}>
            {isCritical ? '🎯 ' : ''}{result}{isCritical ? ' 🎯' : ''}
          </div>
          {breakdownText && (
            <div className="dice-result-breakdown">{breakdownText}</div>
          )}
          {verdictText && (
            <div className={`dice-result-verdict ${verdictClass}`}>{verdictText}</div>
          )}
          {isHit && damage !== null && damage > 0 && (
            <div className="dice-damage">💀 {damage} damage dealt</div>
          )}
        </div>
      )}

      {showContinue && (
        <div className="dice-continue">
          <span>Press SPACE to continue</span>
        </div>
      )}
    </div>
  );
};
