import { useGameStore } from '../src/store/gameStore';
import { DataLoader } from '../src/game/dataLoader';
import { getAllPowerCards } from '../src/data/powerCardLoader';

const dataLoader = DataLoader.getInstance();
const allHeroes = dataLoader.getHeroes();
const allPowerCards = getAllPowerCards();

const store = useGameStore.getState();
const selectedScenarioId = 's1';
const selectedHeroIds = ['hero_arjhan', 'hero_immeril', 'hero_alissa', 'hero_kat'];

store.startNewGame(selectedScenarioId, selectedHeroIds);

selectedHeroIds.forEach(heroId => {
  const hero = allHeroes.find(h => h.id === heroId);
  if (!hero) return;

  const atWills = allPowerCards.filter(c => c.heroClass?.toLowerCase() === hero.heroClass.toLowerCase() && c.powerType === 'at-will');
  const dailies = allPowerCards.filter(c => c.heroClass?.toLowerCase() === hero.heroClass.toLowerCase() && c.powerType === 'daily');
  const utilities = allPowerCards.filter(c => c.heroClass?.toLowerCase() === hero.heroClass.toLowerCase() && c.powerType === 'utility');

  const powerIds = [atWills[0]?.id, atWills[1]?.id, dailies[0]?.id, utilities[0]?.id].filter(Boolean) as string[];

  powerIds.forEach(pId => {
    const card = allPowerCards.find(c => c.id === pId);
    if (card) store.selectPower(heroId, card);
  });
  store.confirmHeroSelection(heroId);
});

store.beginAdventure();

const gs = useGameStore.getState().gameState;
console.log('Phase:', gs?.phase);
console.log('Heroes:', gs?.heroes.length);
console.log('Heroes details:', gs?.heroes.map(h => ({ id: h.id, abilitiesCount: h.abilities.length, selectedPowers: h.selectedPowerIds })));
