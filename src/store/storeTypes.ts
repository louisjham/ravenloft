import { GameState, Entity, Tile, Card, GameSettings, Position, ConditionType, TokenSearchResult, GameToken } from '../game/types';

export interface CombatSlice {
  moveHero: (targetPosition: Position) => void;
  attackMonster: (monsterId: string) => void;
}

export interface CardSlice {
  playCard: (cardId: string, targetId: string) => void;
  drawEncounterCard: () => void;
  cancelEncounterCard: (cardId: string) => void;
  cancelEncounterWithDispelMagic: (cardId: string) => void;
  drawTreasureCard: () => void;
  useTreasureCard: (cardId: string, targetId?: string) => void;
  assignItem: (cardId: string, heroId: string) => void;
  advanceCardResolution: () => void;
  selectResolutionTarget: (entityId: string) => void;
  dismissCardResolution: () => void;
}

export interface PowerSlice {
  usePower: (cardId: string, targetId: string) => void;
  resetPower: (powerId: string) => void;
  getAvailablePowers: () => Card[];
  selectPower: (heroId: string, card: Card) => void;
  deselectPower: (heroId: string, cardId: string) => void;
  confirmHeroSelection: (heroId: string) => void;
  autoSelectPowers: (heroId: string) => void;
  beginAdventure: () => void;
}

export interface ConditionSlice {
  applyCondition: (targetId: string, type: ConditionType, sourceId?: string, duration?: number, value?: number) => void;
  removeCondition: (targetId: string, type: ConditionType) => void;
  decrementConditions: () => void;
}

export interface TokenSlice {
  initializeTokensForScenario: (scenarioId: string) => void;
  searchToken: (tokenId: string) => TokenSearchResult | null;
  getTokensOnTile: (tileId: string) => GameToken[];
  canSearchTokens: (heroId: string) => { canSearch: boolean; reason: string; tokens: GameToken[] };
  disableTrap: (trapId: string) => void;
}

export interface CoreSlice {
  gameState: GameState | null;
  selectedEntity: Entity | null;
  selectedCard: Card | null;
  hoveredTile: Tile | null;
  isPaused: boolean;
  settings: GameSettings;

  setGameState: (state: GameState) => void;
  startNewGame: (scenarioId: string, heroIds: string[]) => void;
  loadGame: (saveId: string) => void;
  saveGame: () => void;
  selectEntity: (entity: Entity | null) => void;
  selectCard: (card: Card | null) => void;
  hoverTile: (tile: Tile | null) => void;
  endTurn: () => void;
  levelUpHero: (heroId: string, newDailyPowerId?: string) => void;
  escapeHero: (heroId: string) => void;
  discardTreasureForPower: (heroId: string, treasureCardId?: string) => void;
  resolvePendingFortune: (choice: Record<string, unknown>) => Promise<void>;
  
  pauseGame: () => void;
  unpauseGame: () => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
}

export interface GameStore extends CoreSlice, CombatSlice, CardSlice, PowerSlice, ConditionSlice, TokenSlice {}
