import { GameState, Hero } from '../types';

const SAVE_KEY = 'castle_ravenloft_saves';

export interface SaveSlot {
  id: string;
  timestamp: string;
  scenarioId: string;
  scenarioName: string;
  heroNames: string[];
  state: GameState;
}

export class SaveSystem {
  public static saveGame(gameState: GameState, slotId: string = 'auto') {
    const saves = this.getSaves();
    const newSave: SaveSlot = {
      id: slotId,
      timestamp: new Date().toISOString(),
      scenarioId: gameState.activeScenario.id,
      scenarioName: gameState.activeScenario.name,
      heroNames: gameState.heroes.map((h: Hero) => h.name),
      state: gameState
    };

    saves[slotId] = newSave;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }

  public static loadGame(slotId: string): GameState | null {
    const saves = this.getSaves();
    return saves[slotId]?.state || null;
  }

  public static getSaves(): Record<string, SaveSlot> {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  public static deleteSave(slotId: string) {
    const saves = this.getSaves();
    delete saves[slotId];
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }

  public static trackCompletion(scenarioId: string) {
    const key = `scenario_completed_${scenarioId}`;
    localStorage.setItem(key, 'true');
  }

  public static isCompleted(scenarioId: string): boolean {
    return localStorage.getItem(`scenario_completed_${scenarioId}`) === 'true';
  }
}
