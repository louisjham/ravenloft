import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { DataLoader } from '../game/dataLoader';
import { ExperienceSystem } from '../game/engine/ExperienceSystem';

export function useCardResolution() {
  const gameState = useGameStore((state) => state.gameState);
  const cardResolution = useGameStore((state) => state.gameState?.cardResolution);
  const heroes = useGameStore((state) => state.gameState?.heroes || []);
  const advanceCardResolution = useGameStore((state) => state.advanceCardResolution);
  const selectResolutionTarget = useGameStore((state) => state.selectResolutionTarget);
  const dismissCardResolution = useGameStore((state) => state.dismissCardResolution);

  const allCards = useMemo(() =>
    DataLoader.getInstance().getAllCards(),
    []
  );

  const resolvedCard = useMemo(() => {
    if (!cardResolution?.cardId) return null;
    return DataLoader.getInstance().getCardById(cardResolution.cardId) ?? null;
  }, [cardResolution?.cardId]);

  const canCancelEncounter = gameState ? ExperienceSystem.canCancelEncounter(gameState) : false;

  return {
    cardResolution,
    resolvedCard,
    heroes,
    canCancelEncounter,
    allCards,
    advanceCardResolution,
    selectResolutionTarget,
    dismissCardResolution,
  };
}
