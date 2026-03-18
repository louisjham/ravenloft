import { GameState } from '../types';

export class EventSystem {
  /**
   * Evaluates if any scenario events should trigger based on state change.
   */
  public static checkTriggers(oldState: GameState, newState: GameState) {
    const scenario = newState.activeScenario;
    if (!scenario.specialRules) return [];

    const triggeredEvents = [];

    for (const rule of scenario.specialRules) {
      if (rule.trigger.type === 'turn_count' && newState.turnCount === rule.trigger.value) {
        triggeredEvents.push(rule);
      }
      
      if (rule.trigger.type === 'tile_reveal' && newState.tiles.length > oldState.tiles.length) {
        triggeredEvents.push(rule);
      }
    }

    return triggeredEvents;
  }
}
