import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { animationQueue } from '../utils/animationQueue'
import { Position, Entity } from '../game/types'

export const useGameActions = () => {
  const { 
    gameState, 
    moveHero: storeMoveHero,
    attackMonster: storeAttackMonster,
    endTurn: storeEndTurn,
    selectEntity: storeSelectEntity
  } = useGameStore();

  const { addNotification } = useUIStore();

  const handleMoveHero = async (targetPosition: Position) => {
    if (!gameState) return;

    // 2. Queue Animation
    await animationQueue.enqueue('HeroMove', async () => {
      // This is where we would trigger the 3D animation
      // For now, we simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // 3. Update State
    storeMoveHero(targetPosition);
    addNotification('Hero moved successfully', 'success');
  };

  const handleAttackMonster = async (monsterId: string) => {
    if (!gameState) return;

    const monster = gameState.monsters.find(m => m.id === monsterId);
    if (!monster) return;

    await animationQueue.enqueue('HeroAttack', async () => {
      console.log('Playing attack animation on:', monsterId);
      await new Promise(resolve => setTimeout(resolve, 800));
    });

    storeAttackMonster(monsterId);
    addNotification(`Attacked ${monster.name}!`, 'info');
  };

  const handleEndTurn = () => {
    storeEndTurn();
    addNotification('End of turn', 'info');
  };

  const handleSelectEntity = (entity: Entity | null) => {
    storeSelectEntity(entity);
  };

  return {
    handleMoveHero,
    handleAttackMonster,
    handleEndTurn,
    handleSelectEntity,
  };
}
