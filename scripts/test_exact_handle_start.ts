import { useGameStore } from '../src/store/gameStore';
import { DataLoader } from '../src/game/dataLoader';
import { getAllPowerCards } from '../src/data/powerCardLoader';

const dataLoader = DataLoader.getInstance();
const allHeroes = dataLoader.getHeroes();
const allPowerCards = getAllPowerCards();

const store = useGameStore.getState();
const selectedScenarioId = 's1';
const selectedHeroIds = ['hero_arjhan', 'hero_immeril', 'hero_alissa', 'hero_kat'];

// Map default power choice from ScenarioSetupScreen.tsx
const getDefaultPowerChoice = (heroClass: string) => {
  const cls = heroClass.toLowerCase();
  const atWills = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'at-will');
  const dailies = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'daily');
  const utilities = allPowerCards.filter(c => c.heroClass?.toLowerCase() === cls && c.powerType === 'utility');

  const choice = {
    atWill1: atWills[0]?.id ?? '',
    atWill2: atWills[1]?.id ?? '',
    daily1: '',
    daily2: '',
    utility1: '',
    utility2: '',
  };

  if (cls === 'fighter') {
    choice.daily1 = 'fighter_dragons_breath';
    const selectableDailies = dailies.filter(c => c.id !== 'fighter_dragons_breath');
    choice.daily2 = selectableDailies[0]?.id ?? '';
    choice.utility1 = utilities[0]?.id ?? '';
  } else if (cls === 'cleric') {
    choice.daily1 = dailies[0]?.id ?? '';
    choice.utility1 = 'cleric_healing_word';
    const selectableUtilities = utilities.filter(c => c.id !== 'cleric_healing_word');
    choice.utility2 = selectableUtilities[0]?.id ?? '';
  } else if (cls === 'wizard') {
    choice.daily1 = dailies[0]?.id ?? '';
    choice.utility1 = 'wizard_fey_step';
    const selectableUtilities = utilities.filter(c => c.id !== 'wizard_fey_step');
    choice.utility2 = selectableUtilities[0]?.id ?? '';
  } else if (cls === 'rogue') {
    choice.daily1 = dailies[0]?.id ?? '';
    choice.utility1 = 'rogue_sneak_attack';
    const selectableUtilities = utilities.filter(c => c.id !== 'rogue_sneak_attack');
    choice.utility2 = selectableUtilities[0]?.id ?? '';
  } else {
    // ranger / default
    choice.daily1 = dailies[0]?.id ?? '';
    choice.utility1 = utilities[0]?.id ?? '';
  }

  return choice;
};

const heroChoices: Record<string, any> = {};
allHeroes.forEach(h => {
  heroChoices[h.id] = getDefaultPowerChoice(h.heroClass);
});

// Run handleStart
store.startNewGame(selectedScenarioId, selectedHeroIds);

selectedHeroIds.forEach(heroId => {
  const hero = allHeroes.find(h => h.id === heroId);
  if (!hero) return;

  const choice = heroChoices[heroId];
  if (!choice) return;

  const powerIds = [
    choice.atWill1,
    choice.atWill2,
    choice.daily1,
    choice.daily2,
    choice.utility1,
    choice.utility2,
  ].filter(Boolean);

  powerIds.forEach(powerId => {
    const card = allPowerCards.find(c => c.id === powerId);
    if (card) {
      store.selectPower(heroId, card);
    }
  });

  store.confirmHeroSelection(heroId);
});

store.beginAdventure();

const gs = useGameStore.getState().gameState;
console.log('Phase:', gs?.phase);
console.log('Heroes count:', gs?.heroes.length);
console.log('Selections confirmed:', gs?.powerSelections?.map(s => ({ heroId: s.heroId, confirmed: s.isConfirmed, count: s.selectedPowerIds.length })));
