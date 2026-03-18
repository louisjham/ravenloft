import { GameState, Scenario } from '../types';
import { ObjectiveTracker } from './Objectives';

export class ScenarioManager {
  private static instance: ScenarioManager;

  public static getInstance(): ScenarioManager {
    if (!this.instance) {
      this.instance = new ScenarioManager();
    }
    return this.instance;
  }

  public loadScenario(scenarioData: any): GameState {
    // This would be called to initialize a new game state from scenario JSON
    return {} as GameState; // Actual implementation would populate the state
  }

  public checkVictory(gameState: GameState): boolean {
    const objectives = ObjectiveTracker.checkObjectives(gameState);
    return objectives.every(obj => obj.isCompleted);
  }

  public checkDefeat(gameState: GameState): boolean {
    // Basic defeat: all heroes dead or no surges left
    const allHeroesDead = gameState.heroes.every(h => h.hp <= 0);
    return allHeroesDead && gameState.healingSurges <= 0;
  }

  public triggerEvent(gameState: GameState, eventId: string): GameState {
    console.log(`Triggering event: ${eventId}`);
    // Handle special scenario events
    return gameState;
  }
}
