import { Hero, Monster, Tile, Card, Scenario } from './types';

// Import JSON data directly (Vite supports this)
import heroesData from '../data/heroes.json';
import monstersData from '../data/monsters.json';
import tilesData from '../data/tiles.json';
import encountersData from '../data/cards/encounters.json';
import treasureData from '../data/cards/treasures.json';
import arjhanAbilities from '../data/cards/hero-abilities/arjhan.json';
import thorgrimAbilities from '../data/cards/hero-abilities/thorgrim.json';
import immerilAbilities from '../data/cards/hero-abilities/immeril.json';
import katAbilities from '../data/cards/hero-abilities/kat.json';
import alanniAbilities from '../data/cards/hero-abilities/alanni.json';
import powerCardsData from '../data/powerCards.json';
import scenario1 from '../data/scenarios/scenario1.json';
import scenario2 from '../data/scenarios/scenario2.json';
import scenario3 from '../data/scenarios/scenario3.json';
import scenario4 from '../data/scenarios/scenario4.json';
import scenario5 from '../data/scenarios/scenario5.json';
import adventure01 from '../data/scenarios/adventure_01.json';
import adventure02 from '../data/scenarios/adventure_02.json';
import adventure03 from '../data/scenarios/adventure_03.json';
import adventure04 from '../data/scenarios/adventure_04.json';
import adventure05 from '../data/scenarios/adventure_05.json';
import adventure06 from '../data/scenarios/adventure_06.json';
import adventure07 from '../data/scenarios/adventure_07.json';
import adventure08 from '../data/scenarios/adventure_08.json';
import adventure09 from '../data/scenarios/adventure_09.json';
import adventure10 from '../data/scenarios/adventure_10.json';
import adventure11 from '../data/scenarios/adventure_11.json';
import adventure12 from '../data/scenarios/adventure_12.json';
import adventure13 from '../data/scenarios/adventure_13.json';

export class DataLoader {
  private static instance: DataLoader;

  private heroes: Hero[] = (heroesData as unknown as Hero[]).map(h => ({
    ...h,
    attackBonus: 0,
  }));
  private monsters: Monster[] = (monstersData as any[]).map(m => ({
    ...m,
    ownedByHeroId: null,
    conditions: [],
    usedPowers: []
  }));
  private tiles: Tile[] = tilesData as Tile[];
  private scenarios: Scenario[] = [
    adventure01 as unknown as Scenario,
    adventure02 as unknown as Scenario,
    adventure03 as unknown as Scenario,
    adventure04 as unknown as Scenario,
    adventure05 as unknown as Scenario,
    adventure06 as unknown as Scenario,
    adventure07 as unknown as Scenario,
    adventure08 as unknown as Scenario,
    adventure09 as unknown as Scenario,
    adventure10 as unknown as Scenario,
    adventure11 as unknown as Scenario,
    adventure12 as unknown as Scenario,
    adventure13 as unknown as Scenario,
    scenario1 as unknown as Scenario,
    scenario2 as unknown as Scenario,
    scenario3 as unknown as Scenario,
    scenario4 as unknown as Scenario,
    scenario5 as unknown as Scenario
  ];
  private cards: Card[] = [
    ...(encountersData as Card[]),
    ...(treasureData as Card[]),
    ...(arjhanAbilities as Card[]),
    ...(thorgrimAbilities as Card[]),
    ...(immerilAbilities as Card[]),
    ...(katAbilities as Card[]),
    ...(alanniAbilities as Card[]),
    ...(powerCardsData as Card[])
  ];

  private constructor() { }

  public static getInstance(): DataLoader {
    if (!DataLoader.instance) {
      DataLoader.instance = new DataLoader();
    }
    return DataLoader.instance;
  }

  public getHeroes(): Hero[] {
    return this.heroes;
  }

  public getHeroById(id: string): Hero | undefined {
    return this.heroes.find(h => h.id === id);
  }

  public getMonsters(): Monster[] {
    return this.monsters;
  }

  public getMonsterById(id: string): Monster | undefined {
    return this.monsters.find(m => m.id === id);
  }

  public getTiles(): Tile[] {
    return this.tiles;
  }

  public getTileById(id: string): Tile | undefined {
    return this.tiles.find(t => t.id === id);
  }

  public getScenarios(): Scenario[] {
    return this.scenarios;
  }

  public getCardById(id: string): Card | undefined {
    return this.cards.find(c => c.id === id);
  }

  public getAllCards(): Card[] {
    return this.cards;
  }

  public validateData(): boolean {
    // Basic validation logic
    const heroIds = this.heroes.map(h => h.id);
    const tileIds = this.tiles.map(t => t.id);

    // Check if every hero has abilities that exist
    for (const hero of this.heroes) {
      for (const abilityId of hero.abilities) {
        if (!this.getCardById(abilityId)) {
          console.error(`Validation Error: Hero ${hero.id} has missing ability ${abilityId}`);
          return false;
        }
      }
    }

    console.log("Game data validated successfully.");
    return true;
  }
}
