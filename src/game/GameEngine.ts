import { GameState, Hero, Monster, Tile, Card, Position, GamePhase, GameLogEntry } from './types';
import { CardSystem } from './engine/CardSystem';
import { TileSystem } from './engine/TileSystem';
import { findClosestHero, manhattanDistance } from './engine/MonsterAI';
import { CombatSystem } from './engine/CombatSystem';
import { ActionResolver } from './engine/ActionResolver';
import { GAME_CONSTANTS } from './constants';

export class GameEngine {
  private state: GameState;
  private cardSystem: CardSystem;

  constructor(initialState: GameState) {
    this.state = initialState;
    this.cardSystem = new CardSystem({
      ability: initialState.dungeonDeck, // Placeholder mapping
      monster: initialState.dungeonDeck,
      encounter: initialState.encounterDeck,
      treasure: initialState.treasureDeck,
    });
  }

  public startGame(scenarioId: string, heroes: Hero[]): void {
    this.log(`Starting scenario: ${this.state.activeScenario.name}`, 'system');
    this.state.phase = 'hero';
    this.state.currentHeroId = heroes[0].id;
  }

  public processTurn(): void {
    switch (this.state.phase) {
      case 'hero':
        // Wait for player input
        break;
      case 'exploration':
        this.explorationPhase();
        break;
      case 'monster':
        this.monsterPhase();
        break;
    }
  }

  private explorationPhase(): void {
    const hero = this.getCurrentHero();
    if (!hero) return;

    const edges = TileSystem.getExplorationPoints(this.state.tiles);
    const heroTileEdge = edges.find(e => {
        const tile = this.state.tiles.find(t => t.id === e.tileId);
        return tile && tile.x === hero.position.x && tile.z === hero.position.z;
    });

    if (heroTileEdge) {
      this.log(`${hero.name} explores a new area!`, 'event');
      // Logic for drawing and placing tile would go here
      // For now, transition to monster phase
    }

    this.state.phase = 'monster';
  }

  private monsterPhase(): void {
    this.log("Monsters are moving...", 'event');
    
    this.state.monsters.forEach(monster => {
      const target = findClosestHero(monster.position as any, this.state.heroes, this.state.tiles);
      if (target) {
        if (manhattanDistance(monster.position.x, monster.position.z, target.hero.position.x, target.hero.position.z) <= 1) {
          const result = ActionResolver.resolveAttack(monster, target.hero);
          this.log(`Monster attacks ${target.hero.name}: ${result.hit ? 'HIT' : 'MISS'} (${result.roll})`, 'combat');
          if (result.hit) {
            CombatSystem.applyDamage(target.hero, result.damage);
          }
        } else {
          // Placeholder for movement
          this.log(`Monster moves toward ${target.hero.name}`, 'action');
        }
      }
    });

    // End of monster phase, back to hero
    this.nextHero();
  }

  private nextHero(): void {
    const currentIndex = this.state.turnOrder.indexOf(this.state.currentHeroId);
    const nextIndex = (currentIndex + 1) % this.state.turnOrder.length;
    this.state.currentHeroId = this.state.turnOrder[nextIndex];
    this.state.phase = 'hero';
    this.log(`It's now ${this.getCurrentHero()?.name}'s turn.`, 'system');
  }

  public rollDie(sides: number = 20): number {
    return Math.floor(Math.random() * sides) + 1;
  }

  public moveHero(heroId: string, to: Position): boolean {
    if (this.state.phase !== 'hero' || this.state.currentHeroId !== heroId) return false;

    if (ActionResolver.validateMove(this.state, heroId, to)) {
      const hero = this.state.heroes.find(h => h.id === heroId);
      if (hero) {
        hero.position = to;
        this.log(`${hero.name} moves to (${to.x}, ${to.z})`, 'action');
        return true;
      }
    }
    return false;
  }

  private log(message: string, type: GameLogEntry['type']): void {
    this.state.log.push({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      message,
      type
    });
  }

  public getCurrentHero(): Hero | undefined {
    return this.state.heroes.find(h => h.id === this.state.currentHeroId);
  }

  public getState(): GameState {
    return this.state;
  }
}
