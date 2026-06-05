import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { DataLoader } from '../game/dataLoader';

export function useTreasurePanel() {
  const [treasurePanelHeroId, setTreasurePanelHeroId] = useState<string | null>(null);
  const heroes = useGameStore((state) => state.gameState?.heroes || []);
  const treasureAssignments = useGameStore(s => s.gameState?.treasureAssignments || []);
  const turnCount = useGameStore(s => s.gameState?.turnCount || 0);
  const useTreasureCard = useGameStore(s => s.useTreasureCard);

  const allCards = useMemo(() =>
    DataLoader.getInstance().getAllCards(),
    []
  );

  const treasurePanelHero = useMemo(() =>
    heroes.find(h => h.id === treasurePanelHeroId) ?? null,
    [heroes, treasurePanelHeroId]
  );

  const handleOpenTreasure = (heroId: string) => setTreasurePanelHeroId(heroId);
  const handleCloseTreasure = () => setTreasurePanelHeroId(null);

  return {
    treasurePanelHero,
    treasureAssignments,
    turnCount,
    allCards,
    handleOpenTreasure,
    handleCloseTreasure,
    useTreasureCard,
  };
}
