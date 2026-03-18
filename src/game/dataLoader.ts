import { Hero, Monster, Tile, Card, Scenario } from './types';

// Import JSON data directly (Vite supports this)
import heroesData from '../data/heroes.json';
import monstersData from '../data/monsters.json';
import tilesData from '../data/tiles.json';
import scenariosData from '../data/scenarios.json';
import encountersData from '../data/cards/encounters.json';
import treasureData from '../data/cards/treasures.json';
import arjhanAbilities from '../data/cards/hero-abilities/arjhan.json';
import scenario1 from '../data/scenarios/scenario1.json';
import scenario2 from '../data/scenarios/scenario2.json';
import scenario3 from '../data/scenarios/scenario3.json';
import scenario4 from '../data/scenarios/scenario4.json';
import scenario5 from '../data/scenarios/scenario5.json';

export class DataLoader {
  private static instance: DataLoader;

  private heroes: Hero[] = heroesData as Hero[];
  private monsters: Monster[] = monstersData as Monster[];
  private tiles: Tile[] = tilesData as Tile[];
  private scenarios: Scenario[] = [
    scenario1 as any,
    scenario2 as any,
    scenario3 as any,
    scenario4 as any,
    scenario5 as any
  ];
  private cards: Card[] = [
    ...(encountersData as Card[]),
    ...(treasureData as Card[]),
    ...(arjhanAbilities as Card[])
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

  public getTiles(): Tile[] {
    return this.tiles;
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
