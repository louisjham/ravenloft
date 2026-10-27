import { GameState, GameLogEntry, LogEntryType, Card } from '../types';

export interface LogEntryOptions {
  message: string;
  type?: LogEntryType;
  turn?: number;
  heroId?: string;
  monsterId?: string;
  roll?: number;
  total?: number;
  targetAC?: number;
  isHit?: boolean;
  damage?: number;
}

/**
 * Creates a new GameLogEntry with a strictly sequential ID based on logIdCounter.
 * Follows the single log-id discipline: id = String(counter + 1), counter = counter + 1.
 */
export function createLogEntry(
  currentCounter: number,
  optionsOrMessage: LogEntryOptions | string,
  type?: LogEntryType
): { entry: GameLogEntry; nextCounter: number } {
  const nextCounter = (currentCounter ?? 0) + 1;
  const isString = typeof optionsOrMessage === 'string';
  const entry: GameLogEntry = {
    id: String(nextCounter),
    timestamp: new Date().toISOString(),
    message: isString ? optionsOrMessage : optionsOrMessage.message,
    type: isString ? (type ?? 'system') : (optionsOrMessage.type ?? type ?? 'system'),
    ...(isString ? {} : optionsOrMessage)
  };
  return { entry, nextCounter };
}

/**
 * Appends a log entry to GameState with a guaranteed fresh sequential ID.
 * Follows the single log-id discipline: id = String(counter + 1), logIdCounter = counter + 1.
 */
export function addLogEntry(
  state: GameState,
  optionsOrMessage: LogEntryOptions | string,
  type?: LogEntryType
): GameState {
  const currentCounter = state.logIdCounter ?? 0;
  const { entry, nextCounter } = createLogEntry(currentCounter, optionsOrMessage, type);

  return {
    ...state,
    log: [...(state.log ?? []), entry].slice(-300),
    logIdCounter: nextCounter
  };
}

/**
 * Appends multiple log entries sequentially to GameState.
 */
export function addLogEntries(
  state: GameState,
  entries: Array<LogEntryOptions | string>,
  defaultType?: LogEntryType
): GameState {
  let currentState = state;
  for (const item of entries) {
    currentState = addLogEntry(currentState, item, defaultType);
  }
  return currentState;
}

export interface EncounterOutcomeOptions {
  cancelledByXP?: boolean;
  cancelledByDispelMagic?: boolean;
  wizardName?: string;
  xpPenaltyDamage?: boolean;
  activeHeroName?: string;
  spawnedMonsterName?: string;
  tilePos?: { x: number; z: number };
  customOutcome?: string;
}

/**
 * Derives a human-readable outcome string for an encounter card.
 */
export function formatEncounterOutcome(
  card: Card,
  options?: EncounterOutcomeOptions
): string {
  if (options?.customOutcome) {
    return options.customOutcome;
  }

  if (options?.cancelledByXP) {
    if (options.xpPenaltyDamage) {
      return `Cancelled by spending 5 XP (${options.activeHeroName || 'Active Hero'} took 1 damage).`;
    }
    return 'Cancelled by spending 5 XP.';
  }

  if (options?.cancelledByDispelMagic) {
    return options.wizardName
      ? `Cancelled by ${options.wizardName} using Dispel Magic.`
      : 'Cancelled by Dispel Magic.';
  }

  if (card.encounterType === 'trap') {
    const posStr = options?.tilePos ? ` on tile (${options.tilePos.x}, ${options.tilePos.z})` : '';
    return `Placed ${card.name} trap${posStr} (Disable DC: ${card.disableDC ?? 10}).`;
  }

  if (card.encounterType === 'environment') {
    const cleanDesc = card.description
      ? card.description
          .replace(/^If there is an Environment card already in play, discard it\.\s*This Environment remains in play until a new Environment is drawn\.\s*/i, '')
          .trim()
      : '';
    return cleanDesc ? `Environment active: ${cleanDesc}` : `Environment ${card.name} is now active.`;
  }

  if (options?.spawnedMonsterName) {
    const posStr = options?.tilePos ? ` on tile (${options.tilePos.x}, ${options.tilePos.z})` : '';
    return `Spawned ${options.spawnedMonsterName}${posStr}. ${card.description || ''}`.trim();
  }

  return card.description || 'Effect resolved.';
}

/**
 * Builds the Chronicle message string for an encounter card:
 * [Card Title] "Full lore / flavor text" ➔ Outcome
 */
export function formatEncounterLogMessage(card: Card, outcome: string): string {
  const flavor = card.flavorText ? card.flavorText.trim() : '';
  if (flavor) {
    return `[${card.name}] "${flavor}" ➔ ${outcome}`;
  }
  return `[${card.name}] ➔ ${outcome}`;
}
